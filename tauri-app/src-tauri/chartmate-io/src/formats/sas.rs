//! SAS data sets: `.sas7bdat` (via the pure-Rust `sas7bdat` crate) and SAS transport `.xpt`
//! version 5 and 8 (own reader, IBM-370 floating point).

use super::{unix_secs_to_iso, Col, Table};

/// Seconds between 1960-01-01 (SAS epoch) and 1970-01-01 (Unix epoch).
const SAS_TO_UNIX_SECS: f64 = 315_619_200.0;

fn sas_days_to_iso(d: f64) -> String {
    if !d.is_finite() {
        return String::new();
    }
    let s = unix_secs_to_iso(d * 86_400.0 - SAS_TO_UNIX_SECS);
    s.get(..10).unwrap_or(&s).to_string()
}

fn sas_secs_to_iso(s: f64) -> String {
    if !s.is_finite() {
        return String::new();
    }
    unix_secs_to_iso(s - SAS_TO_UNIX_SECS)
}

fn hms(secs: f64) -> String {
    if !secs.is_finite() {
        return String::new();
    }
    let s = secs.round() as i64;
    format!("{:02}:{:02}:{:02}", s / 3600, (s % 3600) / 60, s % 60)
}

// ------------------------------------------------------------ sas7bdat ---

pub fn read_sas7bdat(path: &str) -> Result<Table, String> {
    use sas7bdat::{CellValue, Dataset};
    use std::ops::ControlFlow;

    let ds = Dataset::open(path).map_err(|e| format!("Impossibile aprire file SAS: {}", e))?;
    let names: Vec<String> = ds.columns().iter().map(|c| c.name.clone()).collect();
    let ncols = names.len();
    // Per column: numeric values or strings; a column becomes textual on its first text cell.
    let mut nums: Vec<Vec<f64>> = vec![Vec::new(); ncols];
    let mut strs: Vec<Option<Vec<String>>> = vec![None; ncols];
    let mut nrows = 0usize;

    ds.scan()
        .visit_rows(|row| {
            for i in 0..ncols {
                let cell = row.get(i).cloned().unwrap_or(CellValue::Null);
                let text: Option<String> = match cell {
                    CellValue::Null => {
                        nums[i].push(f64::NAN);
                        None
                    }
                    CellValue::Int32(v) => {
                        nums[i].push(v as f64);
                        None
                    }
                    CellValue::Int64(v) => {
                        nums[i].push(v as f64);
                        None
                    }
                    CellValue::Float64(v) => {
                        nums[i].push(v);
                        None
                    }
                    CellValue::Str(s) => Some(s.trim_end().to_string()),
                    CellValue::Bytes(b) => Some(String::from_utf8_lossy(b).trim_end().to_string()),
                    CellValue::Date(d) => Some(sas_days_to_iso(d.days_since_sas_epoch as f64)),
                    CellValue::DateTime(d) => Some(sas_secs_to_iso(d.seconds_since_sas_epoch as f64)),
                    CellValue::Time(t) => Some(hms(t.seconds_since_midnight as f64)),
                };
                if let Some(t) = text {
                    let col = strs[i].get_or_insert_with(|| {
                        nums[i].iter().map(|x| super::fmt_num(*x)).collect()
                    });
                    col.push(t);
                    nums[i].push(f64::NAN);
                } else if let Some(col) = strs[i].as_mut() {
                    col.push(nums[i].last().map(|x| super::fmt_num(*x)).unwrap_or_default());
                }
            }
            nrows += 1;
            Ok(ControlFlow::Continue(()))
        })
        .map_err(|e| format!("Errore lettura righe SAS: {}", e))?;

    let mut table = Table::default();
    for (i, name) in names.into_iter().enumerate() {
        match strs[i].take() {
            Some(s) => table.push(name, Col::Str(s)),
            None => table.push(name, Col::Num(std::mem::take(&mut nums[i]))),
        }
    }
    table.kind = format!("SAS7BDAT ({} colonne, {} righe)", ncols, nrows);
    Ok(table)
}

// ----------------------------------------------------------------- XPT ---

