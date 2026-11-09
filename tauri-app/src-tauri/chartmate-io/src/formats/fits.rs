//! FITS reader: the first binary table (`BINTABLE`) or ASCII table (`TABLE`) extension is read
//! as a table; if the file has no table, a 1-D image or a 2-D image with at most 64 columns is
//! read as numeric columns. Scaling (`TSCALn`/`TZEROn`, `BSCALE`/`BZERO`) and integer null
//! values (`TNULLn`, `BLANK`) are applied.

use super::{Col, Table};

const BLOCK: usize = 2880;

struct Hdu {
    cards: Vec<(String, String)>,
    data_start: usize,
    data_len: usize,
}

impl Hdu {
    fn get(&self, key: &str) -> Option<&str> {
        self.cards.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str())
    }
    fn int(&self, key: &str) -> Option<i64> {
        self.get(key).and_then(|v| v.trim().parse::<f64>().ok()).map(|x| x as i64)
    }
    fn float(&self, key: &str) -> Option<f64> {
        self.get(key).and_then(|v| v.trim().replace('D', "E").parse().ok())
    }
    fn string(&self, key: &str) -> Option<String> {
        self.get(key).map(|v| v.trim().trim_matches('\'').trim().to_string())
    }
}

fn card_value(raw: &str) -> String {
    // Value field: strip an inline comment that is not inside quotes.
    let v = raw.trim();
    if let Some(rest) = v.strip_prefix('\'') {
        // Quoted string; '' is an escaped quote.
        let mut out = String::new();
        let mut chars = rest.chars().peekable();
        while let Some(ch) = chars.next() {
            if ch == '\'' {
                if chars.peek() == Some(&'\'') {
                    out.push('\'');
                    chars.next();
                } else {
                    break;
                }
            } else {
                out.push(ch);
            }
        }
        return format!("'{}'", out.trim_end());
    }
    v.split('/').next().unwrap_or("").trim().to_string()
}

fn parse_hdus(buf: &[u8]) -> Result<Vec<Hdu>, String> {
    let mut hdus = Vec::new();
    let mut p = 0usize;
    while p + BLOCK <= buf.len() {
        let mut cards = Vec::new();
        let mut q = p;
        let mut ended = false;
        while q + 80 <= buf.len() {
            let card = String::from_utf8_lossy(&buf[q..q + 80]).to_string();
            q += 80;
            let key = card.get(..8).unwrap_or("").trim().to_string();
            if key == "END" {
                ended = true;
                break;
            }
            if card.get(8..10) == Some("= ") {
                cards.push((key, card_value(&card[10..])));
            }
        }
        if !ended {
            break;
        }
        let header_end = q.div_ceil(BLOCK) * BLOCK;
        let mut hdu = Hdu { cards, data_start: header_end, data_len: 0 };
        let bitpix = hdu.int("BITPIX").unwrap_or(8).unsigned_abs() as usize;
        let naxis = hdu.int("NAXIS").unwrap_or(0).max(0) as usize;
        let mut n: usize = if naxis == 0 { 0 } else { 1 };
        for k in 1..=naxis {
            n *= hdu.int(&format!("NAXIS{}", k)).unwrap_or(0).max(0) as usize;
        }
        let pcount = hdu.int("PCOUNT").unwrap_or(0).max(0) as usize;
        let gcount = hdu.int("GCOUNT").unwrap_or(1).max(1) as usize;
        hdu.data_len = (bitpix / 8) * gcount * (pcount + n);
        p = header_end + hdu.data_len.div_ceil(BLOCK) * BLOCK;
        hdus.push(hdu);
    }
    if hdus.is_empty() {
        return Err("File FITS non valido (nessuna intestazione)".into());
    }
    Ok(hdus)
}

fn be_num(b: &[u8], code: char) -> f64 {
    match code {
        'B' => b[0] as f64,
        'I' => i16::from_be_bytes([b[0], b[1]]) as f64,
        'J' => i32::from_be_bytes(b[..4].try_into().unwrap()) as f64,
        'K' => i64::from_be_bytes(b[..8].try_into().unwrap()) as f64,
        'E' => f32::from_be_bytes(b[..4].try_into().unwrap()) as f64,
        'D' => f64::from_be_bytes(b[..8].try_into().unwrap()),
        'L' => match b[0] {
            b'T' => 1.0,
            b'F' => 0.0,
            _ => f64::NAN,
        },
        _ => f64::NAN,
    }
}

