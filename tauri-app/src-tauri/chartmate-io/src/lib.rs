//! ChartMate I/O engine: file readers, timestamp handling and time-series re-sampling.
//!
//! This crate has no dependency on Tauri, so it can be tested on its own, reused by other tools
//! and benchmarked from the command line (`cargo run --release -p chartmate-io --example bench_read`).

use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;

pub mod columnar;
pub mod formats;

pub use columnar::{ColumnarDataset, resample_table, table_from_rows};


/// Default maximum number of rows sent to the front end.
pub const DEFAULT_ROW_LIMIT: usize = 500_000;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct DatasetPreview {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    /// Rows in the source (may exceed `rows.len()` when the limit was hit).
    pub total_rows: usize,
    pub detected_sep: String,
    pub suggested_ts_col: Option<String>,
    pub suggested_ts_format: Option<String>,
    /// True when `rows` holds fewer rows than the source because of `row_limit`.
    #[serde(default)]
    pub truncated: bool,
    #[serde(default)]
    pub row_limit: usize,
    /// Reader notes shown to the user (skipped variables, unsupported features).
    #[serde(default)]
    pub notes: Vec<String>,
    /// Time spent reading and parsing in the Rust back end (ms).
    #[serde(default)]
    pub parse_ms: f64,
}

/// Converts an Excel serial date (days since 1899-12-30) to ISO text.
fn excel_serial_to_iso(serial: f64) -> String {
    let secs = ((serial - 25_569.0) * 86_400.0).round() as i64;
    epoch_secs_to_iso(secs)
}

pub(crate) fn spreadsheet_cell_to_string(cell: &calamine::Data) -> String {
    use calamine::Data;
    match cell {
        Data::DateTime(d) => excel_serial_to_iso(d.as_f64()),
        Data::DateTimeIso(s) => s.replace('T', " "),
        Data::Empty => String::new(),
        Data::Error(_) => String::new(),
        other => other.to_string(),
    }
}

#[derive(Debug, Deserialize, Clone)]
pub struct ParseOptions {
    pub separator: Option<String>,
    pub decimal: Option<String>,
    pub timestamp_col: Option<String>,
    pub timestamp_format: Option<String>,
    pub max_rows: Option<usize>,
}


pub fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    (year, m, d)
}

pub fn epoch_secs_to_iso(secs: i64) -> String {
    let days = secs.div_euclid(86400);
    let rem = secs.rem_euclid(86400);
    let h = rem / 3600;
    let m = (rem % 3600) / 60;
    let s = rem % 60;
    let (year, month, day) = civil_from_days(days);
    if !(0..=9999).contains(&year) {
        return format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", year, month, day, h, m, s);
    }
    // Hot path (10^6 timestamps per file): write the digits directly instead of `format!`.
    let y = year as u32;
    let d2 = |v: u32| [b'0' + (v / 10) as u8, b'0' + (v % 10) as u8];
    let mut b = [0u8; 19];
    b[..4].copy_from_slice(&[b'0' + (y / 1000) as u8, b'0' + (y / 100 % 10) as u8, b'0' + (y / 10 % 10) as u8, b'0' + (y % 10) as u8]);
    b[4] = b'-';
    b[5..7].copy_from_slice(&d2(month));
    b[7] = b'-';
    b[8..10].copy_from_slice(&d2(day));
    b[10] = b' ';
    b[11..13].copy_from_slice(&d2(h as u32));
    b[13] = b':';
    b[14..16].copy_from_slice(&d2(m as u32));
    b[16] = b':';
    b[17..19].copy_from_slice(&d2(s as u32));
    String::from_utf8(b.to_vec()).expect("ASCII")
}

