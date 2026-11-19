import { dayKey, dowOf, nRowsOf, strideIndices, numGetter, textGetter, timeColumn, timestampMs, type Rows } from './source.ts';
import type { GridFrameConfig } from './core/types';

export interface CarpetPlotState {
  variableCol: string;
  aggMethod: 'mean' | 'max' | 'min';
  colorscale: 'Viridis' | 'Plasma' | 'Thermal' | 'Turbo' | 'RdBu' | 'Emerald';
  showContours: boolean;
  contourStep: number | null;
  dayFilter: 'all' | 'weekdays' | 'weekends';
  zMin: number | null;
  zMax: number | null;
  decimals: 'auto' | '0' | '1' | '2' | '3';
}

export interface ThermalComfortState {
  normMode: 'en16798' | 'ashrae55' | 'psychro';
  indoorTempCol: string;
  outdoorTempCol: string;
  rhCol: string;
  computeRunningMean: boolean;
  alpha: number;
}

export interface ComfortKpiSummary {
  totalHours: number;
  cat1Hours: number;
  cat1Pct: number;
  cat2Hours: number;
  cat2Pct: number;
  cat3Hours: number;
  cat3Pct: number;
  overheatHours: number;
  overheatPct: number;
  undercoolHours: number;
  undercoolPct: number;
  /** Samples whose T_rm falls outside the adaptive model's applicability range (excluded from totalHours). */
  outOfRangeHours: number;
  /** How T_rm was obtained: daily running mean, column used as-is, or not computable (no parseable timestamps). */
  trmSource: 'running_mean' | 'column' | 'no_timestamps';
  /**
   * Assessed samples that fall in the first RUNNING_MEAN_WARMUP_DAYS days of a computed running mean.
   * There T_rm still depends on the seed (first day's own mean), so they are flagged, not excluded.
   */
  warmupHours?: number;
  /** T–RH chart only: samples above the 12 g/kg humidity-ratio limit (always counted as out of zone). */
  humidityLimitHours?: number;
}

/** Days after which the seed of the running mean weighs less than 0.8^7 ≈ 21 % (α = 0.8). */
export const RUNNING_MEAN_WARMUP_DAYS = 7;

export interface DurationCurveState {
  variableCol: string;
  compareCol: string;
  xMode: 'hours' | 'pct';
  /** Hours per record used only when dtMode is 'manual' or the timestamps cannot be parsed. */
  dtHours: number;
  /** 'auto' (default): Δt is the median spacing of the timestamps. */
  dtMode?: 'auto' | 'manual';
  threshold1: number | null;
  threshold2: number | null;
  shadeExceedance: boolean;
  decimals: 'auto' | '0' | '1' | '2' | '3';
}

export interface DurationKpiSummary {
  totalHours: number;
  exc1Hours: number;
  exc1Pct: number;
  exc2Hours: number;
  exc2Pct: number;
  exposureIntegral: number;
  peakVal: number;
  p95Val: number;
  medianVal: number;
  meanVal: number;
  /** Δt actually used (hours per record) and where it came from. */
  dtHours?: number;
  dtSource?: 'timestamps' | 'manual' | 'default';
  irregularSampling?: boolean;
}

export interface CalibrationState {
  measuredCol: string;
  simulatedCol: string;
  /**
   * ASHRAE Guideline 14 NMBE / CV(RMSE) acceptance criteria are defined for energy and demand data.
   * 'energy' shows the pass/fail verdict; 'other' (e.g. temperature) reports the indices only.
   */
  quantity?: 'energy' | 'other';
  viewMode: 'series' | 'parity';
  standard: 'hourly' | 'monthly';
  showBoxOnChart: boolean;
  decimals: 'auto' | '0' | '1' | '2' | '3';
}

export interface CalibrationMetrics {
  n: number;
  meanMeasured: number;
  meanSimulated: number;
  nmbePct: number;
  cvRmsePct: number;
  rmse: number;
  mae: number;
  rSquared: number;
  hourlyPass: boolean;
  monthlyPass: boolean;
  /** False when the G14 acceptance criteria do not apply (non-energy quantity). */
  criteriaApplicable?: boolean;
  /** Number of aggregated periods (hours or months) the metrics were computed on. */
  periods: number;
  /** Days between the first and the last paired sample. */
  spanDays?: number;
  /**
   * True when the paired data cover less than one year. ASHRAE Guideline 14 calibration is normally
   * judged on a full year of data; on shorter periods the indices are reported but are illustrative.
   */
  shortPeriod?: boolean;
}

export interface EditorialTableVariable {
  column: string;
  selected: boolean;
  unit: string;
  threshold: number | null;
}

export interface EditorialSuiteState {
  caption: string;
  latexLabel: string;
  outputFormat: 'latex' | 'markdown' | 'tsv';
  decimals: '0' | '1' | '2' | '3';
  dtHours: number;
  variables: EditorialTableVariable[];
  plateWidthPreset: 'single_85mm' | 'half_120mm' | 'double_170mm';
  plateDpi: 300 | 600;
  plateGrid: '2x1' | '1x2' | '2x2' | '3x1';
  plateSlots: string[]; // column names or saved canvas keys
}

/**
 * Minimum / maximum of a large array. `arrMin(a)` passes every element as a call argument
 * and overflows the stack above ~10^5 elements (found when building a 2·10^5-row calibration).
 */
export function arrMin(a: number[]): number {
  let m = Infinity;
  for (let i = 0; i < a.length; i++) if (a[i] < m) m = a[i];
  return m;
}
export function arrMax(a: number[]): number {
  let m = -Infinity;
  for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
  return m;
}

export function resolvePlotlyColorscale(name: string): any {
  switch (name) {
    case 'Emerald':
      return [
        [0, '#f0fdf4'],
        [0.25, '#6ee7b7'],
        [0.5, '#10b981'],
        [0.75, '#047857'],
        [1, '#064e3b']
      ];
    case 'Thermal':
      return [
        [0, '#1e3a8a'],
        [0.25, '#0284c7'],
        [0.5, '#10b981'],
        [0.75, '#f59e0b'],
        [1, '#e11d48']
      ];
    case 'Turbo':
      return 'Turbo';
    case 'Plasma':
      return 'Plasma';
    case 'RdBu':
      return 'RdBu';
    default:
      return 'Viridis';
  }
}

export function fmtDec(val: number, dec: 'auto' | '0' | '1' | '2' | '3' = 'auto'): string {
  if (!Number.isFinite(val)) return '—';
  if (dec === 'auto') {
    return Math.abs(val) >= 100 ? val.toFixed(1) : val.toFixed(2);
  }
  return val.toFixed(parseInt(dec, 10));
}

export function tickFmtFromDec(dec: 'auto' | '0' | '1' | '2' | '3' = 'auto'): string | undefined {
  if (dec === 'auto') return undefined;
  return `.${dec}f`;
}

/**
 * Parses "YYYY-MM-DD[ T]HH:MM[:SS]", "YYYY/MM/DD ...", "DD/MM/YYYY ..." or "DD-MM-YYYY ..." as UTC
 * epoch milliseconds. Returns null when the text is not a timestamp.
 */
export function parseTimestampMs(raw: string): number | null {
  const s = (raw || '').trim();
  const m = s.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/);
  if (!m) return null;
  let y = +m[1], mo = +m[2], d = +m[3];
  if (m[1].length <= 2 && m[3].length === 4) { y = +m[3]; d = +m[1]; }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, mo - 1, d, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}

export interface SamplingStep {
  /** Median spacing between consecutive records, hours (null if fewer than 2 parseable timestamps). */
  stepHours: number | null;
  /** True when spacings differ by more than ±10 % from the median in over 5 % of the records. */
  irregular: boolean;
}

/** Infers the sampling step from a timestamp column. */
const samplingCache = new WeakMap<Float64Array, SamplingStep>();

export function inferSamplingStep(rows: Rows, tsIdx: number): SamplingStep {
  if (tsIdx < 0) return { stepHours: null, irregular: false };
  const tc = timeColumn(rows, tsIdx);
  const hit = samplingCache.get(tc);
  if (hit) return hit;
  let k = 0;
  const t = new Float64Array(tc.length);
  for (let i = 0; i < tc.length; i++) if (Number.isFinite(tc[i])) t[k++] = tc[i];
  let res: SamplingStep = { stepHours: null, irregular: false };
  if (k >= 2) {
    const ts = t.subarray(0, k).sort();
    const d = new Float64Array(k - 1);
    let m = 0;
    for (let i = 1; i < k; i++) if (ts[i] > ts[i - 1]) d[m++] = ts[i] - ts[i - 1];
    if (m > 0) {
      const dd = d.subarray(0, m);
      const med = Float64Array.from(dd).sort()[Math.floor(m / 2)];
      let off = 0;
      for (let i = 0; i < m; i++) if (Math.abs(dd[i] - med) > 0.1 * med) off++;
      res = { stepHours: med / 3_600_000, irregular: off > 0.05 * m };
    }
  }
  samplingCache.set(tc, res);
  return res;
}

/** Resolves Δt (hours per record) for duration curves and the statistics table. */
export function resolveDtHours(
  rows: Rows, tsIdx: number, mode: 'auto' | 'manual' | undefined, manualDt: number
): { dt: number; source: 'timestamps' | 'manual' | 'default'; irregular: boolean } {
  const fallback = manualDt > 0 ? manualDt : 1.0;
  if (mode === 'manual') return { dt: fallback, source: 'manual', irregular: false };
  const s = inferSamplingStep(rows, tsIdx);
  if (s.stepHours && s.stepHours > 0) return { dt: s.stepHours, source: 'timestamps', irregular: s.irregular };
  return { dt: fallback, source: manualDt > 0 ? 'manual' : 'default', irregular: false };
}

