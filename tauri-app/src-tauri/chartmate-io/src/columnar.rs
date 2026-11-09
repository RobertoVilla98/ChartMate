//! Column-oriented loading, binary encoding for the IPC, and column-wise re-sampling.
//!
//! The first benchmark (bench/results, 2026-11-09) showed that converting every value to a text
//! cell, serialising it as JSON and parsing it again in JavaScript dominated the load time of
//! binary formats (2-3 s for 10^6 x 9 values). Since v0.3 the engine keeps numbers as `f64`
//! columns end to end:
//!
//! * readers fill typed columns ([`Col::Num`] / [`Col::Str`]) directly;
//! * [`ColumnarDataset::encode`] writes a compact binary message: numeric columns are raw
//!   little-endian `f64` arrays (the front end wraps them in a `Float64Array` without copying),
//!   text columns are one UTF-8 blob with `\0` separators;
//! * the last raw table stays in the back end, so re-sampling does not send the data back.
//!
//! Binary layout (all integers little-endian):
//! ```text
//! "CMB1" | u32 header_len | header (UTF-8 JSON) | zero padding to a multiple of 8 | data section
//! ```
//! `header.cols[i]` = `{ "kind": "num" | "str", "offset": <byte offset from buffer start>,
//! "len": <bytes> }`; numeric offsets are 8-byte aligned.

use crate::formats::{fmt_num, Col, Table};
use crate::{detect_timestamp_metadata, DatasetPreview, DEFAULT_ROW_LIMIT};
use serde::Serialize;

/// A loaded dataset in column form plus the metadata the interface needs.
#[derive(Debug, Clone, Default)]
pub struct ColumnarDataset {
    pub columns: Vec<String>,
    pub cols: Vec<Col>,
    pub total_rows: usize,
    pub detected_sep: String,
    pub suggested_ts_col: Option<String>,
    pub suggested_ts_format: Option<String>,
    pub truncated: bool,
    pub row_limit: usize,
    pub notes: Vec<String>,
    pub parse_ms: f64,
}

impl ColumnarDataset {
    pub fn nrows(&self) -> usize {
        self.cols.iter().map(|c| c.len()).max().unwrap_or(0)
    }

    pub fn from_table(table: Table, total_rows: usize, limit: usize) -> Self {
        let mut t = table;
        for c in t.cols.iter_mut() {
            match c {
                Col::Num(v) => v.truncate(limit),
                Col::Str(v) => v.truncate(limit),
            }
        }
        let sample = sample_rows(&t.cols, 10);
        let (ts_col, ts_fmt) = detect_timestamp_metadata(&t.names, &sample);
        let n = t.cols.iter().map(|c| c.len()).max().unwrap_or(0);
        ColumnarDataset {
            columns: t.names,
            cols: t.cols,
            total_rows: total_rows.max(n),
            detected_sep: t.kind,
            suggested_ts_col: ts_col,
            suggested_ts_format: ts_fmt,
            truncated: total_rows > n,
            row_limit: limit,
            notes: t.notes,
            parse_ms: 0.0,
        }
    }

    /// Row-of-text representation (tests, benchmarks of the old path, MySQL compatibility).
    pub fn to_preview(&self) -> DatasetPreview {
        let n = self.nrows();
        let rows = (0..n).map(|i| self.cols.iter().map(|c| cell_text(c, i)).collect()).collect();
        DatasetPreview {
            columns: self.columns.clone(),
            rows,
            total_rows: self.total_rows,
            detected_sep: self.detected_sep.clone(),
            suggested_ts_col: self.suggested_ts_col.clone(),
            suggested_ts_format: self.suggested_ts_format.clone(),
            truncated: self.truncated,
            row_limit: self.row_limit,
            notes: self.notes.clone(),
            parse_ms: self.parse_ms,
        }
    }

    /// Binary message for the front end (see the module documentation).
    pub fn encode(&self, dataset_id: u64) -> Vec<u8> {
        #[derive(Serialize)]
        struct ColHdr {
            kind: &'static str,
            offset: usize,
            len: usize,
        }
        #[derive(Serialize)]
        struct Header<'a> {
            id: u64,
            columns: &'a [String],
            cols: Vec<ColHdr>,
            n_rows: usize,
            total_rows: usize,
            detected_sep: &'a str,
            suggested_ts_col: &'a Option<String>,
            suggested_ts_format: &'a Option<String>,
            truncated: bool,
            row_limit: usize,
            notes: &'a [String],
            parse_ms: f64,
        }

