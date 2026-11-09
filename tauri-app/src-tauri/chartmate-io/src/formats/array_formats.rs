//! Array-oriented formats (HDF5, netCDF, MATLAB): datasets/variables are turned into table
//! columns when they share the same length.
//!
//! Rules (documented in the user guide):
//! * size-1 dimensions are ignored, so `1×N`, `N×1` and `N` all become one column;
//! * a 2-D array `N×K` (or `K×N`) with `K <= MAX_WIDE_COLUMNS` becomes `K` columns `name_1..name_K`;
//! * the table length `N` is the length shared by the most columns; variables of other lengths,
//!   scalars and arrays with more than two non-trivial dimensions are skipped and listed in the notes;
//! * time variables are converted to ISO timestamps from CF `units` attributes
//!   (`hours since 2026-01-01`) or, for MATLAB, from `datenum` values.

use super::{cf_time_to_strings, looks_like_time_name, unix_secs_to_iso, Col, Table};
use std::collections::BTreeMap;

pub const MAX_WIDE_COLUMNS: usize = 64;

/// One array read from a file, in row-major (C) order.
pub struct Arr {
    pub name: String,
    pub shape: Vec<usize>,
    pub data: Col,
    pub units: Option<String>,
}

pub fn arrays_to_table(arrs: Vec<Arr>, kind: &str, matlab_datenum: bool) -> Result<Table, String> {
    let squeeze = |s: &[usize]| -> Vec<usize> { s.iter().copied().filter(|&d| d != 1).collect() };

    // Score each candidate length by the number of columns it would produce.
    let mut score: BTreeMap<usize, usize> = BTreeMap::new();
    for a in &arrs {
        let d = squeeze(&a.shape);
        match d.len() {
            1 => *score.entry(d[0]).or_default() += 1,
            2 => {
                if d[1] <= MAX_WIDE_COLUMNS {
                    *score.entry(d[0]).or_default() += d[1];
                }
                if d[0] <= MAX_WIDE_COLUMNS && d[0] != d[1] {
                    *score.entry(d[1]).or_default() += d[0];
                }
            }
            _ => {}
        }
    }
    let n = score
        .iter()
        .max_by(|a, b| a.1.cmp(b.1).then(a.0.cmp(b.0)))
        .map(|(len, _)| *len)
        .ok_or_else(|| format!("{}: nessuna variabile 1-D o 2-D leggibile come colonna", kind))?;

    let mut table = Table { kind: kind.to_string(), ..Default::default() };
    let mut skipped: Vec<String> = Vec::new();

    for a in arrs {
        let d = squeeze(&a.shape);
        let base = a.name.trim_start_matches('/').to_string();
        match (d.len(), &a.data) {
            (1, _) if d[0] == n => {
                let col = convert_time(&base, a.data, a.units.as_deref(), matlab_datenum);
                table.push(base, col);
            }
            (2, Col::Num(v)) if d[0] == n && d[1] <= MAX_WIDE_COLUMNS => {
                let k = d[1];
                for j in 0..k {
                    let c: Vec<f64> = (0..n).map(|i| v[i * k + j]).collect();
                    table.push(format!("{}_{}", base, j + 1), Col::Num(c));
                }
            }
            (2, Col::Num(v)) if d[1] == n && d[0] <= MAX_WIDE_COLUMNS => {
                let k = d[0];
                for j in 0..k {
                    let c: Vec<f64> = v[j * n..(j + 1) * n].to_vec();
                    table.push(format!("{}_{}", base, j + 1), Col::Num(c));
                }
            }
            _ => skipped.push(format!("{} {:?}", base, a.shape)),
        }
    }

    if table.cols.is_empty() {
        return Err(format!("{}: nessuna variabile di lunghezza comune", kind));
    }
    // Put the first time column first so the timestamp auto-detection picks it.
    if let Some(pos) = table.names.iter().position(|nm| looks_like_time_name(nm)) {
        if pos > 0 && matches!(table.cols[pos], Col::Str(_)) {
            let nm = table.names.remove(pos);
            let c = table.cols.remove(pos);
            table.names.insert(0, nm);
            table.cols.insert(0, c);
        }
    }
    if !skipped.is_empty() {
        table.notes.push(format!(
            "{} variabili ignorate (lunghezza diversa da {} o >2 dimensioni): {}",
            skipped.len(),
            n,
            skipped.iter().take(8).cloned().collect::<Vec<_>>().join(", ")
        ));
    }
    table.kind = format!("{} ({} colonne, {} righe)", kind, table.cols.len(), n);
    Ok(table)
}