// ============================================================================
// TRACK 1: CARPET PLOT / TEMPORAL HEATMAP (DAY vs HOUR 0-23h)
// ============================================================================
export function buildCarpetPlotFigure(
  columns: string[],
  rows: Rows,
  tsCol: string,
  cfg: CarpetPlotState,
  fontFamily: string,
  fontSize: number,
  widthPx: number,
  heightPx: number
): { traces: any[]; layout: any } {
  const tsIdx = Math.max(0, columns.indexOf(tsCol));
  const valIdx = columns.indexOf(cfg.variableCol);

  const dayList: string[] = [];
  const daySet = new Set<string>();
  // Map key `${dateStr}_${hour}` -> number[]
  // Bin key = hours since the epoch (day·24 + hour); running sum / min / max per bin.
  const binMap = new Map<number, { sum: number; n: number; min: number; max: number }>();
  const dayNumOf = new Map<string, number>();

  if (valIdx !== -1) {
    const tc = timeColumn(rows, tsIdx);
    const val = numGetter(rows, valIdx);
    for (let i = 0; i < tc.length; i++) {
      const ms = tc[i];
      if (!Number.isFinite(ms)) continue;
      const dow = dowOf(ms);
      if (cfg.dayFilter === 'weekdays' && (dow === 0 || dow === 6)) continue;
      if (cfg.dayFilter === 'weekends' && (dow !== 0 && dow !== 6)) continue;

      const num = val(i);
      if (!Number.isFinite(num)) continue;
      const key = Math.floor(ms / 3_600_000);
      let b = binMap.get(key);
      if (!b) {
        const dateStr = dayKey(ms);
        if (!daySet.has(dateStr)) {
          daySet.add(dateStr);
          dayList.push(dateStr);
          dayNumOf.set(dateStr, Math.floor(ms / 86_400_000));
        }
        b = { sum: 0, n: 0, min: Infinity, max: -Infinity };
        binMap.set(key, b);
      }
      b.sum += num;
      b.n++;
      if (num < b.min) b.min = num;
      if (num > b.max) b.max = num;
    }
  }

  dayList.sort();
  const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

  const zMatrix: (number | null)[][] = Array.from({ length: 24 }, () =>
    Array.from({ length: dayList.length }, () => null)
  );

  for (let h = 0; h < 24; h++) {
    for (let dIdx = 0; dIdx < dayList.length; dIdx++) {
      const b = binMap.get(dayNumOf.get(dayList[dIdx])! * 24 + h);
      if (b && b.n > 0) {
        zMatrix[h][dIdx] = cfg.aggMethod === 'max' ? b.max : cfg.aggMethod === 'min' ? b.min : b.sum / b.n;
      }
    }
  }

  const cscale = resolvePlotlyColorscale(cfg.colorscale);
  const tickFmt = tickFmtFromDec(cfg.decimals);

  const trace: any = {
    type: cfg.showContours ? 'contour' : 'heatmap',
    x: dayList,
    y: hours,
    z: zMatrix,
    colorscale: cscale,
    zmin: cfg.zMin !== null && Number.isFinite(cfg.zMin) ? cfg.zMin : undefined,
    zmax: cfg.zMax !== null && Number.isFinite(cfg.zMax) ? cfg.zMax : undefined,
    connectgaps: true,
    hoverongaps: false,
    colorbar: {
      title: {
        text: `${cfg.variableCol} (${cfg.aggMethod.toUpperCase()})`,
        font: { family: fontFamily, size: fontSize, color: '#000000' }
      },
      tickformat: tickFmt,
      tickfont: { family: 'JetBrains Mono, monospace', size: Math.max(9, fontSize - 1), color: '#000000' }
    },
    hovertemplate: `<b>Date</b>: %{x}<br><b>Hour</b>: %{y}<br><b>${cfg.variableCol}</b>: %{z:${tickFmt || '.2f'}}<extra></extra>`
  };

  if (cfg.showContours) {
    trace.contours = {
      coloring: 'heatmap',
      showlabels: true,
      labelfont: { family: 'JetBrains Mono, monospace', size: Math.max(8, fontSize - 2), color: '#000000' }
    };
    if (cfg.contourStep && cfg.contourStep > 0) {
      trace.autocontour = false;
      trace.contours.size = cfg.contourStep;
    }
  }

  const layout: any = {
    width: widthPx,
    height: heightPx,
    margin: { l: 68, r: 40, t: 38, b: 64 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: fontFamily, size: fontSize, color: '#000000' },
    title: {
      text: `<b>Carpet Plot (2D Day–Hour Matrix)</b> — ${cfg.variableCol}`,
      font: { family: fontFamily, size: fontSize + 2, color: '#000000' },
      x: 0.02,
      xanchor: 'left'
    },
    xaxis: {
      title: { text: 'Monitoring Date [YYYY-MM-DD]', font: { family: fontFamily, size: fontSize, color: '#000000' } },
      type: 'category',
      showline: true,
      linecolor: '#000000',
      linewidth: 1.4,
      ticks: 'outside',
      tickfont: { family: 'JetBrains Mono, monospace', size: Math.max(9, fontSize - 1), color: '#000000' }
    },
    yaxis: {
      title: { text: 'Solar Hour of Day [00:00 – 23:00]', font: { family: fontFamily, size: fontSize, color: '#000000' } },
      type: 'category',
      dtick: 2,
      showline: true,
      linecolor: '#000000',
      linewidth: 1.4,
      ticks: 'outside',
      tickfont: { family: 'JetBrains Mono, monospace', size: Math.max(9, fontSize - 1), color: '#000000' }
    }
  };

  return { traces: [trace], layout };
}

// ============================================================================
// TRACK 2: BIOCLIMATIC & ADAPTIVE THERMAL COMFORT (EN 16798-1 / ASHRAE 55)
// ============================================================================
/** Humidity ratio [g/kg dry air] from air temperature [°C] and RH [%] at 101.325 kPa (Magnus). */
export function humidityRatioGkg(tC: number, rhPct: number): number {
  const psat = 0.61078 * Math.exp((17.27 * tC) / (tC + 237.3)); // kPa
  const pv = (rhPct / 100) * psat;
  return 1000 * 0.62198 * pv / (101.325 - pv);
}

/**
 * Running mean outdoor temperature on DAILY means, per EN 16798-1:2019 (Annex B) and the
 * exponentially weighted prevailing mean of ASHRAE 55-2023:
 *
 *   T_rm(d) = (1 − α) · Θ_ed(d−1) + α · T_rm(d−1)
 *
 * where Θ_ed is the daily mean outdoor temperature. T_rm for a day depends only on PREVIOUS days.
 * The first day is seeded with its own daily mean (warm-up, no prior history available).
 * Calendar days without data carry T_rm forward unchanged.
 *
 * @param dailyMean map 'YYYY-MM-DD' → daily mean outdoor temperature
 * @returns map 'YYYY-MM-DD' → T_rm for every calendar day from the first to the last date
 */
export function computeDailyRunningMean(dailyMean: Map<string, number>, alpha: number): Map<string, number> {
  const out = new Map<string, number>();
  const days = [...dailyMean.keys()].sort();
  if (days.length === 0) return out;

  const DAY_MS = 86_400_000;
  const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const first = Date.parse(`${days[0]}T00:00:00Z`);
  const last = Date.parse(`${days[days.length - 1]}T00:00:00Z`);

  let trm = dailyMean.get(days[0])!;
  out.set(days[0], trm);
  for (let ms = first + DAY_MS; ms <= last; ms += DAY_MS) {
    const prevMean = dailyMean.get(toKey(ms - DAY_MS));
    if (prevMean !== undefined) trm = (1 - alpha) * prevMean + alpha * trm;
    out.set(toKey(ms), trm);
  }
  return out;
}

/** Applicability range of T_rm for the adaptive models (as in pythermalcomfort / CBE Comfort Tool). */
export const ADAPTIVE_TRM_RANGE = {
  en16798: [10, 30] as const,
  ashrae55: [10, 33.5] as const
};

