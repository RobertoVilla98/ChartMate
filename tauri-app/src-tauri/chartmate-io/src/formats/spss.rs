//! SPSS system files (`.sav`): uncompressed and bytecode-compressed, either byte order.
//!
//! Supported: numeric and string variables, long variable names (record 7.13), user-missing
//! values on numeric variables (set to empty), SPSS date/time formats (converted to ISO text).
//! Not supported: zlib-compressed `.zsav`; very long strings (> 255 bytes) appear as their
//! 255-byte segments. Value labels are read past but not applied (codes stay numeric, which is
//! what plotting needs).

use super::{fmt_num, unix_secs_to_iso, Col, Table};

struct Cursor<'a> {
    b: &'a [u8],
    p: usize,
    be: bool,
}

impl<'a> Cursor<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        if self.p + n > self.b.len() {
            return Err("SPSS: file troncato".into());
        }
        let s = &self.b[self.p..self.p + n];
        self.p += n;
        Ok(s)
    }
    fn i32(&mut self) -> Result<i32, String> {
        let s: [u8; 4] = self.take(4)?.try_into().unwrap();
        Ok(if self.be { i32::from_be_bytes(s) } else { i32::from_le_bytes(s) })
    }
    fn f64(&mut self) -> Result<f64, String> {
        let s: [u8; 8] = self.take(8)?.try_into().unwrap();
        Ok(self.f64_of(s))
    }
    fn f64_of(&self, s: [u8; 8]) -> f64 {
        if self.be {
            f64::from_be_bytes(s)
        } else {
            f64::from_le_bytes(s)
        }
    }
}

struct Var {
    short_name: String,
    name: String,
    width: usize, // 0 = numeric
    slots: usize,
    print_type: u8,
    missing: Vec<f64>,
    missing_range: Option<(f64, f64)>,
}

/// SPSS date/time print formats (type codes); values are seconds since 1582-10-14.
fn is_date_format(t: u8) -> Option<bool> {
    // Some(true) = date + time, Some(false) = date only
    match t {
        22 | 41 => Some(true),                                   // DATETIME, YMDHMS
        20 | 23 | 24 | 28 | 29 | 30 | 38 | 39 => Some(false),    // DATE, ADATE, JDATE, SDATE, EDATE, ...
        _ => None,
    }
}

pub fn read_sav(path: &str) -> Result<Table, String> {
    let buf = std::fs::read(path).map_err(|e| format!("Impossibile aprire file SPSS: {}", e))?;
    parse_sav(&buf)
}