fn ibm_to_f64(b: &[u8]) -> f64 {
    let mut buf = [0u8; 8];
    let n = b.len().min(8);
    buf[..n].copy_from_slice(&b[..n]);
    // Missing values: '.', '_' or 'A'-'Z' followed by zeros.
    if buf[1..].iter().all(|&x| x == 0) && (buf[0] == b'.' || buf[0] == b'_' || buf[0].is_ascii_uppercase()) {
        return f64::NAN;
    }
    let u = u64::from_be_bytes(buf);
    let mant = (u & 0x00ff_ffff_ffff_ffff) as f64 / 72_057_594_037_927_936.0; // 2^56
    if mant == 0.0 {
        return 0.0;
    }
    let sign = if u >> 63 == 1 { -1.0 } else { 1.0 };
    let exp = ((u >> 56) & 0x7f) as i32 - 64;
    sign * mant * 16f64.powi(exp)
}

fn be_i16(b: &[u8]) -> i16 {
    i16::from_be_bytes([b[0], b[1]])
}

fn be_i32(b: &[u8]) -> i32 {
    i32::from_be_bytes([b[0], b[1], b[2], b[3]])
}

fn ascii(b: &[u8]) -> String {
    String::from_utf8_lossy(b).trim_end_matches(['\0', ' ']).trim().to_string()
}

enum XptKind {
    Num,
    Date,
    DateTime,
    Time,
    Char,
}

fn kind_from_format(ntype: i16, fmt: &str) -> XptKind {
    if ntype == 2 {
        return XptKind::Char;
    }
    let f = fmt.to_ascii_uppercase();
    if f.starts_with("DATETIME") || f.starts_with("E8601DT") || f.starts_with("IS8601DT") || f.starts_with("DATEAMPM") {
        XptKind::DateTime
    } else if f.starts_with("TIME") || f.starts_with("E8601TM") || f.starts_with("HHMM") {
        XptKind::Time
    } else if f.starts_with("DATE")
        || f.starts_with("YYMMDD")
        || f.starts_with("MMDDYY")
        || f.starts_with("DDMMYY")
        || f.starts_with("E8601DA")
        || f.starts_with("IS8601DA")
        || f.starts_with("WEEKDATE")
        || f.starts_with("MONYY")
        || f.starts_with("YYMON")
    {
        XptKind::Date
    } else {
        XptKind::Num
    }
}

pub fn read_xpt(path: &str) -> Result<Table, String> {
    let buf = std::fs::read(path).map_err(|e| format!("Impossibile aprire file XPT: {}", e))?;
    parse_xpt(&buf)
}