fn convert_time(name: &str, col: Col, units: Option<&str>, matlab_datenum: bool) -> Col {
    let Col::Num(v) = &col else { return col };
    if let Some(u) = units {
        if let Some(s) = cf_time_to_strings(v, u) {
            return Col::Str(s);
        }
    }
    if matlab_datenum && looks_like_time_name(name) {
        let finite: Vec<f64> = v.iter().copied().filter(|x| x.is_finite()).collect();
        if !finite.is_empty() && finite.iter().all(|x| (600_000.0..800_000.0).contains(x)) {
            // MATLAB datenum: days since year 0; 719529 = 1970-01-01.
            return Col::Str(v.iter().map(|x| unix_secs_to_iso((x - 719_529.0) * 86_400.0)).collect());
        }
    }
    col
}

// ---------------------------------------------------------------- HDF5 ---

use hdf5_reader::group::Group;
use hdf5_reader::{ByteOrder, Dataset, Datatype, Hdf5File, StringSize};

fn num_from_bytes(b: &[u8], dt: &Datatype) -> Option<f64> {
    match dt {
        Datatype::FloatingPoint { size, byte_order } => {
            let be = matches!(byte_order, ByteOrder::BigEndian);
            match size {
                4 => {
                    let a: [u8; 4] = b.get(..4)?.try_into().ok()?;
                    Some(if be { f32::from_be_bytes(a) } else { f32::from_le_bytes(a) } as f64)
                }
                8 => {
                    let a: [u8; 8] = b.get(..8)?.try_into().ok()?;
                    Some(if be { f64::from_be_bytes(a) } else { f64::from_le_bytes(a) })
                }
                _ => None,
            }
        }
        Datatype::FixedPoint { size, signed, byte_order } => {
            let n = *size as usize;
            let bytes = b.get(..n)?;
            let mut buf = [0u8; 8];
            if matches!(byte_order, ByteOrder::BigEndian) {
                buf[8 - n..].copy_from_slice(bytes);
                let u = u64::from_be_bytes(buf);
                Some(if *signed { ((u << (64 - 8 * n)) as i64 >> (64 - 8 * n)) as f64 } else { u as f64 })
            } else {
                buf[..n].copy_from_slice(bytes);
                let u = u64::from_le_bytes(buf);
                Some(if *signed { ((u << (64 - 8 * n)) as i64 >> (64 - 8 * n)) as f64 } else { u as f64 })
            }
        }
        Datatype::Enum { base, .. } => num_from_bytes(b, base),
        _ => None,
    }
}

fn attr_string(ds: &Dataset, name: &str) -> Option<String> {
    let a = ds.attribute(name).ok()?;
    a.read_string().ok().or_else(|| a.read_strings().ok().and_then(|v| v.into_iter().next()))
}

