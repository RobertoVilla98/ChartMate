// ---------------------------------------------------------------------------
// Large series
// ---------------------------------------------------------------------------

/** Line/area traces longer than this are reduced with min-max decimation before drawing. */
export const DECIMATION_THRESHOLD = 20_000;
/** Marker-only traces longer than this are drawn with WebGL (scattergl). */
export const WEBGL_THRESHOLD = 50_000;

/**
 * Min-max decimation: the series is split into `targetPoints / 2` buckets of consecutive samples
 * and, for each bucket, the minimum and the maximum are kept in their original order. Every local
 * extreme wider than one bucket survives, so at screen or print resolution the line is visually
 * identical to the full series, while the SVG stays small. Non-finite values are kept as gaps.
 * Returns the kept indices (sorted).
 */
export function minMaxDecimationIndices(y: (number | null)[], targetPoints: number): number[] {
  const n = y.length;
  if (n <= targetPoints || targetPoints < 4) return Array.from({ length: n }, (_, i) => i);
  const buckets = Math.floor(targetPoints / 2);
  const size = n / buckets;
  const keep: number[] = [];
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * size);
    const end = Math.min(n, Math.floor((b + 1) * size));
    let iMin = -1, iMax = -1, gap = -1;
    for (let i = start; i < end; i++) {
      const v = y[i];
      if (v === null || !Number.isFinite(v)) { if (gap < 0) gap = i; continue; }
      if (iMin < 0 || v < (y[iMin] as number)) iMin = i;
      if (iMax < 0 || v > (y[iMax] as number)) iMax = i;
    }
    const sel = [iMin, iMax, gap].filter(i => i >= 0).sort((a, b) => a - b);
    for (const i of sel) if (keep[keep.length - 1] !== i) keep.push(i);
  }
  if (keep[0] !== 0) keep.unshift(0);
  if (keep[keep.length - 1] !== n - 1) keep.push(n - 1);
  return keep;
}

/** Applies min-max decimation to an x/y pair; returns the reduced arrays. */
export function decimateSeries<T, V extends number | null>(x: T[], y: V[], targetPoints: number): { x: T[]; y: V[]; decimated: boolean } {
  if (y.length <= DECIMATION_THRESHOLD) return { x, y, decimated: false };
  const idx = minMaxDecimationIndices(y, targetPoints);
  return { x: idx.map(i => x[i]), y: idx.map(i => y[i]), decimated: true };
}

/** Target number of drawn points for a plot `widthPx` wide: 4 per pixel column (2 min-max pairs). */
export function decimationTarget(widthPx: number): number {
  return Math.max(2_000, Math.round(widthPx * 4));
}

/**
 * Display reduction for any Plotly figure (used for the building-physics figures and the plate):
 * line traces longer than DECIMATION_THRESHOLD get min-max decimation, marker-only traces longer
 * than WEBGL_THRESHOLD are drawn with WebGL. Filled areas and non-scatter traces are untouched.
 * Statistics and KPIs are computed before this step, on all values.
 */
export function reduceTracesForDisplay(traces: any[], widthPx: number): any[] {
  return traces.map(t => {
    const isScatter = !t.type || t.type === 'scatter';
    const n = Array.isArray(t.y) || ArrayBuffer.isView(t.y) ? t.y.length : 0;
    if (!isScatter || n === 0 || t.fill) return t;
    const mode: string = t.mode || 'lines';
    if (mode.includes('lines') && n > DECIMATION_THRESHOLD) {
      const d = decimateSeries(Array.from(t.x ?? []), Array.from(t.y) as (number | null)[], decimationTarget(widthPx));
      return { ...t, x: d.x, y: d.y };
    }
    if (!mode.includes('lines') && n > WEBGL_THRESHOLD) {
      return { ...t, type: 'scattergl' };
    }
    return t;
  });
}