        // Data section first (relative offsets), then the header with absolute offsets.
        let mut data: Vec<u8> = Vec::with_capacity(self.cols.iter().map(|c| c.len() * 8).sum());
        let mut rel: Vec<(&'static str, usize, usize)> = Vec::with_capacity(self.cols.len());
        for c in &self.cols {
            while data.len() % 8 != 0 {
                data.push(0);
            }
            let start = data.len();
            match c {
                Col::Num(v) => {
                    for x in v {
                        data.extend_from_slice(&x.to_le_bytes());
                    }
                    rel.push(("num", start, v.len() * 8));
                }
                Col::Str(v) => {
                    for (i, s) in v.iter().enumerate() {
                        if i > 0 {
                            data.push(0);
                        }
                        if s.as_bytes().contains(&0) {
                            data.extend(s.bytes().filter(|&b| b != 0));
                        } else {
                            data.extend_from_slice(s.as_bytes());
                        }
                    }
                    rel.push(("str", start, data.len() - start));
                }
            }
        }

        let make_header = |base: usize| -> Vec<u8> {
            let h = Header {
                id: dataset_id,
                columns: &self.columns,
                cols: rel.iter().map(|&(k, o, l)| ColHdr { kind: k, offset: base + o, len: l }).collect(),
                n_rows: self.nrows(),
                total_rows: self.total_rows,
                detected_sep: &self.detected_sep,
                suggested_ts_col: &self.suggested_ts_col,
                suggested_ts_format: &self.suggested_ts_format,
                truncated: self.truncated,
                row_limit: self.row_limit,
                notes: &self.notes,
                parse_ms: self.parse_ms,
            };
            serde_json::to_vec(&h).expect("header serialisation")
        };
        // The base offset depends on the header length, which depends on the offsets: iterate
        // until stable (two rounds at most, since digit counts barely change).
        let mut base = 0usize;
        let mut header = make_header(base);
        for _ in 0..4 {
            let b = (8 + header.len()).div_ceil(8) * 8;
            if b == base {
                break;
            }
            base = b;
            header = make_header(base);
        }
        let mut out = Vec::with_capacity(base + data.len());
        out.extend_from_slice(b"CMB1");
        out.extend_from_slice(&(header.len() as u32).to_le_bytes());
        out.extend_from_slice(&header);
        // Pad with spaces (valid trailing JSON whitespace would be ignored anyway).
        while out.len() < base {
            out.push(b' ');
        }
        out.extend_from_slice(&data);
        out
    }
}

pub fn cell_text(c: &Col, i: usize) -> String {
    match c {
        Col::Num(v) => v.get(i).map(|x| fmt_num(*x)).unwrap_or_default(),
        Col::Str(v) => v.get(i).cloned().unwrap_or_default(),
    }
}

fn sample_rows(cols: &[Col], n: usize) -> Vec<Vec<String>> {
    let len = cols.iter().map(|c| c.len()).max().unwrap_or(0).min(n);
    (0..len).map(|i| cols.iter().map(|c| cell_text(c, i)).collect()).collect()
}

// ------------------------------------------------------------------ numbers in text ---

/// Parses a numeric cell. Accepts `1234.5`, `-1e-3`, and with `decimal_comma` also `1234,5`.
/// Returns `Some(NaN)` for an empty cell, `None` for text.
#[inline]
pub fn parse_num(s: &str, decimal_comma: bool) -> Option<f64> {
    let t = s.trim();
    if t.is_empty() || t.eq_ignore_ascii_case("nan") || t.eq_ignore_ascii_case("na") || t == "null" || t == "None" {
        return Some(f64::NAN);
    }
    if let Ok(v) = t.parse::<f64>() {
        return Some(v);
    }
    if decimal_comma || (t.contains(',') && !t.contains('.')) {
        if let Ok(v) = t.replace('.', "").replace(',', ".").parse::<f64>() {
            return Some(v);
        }
    }
    None
}