fn code_size(code: char) -> usize {
    match code {
        'L' | 'B' | 'A' => 1,
        'I' => 2,
        'J' | 'E' => 4,
        'K' | 'D' | 'C' | 'P' => 8,
        'M' | 'Q' => 16,
        _ => 0,
    }
}

fn read_bintable(buf: &[u8], h: &Hdu) -> Result<Table, String> {
    let row_len = h.int("NAXIS1").unwrap_or(0).max(0) as usize;
    let nrows = h.int("NAXIS2").unwrap_or(0).max(0) as usize;
    let nfields = h.int("TFIELDS").unwrap_or(0).max(0) as usize;
    let data = buf.get(h.data_start..h.data_start + row_len * nrows).ok_or("FITS: dati tabella troncati")?;
    let mut table = Table::default();
    let mut off = 0usize;
    for f in 1..=nfields {
        let form = h.string(&format!("TFORM{}", f)).unwrap_or_default().to_uppercase();
        let name = h.string(&format!("TTYPE{}", f)).filter(|s| !s.is_empty()).unwrap_or(format!("col{}", f));
        let digits: String = form.chars().take_while(|c| c.is_ascii_digit()).collect();
        let repeat: usize = if digits.is_empty() { 1 } else { digits.parse().unwrap_or(1) };
        let code = form.chars().find(|c| c.is_ascii_alphabetic()).unwrap_or('?');
        let width = if code == 'X' { repeat.div_ceil(8) } else { code_size(code) * repeat };
        let scale = h.float(&format!("TSCAL{}", f)).unwrap_or(1.0);
        let zero = h.float(&format!("TZERO{}", f)).unwrap_or(0.0);
        let tnull = h.int(&format!("TNULL{}", f));
        match code {
            'A' => {
                let v = (0..nrows)
                    .map(|r| {
                        let s = &data[r * row_len + off..r * row_len + off + width];
                        String::from_utf8_lossy(s).trim_end_matches(['\0', ' ']).to_string()
                    })
                    .collect();
                table.push(name, Col::Str(v));
            }
            'L' | 'B' | 'I' | 'J' | 'K' | 'E' | 'D' if repeat >= 1 && repeat <= 16 => {
                let es = code_size(code);
                for k in 0..repeat {
                    let v = (0..nrows)
                        .map(|r| {
                            let p = r * row_len + off + k * es;
                            let raw = be_num(&data[p..p + es], code);
                            if matches!(code, 'B' | 'I' | 'J' | 'K') && tnull.map(|t| t as f64 == raw).unwrap_or(false) {
                                f64::NAN
                            } else {
                                raw * scale + zero
                            }
                        })
                        .collect();
                    let nm = if repeat == 1 { name.clone() } else { format!("{}_{}", name, k + 1) };
                    table.push(nm, Col::Num(v));
                }
            }
            _ => table.notes.push(format!("FITS: colonna {} ({}) non supportata", name, form)),
        }
        off += width;
    }
    table.kind = format!("FITS BINTABLE ({} colonne, {} righe)", table.cols.len(), nrows);
    Ok(table)
}

