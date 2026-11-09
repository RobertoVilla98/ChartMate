// Decoder of the binary dataset message (layout: chartmate-io/src/columnar.rs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDataset, numericValues, axisValues, cellText, rowCount } from '../src/data/table.ts';

/** Builds a message the way the Rust encoder does. */
function encode(columns: string[], cols: (number[] | string[])[]) {
  const n = cols[0].length;
  const enc = new TextEncoder();
  const parts: { kind: string; bytes: Uint8Array }[] = cols.map(c =>
    typeof c[0] === 'number'
      ? { kind: 'num', bytes: new Uint8Array(new Float64Array(c as number[]).buffer) }
      : { kind: 'str', bytes: enc.encode((c as string[]).join('\0')) });
  const mkHeader = (base: number) => {
    let off = base;
    const hdr = parts.map(p => { off = Math.ceil(off / 8) * 8; const h = { kind: p.kind, offset: off, len: p.bytes.length }; off += p.bytes.length; return h; });
    return enc.encode(JSON.stringify({ id: 3, columns, cols: hdr, n_rows: n, total_rows: n, detected_sep: 'test', suggested_ts_col: 'ts', suggested_ts_format: null, truncated: false, row_limit: n, notes: [], parse_ms: 1 }));
  };
  let base = 0, header = mkHeader(0);
  for (let k = 0; k < 4; k++) { const b = Math.ceil((8 + header.length) / 8) * 8; if (b === base) break; base = b; header = mkHeader(base); }
  const hdrObj = JSON.parse(new TextDecoder().decode(header));
  const total = hdrObj.cols.length ? hdrObj.cols.at(-1).offset + hdrObj.cols.at(-1).len : base;
  const out = new Uint8Array(total);
  out.set(enc.encode('CMB1'), 0);
  new DataView(out.buffer).setUint32(4, header.length, true);
  out.set(header, 8);
  hdrObj.cols.forEach((h: any, i: number) => out.set(parts[i].bytes, h.offset));
  return out.buffer;
}

test('binary dataset message decodes to typed columns and a lazy text view', () => {
  const buf = encode(['ts', 'v', 'zone'], [['2026-01-01 00:00:00', '2026-01-01 01:00:00', '2026-01-01 02:00:00'], [1.5, NaN, 3], ['A', 'B', 'C']]);
  const ds = decodeDataset(buf);
  assert.equal(ds.id, 3);
  assert.equal(rowCount(ds), 3);
  assert.ok(ds.colData![1] instanceof Float64Array);
  assert.deepEqual(numericValues(ds, 'v'), [1.5, null, 3]);
  assert.deepEqual(axisValues(ds, 'ts', [0, 2]), ['2026-01-01 00:00:00', '2026-01-01 02:00:00']);
  assert.equal(cellText(ds, 1, 1), '');
  assert.deepEqual(ds.rows[2], ['2026-01-01 02:00:00', '3', 'C']);
  assert.ok(!Object.keys(ds).includes('rows'), 'rows is a lazy, non-enumerable view');
});