/// Builds a typed table from text rows: a column is numeric when every non-empty cell parses.
pub fn table_from_rows(names: Vec<String>, rows: &[Vec<String>], decimal_comma: bool) -> Table {
    let ncols = names.len();
    let mut table = Table::default();
    for (j, name) in names.into_iter().enumerate() {
        let mut nums = Vec::with_capacity(rows.len());
        let mut numeric = true;
        for r in rows {
            match parse_num(r.get(j).map(|s| s.as_str()).unwrap_or(""), decimal_comma) {
                Some(v) => nums.push(v),
                None => {
                    numeric = false;
                    break;
                }
            }
        }
        if numeric {
            table.push(name, Col::Num(nums));
        } else {
            table.push(name, Col::Str(rows.iter().map(|r| r.get(j).map(|s| s.trim().to_string()).unwrap_or_default()).collect()));
        }
    }
    let _ = ncols;
    table
}

// ---------------------------------------------------------------------- CSV ---

/// Reads delimited text into typed columns. Column types are decided on the first 200 rows; a
/// numeric column that later meets text is re-read as text in a second pass (rare).
pub fn read_csv_columns(content: &[u8], delimiter: u8, decimal_comma: bool, limit: usize) -> Result<(Table, usize), String> {
    let mk = || {
        csv::ReaderBuilder::new()
            .delimiter(delimiter)
            .flexible(true)
            .has_headers(true)
            .from_reader(content)
    };
    let mut rdr = mk();
    let headers: Vec<String> = rdr
        .headers()
        .map_err(|e| format!("Errore lettura intestazioni: {}", e))?
        .iter()
        .map(|h| h.trim().trim_start_matches('\u{feff}').to_string())
        .collect();
    let ncols = headers.len();

    // Type inference on a sample.
    let mut is_text = vec![false; ncols];
    {
        let mut r2 = mk();
        let mut rec = csv::StringRecord::new();
        let mut k = 0;
        while k < 200 && r2.read_record(&mut rec).map_err(|e| e.to_string())? {
            for j in 0..ncols {
                if !is_text[j] && parse_num(rec.get(j).unwrap_or(""), decimal_comma).is_none() {
                    is_text[j] = true;
                }
            }
            k += 1;
        }
    }

    let mut nums: Vec<Vec<f64>> = (0..ncols).map(|_| Vec::new()).collect();
    let mut texts: Vec<Vec<String>> = (0..ncols).map(|_| Vec::new()).collect();
    let mut demoted = vec![false; ncols];
    let mut total = 0usize;
    let mut rec = csv::StringRecord::new();
    while rdr.read_record(&mut rec).map_err(|e| format!("Errore lettura CSV: {}", e))? {
        total += 1;
        if total > limit {
            continue;
        }
        for j in 0..ncols {
            let cell = rec.get(j).unwrap_or("");
            if is_text[j] {
                texts[j].push(cell.trim().to_string());
            } else if !demoted[j] {
                match parse_num(cell, decimal_comma) {
                    Some(v) => nums[j].push(v),
                    None => demoted[j] = true,
                }
            }
        }
    }
    if demoted.iter().any(|&d| d) {
        let mut r3 = mk();
        let mut k = 0usize;
        while k < limit && r3.read_record(&mut rec).map_err(|e| e.to_string())? {
            for j in 0..ncols {
                if demoted[j] {
                    texts[j].push(rec.get(j).unwrap_or("").trim().to_string());
                }
            }
            k += 1;
        }
    }

    let mut table = Table::default();
    for (j, name) in headers.into_iter().enumerate() {
        if is_text[j] || demoted[j] {
            table.push(name, Col::Str(std::mem::take(&mut texts[j])));
        } else {
            table.push(name, Col::Num(std::mem::take(&mut nums[j])));
        }
    }
    Ok((table, total))
}

// ---------------------------------------------------------------- spreadsheets ---

