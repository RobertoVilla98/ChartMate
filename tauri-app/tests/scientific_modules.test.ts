// Unit tests for the building-physics engine. Run with `npm test` (Node >= 22.6 native TypeScript stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  computeDailyRunningMean,
  buildThermalComfortFigure,
  aggregateCalibrationPairs,
  computeAshraeMetricsTS,
  ADAPTIVE_TRM_RANGE
} from '../src/scientific_modules.ts';

const ref = JSON.parse(readFileSync(new URL('./fixtures/pythermalcomfort_reference.json', import.meta.url), 'utf8'));
const close = (a: number, b: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);

const comfortCfg = (normMode: 'en16798' | 'ashrae55', computeRunningMean: boolean) => ({
  normMode, indoorTempCol: 'tin', outdoorTempCol: 'tout', rhCol: 'rh', computeRunningMean, alpha: 0.8
});
const comfort = (normMode: 'en16798' | 'ashrae55', rows: string[][], computeRunningMean = false) =>
  buildThermalComfortFigure(['ts', 'tin', 'tout', 'rh'], rows, 'ts', comfortCfg(normMode, computeRunningMean), 'Outfit', 12, 800, 500).kpi;

// ---------------------------------------------------------------------------
// Running mean outdoor temperature (EN 16798-1 Annex B)
// ---------------------------------------------------------------------------
test('T_rm recurrence uses the previous day only', () => {
  const r = computeDailyRunningMean(new Map([['2026-01-01', 10], ['2026-01-02', 20], ['2026-01-03', 20]]), 0.8);
  close(r.get('2026-01-01')!, 10, 1e-12);
  close(r.get('2026-01-02')!, 10, 1e-12); // Θed(01-01) = 10
  close(r.get('2026-01-03')!, 12, 1e-12); // 0.2·20 + 0.8·10
});

test('T_rm carries forward over missing days and crosses month boundaries', () => {
  const r = computeDailyRunningMean(new Map([['2026-01-31', 10], ['2026-02-02', 30], ['2026-02-03', 0]]), 0.8);
  assert.equal(r.size, 4);
  close(r.get('2026-02-01')!, 10, 1e-12);
  close(r.get('2026-02-02')!, 10, 1e-12); // 02-01 has no data
  close(r.get('2026-02-03')!, 14, 1e-12); // 0.2·30 + 0.8·10
});

test('T_rm converges to pythermalcomfort running_mean_outdoor_temperature', () => {
  const daily: number[] = ref.daily;
  const map = new Map<string, number>();
  daily.forEach((v, i) => map.set(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), v));
  const last = new Date(Date.UTC(2026, 0, daily.length)).toISOString().slice(0, 10);
  close(computeDailyRunningMean(map, 0.8).get(last)!, ref.rm_last, 0.02, 'T_rm after 40 days');
});

test('hourly rows are reduced to daily means before the running mean', () => {
  // Day 1: outdoor 0 °C at night, 20 °C by day (mean 10); day 2 constant 30 °C.
  const rows: string[][] = [];
  for (let h = 0; h < 24; h++) rows.push([`2026-03-01 ${String(h).padStart(2, '0')}:00:00`, '22', h < 12 ? '0' : '20', '50']);
  for (let h = 0; h < 24; h++) rows.push([`2026-03-02 ${String(h).padStart(2, '0')}:00:00`, '22', '30', '50']);
  // T_rm = 10 on both days → T_comf = 0.33·10 + 18.8 = 22.1 → 22 °C is Cat. I for every sample.
  const kpi = comfort('en16798', rows, true);
  assert.equal(kpi.trmSource, 'running_mean');
  assert.equal(kpi.totalHours, 48);
  assert.equal(kpi.cat1Hours, 48);
});

test('running mean without parseable timestamps is flagged, not guessed', () => {
  const kpi = comfort('en16798', [['not a date', '22', '15', '50']], true);
  assert.equal(kpi.trmSource, 'no_timestamps');
  assert.equal(kpi.totalHours, 0);
});

// ---------------------------------------------------------------------------
// Adaptive comfort limits vs pythermalcomfort
// ---------------------------------------------------------------------------
const M = 0.08; // > 0.05 rounding of the reference values

