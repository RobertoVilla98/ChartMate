// Column-oriented dataset access (v0.3).
//
// The back end sends a binary message (see chartmate-io/src/columnar.rs): numeric columns arrive
// as raw little-endian f64 arrays and are wrapped in Float64Array views without copying; text
// columns arrive as one UTF-8 blob split on '\0'. Charts read columns directly. The legacy
// `rows: string[][]` view is built lazily, only when a module still asks for it (building it for
// 10^6 rows costs about a second, which the plotting path no longer pays).
import type { DatasetPreview } from '../core/types';

export type ColumnData = Float64Array | string[];

export function isNumericColumn(c: ColumnData | null | undefined): c is Float64Array {
  return c instanceof Float64Array;
}

/** Text of a number as the Rust engine writes it: shortest round-trip form, NaN → ''. */
export function fmtCell(x: number): string {
  return Number.isFinite(x) ? String(x) : '';
}

/** Parses a text cell (decimal comma and thousands separators accepted); null when not a number. */
export function parseNumericText(raw: string | null | undefined): number | null {
  let s = String(raw ?? '').trim();
  if (s === '' || s === 'null' || s === 'nan' || s === 'None') return null;
  if (s.includes(',') && s.includes('.')) {
    s = s.indexOf('.') < s.indexOf(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

/** Attaches the lazily built `rows` view to a dataset whose data are in `colData`. */
export function attachLazyRows(ds: DatasetPreview): DatasetPreview {
  let cache: string[][] | null = null;
  Object.defineProperty(ds, 'rows', {
    configurable: true,
    enumerable: false,
    get(): string[][] {
      if (cache) return cache;
      const cols = (ds.colData || []).map(c => (isNumericColumn(c) ? c : null));
      const n = rowCount(ds);
      const out: string[][] = new Array(n);
      for (let i = 0; i < n; i++) {
        const r: string[] = new Array(cols.length);
        for (let j = 0; j < cols.length; j++) {
          const num = cols[j];
          r[j] = num ? fmtCell(num[i]) : (ds.colData![j] as string[])[i] ?? '';
        }
        out[i] = r;
      }
      cache = out;
      return out;
    },
    set(v: string[][]) {
      cache = v;
    }
  });
  return ds;
}

interface ColHeader {
  kind: 'num' | 'str';
  offset: number;
  len: number;
}

/** Decodes the binary message of `load_dataset` / `resample_loaded` / `execute_sql_query`. */
export function decodeDataset(payload: ArrayBuffer | Uint8Array | number[]): DatasetPreview {
  let buf: ArrayBuffer;
  if (payload instanceof ArrayBuffer) {
    buf = payload;
  } else if (payload instanceof Uint8Array) {
    // Float64Array views need an 8-byte aligned start: copy if the view is offset.
    buf = payload.byteOffset % 8 === 0 && payload.byteOffset === 0 && payload.byteLength === payload.buffer.byteLength
      ? (payload.buffer as ArrayBuffer)
      : (payload.slice().buffer as ArrayBuffer);
  } else {
    buf = new Uint8Array(payload).buffer;
  }
  const bytes = new Uint8Array(buf);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'CMB1') throw new Error('Unexpected data message from the back end');
  const hlen = new DataView(buf).getUint32(4, true);
  const dec = new TextDecoder();
  const h = JSON.parse(dec.decode(bytes.subarray(8, 8 + hlen)));
  const n: number = h.n_rows;
  const colData: ColumnData[] = (h.cols as ColHeader[]).map(c => {
    if (c.kind === 'num') return new Float64Array(buf, c.offset, c.len / 8);
    if (n === 0) return [];
    return dec.decode(bytes.subarray(c.offset, c.offset + c.len)).split('\0');
  });
  const ds: DatasetPreview = {
    id: h.id,
    columns: h.columns,
    colData,
    n_rows: n,
    rows: [],
    total_rows: h.total_rows,
    detected_sep: h.detected_sep,
    suggested_ts_col: h.suggested_ts_col ?? undefined,
    suggested_ts_format: h.suggested_ts_format ?? undefined,
    truncated: h.truncated,
    row_limit: h.row_limit,
    notes: h.notes,
    parse_ms: h.parse_ms
  };
  return attachLazyRows(ds);
}

export function rowCount(ds: DatasetPreview | null | undefined): number {
  if (!ds) return 0;
  if (ds.colData) return ds.n_rows ?? (ds.colData[0]?.length ?? 0);
  return ds.rows.length;
}

/** Column by name; datasets without `colData` (legacy) are read from their rows. */
export function getColumn(ds: DatasetPreview, name: string): ColumnData | null {
  const j = ds.columns.indexOf(name);
  if (j === -1) return null;
  if (ds.colData) return ds.colData[j];
  return ds.rows.map(r => r[j] ?? '');
}

/** Numeric values of a column (NaN / non-numbers → null), optionally at selected row indices. */
export function numericValues(ds: DatasetPreview, name: string, idx?: Int32Array | number[]): (number | null)[] {
  const c = getColumn(ds, name);
  if (!c) return [];
  const n = idx ? idx.length : c.length;
  const out: (number | null)[] = new Array(n);
  if (isNumericColumn(c)) {
    for (let k = 0; k < n; k++) {
      const v = c[idx ? idx[k] : k];
      out[k] = Number.isFinite(v) ? v : null;
    }
  } else {
    for (let k = 0; k < n; k++) out[k] = parseNumericText(c[idx ? idx[k] : k]);
  }
  return out;
}

/** Values for an axis: text columns as text, numeric columns as numbers (null for gaps). */
export function axisValues(ds: DatasetPreview, name: string, idx?: Int32Array | number[]): (string | number | null)[] {
  const c = getColumn(ds, name);
  if (!c) return [];
  if (isNumericColumn(c)) return numericValues(ds, name, idx);
  return idx ? Array.from(idx, i => c[i]) : c.slice();
}

export function cellText(ds: DatasetPreview, row: number, col: number): string {
  if (ds.colData) {
    const c = ds.colData[col];
    if (!c) return '';
    return isNumericColumn(c) ? fmtCell(c[row]) : (c[row] ?? '');
  }
  return ds.rows[row]?.[col] ?? '';
}