pub fn parse_xpt(buf: &[u8]) -> Result<Table, String> {
    const HDR: &[u8] = b"HEADER RECORD*******";
    if buf.len() < 80 * 8 || !buf.starts_with(HDR) {
        return Err("File XPT non valido (manca l'intestazione SAS transport)".into());
    }
    let v8 = &buf[20..28] == b"LIBV8   ";
    let rec = |i: usize| -> &[u8] { &buf[i * 80..((i + 1) * 80).min(buf.len())] };
    let nrec = buf.len() / 80;

    // Find the first member header.
    let mut i = 0;
    while i < nrec && !(rec(i).starts_with(HDR) && (&rec(i)[20..26] == b"MEMBER" || &rec(i)[20..26] == b"MEMBV8")) {
        i += 1;
    }
    if i >= nrec {
        return Err("XPT: nessun membro (data set) trovato".into());
    }
    let namestr_len: usize = ascii(&rec(i)[74..78]).parse().unwrap_or(140);
    // Find the NAMESTR header.
    while i < nrec && !(rec(i).starts_with(HDR) && (&rec(i)[20..27] == b"NAMESTR" || &rec(i)[20..27] == b"NAMSTV8")) {
        i += 1;
    }
    if i >= nrec {
        return Err("XPT: intestazione NAMESTR mancante".into());
    }
    // Variable count: 4 digits at columns 55-58 in both v5 and v8 headers.
    let nvars: usize = ascii(&rec(i)[54..58]).parse().unwrap_or(0);
    if nvars == 0 {
        return Err("XPT: numero di variabili non valido".into());
    }
    let ns_start = (i + 1) * 80;
    let ns_end = ns_start + nvars * namestr_len;
    if ns_end > buf.len() {
        return Err("XPT: descrittori delle variabili troncati".into());
    }

    struct Var {
        name: String,
        len: usize,
        pos: usize,
        kind: XptKind,
    }
    let mut vars = Vec::with_capacity(nvars);
    for k in 0..nvars {
        let ns = &buf[ns_start + k * namestr_len..ns_start + (k + 1) * namestr_len];
        let ntype = be_i16(&ns[0..2]);
        let len = be_i16(&ns[4..6]).max(0) as usize;
        let mut name = ascii(&ns[8..16]);
        if v8 && namestr_len >= 120 {
            let long = ascii(&ns[88..120]);
            if !long.is_empty() {
                name = long;
            }
        }
        let fmt = ascii(&ns[56..64]);
        let pos = be_i32(&ns[84..88]).max(0) as usize;
        vars.push(Var { name, len, pos, kind: kind_from_format(ntype, &fmt) });
    }
    let obs_len = vars.iter().map(|v| v.pos + v.len).max().unwrap_or(0);
    if obs_len == 0 {
        return Err("XPT: lunghezza osservazione nulla".into());
    }

    // OBS header after the namestr block (and optional LABELV8/V9 records).
    let mut j = ns_end.div_ceil(80);
    while j < nrec && !(rec(j).starts_with(HDR) && (&rec(j)[20..23] == b"OBS")) {
        j += 1;
    }
    if j >= nrec {
        return Err("XPT: intestazione OBS mancante".into());
    }
    let data_start = (j + 1) * 80;
    // Data end: next member header or end of file.
    let mut data_end = buf.len();
    let mut k = j + 1;
    while k < nrec {
        let r = rec(k);
        if r.starts_with(HDR) && (&r[20..26] == b"MEMBER" || &r[20..26] == b"MEMBV8") {
            data_end = k * 80;
            break;
        }
        k += 1;
    }
    let data = &buf[data_start..data_end];
    let mut nobs = data.len() / obs_len;
    // Trailing blank padding is not an observation.
    while nobs > 0 && data[(nobs - 1) * obs_len..nobs * obs_len].iter().all(|&b| b == b' ') {
        nobs -= 1;
    }

    let mut table = Table::default();
    for v in &vars {
        let cells = (0..nobs).map(|o| &data[o * obs_len + v.pos..o * obs_len + v.pos + v.len]);
        let col = match v.kind {
            XptKind::Char => Col::Str(cells.map(|c| String::from_utf8_lossy(c).trim_end().to_string()).collect()),
            XptKind::Num => Col::Num(cells.map(ibm_to_f64).collect()),
            XptKind::Date => Col::Str(cells.map(|c| sas_days_to_iso(ibm_to_f64(c))).collect()),
            XptKind::DateTime => Col::Str(cells.map(|c| sas_secs_to_iso(ibm_to_f64(c))).collect()),
            XptKind::Time => Col::Str(cells.map(|c| hms(ibm_to_f64(c))).collect()),
        };
        table.push(v.name.clone(), col);
    }
    table.kind = format!("SAS transport XPT v{} ({} colonne, {} righe)", if v8 { 8 } else { 5 }, nvars, nobs);
    Ok(table)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ibm_float_decoding() {
        // 1.0 = 0x41100000_00000000, -118.625 = 0xC276A000_00000000
        assert_eq!(ibm_to_f64(&[0x41, 0x10, 0, 0, 0, 0, 0, 0]), 1.0);
        assert_eq!(ibm_to_f64(&[0xC2, 0x76, 0xA0, 0, 0, 0, 0, 0]), -118.625);
        assert_eq!(ibm_to_f64(&[0, 0, 0, 0, 0, 0, 0, 0]), 0.0);
        assert!(ibm_to_f64(&[b'.', 0, 0, 0, 0, 0, 0, 0]).is_nan());
    }

    #[test]
    fn sas_epoch_dates() {
        assert_eq!(sas_days_to_iso(0.0), "1960-01-01");
        assert_eq!(sas_secs_to_iso(SAS_TO_UNIX_SECS), "1970-01-01 00:00:00");
    }
}