export function buildThermalComfortFigure(
  columns: string[],
  rows: Rows,
  tsCol: string,
  cfg: ThermalComfortState,
  fontFamily: string,
  fontSize: number,
  widthPx: number,
  heightPx: number
): { traces: any[]; layout: any; kpi: ComfortKpiSummary } {
  const inIdx = columns.indexOf(cfg.indoorTempCol);
  const outIdx = columns.indexOf(cfg.outdoorTempCol);
  const rhIdx = columns.indexOf(cfg.rhCol);

  const kpi: ComfortKpiSummary = {
    totalHours: 0,
    cat1Hours: 0,
    cat1Pct: 0,
    cat2Hours: 0,
    cat2Pct: 0,
    cat3Hours: 0,
    cat3Pct: 0,
    overheatHours: 0,
    overheatPct: 0,
    undercoolHours: 0,
    undercoolPct: 0,
    outOfRangeHours: 0,
    trmSource: cfg.computeRunningMean ? 'running_mean' : 'column'
  };

  const traces: any[] = [];

  if (cfg.normMode === 'psychro') {
    // Psychrometric T-RH Chart
    // 1. Winter Comfort Polygon (20-24°C, 30-70% RH)
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: [20, 24, 24, 20, 20],
      y: [30, 30, 70, 70, 30],
      fill: 'toself',
      fillcolor: 'rgba(2, 132, 199, 0.10)',
      line: { color: '#0284c7', width: 1.8, dash: 'dash' },
      name: 'Winter Comfort (20–24°C, 30–70% RH)'
    });

    // 2. Summer Comfort Polygon (23-26°C, 30-70% RH)
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: [23, 26, 26, 23, 23],
      y: [30, 30, 70, 70, 30],
      fill: 'toself',
      fillcolor: 'rgba(5, 150, 105, 0.14)',
      line: { color: '#059669', width: 2.0, dash: 'solid' },
      name: 'Summer Comfort (23–26°C, 30–70% RH)'
    });

    // 3. Psychrometric Iso-Humidity Line x = 12 g/kg (Upper condensation/mold threshold)
    const tCurve: number[] = [];
    const rh12Curve: number[] = [];
    const xLimit = 0.012; // 12 g/kg
    const patm = 101.325;
    for (let t = 15; t <= 34; t += 0.5) {
      const psat = 0.61078 * Math.exp((17.27 * t) / (t + 237.3));
      const pv = (patm * xLimit) / (0.62198 + xLimit);
      const rhLimit = Math.min(100, (pv / psat) * 100);
      tCurve.push(t);
      rh12Curve.push(rhLimit);
    }
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: tCurve,
      y: rh12Curve,
      line: { color: '#e11d48', width: 1.8, dash: 'dot' },
      name: 'Max Humidity Limit (x = 12 g/kg)'
    });

    const ptsInX: number[] = [];
    const ptsInY: number[] = [];
    const ptsOutX: number[] = [];
    const ptsOutY: number[] = [];

    if (inIdx !== -1 && rhIdx !== -1) {
      const tGet = numGetter(rows, inIdx);
      const rhGet = numGetter(rows, rhIdx);
      const nR = nRowsOf(rows);
      for (let i = 0; i < nR; i++) {
        const tVal = tGet(i);
        const rhVal = rhGet(i);
        if (!Number.isFinite(tVal) || !Number.isFinite(rhVal)) continue;

        kpi.totalHours++;
        // One documented rule: a sample is in the comfort envelope when it lies in the winter OR the
        // summer reference zone AND its humidity ratio does not exceed 12 g/kg dry air.
        // (No hidden extended zone: categories 1–3 coincide on this chart.)
        const inWinter = tVal >= 20.0 && tVal <= 24.0 && rhVal >= 30.0 && rhVal <= 70.0;
        const inSummer = tVal >= 23.0 && tVal <= 26.0 && rhVal >= 30.0 && rhVal <= 70.0;
        const overHumidityLimit = humidityRatioGkg(tVal, rhVal) > 12.0;
        if (overHumidityLimit) kpi.humidityLimitHours = (kpi.humidityLimitHours ?? 0) + 1;

        if ((inSummer || inWinter) && !overHumidityLimit) {
          kpi.cat1Hours++;
          kpi.cat2Hours++;
          kpi.cat3Hours++;
          ptsInX.push(tVal);
          ptsInY.push(rhVal);
        } else {
          ptsOutX.push(tVal);
          ptsOutY.push(rhVal);
          if (tVal > 26.0 || rhVal > 70.0 || overHumidityLimit) kpi.overheatHours++;
          else if (tVal < 20.0 || rhVal < 30.0) kpi.undercoolHours++;
        }
      }
    }

    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: ptsInX,
      y: ptsInY,
      marker: { color: '#059669', size: 6.5, opacity: 0.8, line: { color: '#000000', width: 0.5 } },
      name: `Compliant (${ptsInX.length} h)`
    });

    if (ptsOutX.length > 0) {
      traces.push({
        type: 'scatter',
        mode: 'markers',
        x: ptsOutX,
        y: ptsOutY,
        marker: { color: '#e11d48', size: 6.5, symbol: 'diamond', opacity: 0.85 },
        name: `Out of Zone (${ptsOutX.length} h)`
      });
    }

    if (kpi.totalHours > 0) {
      kpi.cat1Pct = (kpi.cat1Hours / kpi.totalHours) * 100;
      kpi.cat2Pct = (kpi.cat2Hours / kpi.totalHours) * 100;
      kpi.cat3Pct = (kpi.cat3Hours / kpi.totalHours) * 100;
      kpi.overheatPct = (kpi.overheatHours / kpi.totalHours) * 100;
      kpi.undercoolPct = (kpi.undercoolHours / kpi.totalHours) * 100;
    }

    const layout: any = {
      width: widthPx,
      height: heightPx,
      margin: { l: 64, r: 30, t: 42, b: 58 },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      font: { family: fontFamily, size: fontSize, color: '#000000' },
      title: {
        text: '<b>T–RH Diagram</b> — reference zones (editable defaults) and 12 g/kg limit',
        font: { family: fontFamily, size: fontSize + 2, color: '#000000' },
        x: 0.02,
        xanchor: 'left'
      },
      legend: { orientation: 'h', x: 0, y: 1.09, font: { size: Math.max(9, fontSize - 1), color: '#000000' } },
      xaxis: {
        title: { text: 'Indoor Operative Temperature [°C]', font: { family: fontFamily, size: fontSize, color: '#000000' } },
        range: [16, 32],
        showline: true,
        linecolor: '#000000',
        linewidth: 1.4,
        gridcolor: '#e2e8f0',
        ticks: 'outside',
        tickfont: { family: 'JetBrains Mono, monospace', color: '#000000' }
      },
      yaxis: {
        title: { text: 'Relative Humidity RH [%]', font: { family: fontFamily, size: fontSize, color: '#000000' } },
        range: [15, 95],
        showline: true,
        linecolor: '#000000',
        linewidth: 1.4,
        gridcolor: '#e2e8f0',
        ticks: 'outside',
        tickfont: { family: 'JetBrains Mono, monospace', color: '#000000' }
      }
    };

    return { traces, layout, kpi };
  }

  // Adaptive Comfort Mode: EN 16798-1:2019 or ASHRAE 55-2023
  const isEN = cfg.normMode === 'en16798';
  const [trmMin, trmMax] = isEN ? ADAPTIVE_TRM_RANGE.en16798 : ADAPTIVE_TRM_RANGE.ashrae55;
  const xDom = [trmMin, trmMax];
  const calcNeutral = (trm: number) => (isEN ? 0.33 * trm + 18.8 : 0.31 * trm + 17.8);

  // Boundary bands
  if (isEN) {
    // Cat III: [-5, +4], Cat II: [-4, +3], Cat I: [-3, +2]
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xDom,
      y: xDom.map(x => calcNeutral(x) + 4.0),
      line: { color: '#94a3b8', width: 1.3, dash: 'dot' },
      name: 'Cat. III Limit (+4 / -5 °C)'
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xDom,
      y: xDom.map(x => calcNeutral(x) - 5.0),
      line: { color: '#94a3b8', width: 1.3, dash: 'dot' },
      showlegend: false
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xDom,
      y: xDom.map(x => calcNeutral(x) + 3.0),
      line: { color: '#0284c7', width: 1.6, dash: 'dash' },
      name: 'Cat. II Limit (+3 / -4 °C)'
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xDom,
      y: xDom.map(x => calcNeutral(x) - 4.0),
      line: { color: '#0284c7', width: 1.6, dash: 'dash' },
      showlegend: false
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xDom,
      y: xDom.map(x => calcNeutral(x) + 2.0),
      line: { color: '#059669', width: 2.1, dash: 'solid' },
      name: 'Cat. I Limit (+2 / -3 °C)'
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xDom,
      y: xDom.map(x => calcNeutral(x) - 3.0),
      line: { color: '#059669', width: 2.1, dash: 'solid' },
      showlegend: false
    });
  } else {
    // ASHRAE 55: 80% (±3.5°C), 90% (±2.5°C)
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xDom,
      y: xDom.map(x => calcNeutral(x) + 3.5),
      line: { color: '#0284c7', width: 1.6, dash: 'dash' },
      name: '80% Acceptability (±3.5 °C)'
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xDom,
      y: xDom.map(x => calcNeutral(x) - 3.5),
      line: { color: '#0284c7', width: 1.6, dash: 'dash' },
      showlegend: false
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xDom,
      y: xDom.map(x => calcNeutral(x) + 2.5),
      line: { color: '#059669', width: 2.1, dash: 'solid' },
      name: '90% Acceptability (±2.5 °C)'
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xDom,
      y: xDom.map(x => calcNeutral(x) - 2.5),
      line: { color: '#059669', width: 2.1, dash: 'solid' },
      showlegend: false
    });
  }

  // Optimal neutral line
  traces.push({
    type: 'scatter',
    mode: 'lines',
    x: xDom,
    y: xDom.map(x => calcNeutral(x)),
    line: { color: '#000000', width: 1.5, dash: 'dashdot' },
    name: isEN ? 'T_opt = 0.33·T_rm + 18.8°C' : 'T_comf = 0.31·T_rm + 17.8°C'
  });

  // Process experimental data points
  const cat1X: number[] = [], cat1Y: number[] = [];
  const cat2X: number[] = [], cat2Y: number[] = [];
  const outX: number[] = [], outY: number[] = [];
  const naX: number[] = [], naY: number[] = [];

  if (inIdx !== -1 && outIdx !== -1) {
    const alpha = Math.max(0.1, Math.min(0.95, cfg.alpha || 0.8));
    const tsIdx = columns.indexOf(tsCol);
    const nR = nRowsOf(rows);
    const tIn = numGetter(rows, inIdx);
    const tOut = numGetter(rows, outIdx);
    const tc = timeColumn(rows, tsIdx);

    // T_rm must be computed on DAILY mean outdoor temperatures, never sample by sample.
    let trmByDay: Map<string, number> | null = null;
    let warmupEndMs: number | null = null;
    if (cfg.computeRunningMean) {
      const acc = new Map<string, { sum: number; n: number }>();
      if (tsIdx !== -1) {
        for (let i = 0; i < nR; i++) {
          const ms = tc[i];
          const tout = tOut(i);
          if (!Number.isFinite(ms) || !Number.isFinite(tout)) continue;
          const day = dayKey(ms);
          const a = acc.get(day) ?? { sum: 0, n: 0 };
          a.sum += tout;
          a.n++;
          acc.set(day, a);
        }
      }
      if (acc.size === 0) {
        kpi.trmSource = 'no_timestamps';
      } else {
        const dailyMean = new Map<string, number>();
        acc.forEach((a, day) => dailyMean.set(day, a.sum / a.n));
        trmByDay = computeDailyRunningMean(dailyMean, alpha);
        const firstDay = [...dailyMean.keys()].sort()[0];
        warmupEndMs = Date.parse(`${firstDay}T00:00:00Z`) + RUNNING_MEAN_WARMUP_DAYS * 86_400_000;
        kpi.warmupHours = 0;
      }
    }

    for (let i = 0; i < nR; i++) {
      if (kpi.trmSource === 'no_timestamps') break;
      const top = tIn(i);
      const tout = tOut(i);
      if (!Number.isFinite(top) || !Number.isFinite(tout)) continue;

      let trm: number;
      let inWarmup = false;
      if (trmByDay) {
        const dayTrm = Number.isFinite(tc[i]) ? trmByDay.get(dayKey(tc[i])) : undefined;
        if (dayTrm === undefined) continue;
        trm = dayTrm;
        inWarmup = warmupEndMs !== null && tc[i] < warmupEndMs;
      } else {
        // Column already contains T_rm (or prevailing mean outdoor temperature)
        trm = tout;
      }

      // Outside the model's applicability range: plotted separately, excluded from KPIs
      if (trm < trmMin || trm > trmMax) {
        kpi.outOfRangeHours++;
        naX.push(trm);
        naY.push(top);
        continue;
      }

      const tNeutral = calcNeutral(trm);
      kpi.totalHours++;
      if (inWarmup) kpi.warmupHours = (kpi.warmupHours ?? 0) + 1;

      const up1 = isEN ? tNeutral + 2.0 : tNeutral + 2.5;
      const lo1 = isEN ? tNeutral - 3.0 : tNeutral - 2.5;
      const up2 = isEN ? tNeutral + 3.0 : tNeutral + 3.5;
      const lo2 = isEN ? tNeutral - 4.0 : tNeutral - 3.5;
      const up3 = isEN ? tNeutral + 4.0 : tNeutral + 3.5;
      const lo3 = isEN ? tNeutral - 5.0 : tNeutral - 3.5;

      if (top >= lo1 && top <= up1) {
        kpi.cat1Hours++;
        kpi.cat2Hours++;
        kpi.cat3Hours++;
        cat1X.push(trm);
        cat1Y.push(top);
      } else if (top >= lo2 && top <= up2) {
        kpi.cat2Hours++;
        kpi.cat3Hours++;
        cat2X.push(trm);
        cat2Y.push(top);
      } else if (top >= lo3 && top <= up3) {
        kpi.cat3Hours++;
        cat2X.push(trm);
        cat2Y.push(top);
      } else {
        outX.push(trm);
        outY.push(top);
        if (top > up2) kpi.overheatHours++;
        if (top < lo2) kpi.undercoolHours++;
      }
    }
  }

  traces.push({
    type: 'scatter',
    mode: 'markers',
    x: cat1X,
    y: cat1Y,
    marker: { color: '#059669', size: 6.5, opacity: 0.82 },
    name: isEN ? `Cat. I (${cat1X.length} h)` : `90% Accept. (${cat1X.length} h)`
  });

  if (cat2X.length > 0) {
    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: cat2X,
      y: cat2Y,
      marker: { color: '#0284c7', size: 6.5, opacity: 0.82 },
      name: isEN ? `Cat. II–III (${cat2X.length} h)` : `80% Accept. (${cat2X.length} h)`
    });
  }

  if (outX.length > 0) {
    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: outX,
      y: outY,
      marker: { color: '#e11d48', size: 7, symbol: 'diamond', opacity: 0.88 },
      name: `Discomfort (${outX.length} h)`
    });
  }

  if (naX.length > 0) {
    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: naX,
      y: naY,
      marker: { color: '#94a3b8', size: 6, symbol: 'x', opacity: 0.7 },
      name: `Outside model range T_rm ∉ [${trmMin}, ${trmMax}] °C (${naX.length} h)`
    });
  }

  if (kpi.totalHours > 0) {
    kpi.cat1Pct = (kpi.cat1Hours / kpi.totalHours) * 100;
    kpi.cat2Pct = (kpi.cat2Hours / kpi.totalHours) * 100;
    kpi.cat3Pct = (kpi.cat3Hours / kpi.totalHours) * 100;
    kpi.overheatPct = (kpi.overheatHours / kpi.totalHours) * 100;
    kpi.undercoolPct = (kpi.undercoolHours / kpi.totalHours) * 100;
  }

  // Keep the model domain visible, extend only if out-of-range samples exist
  const xRange = [
    Math.min(trmMin, Math.floor(arrMin(naX) - 1)),
    Math.max(trmMax, Math.ceil(arrMax(naX) + 1))
  ];

  const layout: any = {
    width: widthPx,
    height: heightPx,
    margin: { l: 64, r: 30, t: 48, b: 58 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: fontFamily, size: fontSize, color: '#000000' },
    title: {
      text: isEN
        ? '<b>Adaptive Thermal Comfort Chart</b> — EN 16798-1:2019'
        : '<b>Adaptive Thermal Comfort Chart</b> — ASHRAE 55-2023',
      font: { family: fontFamily, size: fontSize + 2, color: '#000000' },
      x: 0.02,
      xanchor: 'left'
    },
    legend: { orientation: 'h', x: 0, y: 1.11, font: { size: Math.max(9, fontSize - 1), color: '#000000' } },
    xaxis: {
      title: {
        text: isEN
          ? 'Outdoor Running Mean Temperature T_rm [°C]'
          : 'Prevailing Mean Outdoor Temperature T_pma(out) [°C]',
        font: { family: fontFamily, size: fontSize, color: '#000000' }
      },
      range: xRange,
      showline: true,
      linecolor: '#000000',
      linewidth: 1.4,
      gridcolor: '#e2e8f0',
      ticks: 'outside',
      tickfont: { family: 'JetBrains Mono, monospace', color: '#000000' }
    },
    yaxis: {
      title: { text: 'Indoor Operative Temperature T_op [°C]', font: { family: fontFamily, size: fontSize, color: '#000000' } },
      range: [18, 32],
      showline: true,
      linecolor: '#000000',
      linewidth: 1.4,
      gridcolor: '#e2e8f0',
      ticks: 'outside',
      tickfont: { family: 'JetBrains Mono, monospace', color: '#000000' }
    }
  };

  return { traces, layout, kpi };
}

