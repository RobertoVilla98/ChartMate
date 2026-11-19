use tauri::Manager;

mod webview2_loader;
use serde::{Deserialize, Serialize};

// File readers and re-sampling live in the Tauri-free `chartmate-io` crate.
pub use chartmate_io::{detect_timestamp_metadata, DatasetPreview, ParseOptions};
use chartmate_io::formats::Table;
use chartmate_io::ColumnarDataset;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::Response;

/// The last raw dataset stays in the back end so that re-sampling does not send it back over the
/// IPC. Only one dataset is kept (the one shown in the interface).
#[derive(Default)]
struct DatasetCache {
    next_id: AtomicU64,
    last: Mutex<Option<(u64, Arc<Table>)>>,
}

impl DatasetCache {
    fn store(&self, ds: &ColumnarDataset) -> u64 {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let table = Table { names: ds.columns.clone(), cols: ds.cols.clone(), kind: ds.detected_sep.clone(), notes: vec![] };
        *self.last.lock().unwrap() = Some((id, Arc::new(table)));
        id
    }
}

/// Loads a file into typed columns and returns the binary message decoded by
/// `tauri-app/src/data/table.ts` (numbers as raw f64, no text conversion, no JSON for the data).
#[tauri::command(async)]
fn load_dataset(cache: tauri::State<'_, DatasetCache>, file_path: String, options: Option<ParseOptions>) -> Result<Response, String> {
    let ds = chartmate_io::load_columnar(&file_path, options)?;
    let id = cache.store(&ds);
    Ok(Response::new(ds.encode(id)))
}

/// Re-samples the cached raw dataset `dataset_id`.
#[tauri::command(async)]
fn resample_loaded(
    cache: tauri::State<'_, DatasetCache>,
    dataset_id: u64,
    timestamp_col: String,
    interval: String,
    agg_method: String,
) -> Result<Response, String> {
    let table = {
        let guard = cache.last.lock().unwrap();
        match guard.as_ref() {
            Some((id, t)) if *id == dataset_id => t.clone(),
            _ => return Err("Il dataset non è più in memoria: ricaricare il file.".into()),
        }
    };
    let ts_idx = table.names.iter().position(|c| c == &timestamp_col).unwrap_or(0);
    let ds = chartmate_io::resampled_dataset(&table, ts_idx, &timestamp_col, &interval, &agg_method);
    // The re-sampled table is derived data: it keeps the source id so that a new re-sampling
    // always starts again from the raw data.
    Ok(Response::new(ds.encode(dataset_id)))
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

/// Heavy commands use `#[tauri::command(async)]`: Tauri v2 runs plain commands on the main
/// thread, which froze the window while a large file was being parsed.
#[tauri::command(async)]
fn file_fingerprint(file_path: String) -> Result<chartmate_io::FileFingerprint, String> {
    chartmate_io::file_fingerprint(&file_path)
}

#[tauri::command(async)]
fn read_dataset_sample(file_path: String, options: Option<ParseOptions>) -> Result<DatasetPreview, String> {
    chartmate_io::read_dataset(file_path, options)
}

#[tauri::command(async)]
fn resample_in_memory(
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
    timestamp_col: String,
    interval: String,
    agg_method: String,
) -> Result<DatasetPreview, String> {
    chartmate_io::resample_rows(columns, rows, timestamp_col, interval, agg_method)
}

#[tauri::command(async)]
fn resample_timeseries(
    file_path: String,
    timestamp_col: String,
    value_cols: Vec<String>,
    interval: String,
    agg_method: String,
) -> Result<DatasetPreview, String> {
    chartmate_io::resample_file(file_path, timestamp_col, value_cols, interval, agg_method)
}

/// Resolves where `projects.json` lives.
///
/// 1. Portable mode: a `projects.json` (or the portable `ChartMate.exe`) next to the executable.
/// 2. Development: an existing `projects.json` in the working directory or its parent.
/// 3. Installed app (macOS `.app`, Linux AppImage/deb/rpm, Windows installer): the per-user
///    application data directory, because the executable's folder is read-only there.
fn get_projects_file_path(app: &tauri::AppHandle) -> std::path::PathBuf {
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
            if parent_p.exists() {
                return parent_p;
            }
        }
    }
    match app.path().app_data_dir() {
        Ok(dir) => {
            let _ = std::fs::create_dir_all(&dir);
            dir.join("projects.json")
        }
        Err(_) => std::path::PathBuf::from("projects.json"),
    }
}

#[tauri::command]
fn load_projects_store(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let path = get_projects_file_path(&app);
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
fn save_projects_store(app: tauri::AppHandle, data: serde_json::Value) -> Result<(), String> {
    let path = get_projects_file_path(&app);
    let json_str = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Errore serializzazione progetti: {}", e))?;
    std::fs::write(&path, json_str)
        .map_err(|e| format!("Errore scrittura file projects.json ({}): {}", path.display(), e))?;
    Ok(())
}

#[tauri::command(async)]
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

#[tauri::command(async)]
fn execute_sql_query(
    cache: tauri::State<'_, DatasetCache>,
    config: SqlConnectionConfig,
    query: String,
    max_rows: Option<usize>,
) -> Result<Response, String> {
    use mysql::prelude::*;
    use mysql::{Conn, OptsBuilder, Value};

    // Same convention as the file readers: None = default limit, Some(0) = all rows.
    let limit = chartmate_io::columnar::effective_limit(max_rows);

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

    let mut table = chartmate_io::table_from_rows(columns, &rows, false);
    table.kind = format!("MySQL ({})", config.database);
    let ds = ColumnarDataset::from_table(table, total_rows, limit);
    let id = cache.store(&ds);
    Ok(Response::new(ds.encode(id)))
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    webview2_loader::ensure_loaded();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(DatasetCache::default())
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
            load_dataset,
            resample_loaded,
            file_fingerprint,
            load_projects_store,
            save_projects_store,
            test_sql_connection,
            execute_sql_query,
            resample_in_memory,
            resample_timeseries
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
