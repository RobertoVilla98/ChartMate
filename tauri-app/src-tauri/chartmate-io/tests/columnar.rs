//! Binary IPC message and typed columns (v0.3 engine).

use chartmate_io::formats::Col;
use chartmate_io::{load_columnar, resampled_dataset, ColumnarDataset};

fn fixture(name: &str) -> String {
    format!("{}/tests/fixtures/{}", env!("CARGO_MANIFEST_DIR"), name)
}

/// Minimal decoder mirroring tauri-app/src/data/table.ts.
fn decode(buf: &[u8]) -> (serde_json::Value, Vec<Col>) {
    assert_eq!(&buf[..4], b"CMB1");
    let hlen = u32::from_le_bytes(buf[4..8].try_into().unwrap()) as usize;
    let header: serde_json::Value = serde_json::from_slice(&buf[8..8 + hlen]).unwrap();
    let n = header["n_rows"].as_u64().unwrap() as usize;
    let cols = header["cols"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| {
            let off = c["offset"].as_u64().unwrap() as usize;
            let len = c["len"].as_u64().unwrap() as usize;
            match c["kind"].as_str().unwrap() {
                "num" => {
                    assert_eq!(off % 8, 0, "numeric column not 8-byte aligned");
                    assert_eq!(len, n * 8);
                    Col::Num(buf[off..off + len].chunks_exact(8).map(|b| f64::from_le_bytes(b.try_into().unwrap())).collect())
                }
                _ => Col::Str(String::from_utf8(buf[off..off + len].to_vec()).unwrap().split('\0').map(String::from).collect()),
            }
        })
        .collect();
    (header, cols)
}

#[test]
fn binary_message_round_trip() {
    let ds = load_columnar(&fixture("sample.csv"), None).unwrap();
    let bytes = ds.encode(7);
    let (h, cols) = decode(&bytes);
    assert_eq!(h["id"], 7);
    assert_eq!(h["n_rows"], 48);
    assert_eq!(h["suggested_ts_col"], "timestamp");
    assert_eq!(cols.len(), ds.cols.len());
    for (a, b) in cols.iter().zip(&ds.cols) {
        match (a, b) {
            (Col::Num(x), Col::Num(y)) => assert_eq!(x, y),
            (Col::Str(x), Col::Str(y)) => assert_eq!(x, y),
            _ => panic!("column kind changed"),
        }
    }
    // Typed columns: numbers stay numbers, text stays text.
    let kinds: Vec<&str> = h["cols"].as_array().unwrap().iter().map(|c| c["kind"].as_str().unwrap()).collect();
    assert_eq!(kinds, ["str", "num", "num", "num", "num", "num", "num", "num", "str"]);
}

#[test]
fn parquet_timestamps_become_text_and_numbers_stay_typed() {
    let ds = load_columnar(&fixture("sample.parquet"), None).unwrap();
    let ts = ds.columns.iter().position(|c| c == "timestamp").unwrap();
    match &ds.cols[ts] {
        Col::Str(v) => assert_eq!(v[1], "2026-01-01 00:01:00"),
        _ => panic!("timestamp should be text"),
    }
    assert!(matches!(ds.cols[1], Col::Num(_)));
    assert_eq!(ds.suggested_ts_col.as_deref(), Some("timestamp"));
}

#[test]
fn resampling_on_columns() {
    let ds: ColumnarDataset = load_columnar(&fixture("sample.csv"), None).unwrap();
    let t = chartmate_io::formats::Table { names: ds.columns.clone(), cols: ds.cols.clone(), ..Default::default() };
    let r = resampled_dataset(&t, 0, "timestamp", "15m", "mean");
    assert_eq!(r.nrows(), 4); // 48 minutes → 00:00, 00:15, 00:30, 00:45
    match (&r.cols[0], &r.cols[1], &ds.cols[1]) {
        (Col::Str(ts), Col::Num(m), Col::Num(raw)) => {
            assert_eq!(ts[1], "2026-01-01 00:15:00");
            let want: f64 = raw[15..30].iter().sum::<f64>() / 15.0;
            assert!((m[1] - want).abs() < 1e-12);
        }
        _ => panic!("unexpected column kinds"),
    }
}

#[test]
fn row_limit_convention_none_default_zero_all() {
    use chartmate_io::columnar::effective_limit;
    assert_eq!(effective_limit(None), chartmate_io::DEFAULT_ROW_LIMIT);
    assert_eq!(effective_limit(Some(0)), usize::MAX, "0 means all rows");
    assert_eq!(effective_limit(Some(1234)), 1234);
}
