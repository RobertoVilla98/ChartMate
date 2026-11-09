//! Readers for scientific and statistical file formats.
//!
//! Every reader returns a column-oriented [`Table`]; `read_dataset_sample` turns it into the
//! row-of-strings preview the front end uses. All readers are pure Rust (no C libraries), so the
//! same binary builds on Windows (MinGW/MSVC), macOS and Linux.
//!
//! | Format            | Extensions                | Reader                                   |
//! |-------------------|---------------------------|------------------------------------------|
//! | HDF5              | .h5 .hdf5 .he5 .hdf       | `hdf5-reader` crate ([`array_formats`])   |
//! | netCDF-3 / -4     | .nc .nc4 .cdf .netcdf     | `netcdf-reader` crate ([`array_formats`]) |
//! | MATLAB v4/v5/v7   | .mat                      | `matfile` crate; v7.3 via the HDF5 path   |
//! | SAS               | .sas7bdat                 | `sas7bdat` crate ([`sas`])                |
//! | SAS transport     | .xpt .xport               | own reader ([`sas`])                      |
//! | SPSS              | .sav                      | own reader ([`spss`])                     |
//! | FITS              | .fits .fit .fts           | own reader ([`fits`])                     |

pub mod array_formats;
pub mod fits;
pub mod sas;
pub mod spss;

/// One column of a table.
#[derive(Debug, Clone)]
pub enum Col {
    Num(Vec<f64>),
    Str(Vec<String>),
}

impl Col {
    pub fn len(&self) -> usize {
        match self {
            Col::Num(v) => v.len(),
            Col::Str(v) => v.len(),
        }
    }
}

/// A column-oriented table produced by a reader.
#[derive(Debug, Clone, Default)]
pub struct Table {
    pub names: Vec<String>,
    pub cols: Vec<Col>,
    /// Human-readable description of the source, shown in the data panel.
    pub kind: String,
    /// Notes for the user (skipped variables, unsupported features).
    pub notes: Vec<String>,
}

impl Table {
    pub fn push(&mut self, name: impl Into<String>, col: Col) {
        self.names.push(name.into());
        self.cols.push(col);
    }

    pub fn nrows(&self) -> usize {
        self.cols.iter().map(|c| c.len()).max().unwrap_or(0)
    }

    /// Converts to the row-major string representation, keeping at most `limit` rows.
    /// Returns `(columns, rows, total_rows)`.
    pub fn into_rows(self, limit: usize) -> (Vec<String>, Vec<Vec<String>>, usize) {
        let total = self.nrows();
        let n = total.min(limit);
        let mut rows = Vec::with_capacity(n);
        for i in 0..n {
            let mut r = Vec::with_capacity(self.cols.len());
            for c in &self.cols {
                r.push(match c {
                    Col::Num(v) => v.get(i).map(|x| fmt_num(*x)).unwrap_or_default(),
                    Col::Str(v) => v.get(i).cloned().unwrap_or_default(),
                });
            }
            rows.push(r);
        }
        (self.names, rows, total)
    }
}

/// Formats a number with the shortest representation that round-trips; NaN becomes empty.
pub fn fmt_num(x: f64) -> String {
    if !x.is_finite() {
        return String::new();
    }
    if x.fract() == 0.0 && x.abs() < 1e15 {
        return itoa_i64(x as i64);
    }
    // ryu: shortest round-trip representation, several times faster than `format!`.
    let mut b = ryu::Buffer::new();
    b.format_finite(x).to_string()
}

fn itoa_i64(v: i64) -> String {
    use std::fmt::Write;
    let mut s = String::with_capacity(12);
    let _ = write!(s, "{}", v);
    s
}

/// Converts seconds since the Unix epoch (may be fractional) to `YYYY-MM-DD HH:MM:SS`.
pub fn unix_secs_to_iso(secs: f64) -> String {
    if !secs.is_finite() {
        return String::new();
    }
    crate::epoch_secs_to_iso(secs.round() as i64)
}

/// Parses CF-style time units such as `hours since 2026-01-01 00:00:00`.
/// Returns `(seconds per unit, epoch offset in Unix seconds)`.
pub fn parse_cf_time_units(units: &str) -> Option<(f64, f64)> {
    let orig = units.trim();
    let u = orig.to_ascii_lowercase();
    let idx = u.find(" since ")?;
    let unit = &u[..idx];
    let mut rest = orig[idx + 7..].trim().to_ascii_lowercase();
    for tz in ["utc", "gmt", "z"] {
        if rest.ends_with(tz) {
            rest.truncate(rest.len() - tz.len());
        }
    }
    let rest = rest.replace('t', " ");
    let scale = match unit.trim() {
        "seconds" | "second" | "secs" | "sec" | "s" => 1.0,
        "minutes" | "minute" | "mins" | "min" => 60.0,
        "hours" | "hour" | "hrs" | "hr" | "h" => 3600.0,
        "days" | "day" | "d" => 86400.0,
        "milliseconds" | "millisecond" | "ms" => 1e-3,
        "microseconds" | "microsecond" | "us" => 1e-6,
        "nanoseconds" | "ns" => 1e-9,
        _ => return None,
    };
    // Drop a numeric time-zone offset ("+00:00").
    let rest = rest.split('+').next().unwrap_or(&rest).trim();
    let epoch = crate::parse_timestamp_to_epoch(rest)?;
    Some((scale, epoch as f64))
}