fn read_ascii_table(buf: &[u8], h: &Hdu) -> Result<Table, String> {
    let row_len = h.int("NAXIS1").unwrap_or(0).max(0) as usize;
    let nrows = h.int("NAXIS2").unwrap_or(0).max(0) as usize;
    let nfields = h.int("TFIELDS").unwrap_or(0).max(0) as usize;
    let data = buf.get(h.data_start..h.data_start + row_len * nrows).ok_or("FITS: dati tabella troncati")?;
    let mut table = Table::default();
    for f in 1..=nfields {
        let form = h.string(&format!("TFORM{}", f)).unwrap_or_default().to_uppercase();
        let name = h.string(&format!("TTYPE{}", f)).filter(|s| !s.is_empty()).unwrap_or(format!("col{}", f));
        let start = h.int(&format!("TBCOL{}", f)).unwrap_or(1).max(1) as usize - 1;
        let w: usize = form[1..].split('.').next().unwrap_or("0").parse().unwrap_or(0);
        let end = (start + w).min(row_len);
        let cells = (0..nrows).map(|r| String::from_utf8_lossy(&data[r * row_len + start..r * row_len + end]).trim().to_string());
        if form.starts_with('A') {
            table.push(name, Col::Str(cells.collect()));
        } else {
            let scale = h.float(&format!("TSCAL{}", f)).unwrap_or(1.0);
            let zero = h.float(&format!("TZERO{}", f)).unwrap_or(0.0);
            table.push(
                name,
                Col::Num(cells.map(|s| s.replace('D', "E").parse::<f64>().map(|x| x * scale + zero).unwrap_or(f64::NAN)).collect()),
            );
        }
    }
    table.kind = format!("FITS ASCII TABLE ({} colonne, {} righe)", table.cols.len(), nrows);
    Ok(table)
}

fn read_image(buf: &[u8], h: &Hdu) -> Result<Table, String> {
    let bitpix = h.int("BITPIX").unwrap_or(0);
    let naxis = h.int("NAXIS").unwrap_or(0);
    let n1 = h.int("NAXIS1").unwrap_or(0).max(0) as usize;
    let n2 = if naxis >= 2 { h.int("NAXIS2").unwrap_or(1).max(0) as usize } else { 1 };
    if naxis > 2 || (naxis == 2 && n1 > super::array_formats::MAX_WIDE_COLUMNS) {
        return Err(format!(
            "FITS: immagine {}D {}×{} non tabellare (ChartMate legge tabelle FITS e immagini 1-D o 2-D con al massimo {} colonne)",
            naxis, n1, n2, super::array_formats::MAX_WIDE_COLUMNS
        ));
    }
    let (code, es) = match bitpix {
        8 => ('B', 1),
        16 => ('I', 2),
        32 => ('J', 4),
        64 => ('K', 8),
        -32 => ('E', 4),
        -64 => ('D', 8),
        _ => return Err("FITS: BITPIX non valido".into()),
    };
    let scale = h.float("BSCALE").unwrap_or(1.0);
    let zero = h.float("BZERO").unwrap_or(0.0);
    let blank = h.int("BLANK");
    let data = buf.get(h.data_start..h.data_start + n1 * n2 * es).ok_or("FITS: dati immagine troncati")?;
    let mut table = Table::default();
    // FITS is Fortran-ordered: NAXIS1 varies fastest, so each of the n2 rows has n1 values.
    let (rows, cols) = if naxis == 1 { (n1, 1) } else { (n2, n1) };
    for j in 0..cols {
        let v = (0..rows)
            .map(|i| {
                let p = (i * cols + j) * es;
                let raw = be_num(&data[p..p + es], code);
                if bitpix > 0 && blank.map(|b| b as f64 == raw).unwrap_or(false) {
                    f64::NAN
                } else {
                    raw * scale + zero
                }
            })
            .collect();
        table.push(if cols == 1 { "value".to_string() } else { format!("col{}", j + 1) }, Col::Num(v));
    }
    table.kind = format!("FITS image ({}×{})", rows, cols);
    Ok(table)
}

pub fn read_fits(path: &str) -> Result<Table, String> {
    let buf = std::fs::read(path).map_err(|e| format!("Impossibile aprire file FITS: {}", e))?;
    parse_fits(&buf)
}

pub fn parse_fits(buf: &[u8]) -> Result<Table, String> {
    if !buf.starts_with(b"SIMPLE  =") {
        return Err("File FITS non valido (manca SIMPLE)".into());
    }
    let hdus = parse_hdus(buf)?;
    for h in &hdus[1..] {
        match h.string("XTENSION").as_deref() {
            Some("BINTABLE") => return read_bintable(buf, h),
            Some("TABLE") => return read_ascii_table(buf, h),
            _ => {}
        }
    }
    for h in &hdus {
        if h.int("NAXIS").unwrap_or(0) > 0 && h.data_len > 0 {
            return read_image(buf, h);
        }
    }
    Err("FITS: nessuna tabella o immagine leggibile".into())
}
