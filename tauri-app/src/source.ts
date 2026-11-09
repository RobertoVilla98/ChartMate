// Row-agnostic access to tabular data for the calculation modules (pure, no DOM).
//
// The building-physics and editorial functions accept either legacy text rows (`string[][]`, used
// by the unit tests) or the column-oriented dataset of the v0.3 engine (`colData`: Float64Array
// for numbers, string[] for text). Reading through these accessors avoids building a text view
// of 10^6 rows and re-parsing every number and timestamp on every redraw.

export type ColumnData = Float64Array | string[];

export interface ColumnTable {
  columns: string[];
  colData?: ColumnData[];
  n_rows?: number;
  rows?: string[][];
}

/** Text rows or a column table. */
export type Rows = string[][] | ColumnTable;

function isTable(r: Rows): r is ColumnTable {
  return !Array.isArray(r);
}

export function nRowsOf(rows: Rows): number {
  if (!isTable(rows)) return rows.length;
  if (rows.colData) return rows.n_rows ?? rows.colData[0]?.length ?? 0;
  return rows.rows?.length ?? 0;
}

function parseCell(s: string | undefined): number {
  if (!s) return NaN;
  const v = parseFloat(s.indexOf(',') >= 0 ? s.replace(',', '.') : s);
  return v;
}

/** Number at row i of column j (NaN when missing or not numeric). */
export function numGetter(rows: Rows, j: number): (i: number) => number {
  if (j < 0) return () => NaN;
  if (isTable(rows) && rows.colData) {
    const c = rows.colData[j];
    if (c instanceof Float64Array) return i => c[i];
    return i => parseCell(c[i]);
  }
  const rr = isTable(rows) ? (rows.rows ?? []) : rows;
  return i => parseCell(rr[i]?.[j]);
}

/** Text at row i of column j. */
export function textGetter(rows: Rows, j: number): (i: number) => string {
  if (j < 0) return () => '';
  if (isTable(rows) && rows.colData) {
    const c = rows.colData[j];
    if (c instanceof Float64Array) return i => (Number.isFinite(c[i]) ? String(c[i]) : '');
    return i => c[i] ?? '';
  }
  const rr = isTable(rows) ? (rows.rows ?? []) : rows;
  return i => rr[i]?.[j] ?? '';
}

// ------------------------------------------------------------------ timestamps ---

const d2 = (s: string, k: number) => (s.charCodeAt(k) - 48) * 10 + (s.charCodeAt(k + 1) - 48);
const isDigit = (s: string, k: number) => { const c = s.charCodeAt(k); return c >= 48 && c <= 57; };

/**
 * Epoch milliseconds (UTC) of a timestamp. Fast path for the fixed layout written by the engine
 * ("YYYY-MM-DD[ T]HH:MM[:SS]"); other layouts ("DD/MM/YYYY HH:MM", "YYYY/MM/DD") go through the
 * general parser. NaN when the text is not a timestamp.
 */
export function timestampMs(raw: string): number {
  const s = raw;
  if (s && s.length >= 10 && s.charCodeAt(4) === 45 && s.charCodeAt(7) === 45 &&
      isDigit(s, 0) && isDigit(s, 3) && isDigit(s, 5) && isDigit(s, 6) && isDigit(s, 8) && isDigit(s, 9)) {
    const y = d2(s, 0) * 100 + d2(s, 2);
    const mo = d2(s, 5), d = d2(s, 8);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return NaN;
    let h = 0, mi = 0, se = 0;
    if (s.length >= 16 && isDigit(s, 11) && isDigit(s, 14)) {
      h = d2(s, 11);
      mi = d2(s, 14);
      if (s.length >= 19 && isDigit(s, 17)) se = d2(s, 17);
    }
    return Date.UTC(y, mo - 1, d, h, mi, se);
  }
  return slowTimestampMs(s);
}

function slowTimestampMs(raw: string): number {
  const s = (raw || '').trim();
  const m = s.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/);
  if (!m) return NaN;
  let y = +m[1], mo = +m[2], d = +m[3];
  if (m[1].length <= 2 && m[3].length === 4) { y = +m[3]; d = +m[1]; }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return NaN;
  return Date.UTC(y, mo - 1, d, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}

const tsCacheCols = new WeakMap<object, Float64Array>();
const tsCacheRows = new WeakMap<object, Map<number, Float64Array>>();

/** Epoch-ms column for the timestamp column j, parsed once and cached per dataset column. */
export function timeColumn(rows: Rows, j: number): Float64Array {
  const n = nRowsOf(rows);
  if (j < 0) return new Float64Array(n).fill(NaN);
  if (isTable(rows) && rows.colData) {
    const c = rows.colData[j];
    const hit = tsCacheCols.get(c);
    if (hit) return hit;
    const out = new Float64Array(n);
    if (c instanceof Float64Array) out.fill(NaN);
    else for (let i = 0; i < n; i++) out[i] = timestampMs(c[i]);
    tsCacheCols.set(c, out);
    return out;
  }
  const rr = isTable(rows) ? (rows.rows ?? []) : rows;
  let m = tsCacheRows.get(rr);
  if (!m) { m = new Map(); tsCacheRows.set(rr, m); }
  const hit = m.get(j);
  if (hit) return hit;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = timestampMs(rr[i]?.[j] ?? '');
  m.set(j, out);
  return out;
}

const DAY_MS = 86_400_000;
const dayKeyCache = new Map<number, string>();

/** Calendar day "YYYY-MM-DD" of an epoch-ms value (cached per day). */
export function dayKey(ms: number): string {
  const day = Math.floor(ms / DAY_MS);
  let k = dayKeyCache.get(day);
  if (k === undefined) {
    const dt = new Date(day * DAY_MS);
    k = `${String(dt.getUTCFullYear()).padStart(4, '0')}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    dayKeyCache.set(day, k);
  }
  return k;
}

/** Hour of day 0–23. */
export function hourOf(ms: number): number {
  return Math.floor((((ms % DAY_MS) + DAY_MS) % DAY_MS) / 3_600_000);
}

/** Day of week, 0 = Sunday … 6 = Saturday (1970-01-01 was a Thursday). */
export function dowOf(ms: number): number {
  return (((Math.floor(ms / DAY_MS) + 4) % 7) + 7) % 7;
}

/**
 * Evenly spaced indices 0 … n−1 (first and last always included), at most `max` of them.
 * Used to draw monotone curves (duration curves) with a bounded number of points; KPIs are always
 * computed on all values.
 */
export function strideIndices(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  const step = (n - 1) / (max - 1);
  for (let k = 0; k < max; k++) out.push(Math.round(k * step));
  return out;
}