// ============================================================================
// TRACK 3: DURATION CURVES & EXCEEDANCE ANALYZER (LDC / EXPOSURE DOSE)
// ============================================================================
export function buildDurationCurveFigure(
  columns: string[],
  rows: Rows,
  cfg: DurationCurveState,
  fontFamily: string,
  fontSize: number,
  widthPx: number,
  heightPx: number,
  tsCol?: string
): { traces: any[]; layout: any; kpi: DurationKpiSummary } {
  const colIdx = columns.indexOf(cfg.variableCol);
  const cmpIdx = cfg.compareCol ? columns.indexOf(cfg.compareCol) : -1;
  // Δt from the timestamps unless the user fixed it (without timestamps: the manual value).
  const dtInfo = resolveDtHours(rows, tsCol ? columns.indexOf(tsCol) : -1, tsCol ? (cfg.dtMode ?? 'auto') : 'manual', cfg.dtHours);
  const dt = dtInfo.dt;

  const vals: number[] = [];
  if (colIdx !== -1) {
    const get = numGetter(rows, colIdx);
    const nR = nRowsOf(rows);
    for (let i = 0; i < nR; i++) {
      const v = get(i);
      if (Number.isFinite(v)) vals.push(v);
    }
  }
  // Descending order y_(1) >= ... >= y_(N); a typed-array sort is ~10x faster than a comparator.
  const sortedAscArr = Float64Array.from(vals).sort();
  for (let i = 0, n0 = sortedAscArr.length; i < n0; i++) vals[i] = sortedAscArr[n0 - 1 - i];

  const n = vals.length;
  const totalHours = n * dt;
  const xAxisVals = vals.map((_, i) =>
    cfg.xMode === 'pct' ? ((i + 1) / Math.max(1, n)) * 100 : (i + 1) * dt
  );

  let exc1Count = 0;
  let exc2Count = 0;
  let integral = 0;

  for (const v of vals) {
    if (cfg.threshold1 !== null && Number.isFinite(cfg.threshold1) && v > cfg.threshold1) {
      exc1Count++;
      integral += (v - cfg.threshold1) * dt;
    }
    if (cfg.threshold2 !== null && Number.isFinite(cfg.threshold2) && v > cfg.threshold2) {
      exc2Count++;
    }
  }

  const sortedAsc = sortedAscArr;
  const peakVal = n > 0 ? vals[0] : 0;
  const p95Val = n > 0 ? sortedAsc[Math.min(n - 1, Math.floor((n - 1) * 0.95))] : 0;
  const medianVal = n > 0 ? sortedAsc[Math.floor((n - 1) * 0.5)] : 0;
  const meanVal = n > 0 ? vals.reduce((a, b) => a + b, 0) / n : 0;

  const kpi: DurationKpiSummary = {
    totalHours,
    exc1Hours: exc1Count * dt,
    exc1Pct: n > 0 ? (exc1Count / n) * 100 : 0,
    exc2Hours: exc2Count * dt,
    exc2Pct: n > 0 ? (exc2Count / n) * 100 : 0,
    exposureIntegral: integral,
    peakVal,
    p95Val,
    medianVal,
    meanVal,
    dtHours: dt,
    dtSource: dtInfo.source,
    irregularSampling: dtInfo.irregular
  };

  const traces: any[] = [];
  const tickFmt = tickFmtFromDec(cfg.decimals);

  // Shaded Exceedance Area above Primary Threshold
  if (cfg.shadeExceedance && cfg.threshold1 !== null && Number.isFinite(cfg.threshold1) && exc1Count > 0) {
    // The curve is monotone: an even subset of points draws it exactly at any print size.
    const excIdx = strideIndices(exc1Count, 4000);
    const excX = excIdx.map(i => xAxisVals[i]);
    const excY = excIdx.map(i => vals[i]);
    const baseLine = excX.map(() => cfg.threshold1!);

    traces.push({
      type: 'scatter',
      mode: 'none',
      x: [...excX, ...[...excX].reverse()],
      y: [...excY, ...baseLine],
      fill: 'toself',
      fillcolor: 'rgba(225, 29, 72, 0.18)',
      name: `Exceedance Area (I_exc = ${fmtDec(integral, cfg.decimals)})`,
      hoverinfo: 'skip'
    });
  }

  // Primary Duration Curve
  const drawIdx = strideIndices(n, 4000);
  traces.push({
    type: 'scatter',
    mode: 'lines',
    x: drawIdx.map(i => xAxisVals[i]),
    y: drawIdx.map(i => vals[i]),
    line: { color: '#000000', width: 2.3 },
    name: `${cfg.variableCol} (Duration Curve)`
  });

  // Optional Secondary Comparison Duration Curve
  if (cmpIdx !== -1) {
    const cmpVals: number[] = [];
    const get = numGetter(rows, cmpIdx);
    const nR = nRowsOf(rows);
    for (let i = 0; i < nR; i++) {
      const v = get(i);
      if (Number.isFinite(v)) cmpVals.push(v);
    }
    const cmpAsc = Float64Array.from(cmpVals).sort();
    for (let i = 0, n0 = cmpAsc.length; i < n0; i++) cmpVals[i] = cmpAsc[n0 - 1 - i];
    const cmpX = cmpVals.map((_, i) =>
      cfg.xMode === 'pct' ? ((i + 1) / Math.max(1, cmpVals.length)) * 100 : (i + 1) * dt
    );
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: strideIndices(cmpVals.length, 4000).map(i => cmpX[i]),
      y: strideIndices(cmpVals.length, 4000).map(i => cmpVals[i]),
      line: { color: '#059669', width: 2.0, dash: 'dash' },
      name: `${cfg.compareCol} (Comparison)`
    });
  }

  const shapes: any[] = [];
  const annotations: any[] = [];
  const xMax = xAxisVals.length > 0 ? xAxisVals[xAxisVals.length - 1] : 100;

  if (cfg.threshold1 !== null && Number.isFinite(cfg.threshold1)) {
    shapes.push({
      type: 'line',
      x0: 0,
      x1: xMax,
      y0: cfg.threshold1,
      y1: cfg.threshold1,
      line: { color: '#d97706', width: 1.8, dash: 'dash' }
    });
    annotations.push({
      x: xMax * 0.98,
      y: cfg.threshold1,
      xanchor: 'right',
      yanchor: 'bottom',
      text: `<b>Threshold 1: ${cfg.threshold1} (${kpi.exc1Hours.toFixed(1)} h | ${kpi.exc1Pct.toFixed(1)}%)</b>`,
      showarrow: false,
      font: { family: 'JetBrains Mono, monospace', size: Math.max(9, fontSize - 1), color: '#b45309' },
      bgcolor: 'rgba(255,255,255,0.88)'
    });
  }

  if (cfg.threshold2 !== null && Number.isFinite(cfg.threshold2)) {
    shapes.push({
      type: 'line',
      x0: 0,
      x1: xMax,
      y0: cfg.threshold2,
      y1: cfg.threshold2,
      line: { color: '#e11d48', width: 1.8, dash: 'dot' }
    });
    annotations.push({
      x: xMax * 0.98,
      y: cfg.threshold2,
      xanchor: 'right',
      yanchor: 'bottom',
      text: `<b>Critical 2: ${cfg.threshold2} (${kpi.exc2Hours.toFixed(1)} h | ${kpi.exc2Pct.toFixed(1)}%)</b>`,
      showarrow: false,
      font: { family: 'JetBrains Mono, monospace', size: Math.max(9, fontSize - 1), color: '#e11d48' },
      bgcolor: 'rgba(255,255,255,0.88)'
    });
  }

  const layout: any = {
    width: widthPx,
    height: heightPx,
    margin: { l: 66, r: 30, t: 45, b: 58 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: fontFamily, size: fontSize, color: '#000000' },
    title: {
      text: `<b>Duration & Threshold Exceedance Curve</b> — ${cfg.variableCol}`,
      font: { family: fontFamily, size: fontSize + 2, color: '#000000' },
      x: 0.02,
      xanchor: 'left'
    },
    legend: { orientation: 'h', x: 0, y: 1.1, font: { size: Math.max(9, fontSize - 1), color: '#000000' } },
    shapes,
    annotations,
    xaxis: {
      title: {
        text: cfg.xMode === 'pct' ? 'Cumulative Duration [% of Monitored Time]' : 'Cumulative Duration [Hours]',
        font: { family: fontFamily, size: fontSize, color: '#000000' }
      },
      showline: true,
      linecolor: '#000000',
      linewidth: 1.4,
      gridcolor: '#e2e8f0',
      ticks: 'outside',
      tickfont: { family: 'JetBrains Mono, monospace', color: '#000000' }
    },
    yaxis: {
      title: { text: cfg.variableCol, font: { family: fontFamily, size: fontSize, color: '#000000' } },
      tickformat: tickFmt,
      showline: true,
      linecolor: '#000000',
      linewidth: 1.4,
      gridcolor: '#e2e8f0',
      ticks: 'outside',
      tickfont: { family: 'JetBrains Mono, monospace', color: '#000000' }
    }
  };

  return { traces, layout, kpi };
}