test('EN 16798-1 category limits match pythermalcomfort.adaptive_en', () => {
  for (const r of ref.en) {
    const at = (tin: number) => comfort('en16798', [['', String(tin), String(r.trm), '50']]);
    assert.equal(at(r.tmp_cmf_cat_i_up - M).cat1Hours, 1, `Cat I upper @ T_rm ${r.trm}`);
    assert.equal(at(r.tmp_cmf_cat_i_low + M).cat1Hours, 1, `Cat I lower @ T_rm ${r.trm}`);
    const k2 = at(r.tmp_cmf_cat_i_up + M);
    assert.ok(k2.cat1Hours === 0 && k2.cat2Hours === 1, `Cat II band @ T_rm ${r.trm}`);
    // Discomfort counters refer to samples outside the widest band (Cat. III)
    assert.equal(at(r.tmp_cmf_cat_iii_up + M).overheatHours, 1, `overheating above Cat III @ T_rm ${r.trm}`);
    assert.equal(at(r.tmp_cmf_cat_iii_low - M).undercoolHours, 1, `undercooling below Cat III @ T_rm ${r.trm}`);
    const k3 = at(r.tmp_cmf_cat_iii_up - M);
    assert.ok(k3.cat2Hours === 0 && k3.cat3Hours === 1, `Cat III band @ T_rm ${r.trm}`);
  }
});

test('ASHRAE 55 acceptability limits match pythermalcomfort.adaptive_ashrae', () => {
  for (const r of ref.ashrae) {
    const at = (tin: number) => comfort('ashrae55', [['', String(tin), String(r.trm), '50']]);
    assert.equal(at(r.tmp_cmf_90_up - M).cat1Hours, 1, `90% upper @ T_pma ${r.trm}`);
    assert.equal(at(r.tmp_cmf_90_low + M).cat1Hours, 1, `90% lower @ T_pma ${r.trm}`);
    const k80 = at(r.tmp_cmf_90_up + M);
    assert.ok(k80.cat1Hours === 0 && k80.cat2Hours === 1, `80% band @ T_pma ${r.trm}`);
    assert.equal(at(r.tmp_cmf_80_up + M).overheatHours, 1, `above 80% @ T_pma ${r.trm}`);
    assert.equal(at(r.tmp_cmf_80_low - M).undercoolHours, 1, `below 80% @ T_pma ${r.trm}`);
  }
});

test('samples outside the model applicability range are excluded', () => {
  const [, enMax] = ADAPTIVE_TRM_RANGE.en16798;
  const kpi = comfort('en16798', [['', '24', String(enMax + 1), '50'], ['', '24', '5', '50'], ['', '24', '20', '50']]);
  assert.equal(kpi.outOfRangeHours, 2);
  assert.equal(kpi.totalHours, 1);
  // 31 °C is outside EN (max 30) but inside ASHRAE (max 33.5)
  assert.equal(comfort('ashrae55', [['', '28', '31', '50']]).outOfRangeHours, 0);
});

// ---------------------------------------------------------------------------
// ASHRAE Guideline 14 calibration indices
// ---------------------------------------------------------------------------
test('NMBE and CV(RMSE) use the (n − p) denominator with p = 1', () => {
  const y = [10, 12, 14, 16];
  const yhat = [11, 12, 13, 15];
  const m = computeAshraeMetricsTS(y, yhat);
  const mean = 13; // ȳ
  close(m.nmbePct, ((-1 + 0 + 1 + 1) / (3 * mean)) * 100, 1e-12);
  close(m.cvRmsePct, (Math.sqrt((1 + 0 + 1 + 1) / 3) / mean) * 100, 1e-12);
  close(m.rmse, Math.sqrt(3 / 4), 1e-12);
  close(m.mae, 3 / 4, 1e-12);
});

test('sub-hourly data are averaged per hour, months per calendar month', () => {
  const ts = ['2026-01-01 00:00', '2026-01-01 00:30', '2026-01-01 01:00', '2026-02-10 05:00'];
  const hourly = aggregateCalibrationPairs(ts, [1, 3, 5, 7], [2, 2, 5, 7], 'hour');
  assert.deepEqual(hourly.measured, [2, 5, 7]);
  assert.deepEqual(hourly.simulated, [2, 5, 7]);
  const monthly = aggregateCalibrationPairs(ts, [1, 3, 5, 7], [2, 2, 5, 7], 'month');
  assert.deepEqual(monthly.measured, [3, 7]);
});
