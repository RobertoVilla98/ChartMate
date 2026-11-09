// Tests for the calculation modules: Δt inference, duration curve and dose, carpet binning, statistics
// table, G14 scope, decimation, plate slots, column/row equivalence.
// Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDurationCurveFigure,
  buildCarpetPlotFigure,
  buildCalibrationFigure,
  computeVariableStats,
  generatePublicationTableCode,
  inferSamplingStep,
  parseTimestampMs,
  resolveDtHours
} from '../src/scientific_modules.ts';
import { minMaxDecimationIndices, decimateSeries } from '../src/charts/decimation.ts';

const close = (a: number, b: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

const pad = (n: number) => String(n).padStart(2, '0');
/** Rows every `stepMin` minutes from 2026-01-05 00:00 (a Monday), value = f(i). */
const series = (n: number, stepMin: number, f: (i: number) => number): string[][] =>
  Array.from({ length: n }, (_, i) => {
    const t = new Date(Date.UTC(2026, 0, 5) + i * stepMin * 60_000);
    const ts = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:00`;
    return [ts, String(f(i))];
  });

// ---------------------------------------------------------------- timestamps and Δt
test('timestamp parser accepts ISO, T-separated and day-first formats', () => {
  const iso = parseTimestampMs('2026-03-01 12:30:00');
  assert.equal(iso, Date.UTC(2026, 2, 1, 12, 30, 0));
  assert.equal(parseTimestampMs('2026-03-01T12:30:00'), iso);
  assert.equal(parseTimestampMs('01/03/2026 12:30'), iso);
  assert.equal(parseTimestampMs('hello'), null);
  assert.equal(parseTimestampMs('2026-13-01'), null);
});

test('sampling step is inferred from timestamps and irregular data are flagged', () => {
  close(inferSamplingStep(series(100, 15, () => 0), 0).stepHours!, 0.25, 1e-12);
  assert.equal(inferSamplingStep(series(100, 15, () => 0), 0).irregular, false);
  const gappy = series(100, 10, () => 0).filter((_, i) => i % 3 !== 0); // 10 / 20 min mix
  assert.equal(inferSamplingStep(gappy, 0).irregular, true);
  assert.equal(inferSamplingStep([['x', '1']], 0).stepHours, null);
  assert.deepEqual(resolveDtHours(series(10, 30, () => 0), 0, 'manual', 2).dt, 2);
  assert.equal(resolveDtHours([['no-ts', '1']], 0, 'auto', 0).source, 'default');
});

// ---------------------------------------------------------------- duration curve and dose
const durCfg = { variableCol: 'v', compareCol: '', xMode: 'hours' as const, dtHours: 1, threshold1: 25, threshold2: 27, shadeExceedance: false, decimals: '1' as const };

test('duration curve: exceedance hours and dose use Δt from timestamps', () => {
  // 15-min data, values 20..29 repeated: per cycle of 10 samples, 4 are > 25 (26..29) and 2 are > 27.
  const rows = series(400, 15, i => 20 + (i % 10));
  const { kpi } = buildDurationCurveFigure(['ts', 'v'], rows, durCfg, 'Arial', 10, 600, 400, 'ts');
  close(kpi.dtHours!, 0.25, 1e-12, 'dt');
  assert.equal(kpi.dtSource, 'timestamps');
  close(kpi.totalHours, 100, 1e-9, 'total hours');
  close(kpi.exc1Hours, 160 * 0.25, 1e-9, 'hours > 25');
  close(kpi.exc2Hours, 80 * 0.25, 1e-9, 'hours > 27');
  close(kpi.exc1Pct, 40, 1e-9);
  // Dose above 25: per cycle (1+2+3+4)·Δt = 10·0.25 h; 40 cycles.
  close(kpi.exposureIntegral, 40 * 10 * 0.25, 1e-9, 'dose');
  assert.equal(kpi.peakVal, 29);
});

test('duration curve without timestamps keeps the manual Δt', () => {
  const rows = series(10, 60, i => 20 + i);
  const { kpi } = buildDurationCurveFigure(['ts', 'v'], rows, { ...durCfg, dtHours: 0.5 }, 'Arial', 10, 600, 400);
  assert.equal(kpi.dtHours, 0.5);
  close(kpi.exc1Hours, 4 * 0.5, 1e-9); // 26, 27, 28, 29
});

// ---------------------------------------------------------------- carpet plot binning
test('carpet plot bins by day × hour with the chosen statistic', () => {
  // Two days of 30-min data; value = hour of day (+0.5 on the half hour), so mean = h + 0.25.
  const rows = series(96, 30, i => Math.floor(i / 2) % 24 + (i % 2) * 0.5);
  const cfg = { variableCol: 'v', aggMethod: 'mean' as const, colorscale: 'Viridis' as const, showContours: false, contourStep: null, dayFilter: 'all' as const, zMin: null, zMax: null, decimals: '1' as const };
  const z = buildCarpetPlotFigure(['ts', 'v'], rows, 'ts', cfg, 'Arial', 10, 600, 400).traces[0].z as (number | null)[][];
  assert.equal(z.length, 24);
  assert.equal(z[0].length, 2);
  close(z[7][1]!, 7.25, 1e-12, 'mean at 07:00 day 2');
  const zMax = buildCarpetPlotFigure(['ts', 'v'], rows, 'ts', { ...cfg, aggMethod: 'max' }, 'Arial', 10, 600, 400).traces[0].z as number[][];
  close(zMax[7][0], 7.5, 1e-12, 'max');
  // 2026-01-05 is a Monday, so the weekend filter leaves no day.
  const zWe = buildCarpetPlotFigure(['ts', 'v'], rows, 'ts', { ...cfg, dayFilter: 'weekends' }, 'Arial', 10, 600, 400).traces[0].z as number[][];
  assert.equal(zWe[0].length, 0);
});

// ---------------------------------------------------------------- statistics table
test('statistics table: moments, percentiles and exceedance hours', () => {
  const rows = series(101, 60, i => i); // 0..100, hourly
  const cfg = {
    caption: 'c', latexLabel: 'tab:x', outputFormat: 'latex' as const, decimals: '2' as const, dtHours: 1,
    variables: [{ column: 'v', selected: true, unit: 'K', threshold: 90 }],
    plateWidthPreset: 'single_85mm' as const, plateDpi: 600 as const, plateGrid: '2x1' as const, plateSlots: []
  };
  const [r] = computeVariableStats(['ts', 'v'], rows, cfg as any, 'ts');
  assert.equal(r.n, 101);
  close(r.mean, 50, 1e-12);
  assert.equal(r.min, 0);
  assert.equal(r.max, 100);
  close(r.median, 50, 1e-9);
  assert.equal(r.excHours, 10); // 91..100
  const latex = generatePublicationTableCode([r], cfg as any);
  assert.match(latex, /\\toprule/);
  assert.match(latex, /\\bottomrule/);
  assert.match(latex, /50\.00/);
});

// ---------------------------------------------------------------- G14 scope
test('G14 verdict is withheld for non-energy quantities', () => {
  const rows = series(48, 60, i => 20 + Math.sin(i)).map((r, i) => [r[0], r[1], String(20 + Math.sin(i) + 0.05)]);
  const base = { measuredCol: 'm', simulatedCol: 's', viewMode: 'series' as const, standard: 'hourly' as const, showBoxOnChart: true, decimals: '2' as const };
  const energy = buildCalibrationFigure(['ts', 'm', 's'], rows, 'ts', { ...base, quantity: 'energy' }, 'Arial', 10, 600, 400);
  const temp = buildCalibrationFigure(['ts', 'm', 's'], rows, 'ts', { ...base, quantity: 'other' }, 'Arial', 10, 600, 400);
  assert.equal(energy.metrics.criteriaApplicable, true);
  assert.equal(temp.metrics.criteriaApplicable, false);
  close(temp.metrics.nmbePct, energy.metrics.nmbePct, 1e-12, 'indices are still reported');
  const note = JSON.stringify(temp.layout.annotations ?? []);
  assert.ok(!note.includes('G14 PASS') && !note.includes('OUT OF TOLERANCE'), 'no verdict on temperature');
});

// ---------------------------------------------------------------- min-max decimation
test('min-max decimation keeps every bucket extreme and the end points', () => {
  const n = 100_000;
  const y = Array.from({ length: n }, (_, i) => Math.sin(i / 500));
  y[12_345] = 50;   // spike
  y[67_890] = -50;  // dip
  y[500] = NaN;     // gap
  const idx = minMaxDecimationIndices(y, 4_000);
  assert.ok(idx.length <= 4_000 + 3, `kept ${idx.length}`);
  assert.ok(idx.includes(12_345) && idx.includes(67_890), 'extremes kept');
  assert.ok(idx.includes(500), 'gap kept');
  assert.equal(idx[0], 0);
  assert.equal(idx[idx.length - 1], n - 1);
  for (let i = 1; i < idx.length; i++) assert.ok(idx[i] > idx[i - 1], 'sorted, unique');
  const short = decimateSeries([1, 2, 3], [1, 2, 3], 10);
  assert.equal(short.decimated, false);
});

// ---------------------------------------------------------------- physics figures in plates
test('building-physics figures can be placed in figure-plate slots', async () => {
  const { buildCompositePlateFigure } = await import('../src/scientific_modules.ts');
  // 3 days hourly: indoor, outdoor, rh, measured/simulated power.
  const rows = series(72, 60, i => 22 + Math.sin(i / 4)).map((r, i) => [r[0], r[1], String(15 + 5 * Math.sin(i / 12)), '50', String(4 + Math.sin(i)), String(4.1 + Math.sin(i))]);
  const cols = ['ts', 't_in', 't_out', 'rh', 'p', 'p_sim'];
  const ed = {
    caption: '', latexLabel: '', outputFormat: 'latex', decimals: '2', dtHours: 1, variables: [],
    plateWidthPreset: 'double_170mm', plateDpi: 600, plateGrid: '2x2',
    plateSlots: ['physics:carpet', 'physics:comfort', 'physics:duration', 'physics:calibration']
  };
  const physics = {
    carpet: { variableCol: 't_in', aggMethod: 'mean', colorscale: 'Viridis', showContours: false, contourStep: null, dayFilter: 'all', zMin: null, zMax: null, decimals: '1' },
    comfort: { normMode: 'en16798', indoorTempCol: 't_in', outdoorTempCol: 't_out', rhCol: 'rh', computeRunningMean: true, alpha: 0.8 },
    duration: { ...durCfg, variableCol: 't_in' },
    calibration: { measuredCol: 'p', simulatedCol: 'p_sim', viewMode: 'series', standard: 'hourly', showBoxOnChart: true, decimals: '2', quantity: 'energy' }
  };
  const grid = { frameMode: 'box', showXGrid: false, showYGrid: false, majorGridColor: '#ddd', tickDir: 'outside' };
  const { traces, layout } = buildCompositePlateFigure(cols, rows, 'ts', ed as any, 'Arial', 10, grid as any, physics as any);
  for (const ax of ['x', 'x2', 'x3', 'x4']) {
    assert.ok(traces.some(t => t.xaxis === ax), `slot on ${ax} has traces`);
  }
  assert.ok(traces.some(t => t.type === 'heatmap' && t.xaxis === 'x'), 'carpet heatmap in slot (a)');
  assert.ok(layout.xaxis4 && layout.yaxis4, 'axes for slot (d)');
  const heat = traces.find(t => t.type === 'heatmap');
  assert.ok(heat.colorbar.len <= 0.5, 'colour bar fitted to its cell');
});

test('large inputs do not overflow the call stack (2·10^5 rows)', () => {
  const rows = series(200_000, 1, i => 20 + Math.sin(i / 100)).map(r => [r[0], r[1], String(+r[1] + 0.1)]);
  const cal = buildCalibrationFigure(['ts', 'm', 's'], rows, 'ts',
    { measuredCol: 'm', simulatedCol: 's', viewMode: 'parity', standard: 'hourly', showBoxOnChart: true, decimals: '2', quantity: 'other' }, 'Arial', 10, 600, 400);
  assert.ok(cal.metrics.n > 0);
  const carpet = buildCarpetPlotFigure(['ts', 'm'], rows, 'ts',
    { variableCol: 'm', aggMethod: 'max', colorscale: 'Viridis', showContours: false, contourStep: null, dayFilter: 'all', zMin: null, zMax: null, decimals: '1' }, 'Arial', 10, 600, 400);
  assert.equal((carpet.traces[0].z as number[][]).length, 24);
});

// ---------------------------------------------------------------- column tables give the same results as text rows
test('every module returns identical results from typed columns and from text rows', async () => {
  const { buildThermalComfortFigure } = await import('../src/scientific_modules.ts');
  const text = series(24 * 20, 30, i => 22 + 2 * Math.sin(i / 7)).map((r, i) =>
    [r[0], r[1], String(12 + 6 * Math.sin(i / 48)), String(45 + (i % 9)), String(4 + Math.sin(i)), String(4.1 + Math.sin(i))]);
  const columns = ['ts', 't_in', 't_out', 'rh', 'p', 'p_sim'];
  const table = {
    columns,
    n_rows: text.length,
    colData: columns.map((_, j) => j === 0 ? text.map(r => r[0]) : Float64Array.from(text, r => parseFloat(r[j])))
  };
  const same = (a: any, b: any, what: string) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), what);
  const carpetCfg = { variableCol: 't_in', aggMethod: 'mean', colorscale: 'Viridis', showContours: false, contourStep: null, dayFilter: 'weekdays', zMin: null, zMax: null, decimals: '1' } as any;
  same(buildCarpetPlotFigure(columns, table, 'ts', carpetCfg, 'Arial', 10, 600, 400).traces[0].z,
       buildCarpetPlotFigure(columns, text, 'ts', carpetCfg, 'Arial', 10, 600, 400).traces[0].z, 'carpet');
  for (const norm of ['en16798', 'ashrae55', 'psychro'] as const) {
    const cfg = { normMode: norm, indoorTempCol: 't_in', outdoorTempCol: 't_out', rhCol: 'rh', computeRunningMean: true, alpha: 0.8 };
    same(buildThermalComfortFigure(columns, table, 'ts', cfg, 'Arial', 10, 600, 400).kpi,
         buildThermalComfortFigure(columns, text, 'ts', cfg, 'Arial', 10, 600, 400).kpi, `comfort ${norm}`);
  }
  const d = { ...durCfg, variableCol: 't_in', compareCol: 't_out' };
  same(buildDurationCurveFigure(columns, table, d, 'Arial', 10, 600, 400, 'ts').kpi,
       buildDurationCurveFigure(columns, text, d, 'Arial', 10, 600, 400, 'ts').kpi, 'duration');
  const cal = { measuredCol: 'p', simulatedCol: 'p_sim', viewMode: 'series', standard: 'monthly', showBoxOnChart: true, decimals: '2', quantity: 'energy' } as any;
  same(buildCalibrationFigure(columns, table, 'ts', cal, 'Arial', 10, 600, 400).metrics,
       buildCalibrationFigure(columns, text, 'ts', cal, 'Arial', 10, 600, 400).metrics, 'calibration');
  const ed = { dtHours: 1, variables: [{ column: 't_in', selected: true, unit: '°C', threshold: 23 }, { column: 'rh', selected: true, unit: '%', threshold: 50 }] } as any;
  same(computeVariableStats(columns, table, ed, 'ts'), computeVariableStats(columns, text, ed, 'ts'), 'statistics');
});

test('quickselect returns the same order statistics as a full sort', async () => {
  const { selectKth } = await import('../src/scientific_modules.ts');
  for (const n of [1, 2, 7, 1000, 100_001]) {
    const a = Float64Array.from({ length: n }, (_, i) => (i * 7919) % 1013 + (i % 3) * 0.5);
    const sorted = Float64Array.from(a).sort();
    for (const q of [0, 0.05, 0.5, 0.95, 1]) {
      const k = Math.floor((n - 1) * q);
      assert.equal(selectKth(Float64Array.from(a), k, 0, n - 1), sorted[k], `n=${n} q=${q}`);
    }
  }
});