// ============================================================================
// TRACK 5: MODEL CALIBRATION & VALIDATION (ASHRAE GUIDELINE 14 / IPMVP)
// ============================================================================
/** Number of model parameters p in the (n − p) denominators of ASHRAE Guideline 14-2014 (p = 1 for calibrated simulation). */
export const ASHRAE_G14_P = 1;

/**
 * Aggregates measured/simulated pairs to the time base required by the ASHRAE G14 criteria:
 * 'hour' → calendar hour (sub-hourly data averaged, hourly data unchanged), 'month' → calendar month.
 * Monthly values are either the mean of the samples ('mean', for temperatures and other intensive
 * quantities) or the SUM of the hourly means ('sum', for energy: monthly consumption, as in the
 * Guideline 14 monthly criterion; for power in kW the sum of hourly means is the energy in kWh).
 * Rows whose timestamp cannot be parsed are dropped; if none parses, 'hour' falls back to the raw samples.
 */
export function aggregateCalibrationPairs(
  timestamps: string[] | Float64Array,
  measured: number[],
  simulated: number[],
  period: 'hour' | 'month',
  monthlyMode: 'mean' | 'sum' = 'mean'
): { measured: number[]; simulated: number[] } {
  if (period === 'month' && monthlyMode === 'sum') {
    // Hourly means first (so sub-hourly data count once per hour), then the sum per calendar month.
    const hourAcc = new Map<number, { m: number; s: number; n: number }>();
    const len0 = Math.min(timestamps.length, measured.length, simulated.length);
    for (let i = 0; i < len0; i++) {
      if (!Number.isFinite(measured[i]) || !Number.isFinite(simulated[i])) continue;
      const ms = typeof timestamps[i] === 'number' ? (timestamps[i] as number) : timestampMs(timestamps[i] as string);
      if (!Number.isFinite(ms)) continue;
      const h = Math.floor(ms / 3_600_000);
      const a = hourAcc.get(h) ?? { m: 0, s: 0, n: 0 };
      a.m += measured[i];
      a.s += simulated[i];
      a.n++;
      hourAcc.set(h, a);
    }
    const monthAcc = new Map<number, { m: number; s: number }>();
    hourAcc.forEach((a, h) => {
      const d = new Date(h * 3_600_000);
      const key = d.getUTCFullYear() * 12 + d.getUTCMonth();
      const b = monthAcc.get(key) ?? { m: 0, s: 0 };
      b.m += a.m / a.n;
      b.s += a.s / a.n;
      monthAcc.set(key, b);
    });
    const mk = [...monthAcc.keys()].sort((a, b) => a - b);
    return { measured: mk.map(k => monthAcc.get(k)!.m), simulated: mk.map(k => monthAcc.get(k)!.s) };
  }
  // Keys are numeric (hour index or year·12 + month) so that 10^6 samples aggregate quickly.
  const acc = new Map<number, { m: number; s: number; n: number }>();
  const len = Math.min(timestamps.length, measured.length, simulated.length);
  for (let i = 0; i < len; i++) {
    if (!Number.isFinite(measured[i]) || !Number.isFinite(simulated[i])) continue;
    const ms = typeof timestamps[i] === 'number' ? (timestamps[i] as number) : timestampMs(timestamps[i] as string);
    if (!Number.isFinite(ms)) continue;
    let key: number;
    if (period === 'month') {
      const d = new Date(ms);
      key = d.getUTCFullYear() * 12 + d.getUTCMonth();
    } else {
      key = Math.floor(ms / 3_600_000);
    }
    const a = acc.get(key) ?? { m: 0, s: 0, n: 0 };
    a.m += measured[i];
    a.s += simulated[i];
    a.n++;
    acc.set(key, a);
  }
  if (acc.size === 0) {
    return period === 'hour' ? { measured: measured.slice(0, len), simulated: simulated.slice(0, len) } : { measured: [], simulated: [] };
  }
  const keys = [...acc.keys()].sort((a, b) => a - b);
  return {
    measured: keys.map(k => acc.get(k)!.m / acc.get(k)!.n),
    simulated: keys.map(k => acc.get(k)!.s / acc.get(k)!.n)
  };
}

/**
 * ASHRAE Guideline 14-2014 statistical indices on already-aggregated pairs:
 *   NMBE     = Σ(y − ŷ) / ((n − p) · ȳ) · 100
 *   CV(RMSE) = √(Σ(y − ŷ)² / (n − p)) / ȳ · 100
 * RMSE and MAE are reported with the plain 1/n normalisation.
 */
export function computeAshraeMetricsTS(measured: number[], simulated: number[]): CalibrationMetrics {
  const pairs: [number, number][] = [];
  const len = Math.min(measured.length, simulated.length);
  for (let i = 0; i < len; i++) {
    if (Number.isFinite(measured[i]) && Number.isFinite(simulated[i])) {
      pairs.push([measured[i], simulated[i]]);
    }
  }

  const n = pairs.length;
  if (n < 2) {
    return {
      n,
      meanMeasured: 0,
      meanSimulated: 0,
      nmbePct: 0,
      cvRmsePct: 0,
      rmse: 0,
      mae: 0,
      rSquared: 0,
      hourlyPass: false,
      monthlyPass: false,
      periods: n
    };
  }

  const meanM = pairs.reduce((s, p) => s + p[0], 0) / n;
  const meanS = pairs.reduce((s, p) => s + p[1], 0) / n;

  let sumErr = 0;
  let sumSqErr = 0;
  let sumAbsErr = 0;
  let ssTot = 0;

  for (const [m, s] of pairs) {
    const err = m - s;
    sumErr += err;
    sumSqErr += err * err;
    sumAbsErr += Math.abs(err);
    ssTot += (m - meanM) * (m - meanM);
  }

  const denomMean = Math.abs(meanM) > 1e-9 ? meanM : 1.0;
  const dof = Math.max(1, n - ASHRAE_G14_P);
  const nmbePct = (sumErr / (dof * denomMean)) * 100.0;
  const cvRmsePct = (Math.sqrt(sumSqErr / dof) / Math.abs(denomMean)) * 100.0;
  const rmse = Math.sqrt(sumSqErr / n);
  const mae = sumAbsErr / n;
  const rSquared = ssTot > 1e-12 ? 1.0 - sumSqErr / ssTot : 1.0;

  const hourlyPass = Math.abs(nmbePct) <= 10.0 && cvRmsePct <= 30.0;
  const monthlyPass = Math.abs(nmbePct) <= 5.0 && cvRmsePct <= 15.0;

  return {
    n,
    meanMeasured: meanM,
    meanSimulated: meanS,
    nmbePct,
    cvRmsePct,
    rmse,
    mae,
    rSquared,
    hourlyPass,
    monthlyPass,
    periods: n
  };
}