/// Applies CF time units to a numeric column, returning ISO timestamps.
pub fn cf_time_to_strings(values: &[f64], units: &str) -> Option<Vec<String>> {
    let (scale, epoch) = parse_cf_time_units(units)?;
    Some(values.iter().map(|v| if v.is_finite() { unix_secs_to_iso(epoch + v * scale) } else { String::new() }).collect())
}

/// Whether a variable name suggests a time axis.
pub fn looks_like_time_name(name: &str) -> bool {
    let n = name.to_lowercase();
    n == "t" || n.contains("time") || n.contains("date") || n == "datenum" || n.contains("timestamp")
}

/// Detects the file format from the extension, falling back to magic bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Parquet,
    Spreadsheet,
    Hdf5,
    NetCdf,
    Matlab,
    Sas7bdat,
    Xpt,
    Spss,
    Fits,
    Text,
}

pub fn detect_format(path: &str) -> Format {
    let lower = path.to_lowercase();
    let ext = lower.rsplit('.').next().unwrap_or("");
    let by_ext = match ext {
        "parquet" | "pq" => Some(Format::Parquet),
        "xlsx" | "xlsm" | "xlsb" | "xls" | "ods" => Some(Format::Spreadsheet),
        "h5" | "hdf5" | "he5" | "hdf" => Some(Format::Hdf5),
        "nc" | "nc4" | "cdf" | "netcdf" => Some(Format::NetCdf),
        "mat" => Some(Format::Matlab),
        "sas7bdat" => Some(Format::Sas7bdat),
        "xpt" | "xport" => Some(Format::Xpt),
        "sav" => Some(Format::Spss),
        "fits" | "fit" | "fts" => Some(Format::Fits),
        "csv" | "tsv" | "txt" | "dat" | "tab" => Some(Format::Text),
        _ => None,
    };
    if let Some(f) = by_ext {
        return f;
    }
    // Unknown extension: sniff the first bytes.
    let mut head = [0u8; 8];
    if let Ok(mut f) = std::fs::File::open(path) {
        use std::io::Read;
        let _ = f.read(&mut head);
    }
    match &head {
        [0x89, b'H', b'D', b'F', ..] => Format::Hdf5,
        [b'C', b'D', b'F', 1..=5, ..] => Format::NetCdf,
        [b'P', b'A', b'R', b'1', ..] => Format::Parquet,
        [b'$', b'F', b'L', b'2', ..] => Format::Spss,
        [b'S', b'I', b'M', b'P', b'L', b'E', ..] => Format::Fits,
        [b'P', b'K', 3, 4, ..] | [0xD0, 0xCF, 0x11, 0xE0, ..] => Format::Spreadsheet,
        _ => Format::Text,
    }
}

/// Reads any supported non-text, non-Parquet, non-spreadsheet format.
pub fn read_table(path: &str, format: Format) -> Result<Table, String> {
    match format {
        Format::Hdf5 => array_formats::read_hdf5(path),
        Format::NetCdf => array_formats::read_netcdf(path),
        Format::Matlab => array_formats::read_matlab(path),
        Format::Sas7bdat => sas::read_sas7bdat(path),
        Format::Xpt => sas::read_xpt(path),
        Format::Spss => spss::read_sav(path),
        Format::Fits => fits::read_fits(path),
        _ => Err("Formato non gestito da read_table".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cf_units_parse() {
        let (s, e) = parse_cf_time_units("hours since 1970-01-02 00:00:00").unwrap();
        assert_eq!(s, 3600.0);
        assert_eq!(e, 86400.0);
        let v = cf_time_to_strings(&[0.0, 1.5], "minutes since 2026-01-01T00:00:00Z").unwrap();
        assert_eq!(v[0], "2026-01-01 00:00:00");
        assert_eq!(v[1], "2026-01-01 00:01:30");
    }

    #[test]
    fn number_formatting() {
        assert_eq!(fmt_num(3.0), "3");
        assert_eq!(fmt_num(-0.25), "-0.25");
        assert_eq!(fmt_num(f64::NAN), "");
    }
}