pub fn read_spreadsheet_columns(path: &str, limit: usize) -> Result<(Table, usize), String> {
    use calamine::{open_workbook_auto, Data, Reader};
    let is_ods = path.to_lowercase().ends_with(".ods");
    let mut workbook = open_workbook_auto(path).map_err(|e| format!("Impossibile aprire foglio di calcolo: {}", e))?;
    let sheet_names = workbook.sheet_names();
    let sheet_name = sheet_names.first().ok_or("Nessun foglio trovato nel file")?.clone();
    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| format!("Errore lettura foglio {}: {}", sheet_name, e))?;
    let mut rows = range.rows();
    let header = rows.next().ok_or("Il foglio è vuoto")?;
    let names: Vec<String> = header.iter().map(|c| crate::spreadsheet_cell_to_string(c).trim().to_string()).collect();
    let ncols = names.len();
    let body: Vec<&[Data]> = rows.collect();
    let total = body.len();
    let n = total.min(limit);

    let numeric_cell = |d: &Data| -> Option<f64> {
        match d {
            Data::Float(f) => Some(*f),
            Data::Int(i) => Some(*i as f64),
            Data::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
            Data::Empty | Data::Error(_) => Some(f64::NAN),
            Data::String(s) => parse_num(s, false),
            _ => None, // dates are text
        }
    };
    let mut table = Table::default();
    for j in 0..ncols {
        let numeric = body[..n].iter().all(|r| r.get(j).map(|d| numeric_cell(d).is_some()).unwrap_or(true));
        if numeric {
            table.push(
                names[j].clone(),
                Col::Num(body[..n].iter().map(|r| r.get(j).and_then(|d| numeric_cell(d)).unwrap_or(f64::NAN)).collect()),
            );
        } else {
            table.push(
                names[j].clone(),
                Col::Str(body[..n].iter().map(|r| r.get(j).map(crate::spreadsheet_cell_to_string).unwrap_or_default()).collect()),
            );
        }
    }
    table.kind = if is_ods { "OpenDocument Spreadsheet (.ods)".into() } else { "Excel (Direct Workbook)".into() };
    Ok((table, total))
}

// ---------------------------------------------------------------------- Parquet ---

pub fn read_parquet_columns(path: &str, limit: usize) -> Result<(Table, usize), String> {
    use arrow_array::{Array, Float64Array, Int64Array, StringArray};
    use arrow_schema::{DataType, TimeUnit};
    use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;

    let file = std::fs::File::open(path).map_err(|e| format!("Impossibile aprire file Parquet: {}", e))?;
    let builder = ParquetRecordBatchReaderBuilder::try_new(file).map_err(|e| format!("Errore decodifica struttura Parquet: {}", e))?;
    let total = builder.metadata().file_metadata().num_rows().max(0) as usize;
    let schema = builder.schema().clone();
    let reader = builder
        .with_batch_size(65_536)
        .with_limit(limit)
        .build()
        .map_err(|e| format!("Errore lettura Parquet: {}", e))?;

    enum Acc {
        Num(Vec<f64>),
        Str(Vec<String>),
    }
    let mut accs: Vec<Acc> = schema
        .fields()
        .iter()
        .map(|f| match f.data_type() {
            DataType::Utf8 | DataType::LargeUtf8 | DataType::Utf8View | DataType::Timestamp(_, _) | DataType::Date32 | DataType::Date64 => {
                Acc::Str(Vec::new())
            }
            dt if arrow_cast::can_cast_types(dt, &DataType::Float64) => Acc::Num(Vec::new()),
            _ => Acc::Str(Vec::new()),
        })
        .collect();

    for batch in reader {
        let batch = batch.map_err(|e| format!("Errore iterazione Parquet: {}", e))?;
        for (j, field) in schema.fields().iter().enumerate() {
            let col = batch.column(j);
            match (&mut accs[j], field.data_type()) {
                (Acc::Num(v), _) => {
                    let c = arrow_cast::cast(col, &DataType::Float64).map_err(|e| e.to_string())?;
                    let a = c.as_any().downcast_ref::<Float64Array>().ok_or("cast Float64")?;
                    v.extend((0..a.len()).map(|i| if a.is_null(i) { f64::NAN } else { a.value(i) }));
                }
                (Acc::Str(v), DataType::Timestamp(unit, _)) => {
                    let c = arrow_cast::cast(col, &DataType::Int64).map_err(|e| e.to_string())?;
                    let a = c.as_any().downcast_ref::<Int64Array>().ok_or("cast Int64")?;
                    let div = match unit {
                        TimeUnit::Second => 1,
                        TimeUnit::Millisecond => 1_000,
                        TimeUnit::Microsecond => 1_000_000,
                        TimeUnit::Nanosecond => 1_000_000_000,
                    };
                    v.extend((0..a.len()).map(|i| if a.is_null(i) { String::new() } else { crate::epoch_secs_to_iso(a.value(i).div_euclid(div)) }));
                }
                (Acc::Str(v), DataType::Date32) | (Acc::Str(v), DataType::Date64) => {
                    let c = arrow_cast::cast(col, &DataType::Utf8).map_err(|e| e.to_string())?;
                    let a = c.as_any().downcast_ref::<StringArray>().ok_or("cast Utf8")?;
                    v.extend((0..a.len()).map(|i| if a.is_null(i) { String::new() } else { a.value(i).to_string() }));
                }
                (Acc::Str(v), _) => {
                    let c = arrow_cast::cast(col, &DataType::Utf8).map_err(|e| format!("{}: {}", field.name(), e))?;
                    let a = c.as_any().downcast_ref::<StringArray>().ok_or("cast Utf8")?;
                    v.extend((0..a.len()).map(|i| if a.is_null(i) { String::new() } else { a.value(i).to_string() }));
                }
            }
        }
    }
    let mut table = Table::default();
    for (f, acc) in schema.fields().iter().zip(accs) {
        table.push(
            f.name().clone(),
            match acc {
                Acc::Num(v) => Col::Num(v),
                Acc::Str(v) => Col::Str(v),
            },
        );
    }
    table.kind = "Apache Parquet (Columnar)".into();
    Ok((table, total))
}