pub fn detect_timestamp_metadata(headers: &[String], rows: &[Vec<String>]) -> (Option<String>, Option<String>) {
    // 1. Look for typical column names: timestamp, time, date, datetime, data, ora
    let mut ts_col = None;
    let mut ts_idx = None;

    for (i, h) in headers.iter().enumerate() {
        let hl = h.to_lowercase();
        if hl.contains("time") || hl.contains("date") || hl.contains("data") || hl.contains("giorno") || hl == "t" {
            ts_col = Some(h.clone());
            ts_idx = Some(i);
            break;
        }
    }

    let mut detected_format = None;

    // If no keyword match, inspect first column to see if it actually has date strings
    if ts_col.is_none() && !headers.is_empty() && !rows.is_empty() {
        if let Some(val) = rows[0].get(0) {
            let v = val.trim();
            if (v.len() >= 8 && (v.contains('-') || v.contains('/'))) && (v.contains(':') || v.len() == 10) {
                ts_col = Some(headers[0].clone());
                ts_idx = Some(0);
            }
        }
    }

    // Check sample values for format string
    if let Some(idx) = ts_idx {
        for row in rows.iter().take(10) {
            if let Some(val) = row.get(idx) {
                let v = val.trim();
                if v.len() >= 19 && (v.contains('-') && v.contains(':')) {
                    detected_format = Some("%Y-%m-%d %H:%M:%S".to_string());
                    break;
                } else if v.len() >= 19 && (v.contains('/') && v.contains(':')) {
                    detected_format = Some("%d/%m/%Y %H:%M:%S".to_string());
                    break;
                } else if v.len() == 10 && v.contains('-') {
                    detected_format = Some("%Y-%m-%d".to_string());
                    break;
                } else if v.len() == 10 && v.contains('/') {
                    detected_format = Some("%d/%m/%Y".to_string());
                    break;
                }
            }
        }
    }

    (ts_col, detected_format)
}


/// Reads any supported file into typed columns (the path used by the app since v0.3).
pub fn load_columnar(file_path: &str, options: Option<ParseOptions>) -> Result<ColumnarDataset, String> {
    let started = std::time::Instant::now();
    let opts = options.unwrap_or(ParseOptions {
        separator: None,
        decimal: None,
        timestamp_col: None,
        timestamp_format: None,
        max_rows: None,
    });
    let limit = columnar::effective_limit(opts.max_rows);
    let format = formats::detect_format(file_path);

    let (table, total) = match format {
        formats::Format::Parquet => columnar::read_parquet_columns(file_path, limit)?,
        formats::Format::Spreadsheet => columnar::read_spreadsheet_columns(file_path, limit)?,
        formats::Format::Text => {
            let mut file = File::open(file_path).map_err(|e| format!("Impossibile aprire file: {}", e))?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer).map_err(|e| format!("Errore lettura file: {}", e))?;
            let (delimiter, sep_name) = detect_delimiter(&buffer, opts.separator.as_deref());
            let decimal_comma = opts.decimal.as_deref() == Some(",");
            let (mut t, total) = columnar::read_csv_columns(&buffer, delimiter, decimal_comma, limit)?;
            t.kind = sep_name.to_string();
            (t, total)
        }
        other => {
            let t = formats::read_table(file_path, other)?;
            let n = t.nrows();
            (t, n)
        }
    };
    let mut ds = ColumnarDataset::from_table(table, total, limit);
    if ds.truncated {
        ds.notes.push(format!(
            "Il file ha {} righe: caricate solo le prime {} (limite righe). Usare il ricampionamento o aumentare il limite.",
            ds.total_rows,
            ds.nrows()
        ));
    }
    ds.parse_ms = started.elapsed().as_secs_f64() * 1000.0;
    Ok(ds)
}

fn detect_delimiter(buffer: &[u8], separator: Option<&str>) -> (u8, &'static str) {
    match separator {
        Some(",") => (b',', ", (Comma)"),
        Some(";") => (b';', "; (Semicolon)"),
        Some("\t") | Some("tab") => (b'\t', "\\t (Tab)"),
        Some("|") => (b'|', "| (Pipe)"),
        Some(custom) if !custom.is_empty() => (custom.as_bytes()[0], "Custom"),
        _ => {
            let end = buffer.iter().position(|&b| b == b'\n').unwrap_or(buffer.len());
            let first = &buffer[..end];
            let count = |c: u8| first.iter().filter(|&&b| b == c).count();
            let (comma, semi, tab) = (count(b','), count(b';'), count(b'\t'));
            if semi > comma && semi >= tab {
                (b';', "; (Semicolon Auto)")
            } else if tab > comma && tab > semi {
                (b'\t', "\\t (Tab Auto)")
            } else {
                (b',', ", (Comma Auto)")
            }
        }
    }
}

