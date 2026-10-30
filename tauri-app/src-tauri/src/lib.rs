use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;

#[derive(Debug, Serialize, Deserialize)]
pub struct DatasetPreview {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub total_rows: usize,
    pub detected_sep: String,
    pub suggested_ts_col: Option<String>,
    pub suggested_ts_format: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ParseOptions {
    pub separator: Option<String>,
    pub decimal: Option<String>,
    pub timestamp_col: Option<String>,
    pub timestamp_format: Option<String>,
    pub max_rows: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SqlConnectionConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub user: String,
    pub password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SqlConnectionStatus {
    pub connected: bool,
    pub latency_ms: u128,
    pub tables: Vec<String>,
    pub message: String,
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
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

fn epoch_secs_to_iso(secs: i64) -> String {
    let days = secs.div_euclid(86400);
    let rem = secs.rem_euclid(86400);
    let h = rem / 3600;
    let m = (rem % 3600) / 60;
    let s = rem % 60;
    let (year, month, day) = civil_from_days(days);
    format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", year, month, day, h, m, s)
}

fn format_parquet_field(field: &parquet::record::Field) -> String {
    use parquet::record::Field;
    match field {
        Field::Null => String::new(),
        Field::Bool(b) => b.to_string(),
        Field::Byte(b) => b.to_string(),
        Field::Short(s) => s.to_string(),
        Field::Int(i) => i.to_string(),
        Field::Long(l) => l.to_string(),
        Field::UByte(b) => b.to_string(),
        Field::UShort(s) => s.to_string(),
        Field::UInt(i) => i.to_string(),
        Field::ULong(l) => l.to_string(),
        Field::Float(f) => f.to_string(),
        Field::Double(d) => d.to_string(),
        Field::Str(s) => s.clone(),
        Field::Bytes(b) => String::from_utf8_lossy(b.data()).to_string(),
        Field::Date(days) => {
            let (y, m, d) = civil_from_days(*days as i64);
            format!("{:04}-{:02}-{:02}", y, m, d)
        }
        Field::TimestampMillis(ms) => epoch_secs_to_iso((*ms as i64).div_euclid(1000)),
        Field::TimestampMicros(us) => epoch_secs_to_iso((*us as i64).div_euclid(1_000_000)),
        _ => field.to_string(),
    }
}


fn detect_timestamp_metadata(headers: &[String], rows: &[Vec<String>]) -> (Option<String>, Option<String>) {
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

#[tauri::command]
fn read_dataset_sample(file_path: String, options: Option<ParseOptions>) -> Result<DatasetPreview, String> {
    let opts = options.unwrap_or(ParseOptions {
        separator: None,
        decimal: None,
        timestamp_col: None,
        timestamp_format: None,
        max_rows: None,
    });

    let limit = match opts.max_rows {
        Some(m) if m > 0 => m,
        _ => 500_000,
    };

    // 1. Check if Apache Parquet (.parquet, .pq)
    let lower_path = file_path.to_lowercase();
    if lower_path.ends_with(".parquet") || lower_path.ends_with(".pq") {
        use parquet::file::reader::{FileReader, SerializedFileReader};
        let file = File::open(&file_path)
            .map_err(|e| format!("Impossibile aprire file Parquet: {}", e))?;
        let reader = SerializedFileReader::new(file)
            .map_err(|e| format!("Errore decodifica struttura Parquet: {}", e))?;

        let metadata = reader.metadata();
        let total_rows = metadata.file_metadata().num_rows().max(0) as usize;
        let schema = metadata.file_metadata().schema_descr();
        let columns: Vec<String> = schema.columns().iter().map(|c| c.name().to_string()).collect();

        let iter = reader.get_row_iter(None)
            .map_err(|e| format!("Errore iterazione record Parquet: {}", e))?;

        let mut rows = Vec::new();
        for record_res in iter {
            if rows.len() >= limit {
                break;
            }
            if let Ok(row) = record_res {
                let mut row_vals = vec![String::new(); columns.len()];
                for (name, field) in row.get_column_iter() {
                    if let Some(pos) = columns.iter().position(|c| c == name) {
                        row_vals[pos] = format_parquet_field(field);
                    }
                }
                rows.push(row_vals);
            }
        }

        let (ts_col, ts_fmt) = detect_timestamp_metadata(&columns, &rows);

        return Ok(DatasetPreview {
            columns,
            rows,
            total_rows,
            detected_sep: "Apache Parquet (Columnar)".to_string(),
            suggested_ts_col: ts_col,
            suggested_ts_format: ts_fmt,
        });
    }

    // 2. Check if Excel (.xlsx, .xls)
    if lower_path.ends_with(".xlsx") || lower_path.ends_with(".xls") {
        use calamine::{open_workbook_auto, Reader};
        let mut workbook = open_workbook_auto(&file_path)
            .map_err(|e| format!("Impossibile aprire file Excel: {}", e))?;

        let sheet_names = workbook.sheet_names();
        let sheet_name = sheet_names.first().ok_or("Nessun foglio trovato nel file Excel")?;

        let range = workbook.worksheet_range(sheet_name)
            .map_err(|e| format!("Errore lettura foglio {}: {}", sheet_name, e))?;

        let mut rows_iter = range.rows();
        let header_row = rows_iter.next().ok_or("Il foglio Excel è vuoto")?;

        let columns: Vec<String> = header_row.iter().map(|cell| cell.to_string().trim().to_string()).collect();
        let mut rows = Vec::new();
        let mut count = 0;

        for r in rows_iter {
            count += 1;
            if rows.len() < limit {
                let row_vals: Vec<String> = r.iter().map(|cell| cell.to_string()).collect();
                rows.push(row_vals);
            }
        }

        let (ts_col, ts_fmt) = detect_timestamp_metadata(&columns, &rows);

        return Ok(DatasetPreview {
            columns,
            rows,
            total_rows: count,
            detected_sep: "Excel (Direct Workbook)".to_string(),
            suggested_ts_col: ts_col,
            suggested_ts_format: ts_fmt,
        });
    }

    // 2. Text Delimited (CSV, TSV, TXT)
    let mut file = File::open(&file_path).map_err(|e| format!("Impossibile aprire file: {}", e))?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| format!("Errore lettura file: {}", e))?;
    let content = String::from_utf8_lossy(&buffer);

    // Delimiter determination
    let (delimiter, sep_name) = match opts.separator.as_deref() {
        Some(",") => (b',', ", (Comma)"),
        Some(";") => (b';', "; (Semicolon)"),
        Some("\t") | Some("tab") => (b'\t', "\\t (Tab)"),
        Some("|") => (b'|', "| (Pipe)"),
        Some(custom) if !custom.is_empty() => (custom.as_bytes()[0], "Custom"),
        _ => {
            // Auto-detect from first line
            let first_line = content.lines().next().unwrap_or("");
            let comma_count = first_line.matches(',').count();
            let semicolon_count = first_line.matches(';').count();
            let tab_count = first_line.matches('\t').count();

            if semicolon_count > comma_count && semicolon_count >= tab_count {
                (b';', "; (Semicolon Auto)")
            } else if tab_count > comma_count && tab_count > semicolon_count {
                (b'\t', "\\t (Tab Auto)")
            } else {
                (b',', ", (Comma Auto)")
            }
        }
    };

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .flexible(true)
        .has_headers(true)
        .from_reader(content.as_bytes());

    let headers = rdr.headers().map_err(|e| format!("Errore lettura intestazioni: {}", e))?;
    let columns: Vec<String> = headers.iter().map(|h| h.trim().to_string()).collect();

    let mut rows = Vec::new();
    let mut total_rows = 0;

    for result in rdr.records() {
        total_rows += 1;
        if rows.len() < limit {
            if let Ok(rec) = result {
                rows.push(rec.iter().map(|s| s.trim().to_string()).collect());
            }
        }
    }

    let (ts_col, ts_fmt) = detect_timestamp_metadata(&columns, &rows);

    Ok(DatasetPreview {
        columns,
        rows,
        total_rows,
        detected_sep: sep_name.to_string(),
        suggested_ts_col: ts_col,
        suggested_ts_format: ts_fmt,
    })
}

fn get_projects_file_path() -> std::path::PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let p = exe_dir.join("projects.json");
            if p.exists() || exe_dir.join("ChartMate.exe").exists() {
                return p;
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        let p = cwd.join("projects.json");
        if p.exists() {
            return p;
        }
        if let Some(parent) = cwd.parent() {
            let parent_p = parent.join("projects.json");
            if parent_p.exists() || parent.join("ChartMate.exe").exists() {
                return parent_p;
            }
        }
        return p;
    }
    std::path::PathBuf::from("projects.json")
}

#[tauri::command]
fn load_projects_store() -> Result<serde_json::Value, String> {
    let path = get_projects_file_path();
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Errore lettura file projects.json ({}): {}", path.display(), e))?;
    if content.trim().is_empty() {
        return Ok(serde_json::json!({}));
    }
    let val: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Errore decodifica JSON da projects.json: {}", e))?;
    Ok(val)
}

#[tauri::command]
fn save_projects_store(data: serde_json::Value) -> Result<(), String> {
    let path = get_projects_file_path();
    let json_str = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Errore serializzazione progetti: {}", e))?;
    std::fs::write(&path, json_str)
        .map_err(|e| format!("Errore scrittura file projects.json ({}): {}", path.display(), e))?;
    Ok(())
}

#[tauri::command]
fn test_sql_connection(config: SqlConnectionConfig) -> Result<SqlConnectionStatus, String> {
    use mysql::prelude::*;
    use mysql::{Conn, OptsBuilder};
    use std::time::Instant;

    let start = Instant::now();
    let mut builder = OptsBuilder::new()
        .ip_or_hostname(Some(config.host.trim()))
        .tcp_port(config.port)
        .db_name(Some(config.database.trim()))
        .user(Some(config.user.trim()));

    if let Some(ref pwd) = config.password {
        if !pwd.is_empty() {
            builder = builder.pass(Some(pwd));
        }
    }

    let mut conn = Conn::new(builder)
        .map_err(|e| format!("Connessione MySQL fallita: {}", e))?;

    let latency_ms = start.elapsed().as_millis();

    let tables: Vec<String> = conn
        .query("SHOW TABLES")
        .unwrap_or_default();

    Ok(SqlConnectionStatus {
        connected: true,
        latency_ms,
        tables: tables.clone(),
        message: format!("Connesso in {}ms ({} tabelle trovate)", latency_ms, tables.len()),
    })
}

#[tauri::command]
fn execute_sql_query(
    config: SqlConnectionConfig,
    query: String,
    max_rows: Option<usize>,
) -> Result<DatasetPreview, String> {
    use mysql::prelude::*;
    use mysql::{Conn, OptsBuilder, Value};

    let limit = match max_rows {
        Some(m) if m > 0 => m,
        _ => 100_000,
    };

    let mut builder = OptsBuilder::new()
        .ip_or_hostname(Some(config.host.trim()))
        .tcp_port(config.port)
        .db_name(Some(config.database.trim()))
        .user(Some(config.user.trim()));

    if let Some(ref pwd) = config.password {
        if !pwd.is_empty() {
            builder = builder.pass(Some(pwd));
        }
    }

    let mut conn = Conn::new(builder)
        .map_err(|e| format!("Connessione MySQL fallita: {}", e))?;

    let result = conn
        .query_iter(query.trim())
        .map_err(|e| format!("Errore esecuzione query SQL: {}", e))?;

    let columns: Vec<String> = result
        .columns()
        .as_ref()
        .iter()
        .map(|c| c.name_str().to_string())
        .collect();

    let mut rows = Vec::new();
    let mut total_rows = 0;

    for row_res in result {
        let row = row_res.map_err(|e| format!("Errore lettura riga SQL: {}", e))?;
        total_rows += 1;
        if rows.len() < limit {
            let mut row_vals = Vec::with_capacity(columns.len());
            for i in 0..columns.len() {
                let val_str = match row.as_ref(i) {
                    Some(Value::NULL) | None => String::new(),
                    Some(Value::Bytes(b)) => String::from_utf8_lossy(b).to_string(),
                    Some(Value::Int(n)) => n.to_string(),
                    Some(Value::UInt(u)) => u.to_string(),
                    Some(Value::Float(f)) => f.to_string(),
                    Some(Value::Double(d)) => d.to_string(),
                    Some(Value::Date(y, m, d, 0, 0, 0, 0)) => {
                        format!("{:04}-{:02}-{:02}", y, m, d)
                    }
                    Some(Value::Date(y, m, d, h, min, s, _)) => {
                        format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", y, m, d, h, min, s)
                    }
                    Some(Value::Time(neg, d, h, m, s, _)) => {
                        let sign = if *neg { "-" } else { "" };
                        format!("{}{:02}:{:02}:{:02}", sign, d * 24 + (*h as u32), m, s)
                    }
                };
                row_vals.push(val_str);
            }
            rows.push(row_vals);
        }
    }

    let (ts_col, ts_fmt) = detect_timestamp_metadata(&columns, &rows);

    Ok(DatasetPreview {
        columns,
        rows,
        total_rows,
        detected_sep: format!("MySQL ({})", config.database),
        suggested_ts_col: ts_col,
        suggested_ts_format: ts_fmt,
    })
}

fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
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

fn aggregate_slice(vals: &mut [f64], method: &str) -> f64 {
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

fn interval_to_seconds(interval: &str) -> i64 {
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

#[tauri::command]
fn resample_in_memory(
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
    timestamp_col: String,
    interval: String,
    agg_method: String,
) -> Result<DatasetPreview, String> {
    let ts_idx = columns
        .iter()
        .position(|c| c == &timestamp_col)
        .unwrap_or(0);

    let step_secs = interval_to_seconds(&interval);
    let method = agg_method.trim().to_lowercase();

    use std::collections::BTreeMap;
    // Map bucket_epoch -> (per-column numeric values Vec<f64>, per-column fallback string)
    let ncols = columns.len();
    let mut buckets: BTreeMap<i64, (Vec<Vec<f64>>, Vec<String>)> = BTreeMap::new();

    for row in &rows {
        let Some(ts_str) = row.get(ts_idx) else { continue };
        let Some(epoch) = parse_timestamp_to_epoch(ts_str) else { continue };
        let bucket_epoch = epoch.div_euclid(step_secs) * step_secs;

        let entry = buckets
            .entry(bucket_epoch)
            .or_insert_with(|| (vec![Vec::new(); ncols], vec![String::new(); ncols]));

        for col_i in 0..ncols {
            if col_i == ts_idx {
                continue;
            }
            if let Some(cell) = row.get(col_i) {
                let trimmed = cell.trim().replace(',', ".");
                if let Ok(num) = trimmed.parse::<f64>() {
                    if num.is_finite() {
                        entry.0[col_i].push(num);
                    }
                } else if entry.1[col_i].is_empty() && !cell.trim().is_empty() {
                    entry.1[col_i] = cell.trim().to_string();
                }
            }
        }
    }

    let mut out_rows = Vec::with_capacity(buckets.len());
    for (bucket_epoch, (mut num_vecs, str_fallbacks)) in buckets {
        let mut out_row = vec![String::new(); ncols];
        out_row[ts_idx] = epoch_secs_to_iso(bucket_epoch);
        for col_i in 0..ncols {
            if col_i == ts_idx {
                continue;
            }
            if !num_vecs[col_i].is_empty() {
                let agg_val = aggregate_slice(&mut num_vecs[col_i], &method);
                // Format cleanly with up to 4 decimals, stripping trailing zeros
                let formatted = format!("{:.4}", agg_val);
                let clean = formatted.trim_end_matches('0').trim_end_matches('.').to_string();
                out_row[col_i] = if clean.is_empty() || clean == "-0" { "0".to_string() } else { clean };
            } else {
                out_row[col_i] = str_fallbacks[col_i].clone();
            }
        }
        out_rows.push(out_row);
    }

    let total_rows = out_rows.len();
    Ok(DatasetPreview {
        columns,
        rows: out_rows,
        total_rows,
        detected_sep: format!("Resampled ({} | {})", interval, method.to_uppercase()),
        suggested_ts_col: Some(timestamp_col),
        suggested_ts_format: Some("%Y-%m-%d %H:%M:%S".to_string()),
    })
}

#[tauri::command]
fn resample_timeseries(
    file_path: String,
    timestamp_col: String,
    value_cols: Vec<String>,
    interval: String,
    agg_method: String,
) -> Result<DatasetPreview, String> {
    let raw = read_dataset_sample(
        file_path,
        Some(ParseOptions {
            separator: None,
            decimal: None,
            timestamp_col: Some(timestamp_col.clone()),
            timestamp_format: None,
            max_rows: Some(2_000_000),
        }),
    )?;

    // If specific value_cols are given and non-empty, keep timestamp_col + value_cols; otherwise keep all columns
    if value_cols.is_empty() {
        return resample_in_memory(raw.columns, raw.rows, timestamp_col, interval, agg_method);
    }

    let mut selected_indices = Vec::new();
    let mut filtered_cols = Vec::new();
    for (idx, col) in raw.columns.iter().enumerate() {
        if col == &timestamp_col || value_cols.iter().any(|vc| vc == col) {
            selected_indices.push(idx);
            filtered_cols.push(col.clone());
        }
    }

    let filtered_rows: Vec<Vec<String>> = raw
        .rows
        .into_iter()
        .map(|r| selected_indices.iter().map(|&i| r.get(i).cloned().unwrap_or_default()).collect())
        .collect();

    resample_in_memory(filtered_cols, filtered_rows, timestamp_col, interval, agg_method)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AshraeCalibrationResult {
    pub n: usize,
    pub mean_measured: f64,
    pub mean_simulated: f64,
    pub nmbe_pct: f64,
    pub cv_rmse_pct: f64,
    pub rmse: f64,
    pub mae: f64,
    pub r_squared: f64,
    pub ashrae_hourly_pass: bool,
    pub ashrae_monthly_pass: bool,
}

#[tauri::command]
fn compute_ashrae_calibration(
    measured: Vec<f64>,
    simulated: Vec<f64>,
) -> Result<AshraeCalibrationResult, String> {
    let pairs: Vec<(f64, f64)> = measured
        .into_iter()
        .zip(simulated.into_iter())
        .filter(|(m, s)| m.is_finite() && s.is_finite())
        .collect();

    let n = pairs.len();
    if n < 2 {
        return Err("Almeno 2 coppie di dati validi sono richieste per la calibrazione ASHRAE G14".to_string());
    }

    let nf = n as f64;
    let mean_m = pairs.iter().map(|(m, _)| *m).sum::<f64>() / nf;
    let mean_s = pairs.iter().map(|(_, s)| *s).sum::<f64>() / nf;

    let sum_err: f64 = pairs.iter().map(|(m, s)| m - s).sum();
    let sum_sq_err: f64 = pairs.iter().map(|(m, s)| (m - s).powi(2)).sum();
    let sum_abs_err: f64 = pairs.iter().map(|(m, s)| (m - s).abs()).sum();
    let ss_tot: f64 = pairs.iter().map(|(m, _)| (m - mean_m).powi(2)).sum();

    let denom_mean = if mean_m.abs() > 1e-9 { mean_m } else { 1.0 };
    // ASHRAE Guideline 14 formulas use (n - 1) for NMBE and CV(RMSE)
    let nmbe_pct = (sum_err / ((nf - 1.0) * denom_mean)) * 100.0;
    let rmse = (sum_sq_err / (nf - 1.0)).sqrt();
    let cv_rmse_pct = (rmse / denom_mean.abs()) * 100.0;
    let mae = sum_abs_err / nf;
    let r_squared = if ss_tot > 1e-12 {
        1.0 - (sum_sq_err / ss_tot)
    } else {
        1.0
    };

    let ashrae_hourly_pass = nmbe_pct.abs() <= 10.0 && cv_rmse_pct <= 30.0;
    let ashrae_monthly_pass = nmbe_pct.abs() <= 5.0 && cv_rmse_pct <= 15.0;

    Ok(AshraeCalibrationResult {
        n,
        mean_measured: mean_m,
        mean_simulated: mean_s,
        nmbe_pct,
        cv_rmse_pct,
        rmse,
        mae,
        r_squared,
        ashrae_hourly_pass,
        ashrae_monthly_pass,
    })
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
        let res = resample_in_memory(
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

    #[test]
    fn test_ashrae_calibration_metrics() {
        let measured = vec![20.0, 22.0, 24.0, 26.0, 23.0];
        let simulated = vec![20.2, 21.8, 23.9, 25.7, 23.1];
        let cal = compute_ashrae_calibration(measured, simulated).expect("calibration should succeed");
        assert_eq!(cal.n, 5);
        assert!(cal.nmbe_pct.abs() < 2.0);
        assert!(cal.cv_rmse_pct < 5.0);
        assert!(cal.r_squared > 0.98);
        assert!(cal.ashrae_hourly_pass);
        assert!(cal.ashrae_monthly_pass);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_dataset_sample,
            load_projects_store,
            save_projects_store,
            test_sql_connection,
            execute_sql_query,
            resample_in_memory,
            resample_timeseries,
            compute_ashrae_calibration
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