fn read_h5_dataset(ds: &Dataset, path: &str, out: &mut Vec<Arr>, notes: &mut Vec<String>) {
    let shape: Vec<usize> = ds.shape().iter().map(|&d| d as usize).collect();
    let dt = ds.dtype().clone();
    let units = attr_string(ds, "units");
    let res: Result<(), String> = (|| {
        match &dt {
            Datatype::String { .. } => {
                let s = ds.read_strings().map_err(|e| e.to_string())?;
                out.push(Arr { name: path.to_string(), shape, data: Col::Str(s), units: None });
            }
            Datatype::Compound { size, fields } => {
                // Table-like compound dataset (e.g. PyTables / h5py structured arrays).
                let raw = ds.read_raw_bytes().map_err(|e| e.to_string())?;
                let sz = *size as usize;
                let nrec = if sz > 0 { raw.len() / sz } else { 0 };
                for f in fields {
                    let off = f.byte_offset as usize;
                    match &f.datatype {
                        Datatype::String { size: StringSize::Fixed(len), .. } => {
                            let l = *len as usize;
                            let v = (0..nrec)
                                .map(|i| {
                                    let s = &raw[i * sz + off..(i * sz + off + l).min(raw.len())];
                                    String::from_utf8_lossy(s).trim_end_matches(['\0', ' ']).to_string()
                                })
                                .collect();
                            out.push(Arr { name: format!("{}/{}", path, f.name), shape: vec![nrec], data: Col::Str(v), units: None });
                        }
                        Datatype::Array { base, dims } => {
                            let k: usize = dims.iter().product::<u64>() as usize;
                            let es = hdf5_reader::dtype_element_size(base).unwrap_or(0);
                            if k > MAX_WIDE_COLUMNS || es == 0 {
                                continue;
                            }
                            let mut v = Vec::with_capacity(nrec * k);
                            for i in 0..nrec {
                                for j in 0..k {
                                    let p = i * sz + off + j * es;
                                    v.push(num_from_bytes(&raw[p..], base).unwrap_or(f64::NAN));
                                }
                            }
                            out.push(Arr { name: format!("{}/{}", path, f.name), shape: vec![nrec, k], data: Col::Num(v), units: None });
                        }
                        other => {
                            if num_from_bytes(&raw[off.min(raw.len())..], other).is_none() && nrec > 0 {
                                continue;
                            }
                            let v = (0..nrec)
                                .map(|i| num_from_bytes(&raw[i * sz + off..], other).unwrap_or(f64::NAN))
                                .collect();
                            out.push(Arr { name: format!("{}/{}", path, f.name), shape: vec![nrec], data: Col::Num(v), units: None });
                        }
                    }
                }
            }
            Datatype::FixedPoint { .. } | Datatype::FloatingPoint { .. } | Datatype::Enum { .. } => {
                let raw = ds.read_raw_bytes().map_err(|e| e.to_string())?;
                let es = hdf5_reader::dtype_element_size(&dt).unwrap_or(0);
                if es == 0 {
                    return Err("dimensione elemento nulla".into());
                }
                let v: Vec<f64> = raw.chunks_exact(es).map(|c| num_from_bytes(c, &dt).unwrap_or(f64::NAN)).collect();
                out.push(Arr { name: path.to_string(), shape, data: Col::Num(v), units });
            }
            _ => return Err("tipo di dato non supportato".into()),
        }
        Ok(())
    })();
    if let Err(e) = res {
        notes.push(format!("{}: {}", path, e));
    }
}

fn walk_h5(group: &Group, prefix: &str, out: &mut Vec<Arr>, notes: &mut Vec<String>, depth: usize) {
    if depth > 16 {
        return;
    }
    let Ok((groups, datasets)) = group.members() else { return };
    for ds in &datasets {
        let p = format!("{}/{}", prefix, ds.name());
        // MATLAB v7.3 bookkeeping and netCDF-4 dimension scales without data are not columns.
        if ds.name().starts_with('#') {
            continue;
        }
        read_h5_dataset(ds, &p, out, notes);
    }
    for g in &groups {
        if g.name().starts_with('#') {
            continue;
        }
        walk_h5(g, &format!("{}/{}", prefix, g.name()), out, notes, depth + 1);
    }
}

pub fn read_hdf5(path: &str) -> Result<Table, String> {
    read_hdf5_as(path, "HDF5", false)
}

fn read_hdf5_as(path: &str, kind: &str, matlab: bool) -> Result<Table, String> {
    let file = Hdf5File::open(path).map_err(|e| format!("Impossibile aprire file {}: {}", kind, e))?;
    let root = file.root_group().map_err(|e| format!("Errore lettura gruppo radice {}: {}", kind, e))?;
    let mut arrs = Vec::new();
    let mut notes = Vec::new();
    walk_h5(&root, "", &mut arrs, &mut notes, 0);
    if matlab {
        // MATLAB stores arrays column-major, so h5 shape [K, N] means N rows × K columns: transpose.
        for a in arrs.iter_mut() {
            a.shape.reverse();
            if let (Col::Num(v), [r, c]) = (&a.data, a.shape.as_slice()) {
                let (r, c) = (*r, *c);
                if r > 1 && c > 1 {
                    let mut t = vec![0.0; v.len()];
                    for i in 0..r {
                        for j in 0..c {
                            t[i * c + j] = v[j * r + i];
                        }
                    }
                    a.data = Col::Num(t);
                }
            }
        }
    }
    let mut t = arrays_to_table(arrs, kind, matlab)?;
    t.notes.extend(notes);
    Ok(t)
}

// -------------------------------------------------------------- netCDF ---