/// Reads any supported file into the row-of-text preview (tests and compatibility).
pub fn read_dataset(file_path: String, options: Option<ParseOptions>) -> Result<DatasetPreview, String> {
    load_columnar(&file_path, options).map(|d| d.to_preview())
}

pub fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as u32;
    let m_adj = if m > 2 { m - 3 } else { m + 9 };
    let doy = (153 * m_adj + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + (doe as i64) - 719468
}

pub fn parse_timestamp_to_epoch(ts: &str) -> Option<i64> {
    let s = ts.trim();
    if s.is_empty() {
        return None;
    }
    // Split date and time by space or 'T'
    let norm = s.replace('T', " ");
    let mut parts = norm.split_whitespace();
    let date_part = parts.next()?;
    let time_part = parts.next().unwrap_or("00:00:00");

    let (year, month, day) = if date_part.contains('-') {
        let dparts: Vec<&str> = date_part.split('-').collect();
        if dparts.len() != 3 {
            return None;
        }
        let p0 = dparts[0].parse::<i64>().ok()?;
        let p1 = dparts[1].parse::<u32>().ok()?;
        let p2 = dparts[2].parse::<u32>().ok()?;
        if p0 > 1900 {
            (p0, p1, p2)
        } else {
            (p2 as i64, p1, p0 as u32)
        }
    } else if date_part.contains('/') {
        let dparts: Vec<&str> = date_part.split('/').collect();
        if dparts.len() != 3 {
            return None;
        }
        let p0 = dparts[0].parse::<i64>().ok()?;
        let p1 = dparts[1].parse::<u32>().ok()?;
        let p2 = dparts[2].parse::<i64>().ok()?;
        if p0 > 1900 {
            (p0, p1, p2 as u32)
        } else {
            (p2, p1, p0 as u32)
        }
    } else {
        return None;
    };

    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }

    let tparts: Vec<&str> = time_part.split(':').collect();
    let hour = tparts.first().and_then(|v| v.parse::<i64>().ok()).unwrap_or(0);
    let minute = tparts.get(1).and_then(|v| v.parse::<i64>().ok()).unwrap_or(0);
    let second = tparts
        .get(2)
        .and_then(|v| v.split('.').next())
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    let days = days_from_civil(year, month, day);
    Some(days * 86400 + hour * 3600 + minute * 60 + second)
}

pub fn aggregate_slice(vals: &mut [f64], method: &str) -> f64 {
    if vals.is_empty() {
        return f64::NAN;
    }
    match method {
        "max" => vals.iter().copied().fold(f64::NEG_INFINITY, f64::max),
        "min" => vals.iter().copied().fold(f64::INFINITY, f64::min),
        "sum" => vals.iter().sum(),
        "median" | "p50" => {
            vals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let mid = vals.len() / 2;
            if vals.len() % 2 == 0 {
                (vals[mid - 1] + vals[mid]) / 2.0
            } else {
                vals[mid]
            }
        }
        "p5" => {
            vals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let idx = ((vals.len() as f64 - 1.0) * 0.05).round() as usize;
            vals[idx.min(vals.len() - 1)]
        }
        "p95" => {
            vals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let idx = ((vals.len() as f64 - 1.0) * 0.95).round() as usize;
            vals[idx.min(vals.len() - 1)]
        }
        _ => vals.iter().sum::<f64>() / (vals.len() as f64), // default: mean
    }
}

pub fn interval_to_seconds(interval: &str) -> i64 {
    match interval.trim().to_lowercase().as_str() {
        "1m" | "1min" => 60,
        "5m" | "5min" => 300,
        "10m" | "10min" => 600,
        "15m" | "15min" => 900,
        "30m" | "30min" => 1800,
        "1h" | "60m" => 3600,
        "3h" => 10800,
        "6h" => 21600,
        "12h" => 43200,
        "1d" | "24h" => 86400,
        "7d" | "1w" => 604800,
        _ => 3600,
    }
}


/// Re-samples text rows onto a regular time grid (compatibility wrapper over [`resample_table`]).
pub fn resample_rows(
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
    timestamp_col: String,
    interval: String,
    agg_method: String,
) -> Result<DatasetPreview, String> {
    let ts_idx = columns.iter().position(|c| c == &timestamp_col).unwrap_or(0);
    let mut table = table_from_rows(columns, &rows, false);
    // The timestamp column must stay text even if it happens to parse as a number.
    if let formats::Col::Num(_) = table.cols[ts_idx] {
        table.cols[ts_idx] = formats::Col::Str(rows.iter().map(|r| r.get(ts_idx).cloned().unwrap_or_default()).collect());
    }
    Ok(resampled_dataset(&table, ts_idx, &timestamp_col, &interval, &agg_method).to_preview())
}