pub fn parse_sav(buf: &[u8]) -> Result<Table, String> {
    if buf.len() < 176 {
        return Err("SPSS: file troppo corto".into());
    }
    match &buf[0..4] {
        b"$FL2" => {}
        b"$FL3" => return Err("SPSS .zsav (compressione zlib) non ancora supportato: risalvare come .sav".into()),
        _ => return Err("File SPSS non valido (manca la firma $FL2)".into()),
    }
    let layout_le = i32::from_le_bytes(buf[64..68].try_into().unwrap());
    let be = !(layout_le == 2 || layout_le == 3);
    let mut c = Cursor { b: buf, p: 64, be };
    let _layout = c.i32()?;
    let _nominal_case_size = c.i32()?;
    let compression = c.i32()?;
    let _weight_index = c.i32()?;
    let ncases_hdr = c.i32()?;
    let bias = c.f64()?;
    c.p = 176;

    let mut vars: Vec<Var> = Vec::new();
    let mut long_names: Option<String> = None;

    loop {
        let rt = c.i32()?;
        match rt {
            2 => {
                let typ = c.i32()?;
                let has_label = c.i32()?;
                let n_missing = c.i32()?;
                let print = c.i32()?;
                let _write = c.i32()?;
                let name = String::from_utf8_lossy(c.take(8)?).trim_end().to_string();
                if has_label == 1 {
                    let l = c.i32()?.max(0) as usize;
                    c.take(l.div_ceil(4) * 4)?;
                }
                let mut missing = Vec::new();
                let mut missing_range = None;
                let nm = n_missing.unsigned_abs() as usize;
                let mut mv = Vec::with_capacity(nm);
                for _ in 0..nm {
                    mv.push(c.f64()?);
                }
                if typ == 0 {
                    if n_missing < 0 && mv.len() >= 2 {
                        missing_range = Some((mv[0], mv[1]));
                        missing.extend_from_slice(&mv[2..]);
                    } else {
                        missing = mv;
                    }
                }
                if typ == -1 {
                    // Continuation of a long string: one more 8-byte slot.
                    if let Some(v) = vars.last_mut() {
                        v.slots += 1;
                    }
                } else {
                    let width = typ.max(0) as usize;
                    vars.push(Var {
                        short_name: name.clone(),
                        name,
                        width,
                        slots: 1,
                        print_type: ((print >> 16) & 0xff) as u8,
                        missing,
                        missing_range,
                    });
                }
            }
            3 => {
                let count = c.i32()?.max(0) as usize;
                for _ in 0..count {
                    c.take(8)?;
                    let l = c.take(1)?[0] as usize;
                    c.take((l + 1).div_ceil(8) * 8 - 1)?;
                }
                // The following type-4 record lists the variable indices.
                let rt4 = c.i32()?;
                if rt4 != 4 {
                    return Err("SPSS: record etichette valori malformato".into());
                }
                let n = c.i32()?.max(0) as usize;
                c.take(n * 4)?;
            }
            6 => {
                let n = c.i32()?.max(0) as usize;
                c.take(n * 80)?;
            }
            7 => {
                let subtype = c.i32()?;
                let size = c.i32()?.max(0) as usize;
                let count = c.i32()?.max(0) as usize;
                let data = c.take(size * count)?;
                if subtype == 13 {
                    long_names = Some(String::from_utf8_lossy(data).to_string());
                }
            }
            999 => {
                c.i32()?;
                break;
            }
            other => return Err(format!("SPSS: tipo di record sconosciuto {}", other)),
        }
    }

    if let Some(ln) = long_names {
        for pair in ln.split('\t') {
            if let Some((short, long)) = pair.split_once('=') {
                if let Some(v) = vars.iter_mut().find(|v| v.short_name.eq_ignore_ascii_case(short.trim())) {
                    v.name = long.trim_end_matches('\0').to_string();
                }
            }
        }
    }

    let case_slots: usize = vars.iter().map(|v| v.slots).sum();
    if case_slots == 0 {
        return Err("SPSS: nessuna variabile".into());
    }

    // Decode the data stream into 8-byte slots; None = system-missing.
    let mut slots: Vec<Option<[u8; 8]>> = Vec::new();
    let expected = if ncases_hdr > 0 { ncases_hdr as usize * case_slots } else { 0 };
    slots.reserve(expected);
    match compression {
        0 => {
            while c.p + 8 <= buf.len() {
                let s: [u8; 8] = c.take(8)?.try_into().unwrap();
                slots.push(Some(s));
            }
        }
        1 => {
            let sysmis_bytes = if be { (-f64::MAX).to_be_bytes() } else { (-f64::MAX).to_le_bytes() };
            'outer: while c.p + 8 <= buf.len() {
                let cmds: [u8; 8] = c.take(8)?.try_into().unwrap();
                for &code in &cmds {
                    match code {
                        0 => {}
                        252 => break 'outer,
                        253 => {
                            if c.p + 8 > buf.len() {
                                break 'outer;
                            }
                            let s: [u8; 8] = c.take(8)?.try_into().unwrap();
                            slots.push(Some(s));
                        }
                        254 => slots.push(Some(*b"        ")),
                        255 => slots.push(Some(sysmis_bytes)),
                        n => {
                            let v = n as f64 - bias;
                            slots.push(Some(if be { v.to_be_bytes() } else { v.to_le_bytes() }));
                        }
                    }
                }
            }
        }
        2 => return Err("SPSS: compressione zlib (.zsav) non supportata".into()),
        other => return Err(format!("SPSS: compressione sconosciuta {}", other)),
    }
    let ncases = slots.len() / case_slots;

    let mut table = Table::default();
    let mut offset = 0usize;
    for v in &vars {
        let col = if v.width == 0 {
            let date = is_date_format(v.print_type);
            let vals: Vec<f64> = (0..ncases)
                .map(|k| {
                    let s = slots[k * case_slots + offset].unwrap_or([0; 8]);
                    let x = c.f64_of(s);
                    let miss = x == -f64::MAX
                        || !x.is_finite()
                        || v.missing.contains(&x)
                        || v.missing_range.map(|(lo, hi)| x >= lo && x <= hi).unwrap_or(false);
                    if miss {
                        f64::NAN
                    } else {
                        x
                    }
                })
                .collect();
            match date {
                Some(with_time) => {
                    // 1582-10-14 is 12_219_379_200 s before 1970-01-01.
                    Col::Str(
                        vals.iter()
                            .map(|x| {
                                if !x.is_finite() {
                                    return String::new();
                                }
                                let s = unix_secs_to_iso(x - 12_219_379_200.0);
                                if with_time { s } else { s.get(..10).unwrap_or(&s).to_string() }
                            })
                            .collect(),
                    )
                }
                None => Col::Num(vals),
            }
        } else {
            Col::Str(
                (0..ncases)
                    .map(|k| {
                        let mut bytes = Vec::with_capacity(v.slots * 8);
                        for j in 0..v.slots {
                            bytes.extend_from_slice(&slots[k * case_slots + offset + j].unwrap_or(*b"        "));
                        }
                        bytes.truncate(v.width);
                        String::from_utf8_lossy(&bytes).trim_end().to_string()
                    })
                    .collect(),
            )
        };
        table.push(v.name.clone(), col);
        offset += v.slots;
    }
    let _ = fmt_num; // shared helper, used by other readers
    table.kind = format!(
        "SPSS .sav ({} variabili, {} casi{})",
        vars.len(),
        ncases,
        if compression == 1 { ", bytecode" } else { "" }
    );
    Ok(table)
}