pub fn read_netcdf(path: &str) -> Result<Table, String> {
    use netcdf_reader::NcFile;
    use netcdf_reader::NcType;
    let file = NcFile::open(path).map_err(|e| format!("Impossibile aprire file netCDF: {}", e))?;
    let kind = format!("netCDF {:?}", file.format());
    let vars = file.variables().map_err(|e| format!("Errore lettura variabili netCDF: {}", e))?;
    let mut arrs = Vec::new();
    let mut notes = Vec::new();
    for var in vars {
        let name = var.name().to_string();
        let mut shape: Vec<usize> = var.shape().iter().map(|&d| d as usize).collect();
        let units = var.attribute("units").and_then(|a| a.value.as_string());
        let data = match var.dtype() {
            NcType::Char => {
                // Classic char arrays: last dimension is the string length.
                match file.read_variable_as_strings(&name) {
                    Ok(s) => {
                        shape.pop();
                        Col::Str(s)
                    }
                    Err(e) => {
                        notes.push(format!("{}: {}", name, e));
                        continue;
                    }
                }
            }
            NcType::String => match file.read_variable_as_strings(&name) {
                Ok(s) => Col::Str(s),
                Err(e) => {
                    notes.push(format!("{}: {}", name, e));
                    continue;
                }
            },
            NcType::Compound { .. } | NcType::Opaque { .. } | NcType::VLen { .. } | NcType::Array { .. } => {
                notes.push(format!("{}: tipo definito dall'utente non supportato", name));
                continue;
            }
            _ => {
                let arr = file
                    .read_variable_unpacked_masked(&name)
                    .or_else(|_| file.read_variable_as_f64(&name));
                match arr {
                    Ok(a) => Col::Num(a.iter().copied().collect()),
                    Err(e) => {
                        notes.push(format!("{}: {}", name, e));
                        continue;
                    }
                }
            }
        };
        arrs.push(Arr { name, shape, data, units });
    }
    let mut t = arrays_to_table(arrs, &kind, false)?;
    t.notes.extend(notes);
    Ok(t)
}

// -------------------------------------------------------------- MATLAB ---

pub fn read_matlab(path: &str) -> Result<Table, String> {
    // v7.3 files are HDF5 with a 512-byte user block.
    let mut head = vec![0u8; 520];
    {
        use std::io::Read;
        let mut f = std::fs::File::open(path).map_err(|e| format!("Impossibile aprire file MATLAB: {}", e))?;
        let n = f.read(&mut head).unwrap_or(0);
        head.truncate(n);
    }
    if head.len() >= 520 && &head[512..516] == b"\x89HDF" {
        return read_hdf5_as(path, "MATLAB v7.3", true);
    }

    let f = std::fs::File::open(path).map_err(|e| format!("Impossibile aprire file MATLAB: {}", e))?;
    let mat = matfile::MatFile::parse(std::io::BufReader::new(f))
        .map_err(|e| format!("Errore decodifica MATLAB (supportati v4/v5/v7 numerici e v7.3): {:?}", e))?;
    let mut arrs = Vec::new();
    for a in mat.arrays() {
        let size = a.size().clone();
        let v: Vec<f64> = match a.data() {
            matfile::NumericData::Double { real, .. } => real.clone(),
            matfile::NumericData::Single { real, .. } => real.iter().map(|x| *x as f64).collect(),
            matfile::NumericData::Int8 { real, .. } => real.iter().map(|x| *x as f64).collect(),
            matfile::NumericData::UInt8 { real, .. } => real.iter().map(|x| *x as f64).collect(),
            matfile::NumericData::Int16 { real, .. } => real.iter().map(|x| *x as f64).collect(),
            matfile::NumericData::UInt16 { real, .. } => real.iter().map(|x| *x as f64).collect(),
            matfile::NumericData::Int32 { real, .. } => real.iter().map(|x| *x as f64).collect(),
            matfile::NumericData::UInt32 { real, .. } => real.iter().map(|x| *x as f64).collect(),
            matfile::NumericData::Int64 { real, .. } => real.iter().map(|x| *x as f64).collect(),
            matfile::NumericData::UInt64 { real, .. } => real.iter().map(|x| *x as f64).collect(),
        };
        // Column-major → row-major for 2-D arrays.
        let data = if size.len() == 2 && size[0] > 1 && size[1] > 1 {
            let (r, c) = (size[0], size[1]);
            let mut t = vec![0.0; v.len()];
            for i in 0..r {
                for j in 0..c {
                    t[i * c + j] = v[j * r + i];
                }
            }
            t
        } else {
            v
        };
        arrs.push(Arr { name: a.name().to_string(), shape: size, data: Col::Num(data), units: None });
    }
    let mut t = arrays_to_table(arrs, "MATLAB v5", true)?;
    t.notes.push("Strutture, celle e char array MATLAB non sono importati (solo array numerici).".into());
    Ok(t)
}