/// Re-samples a typed table and wraps the result with its metadata.
pub fn resampled_dataset(table: &formats::Table, ts_idx: usize, timestamp_col: &str, interval: &str, agg_method: &str) -> ColumnarDataset {
    let method = agg_method.trim().to_lowercase();
    let mut t = resample_table(table, ts_idx, interval_to_seconds(interval), &method);
    t.kind = format!("Resampled ({} | {})", interval, method.to_uppercase());
    let n = t.nrows();
    let mut ds = ColumnarDataset::from_table(t, n, usize::MAX);
    ds.suggested_ts_col = Some(timestamp_col.to_string());
    ds.suggested_ts_format = Some("%Y-%m-%d %H:%M:%S".to_string());
    ds.row_limit = n;
    ds
}

/// Reads a file and re-samples it (the timestamp column plus `value_cols`, or all columns).
pub fn resample_file(
    file_path: String,
    timestamp_col: String,
    value_cols: Vec<String>,
    interval: String,
    agg_method: String,
) -> Result<DatasetPreview, String> {
    let raw = load_columnar(
        &file_path,
        Some(ParseOptions { separator: None, decimal: None, timestamp_col: Some(timestamp_col.clone()), timestamp_format: None, max_rows: Some(usize::MAX) }),
    )?;
    let mut table = formats::Table::default();
    for (name, col) in raw.columns.into_iter().zip(raw.cols) {
        if name == timestamp_col || value_cols.is_empty() || value_cols.iter().any(|v| v == &name) {
            table.push(name, col);
        }
    }
    let ts_idx = table.names.iter().position(|c| c == &timestamp_col).ok_or("Colonna timestamp non trovata")?;
    Ok(resampled_dataset(&table, ts_idx, &timestamp_col, &interval, &agg_method).to_preview())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_civil_roundtrip() {
        let days = days_from_civil(2026, 9, 15);
        let (y, m, d) = civil_from_days(days);
        assert_eq!((y, m, d), (2026, 9, 15));
    }

    #[test]
    fn test_timestamp_parsing_and_resampling() {
        let cols = vec!["timestamp".to_string(), "temp".to_string(), "zone".to_string()];
        let rows = vec![
            vec!["2026-09-01 00:10:00".to_string(), "20.0".to_string(), "A".to_string()],
            vec!["2026-09-01 00:40:00".to_string(), "22.0".to_string(), "A".to_string()],
            vec!["2026-09-01 01:15:00".to_string(), "24.0".to_string(), "B".to_string()],
        ];
        let res = resample_rows(
            cols,
            rows,
            "timestamp".to_string(),
            "1h".to_string(),
            "mean".to_string(),
        )
        .expect("resampling should succeed");

        assert_eq!(res.total_rows, 2);
        assert_eq!(res.rows[0][0], "2026-09-01 00:00:00");
        assert_eq!(res.rows[0][1], "21");
        assert_eq!(res.rows[0][2], "A");
        assert_eq!(res.rows[1][0], "2026-09-01 01:00:00");
        assert_eq!(res.rows[1][1], "24");
    }
}

/// Size and SHA-256 of a data file, stored in projects so that a project reopened on different
/// data is detected.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct FileFingerprint {
    pub size: u64,
    pub sha256: String,
}

pub fn file_fingerprint(path: &str) -> Result<FileFingerprint, String> {
    use sha2::{Digest, Sha256};
    let mut f = File::open(path).map_err(|e| format!("Impossibile aprire {}: {}", path, e))?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    let mut size = 0u64;
    loop {
        let n = f.read(&mut buf).map_err(|e| format!("Errore lettura {}: {}", path, e))?;
        if n == 0 {
            break;
        }
        size += n as u64;
        h.update(&buf[..n]);
    }
    let sha256 = h.finalize().iter().map(|b| format!("{:02x}", b)).collect();
    Ok(FileFingerprint { size, sha256 })
}
