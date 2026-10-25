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
            execute_sql_query
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