export function buildCalibrationFigure(
  columns: string[],
  rows: Rows,
  tsCol: string,
  cfg: CalibrationState,
  fontFamily: string,
  fontSize: number,
  widthPx: number,
  heightPx: number
): { traces: any[]; layout: any; metrics: CalibrationMetrics } {
  const tsIdx = Math.max(0, columns.indexOf(tsCol));
  const mIdx = columns.indexOf(cfg.measuredCol);
  const sIdx = columns.indexOf(cfg.simulatedCol);

  const xLabels: string[] = [];
  const mVals: number[] = [];
  const sVals: number[] = [];
  const residuals: number[] = [];
  const rawTs: string[] = [];

  const tsMs: number[] = [];
  if (mIdx !== -1 && sIdx !== -1) {
    const mGet = numGetter(rows, mIdx);
    const sGet = numGetter(rows, sIdx);
    const tsText = textGetter(rows, tsIdx);
    const tc = timeColumn(rows, tsIdx);
    const nR = nRowsOf(rows);
    for (let idx = 0; idx < nR; idx++) {
      const mv = mGet(idx);
      const sv = sGet(idx);
      if (Number.isFinite(mv) && Number.isFinite(sv)) {
        const ts = tsText(idx);
        xLabels.push(ts || String(idx + 1));
        rawTs.push(ts);
        tsMs.push(tc[idx]);
        mVals.push(mv);
        sVals.push(sv);
        residuals.push(mv - sv);
      }
    }
  }

  // G14 criteria are defined on hourly resp. monthly values: aggregate before computing the indices
  const tsArr = Float64Array.from(tsMs);
  const isEnergy = (cfg.quantity ?? 'energy') === 'energy';
  const hourlyAgg = aggregateCalibrationPairs(tsArr, mVals, sVals, 'hour');
  // Energy: monthly consumption (sum); other quantities: monthly mean.
  const monthlyAgg = aggregateCalibrationPairs(tsArr, mVals, sVals, 'month', isEnergy ? 'sum' : 'mean');
  const hourlyMetrics = computeAshraeMetricsTS(hourlyAgg.measured, hourlyAgg.simulated);
  const monthlyMetrics = computeAshraeMetricsTS(monthlyAgg.measured, monthlyAgg.simulated);
  const metrics: CalibrationMetrics = {
    ...(cfg.standard === 'monthly' ? monthlyMetrics : hourlyMetrics),
    hourlyPass: hourlyMetrics.n >= 2 && hourlyMetrics.hourlyPass,
    monthlyPass: monthlyMetrics.n >= 2 && monthlyMetrics.monthlyPass
  };
  const criteriaApply = isEnergy;
  metrics.criteriaApplicable = criteriaApply;
  {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < tsArr.length; i++) {
      const v = tsArr[i];
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      metrics.spanDays = (hi - lo) / 86_400_000;
      metrics.shortPeriod = metrics.spanDays < 365;
    }
  }
  const isPass = cfg.standard === 'monthly' ? metrics.monthlyPass : metrics.hourlyPass;
  const tickFmt = tickFmtFromDec(cfg.decimals);
  const traces: any[] = [];
  const annotations: any[] = [];

  if (cfg.showBoxOnChart && metrics.n >= 2) {
    const passText = !criteriaApply
      ? 'Calibration indices (G14 criteria not applied: not energy data)'
      : isPass ? '✓ ASHRAE G14 PASS' : '⚠ OUT OF TOLERANCE';
    const periodText = `${metrics.periods} ${cfg.standard === 'monthly' ? 'months' : 'hours'}`;
    annotations.push({
      xref: 'paper',
      yref: 'paper',
      x: 0.98,
      y: 0.97,
      xanchor: 'right',
      yanchor: 'top',
      align: 'left',
      text: `<b>${passText}${criteriaApply ? ` (${cfg.standard.toUpperCase()})` : ''}</b><br>` +
            `NMBE: ${metrics.nmbePct >= 0 ? '+' : ''}${metrics.nmbePct.toFixed(2)}%<br>` +
            `CV(RMSE): ${metrics.cvRmsePct.toFixed(2)}%<br>` +
            `R²: ${metrics.rSquared.toFixed(4)} | RMSE: ${metrics.rmse.toFixed(2)}<br>` +
            `n = ${periodText}`,
      showarrow: false,
      font: { family: 'JetBrains Mono, monospace', size: Math.max(9, fontSize - 1), color: '#000000' },
      bgcolor: 'rgba(255, 255, 255, 0.94)',
      bordercolor: isPass ? '#059669' : '#e11d48',
      borderwidth: 1.5,
      borderpad: 6
    });
  }

  if (cfg.viewMode === 'parity') {
    const allV = [...mVals, ...sVals];
    const minV = allV.length > 0 ? arrMin(allV) * 0.95 : 0;
    const maxV = allV.length > 0 ? arrMax(allV) * 1.05 : 100;

    // 1:1 Identity Line and ±10% Error Cone
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: [minV, maxV],
      y: [minV, maxV],
      line: { color: '#000000', width: 1.8, dash: 'dash' },
      name: '1:1 Perfect Identity (y = ŷ)'
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: [minV, maxV],
      y: [minV * 1.1, maxV * 1.1],
      line: { color: '#94a3b8', width: 1.2, dash: 'dot' },
      name: '+10% Error Bound'
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: [minV, maxV],
      y: [minV * 0.9, maxV * 0.9],
      line: { color: '#94a3b8', width: 1.2, dash: 'dot' },
      name: '-10% Error Bound'
    });

    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: mVals,
      y: sVals,
      marker: { color: '#059669', size: 7, opacity: 0.8, line: { color: '#000000', width: 0.5 } },
      name: `Pairs (N = ${metrics.n})`
    });

    const layout: any = {
      width: widthPx,
      height: heightPx,
      margin: { l: 66, r: 30, t: 45, b: 58 },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      font: { family: fontFamily, size: fontSize, color: '#000000' },
      title: {
        text: `<b>1:1 Parity & Error Cone Validation</b> — ${cfg.measuredCol} vs ${cfg.simulatedCol}`,
        font: { family: fontFamily, size: fontSize + 2, color: '#000000' },
        x: 0.02,
        xanchor: 'left'
      },
      legend: { orientation: 'h', x: 0, y: 1.1, font: { size: Math.max(9, fontSize - 1), color: '#000000' } },
      annotations,
      xaxis: {
        title: { text: `Measured: ${cfg.measuredCol}`, font: { family: fontFamily, size: fontSize, color: '#000000' } },
        range: [minV, maxV],
        tickformat: tickFmt,
        showline: true,
        linecolor: '#000000',
        linewidth: 1.4,
        gridcolor: '#e2e8f0',
        ticks: 'outside',
        tickfont: { family: 'JetBrains Mono, monospace', color: '#000000' }
      },
      yaxis: {
        title: { text: `Simulated / Predicted: ${cfg.simulatedCol}`, font: { family: fontFamily, size: fontSize, color: '#000000' } },
        range: [minV, maxV],
        tickformat: tickFmt,
        showline: true,
        linecolor: '#000000',
        linewidth: 1.4,
        gridcolor: '#e2e8f0',
        ticks: 'outside',
        tickfont: { family: 'JetBrains Mono, monospace', color: '#000000' }
      }
    };

    return { traces, layout, metrics };
  }

  // Default: 2-Row Time-Series Overlay + Residual Error Panel
  traces.push({
    type: 'scatter',
    mode: 'lines',
    x: xLabels,
    y: mVals,
    xaxis: 'x',
    yaxis: 'y',
    line: { color: '#000000', width: 2.1 },
    name: `Measured (${cfg.measuredCol})`
  });

  traces.push({
    type: 'scatter',
    mode: 'lines',
    x: xLabels,
    y: sVals,
    xaxis: 'x',
    yaxis: 'y',
    line: { color: '#059669', width: 1.9, dash: 'dash' },
    name: `Simulated (${cfg.simulatedCol})`
  });

  if (residuals.length > 20_000) {
    // 10^4+ bars cannot be drawn usefully (or quickly): a line keeps the residual envelope and is
    // reduced with min-max decimation at display time.
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xLabels,
      y: residuals,
      xaxis: 'x2',
      yaxis: 'y2',
      line: { color: 'rgba(2, 132, 199, 0.85)', width: 0.8 },
      name: 'Residual (y_i - ŷ_i)'
    });
  } else {
    traces.push({
      type: 'bar',
      x: xLabels,
      y: residuals,
      xaxis: 'x2',
      yaxis: 'y2',
      marker: {
        color: residuals.map(e => (e >= 0 ? 'rgba(2, 132, 199, 0.7)' : 'rgba(225, 29, 72, 0.7)'))
      },
      name: 'Residual (y_i - ŷ_i)'
    });
  }

  const layout: any = {
    width: widthPx,
    height: heightPx,
    margin: { l: 66, r: 30, t: 48, b: 56 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: fontFamily, size: fontSize, color: '#000000' },
    title: {
      text: `<b>Model Calibration (ASHRAE Guideline 14)</b> — ${cfg.measuredCol} vs ${cfg.simulatedCol}`,
      font: { family: fontFamily, size: fontSize + 2, color: '#000000' },
      x: 0.02,
      xanchor: 'left'
    },
    legend: { orientation: 'h', x: 0, y: 1.11, font: { size: Math.max(9, fontSize - 1), color: '#000000' } },
    annotations,
    xaxis: {
      domain: [0, 1],
      anchor: 'y',
      showticklabels: false,
      showline: true,
      linecolor: '#000000',
      linewidth: 1.2,
      gridcolor: '#e2e8f0'
    },
    yaxis: {
      domain: [0.34, 1],
      anchor: 'x',
      title: { text: cfg.measuredCol, font: { family: fontFamily, size: fontSize, color: '#000000' } },
      tickformat: tickFmt,
      showline: true,
      linecolor: '#000000',
      linewidth: 1.4,
      gridcolor: '#e2e8f0',
      ticks: 'outside',
      tickfont: { family: 'JetBrains Mono, monospace', color: '#000000' }
    },
    xaxis2: {
      domain: [0, 1],
      anchor: 'y2',
      title: { text: tsCol || 'Sample Index', font: { family: fontFamily, size: fontSize, color: '#000000' } },
      showline: true,
      linecolor: '#000000',
      linewidth: 1.4,
      gridcolor: '#e2e8f0',
      ticks: 'outside',
      tickfont: { family: 'JetBrains Mono, monospace', color: '#000000' }
    },
    yaxis2: {
      domain: [0, 0.25],
      anchor: 'x2',
      title: { text: 'Error [y - ŷ]', font: { family: fontFamily, size: Math.max(9, fontSize - 1), color: '#000000' } },
      tickformat: tickFmt,
      zeroline: true,
      zerolinecolor: '#000000',
      zerolinewidth: 1.2,
      showline: true,
      linecolor: '#000000',
      linewidth: 1.4,
      gridcolor: '#e2e8f0',
      ticks: 'outside',
      tickfont: { family: 'JetBrains Mono, monospace', size: Math.max(8, fontSize - 1), color: '#000000' }
    }
  };

  return { traces, layout, metrics };
}

