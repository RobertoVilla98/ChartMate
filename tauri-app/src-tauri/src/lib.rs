use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;

#[derive(Debug, Serialize, Deserialize)]
pub struct DatasetPreview {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub total_rows: usize,
    pub detected_sep: String,
}

#[tauri::command]
fn read_dataset_sample(file_path: String, max_preview_rows: Option<usize>) -> Result<DatasetPreview, String> {
    let limit = max_preview_rows.unwrap_or(50);
    
    // Check if Excel
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
        
        return Ok(DatasetPreview {
            columns,
            rows,
            total_rows: count,
            detected_sep: "Excel (Sheet 1)".to_string(),
        });
    }

    // Text Delimited (CSV / TSV / TXT)
    let mut file = File::open(&file_path).map_err(|e| format!("Impossibile aprire file: {}", e))?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| format!("Errore lettura file: {}", e))?;
    let content = String::from_utf8_lossy(&buffer);

    // Auto-detect delimiter from first lines
    let first_line = content.lines().next().unwrap_or("");
    let comma_count = first_line.matches(',').count();
    let semicolon_count = first_line.matches(';').count();
    let tab_count = first_line.matches('\t').count();

    let delimiter = if semicolon_count > comma_count && semicolon_count >= tab_count {
        b';'
    } else if tab_count > comma_count && tab_count > semicolon_count {
        b'\t'
    } else {
        b','
    };

    let sep_name = match delimiter {
        b';' => "; (Semicolon)",
        b'\t' => "\\t (Tab)",
        _ => ", (Comma)",
    };

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .flexible(true)
        .has_headers(true)
        .from_reader(content.as_bytes());

    let headers = rdr.headers().map_err(|e| format!("Errore lettura header: {}", e))?;
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

    Ok(DatasetPreview {
        columns,
        rows,
        total_rows,
        detected_sep: sep_name.to_string(),
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
