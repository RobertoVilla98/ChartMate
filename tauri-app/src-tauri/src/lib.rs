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

    if ts_col.is_none() && !headers.is_empty() {
        // Fallback: check first column
        ts_col = Some(headers[0].clone());
        ts_idx = Some(0);
    }

    let mut detected_format = None;

    // Check sample values
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
        max_rows: Some(100),
    });

    let limit = opts.max_rows.unwrap_or(100);

    // 1. Check if Excel (.xlsx, .xls)
    if file_path.ends_with(".xlsx") || file_path.ends_with(".xls") {
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
        .invoke_handler(tauri::generate_handler![read_dataset_sample])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
