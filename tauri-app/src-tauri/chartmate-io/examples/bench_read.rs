//! Command-line timing of the ChartMate reader, used by `bench/run_benchmark.py`.
//!
//! ```text
//! cargo run --release -p chartmate-io --example bench_read -- <file> [--repeat N]
//! ```
//!
//! For each repetition it prints one JSON line with
//! * `parse_ms` – read + parse into typed columns (what the app's `load_dataset` command does),
//! * `ipc_ms`   – encoding of the binary IPC message (raw f64 columns, see `columnar.rs`),
//! * `ipc_bytes`, `rows`, `cols`.
//! No row limit is applied, so the full file is read.

use std::time::Instant;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() {
        eprintln!("usage: bench_read <file> [--repeat N]");
        std::process::exit(2);
    }
    let file = args[0].clone();
    let repeat = args
        .iter()
        .position(|a| a == "--repeat")
        .and_then(|i| args.get(i + 1))
        .and_then(|s| s.parse().ok())
        .unwrap_or(1usize);

    for _ in 0..repeat {
        let opts = chartmate_io::ParseOptions {
            separator: None,
            decimal: None,
            timestamp_col: None,
            timestamp_format: None,
            max_rows: Some(usize::MAX),
        };
        let t0 = Instant::now();
        let ds = match chartmate_io::load_columnar(&file, Some(opts)) {
            Ok(d) => d,
            Err(e) => {
                println!("{{\"error\": {}}}", serde_json::to_string(&e).unwrap());
                std::process::exit(1);
            }
        };
        let parse_ms = t0.elapsed().as_secs_f64() * 1e3;
        let t1 = Instant::now();
        let msg = ds.encode(1);
        let ipc_ms = t1.elapsed().as_secs_f64() * 1e3;
        println!(
            "{{\"parse_ms\": {:.3}, \"ipc_ms\": {:.3}, \"ipc_bytes\": {}, \"rows\": {}, \"cols\": {}, \"kind\": {}}}",
            parse_ms,
            ipc_ms,
            msg.len(),
            ds.nrows(),
            ds.columns.len(),
            serde_json::to_string(&ds.detected_sep).unwrap()
        );
    }
}