// ============================================================================
// TRACK 6: EDITORIAL SUITE — STATISTICAL TABLES (LATEX / MD / WORD) & PLATES
// ============================================================================
export interface VariableStatRow {
  variable: string;
  unit: string;
  n: number;
  mean: number;
  std: number;
  min: number;
  p5: number;
  median: number;
  p95: number;
  max: number;
  threshold: number | null;
  excHours: number;
  excPct: number;
}

/**
 * k-th smallest value of a[lo..hi] (Hoare quickselect, median-of-three pivot); reorders `a` so
 * that a[k] holds it, smaller values lie left of k and larger ones right.
 */
export function selectKth(a: Float64Array, k: number, lo: number, hi: number): number {
  while (hi > lo) {
    const mid = (lo + hi) >>> 1;
    // median of three as pivot
    let x = a[lo], y = a[mid], z = a[hi];
    const pivot = x < y ? (y < z ? y : x < z ? z : x) : (x < z ? x : y < z ? z : y);
    let i = lo, j = hi;
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) { x = a[i]; a[i] = a[j]; a[j] = x; i++; j--; }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else return a[k];
  }
  return a[k];
}

export function computeVariableStats(
  columns: string[],
  rows: Rows,
  cfg: EditorialSuiteState,
  tsCol?: string
): VariableStatRow[] {
  const dt = resolveDtHours(rows, tsCol ? columns.indexOf(tsCol) : -1, tsCol ? 'auto' : 'manual', cfg.dtHours).dt;
  const results: VariableStatRow[] = [];

  for (const item of cfg.variables) {
    if (!item.selected) continue;
    const cIdx = columns.indexOf(item.column);
    if (cIdx === -1) continue;

    const get = numGetter(rows, cIdx);
    const nR = nRowsOf(rows);
    const buf = new Float64Array(nR);
    let cnt = 0;
    for (let i = 0; i < nR; i++) {
      const v = get(i);
      if (Number.isFinite(v)) buf[cnt++] = v;
    }
    if (cnt === 0) continue;

    // Percentiles by selection (O(n)) instead of a full sort: same values, ~10x faster at 10^6.
    const sorted = buf.subarray(0, cnt);
    const n = sorted.length;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += sorted[i];
    const mean = sum / n;
    let ss = 0;
    for (let i = 0; i < n; i++) ss += (sorted[i] - mean) ** 2;
    const variance = ss / Math.max(1, n - 1);
    const nums2 = sorted;
    const std = Math.sqrt(variance);
    const min = arrMin(nums2 as unknown as number[]);
    const max = arrMax(nums2 as unknown as number[]);
    let excCount = 0;
    if (item.threshold !== null && Number.isFinite(item.threshold)) {
      const thr = item.threshold;
      for (let i = 0; i < n; i++) if (nums2[i] > thr) excCount++;
    }
    const iP5 = Math.min(n - 1, Math.floor((n - 1) * 0.05));
    const iMed = Math.floor((n - 1) * 0.5);
    const iP95 = Math.min(n - 1, Math.floor((n - 1) * 0.95));
    // Selections in increasing rank order keep the earlier partitions valid.
    const p5 = selectKth(nums2, iP5, 0, n - 1);
    const median = selectKth(nums2, iMed, iP5, n - 1);
    const p95 = selectKth(nums2, iP95, iMed, n - 1);

    results.push({
      variable: item.column,
      unit: item.unit || '-',
      n,
      mean,
      std,
      min,
      p5,
      median,
      p95,
      max,
      threshold: item.threshold,
      excHours: excCount * dt,
      excPct: (excCount / n) * 100
    });
  }

  return results;
}

export function generatePublicationTableCode(
  statRows: VariableStatRow[],
  cfg: EditorialSuiteState
): string {
  const d = cfg.decimals;

  if (cfg.outputFormat === 'latex') {
    const lines: string[] = [
      '\\begin{table}[htbp]',
      '  \\centering',
      `  \\caption{${cfg.caption || 'Descriptive statistics and threshold exceedance summary.'}}`,
      `  \\label{${cfg.latexLabel || 'tab:ieq_summary'}}`,
      '  \\begin{tabular}{llrrrrrrrr}',
      '    \\toprule',
      '    Variable & Unit & Mean & Std & Min & P5 & Median & P95 & Max & Exceedance \\\\',
      '    \\midrule'
    ];

    for (const r of statRows) {
      const cleanName = r.variable.replace(/_/g, '\\_');
      const excStr = r.threshold !== null && Number.isFinite(r.threshold)
        ? `${r.excHours.toFixed(1)} h ($>${r.threshold}$, ${r.excPct.toFixed(1)}\\%)`
        : '—';
      lines.push(
        `    ${cleanName} & ${r.unit} & ${fmtDec(r.mean, d)} & ${fmtDec(r.std, d)} & ${fmtDec(r.min, d)} & ${fmtDec(r.p5, d)} & ${fmtDec(r.median, d)} & ${fmtDec(r.p95, d)} & ${fmtDec(r.max, d)} & ${excStr} \\\\`
      );
    }

    lines.push('    \\bottomrule');
    lines.push('  \\end{tabular}');
    lines.push('\\end{table}');
    return lines.join('\n');
  }

  if (cfg.outputFormat === 'markdown') {
    const lines: string[] = [
      `### ${cfg.caption || 'Descriptive Statistics & Compliance Summary'}`,
      '',
      '| Variable | Unit | N | Mean | Std | Min | P5 | Median | P95 | Max | Exceedance |',
      '| :--- | :---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |'
    ];
    for (const r of statRows) {
      const excStr = r.threshold !== null && Number.isFinite(r.threshold)
        ? `${r.excHours.toFixed(1)} h (>${r.threshold}, ${r.excPct.toFixed(1)}%)`
        : '—';
      lines.push(
        `| **${r.variable}** | ${r.unit} | ${r.n} | ${fmtDec(r.mean, d)} | ${fmtDec(r.std, d)} | ${fmtDec(r.min, d)} | ${fmtDec(r.p5, d)} | ${fmtDec(r.median, d)} | ${fmtDec(r.p95, d)} | ${fmtDec(r.max, d)} | ${excStr} |`
      );
    }
    return lines.join('\n');
  }

  // TSV format for direct paste into Microsoft Word / Excel
  const lines: string[] = [
    ['Variable', 'Unit', 'N', 'Mean', 'Std', 'Min', 'P5', 'Median', 'P95', 'Max', 'Exceedance'].join('\t')
  ];
  for (const r of statRows) {
    const excStr = r.threshold !== null && Number.isFinite(r.threshold)
      ? `${r.excHours.toFixed(1)} h (>${r.threshold}, ${r.excPct.toFixed(1)}%)`
      : '-';
    lines.push(
      [
        r.variable,
        r.unit,
        r.n,
        fmtDec(r.mean, d),
        fmtDec(r.std, d),
        fmtDec(r.min, d),
        fmtDec(r.p5, d),
        fmtDec(r.median, d),
        fmtDec(r.p95, d),
        fmtDec(r.max, d),
        excStr
      ].join('\t')
    );
  }
  return lines.join('\n');
}

/** Configurations of the building-physics figures that can be placed in plate slots. */
export interface PhysicsSlotConfigs {
  carpet: CarpetPlotState;
  comfort: ThermalComfortState;
  duration: DurationCurveState;
  calibration: CalibrationState;
}

/** Slot values that embed a building-physics figure instead of a data column. */
export const PHYSICS_SLOT_KEYS = ['physics:carpet', 'physics:comfort', 'physics:duration', 'physics:calibration'] as const;

/**
 * Moves the primary-axis content of a stand-alone figure (traces on x/y, data-referenced shapes and
 * annotations, axis settings, colour bar) into the plate cell with axes `xRef`/`yRef`.
 * Paper-referenced annotations (KPI boxes) and secondary subplots are not carried over.
 */
