//! Re-sampling statistics against hand-computed values.

use chartmate_io::{aggregate_slice, interval_to_seconds, parse_timestamp_to_epoch, resample_rows};

fn agg(v: &[f64], m: &str) -> f64 {
    let mut v = v.to_vec();
    aggregate_slice(&mut v, m)
}

#[test]
fn aggregators() {
    let v = [5.0, 1.0, 4.0, 2.0, 3.0];
    assert_eq!(agg(&v, "mean"), 3.0);
    assert_eq!(agg(&v, "median"), 3.0);
    assert_eq!(agg(&[1.0, 2.0, 3.0, 4.0], "median"), 2.5);
    assert_eq!(agg(&v, "min"), 1.0);
    assert_eq!(agg(&v, "max"), 5.0);
    assert_eq!(agg(&v, "sum"), 15.0);
    // Nearest-rank on (n-1)·p: 21 values 0..20 → P5 = 1, P95 = 19.
    let w: Vec<f64> = (0..21).map(|x| x as f64).collect();
    assert_eq!(agg(&w, "p5"), 1.0);
    assert_eq!(agg(&w, "p95"), 19.0);
    assert!(agg(&[], "mean").is_nan());
}

#[test]
fn intervals() {
    assert_eq!(interval_to_seconds("15m"), 900);
    assert_eq!(interval_to_seconds("1h"), 3600);
    assert_eq!(interval_to_seconds("1d"), 86400);
}

#[test]
fn timestamp_formats() {
    let iso = parse_timestamp_to_epoch("2026-03-01 12:30:00").unwrap();
    assert_eq!(parse_timestamp_to_epoch("2026-03-01T12:30:00").unwrap(), iso);
    assert_eq!(parse_timestamp_to_epoch("01/03/2026 12:30:00").unwrap(), iso);
    assert_eq!(parse_timestamp_to_epoch("01-03-2026 12:30").unwrap(), iso);
    assert!(parse_timestamp_to_epoch("not a date").is_none());
    assert!(parse_timestamp_to_epoch("2026-13-01").is_none());
}

#[test]
fn hourly_statistics_and_empty_buckets() {
    let cols = vec!["timestamp".to_string(), "v".to_string()];
    let mut rows = Vec::new();
    // Hour 0: 0..=59 minutes with value = minute; hour 2: a single value; hour 1 has no data.
    for m in 0..60 {
        rows.push(vec![format!("2026-01-01 00:{:02}:00", m), m.to_string()]);
    }
    rows.push(vec!["2026-01-01 02:15:00".to_string(), "7,5".to_string()]); // decimal comma
    let run = |method: &str| resample_rows(cols.clone(), rows.clone(), "timestamp".into(), "1h".into(), method.into()).unwrap();

    let mean = run("mean");
    assert_eq!(mean.rows.len(), 2, "empty hours are not invented");
    assert_eq!(mean.rows[0], vec!["2026-01-01 00:00:00", "29.5"]);
    assert_eq!(mean.rows[1], vec!["2026-01-01 02:00:00", "7.5"]);
    assert_eq!(run("max").rows[0][1], "59");
    assert_eq!(run("min").rows[0][1], "0");
    assert_eq!(run("sum").rows[0][1], "1770");
    assert_eq!(run("median").rows[0][1], "29.5");
    assert_eq!(run("p95").rows[0][1], "56"); // round(59·0.95) = 56
}