// ------------------------------------------------------------------ re-sampling ---

/// Re-samples a table onto a regular grid of `step_secs`: numeric columns are aggregated with
/// `method` (see [`crate::aggregate_slice`]), text columns keep their first non-empty value per
/// bucket. Buckets without data are not created.
pub fn resample_table(t: &Table, ts_idx: usize, step_secs: i64, method: &str) -> Table {
    use std::collections::BTreeMap;
    let n = t.nrows();
    let ts_text = |i: usize| -> Option<i64> {
        match &t.cols[ts_idx] {
            Col::Str(v) => crate::parse_timestamp_to_epoch(&v[i]),
            Col::Num(_) => None,
        }
    };
    let mut buckets: BTreeMap<i64, Vec<usize>> = BTreeMap::new();
    for i in 0..n {
        if let Some(e) = ts_text(i) {
            buckets.entry(e.div_euclid(step_secs) * step_secs).or_default().push(i);
        }
    }
    let mut out = Table { kind: t.kind.clone(), ..Default::default() };
    let keys: Vec<i64> = buckets.keys().copied().collect();
    for (j, name) in t.names.iter().enumerate() {
        if j == ts_idx {
            out.push(name.clone(), Col::Str(keys.iter().map(|&k| crate::epoch_secs_to_iso(k)).collect()));
            continue;
        }
        match &t.cols[j] {
            Col::Num(v) => {
                let mut tmp = Vec::new();
                let agg = buckets
                    .values()
                    .map(|idx| {
                        tmp.clear();
                        tmp.extend(idx.iter().map(|&i| v[i]).filter(|x| x.is_finite()));
                        crate::aggregate_slice(&mut tmp, method)
                    })
                    .collect();
                out.push(name.clone(), Col::Num(agg));
            }
            Col::Str(v) => {
                let first = buckets
                    .values()
                    .map(|idx| idx.iter().map(|&i| v[i].trim()).find(|s| !s.is_empty()).unwrap_or("").to_string())
                    .collect();
                out.push(name.clone(), Col::Str(first));
            }
        }
    }
    out
}

/// Row limit actually applied by the readers.
///
/// `None` (no choice made) gives [`DEFAULT_ROW_LIMIT`]; `Some(0)` means "all rows" (no limit);
/// any other value is used as given.
pub fn effective_limit(max_rows: Option<usize>) -> usize {
    match max_rows {
        None => DEFAULT_ROW_LIMIT,
        Some(0) => usize::MAX,
        Some(m) => m,
    }
}