export function embedFigureInCell(
  fig: { traces: any[]; layout: any },
  xRef: string,
  yRef: string,
  domainX: [number, number],
  domainY: [number, number]
): { traces: any[]; xaxis: any; yaxis: any; shapes: any[]; annotations: any[] } {
  const isPrimary = (t: any) => (!t.xaxis || t.xaxis === 'x') && (!t.yaxis || t.yaxis === 'y');
  const traces = fig.traces.filter(isPrimary).map(t => {
    const c: any = { ...t, xaxis: xRef, yaxis: yRef, showlegend: false };
    if (c.colorbar || c.showscale) {
      const title = c.colorbar?.title;
      c.colorbar = {
        ...(c.colorbar || {}),
        title: title ? { ...(typeof title === 'string' ? { text: title } : title), side: 'right' } : undefined,
        x: domainX[1] + 0.008, xanchor: 'left',
        y: (domainY[0] + domainY[1]) / 2, yanchor: 'middle',
        len: domainY[1] - domainY[0], thickness: 10
      };
    }
    return c;
  });
  // Plotly defaults xref/yref to 'x'/'y'; 'x domain' positions relative to the axis domain.
  const remapRef = (o: any) => {
    const c = { ...o };
    c.xref = !c.xref || c.xref === 'x' ? xRef : c.xref === 'x domain' ? `${xRef} domain` : c.xref;
    c.yref = !c.yref || c.yref === 'y' ? yRef : c.yref === 'y domain' ? `${yRef} domain` : c.yref;
    return c;
  };
  const onData = (o: any) =>
    o.xref !== 'paper' && o.yref !== 'paper' &&
    (!o.xref || o.xref === 'x' || o.xref === 'x domain') && (!o.yref || o.yref === 'y' || o.yref === 'y domain');
  const shapes = (fig.layout.shapes || []).filter(onData).map(remapRef);
  const annotations = (fig.layout.annotations || []).filter(onData).map(remapRef);
  const pick = (ax: any) => {
    const keep: any = {};
    for (const k of ['title', 'range', 'type', 'tickformat', 'dtick', 'tick0', 'autorange', 'tickvals', 'ticktext', 'categoryorder', 'zeroline']) {
      if (ax && ax[k] !== undefined) keep[k] = ax[k];
    }
    return keep;
  };
  return { traces, xaxis: pick(fig.layout.xaxis), yaxis: pick(fig.layout.yaxis), shapes, annotations };
}

/**
 * Physical size of a figure plate. The width follows the journal column preset; the height follows
 * the grid, so that every grid keeps its own aspect ratio in the preview and in every export.
 */
export function plateDimensionsMm(cfg: Pick<EditorialSuiteState, 'plateWidthPreset' | 'plateGrid'>): { widthMm: number; heightMm: number; rows: number; cols: number } {
  const widthMm = cfg.plateWidthPreset === 'single_85mm' ? 85 : (cfg.plateWidthPreset === 'half_120mm' ? 120 : 170);
  const gridMap: Record<string, { r: number; c: number; ratio: number }> = {
    '2x1': { r: 2, c: 1, ratio: 0.95 },
    '1x2': { r: 1, c: 2, ratio: 0.52 },
    '2x2': { r: 2, c: 2, ratio: 0.85 },
    '3x1': { r: 3, c: 1, ratio: 1.25 }
  };
  const g = gridMap[cfg.plateGrid] || gridMap['2x2'];
  return { widthMm, heightMm: Math.round(widthMm * g.ratio), rows: g.r, cols: g.c };
}

export function buildCompositePlateFigure(
  columns: string[],
  rows: Rows,
  tsCol: string,
  cfg: EditorialSuiteState,
  fontFamily: string,
  fontSize: number,
  gridFrame: GridFrameConfig,
  physics?: PhysicsSlotConfigs
): { traces: any[]; layout: any; widthPx: number; heightPx: number } {
  const mmToPxPreview = 3.78; // 96 DPI screen preview scaling (export uses 300/600 DPI scale factor)
  const dims = plateDimensionsMm(cfg);
  const widthMm = dims.widthMm;
  const g = { r: dims.rows, c: dims.cols, hMm: dims.heightMm };
  const count = g.r * g.c;

  const widthPx = Math.round(widthMm * mmToPxPreview * 1.35);
  const heightPx = Math.round(g.hMm * mmToPxPreview * 1.35);

  const tsIdx = Math.max(0, columns.indexOf(tsCol));
  const nPlate = nRowsOf(rows);
  const tsTextPlate = textGetter(rows, tsIdx);
  const xVals = Array.from({ length: nPlate }, (_, i) => tsTextPlate(i) || String(i + 1));

  const traces: any[] = [];
  const annotations: any[] = [];
  const shapes: any[] = [];
  const layout: any = {
    width: widthPx,
    height: heightPx,
    margin: { l: 60, r: 25, t: 38, b: 48 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: fontFamily, size: fontSize, color: '#000000' },
    showlegend: false
  };

  const palette = ['#000000', '#059669', '#0284c7', '#d97706'];
  const hGap = g.c > 1 ? 0.10 : 0;
  const vGap = g.r > 1 ? 0.12 : 0;
  const cellW = (1.0 - hGap * (g.c - 1)) / g.c;
  const cellH = (1.0 - vGap * (g.r - 1)) / g.r;

  for (let idx = 0; idx < count; idx++) {
    const rowIdx = Math.floor(idx / g.c);
    const colIdx = idx % g.c;
    const x0 = colIdx * (cellW + hGap);
    let x1 = x0 + cellW;
    const y1 = 1.0 - rowIdx * (cellH + vGap);
    const y0 = y1 - cellH;

    const axNum = idx === 0 ? '' : String(idx + 1);
    const xKey = `xaxis${axNum}`;
    const yKey = `yaxis${axNum}`;
    const xRef = idx === 0 ? 'x' : `x${idx + 1}`;
    const yRef = idx === 0 ? 'y' : `y${idx + 1}`;

    let slotCol = cfg.plateSlots[idx] || columns[Math.min(columns.length - 1, idx + 1)] || columns[0] || '';
    let embedded: ReturnType<typeof embedFigureInCell> | null = null;

    if (slotCol.startsWith('physics:') && physics) {
      // Building-physics figure in this cell, built with the current Tab-5 settings.
      const kind = slotCol.slice('physics:'.length);
      const w = 600, h = 400;
      let fig: { traces: any[]; layout: any } | null = null;
      if (kind === 'carpet') fig = buildCarpetPlotFigure(columns, rows, tsCol, physics.carpet, fontFamily, fontSize, w, h);
      else if (kind === 'comfort') fig = buildThermalComfortFigure(columns, rows, tsCol, physics.comfort, fontFamily, fontSize, w, h);
      else if (kind === 'duration') fig = buildDurationCurveFigure(columns, rows, physics.duration, fontFamily, fontSize, w, h, tsCol);
      else if (kind === 'calibration') fig = buildCalibrationFigure(columns, rows, tsCol, { ...physics.calibration, viewMode: 'parity', showBoxOnChart: false }, fontFamily, fontSize, w, h);
      if (fig) {
        // Leave room inside the cell for a colour bar so it does not overlap the next panel.
        if (fig.traces.some(t => t.showscale || t.colorbar)) x1 = x1 - 0.085 * (g.c > 1 ? 1 : 0.5);
        embedded = embedFigureInCell(fig, xRef, yRef, [x0, x1], [y0, y1]);
        traces.push(...embedded.traces);
        shapes.push(...embedded.shapes);
        annotations.push(...embedded.annotations);
        const labels: Record<string, string> = { carpet: 'Carpet plot', comfort: 'Adaptive comfort', duration: 'Duration curve', calibration: 'Calibration (parity)' };
        slotCol = labels[kind] || kind;
      }
    } else {
      const cPos = columns.indexOf(slotCol);
      const yGet = numGetter(rows, cPos);
      const yVals = cPos !== -1 ? Array.from({ length: nPlate }, (_, i) => {
        const v = yGet(i);
        return Number.isFinite(v) ? v : null;
      }) : [];

      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: xVals,
        y: yVals,
        xaxis: xRef,
        yaxis: yRef,
        line: { color: palette[idx % palette.length], width: 1.8 },
        name: slotCol
      });
    }

    layout[xKey] = {
      ...(embedded ? embedded.xaxis : {}),
      domain: [x0, x1],
      anchor: yRef,
      showline: gridFrame.frameMode !== 'none',
      mirror: gridFrame.frameMode === 'box' ? true : (gridFrame.frameMode === 'ticks' ? 'ticks' : false),
      linecolor: '#000000',
      linewidth: 1.3,
      showgrid: gridFrame.showXGrid,
      gridcolor: gridFrame.majorGridColor,
      ticks: gridFrame.tickDir === 'none' ? '' : gridFrame.tickDir,
      tickfont: { family: 'JetBrains Mono, monospace', size: Math.max(8, fontSize - 2), color: '#000000' }
    };

    const yTitleText = embedded && embedded.yaxis.title
      ? (typeof embedded.yaxis.title === 'string' ? embedded.yaxis.title : embedded.yaxis.title.text)
      : slotCol;
    layout[yKey] = {
      ...(embedded ? embedded.yaxis : {}),
      domain: [y0, y1],
      anchor: xRef,
      title: { text: yTitleText, font: { family: fontFamily, size: Math.max(9, fontSize - 1), color: '#000000' } },
      showline: gridFrame.frameMode !== 'none',
      mirror: gridFrame.frameMode === 'box' ? true : (gridFrame.frameMode === 'ticks' ? 'ticks' : false),
      linecolor: '#000000',
      linewidth: 1.3,
      showgrid: gridFrame.showYGrid,
      gridcolor: gridFrame.majorGridColor,
      ticks: gridFrame.tickDir === 'none' ? '' : gridFrame.tickDir,
      tickfont: { family: 'JetBrains Mono, monospace', size: Math.max(8, fontSize - 2), color: '#000000' }
    };

    // Outside academic lettering (a), (b), (c)...
    annotations.push({
      xref: 'paper',
      yref: 'paper',
      x: x0,
      y: y1 + 0.015,
      xanchor: 'left',
      yanchor: 'bottom',
      text: `<b>(${String.fromCharCode(97 + idx)}) ${slotCol}</b>`,
      showarrow: false,
      font: { family: fontFamily, size: fontSize, color: '#000000' }
    });
  }

  layout.annotations = annotations;
  layout.shapes = shapes;
  return { traces, layout, widthPx, heightPx };
}
