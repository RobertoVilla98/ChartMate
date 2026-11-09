// Tests for the defects found by the paper re-review (S-3, S-4, S-6, S-7, S-8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  plateDimensionsMm,
  buildThermalComfortFigure,
  aggregateCalibrationPairs,
  buildCalibrationFigure,
  humidityRatioGkg,
  RUNNING_MEAN_WARMUP_DAYS
} from '../src/scientific_modules.ts';
import { fontCategory, standardizeFontsFor } from '../src/charts/export_fonts.ts';

const hourly = (days: number, f: (h: number) => string[]): string[][] =>
  Array.from({ length: days * 24 }, (_, h) => {
    const d = new Date(Date.UTC(2026, 0, 1) + h * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
    return [d, ...f(h)];
  });

// S-3 ---------------------------------------------------------------------------------------
test('S-3: plate height follows the grid, not a fixed 0.85 ratio', () => {
  const w = { plateWidthPreset: 'double_170mm' as const };
  assert.deepEqual(plateDimensionsMm({ ...w, plateGrid: '2x2' }).heightMm, Math.round(170 * 0.85));
  assert.equal(plateDimensionsMm({ ...w, plateGrid: '1x2' }).heightMm, Math.round(170 * 0.52));
  assert.equal(plateDimensionsMm({ ...w, plateGrid: '3x1' }).heightMm, Math.round(170 * 1.25));
  assert.equal(plateDimensionsMm({ plateWidthPreset: 'single_85mm', plateGrid: '2x1' }).widthMm, 85);
});

// S-4 ---------------------------------------------------------------------------------------
test('S-4: exported text uses one standard font following the user font, ticks included', () => {
  const svg = `<text style="font-family: 'JetBrains Mono', monospace; font-size: 10px">1</text>` +
              `<text style="font-family: Outfit, sans-serif; font-size: 11px">T</text>`;
  const pdf = standardizeFontsFor(svg, 'pdf', 'Outfit, sans-serif');
  assert.ok(!/Courier|JetBrains|Outfit/.test(pdf), pdf);
  assert.equal((pdf.match(/font-family: Helvetica/g) || []).length, 2);
  const svgOut = standardizeFontsFor(svg, 'svg', 'Times New Roman, serif');
  assert.equal((svgOut.match(/Times New Roman/g) || []).length, 2);
  assert.ok(!/JetBrains|Outfit/.test(svgOut));
  assert.equal(fontCategory('JetBrains Mono, monospace'), 'mono');
  assert.equal(fontCategory('Georgia, serif'), 'serif');
  assert.equal(fontCategory('Arial, sans-serif'), 'sans');
});

// S-6 ---------------------------------------------------------------------------------------
test('S-6: T–RH chart has no hidden extended zone and applies the 12 g/kg limit', () => {
  // 21 °C / 50 % → in winter zone; 19.5 °C / 50 % → only in the old "extended" zone; 25.5 °C / 68 % → in the summer zone but above 12 g/kg.
  assert.ok(humidityRatioGkg(25.5, 68) > 12);
  assert.ok(humidityRatioGkg(21, 50) < 12);
  const rows = [['2026-01-01 00:00:00', '21', '10', '50'], ['2026-01-01 01:00:00', '19.5', '10', '50'], ['2026-01-01 02:00:00', '25.5', '10', '68']];
  const cfg = { normMode: 'psychro', indoorTempCol: 't', outdoorTempCol: 'o', rhCol: 'rh', computeRunningMean: true, alpha: 0.8 } as any;
  const { kpi } = buildThermalComfortFigure(['ts', 't', 'o', 'rh'], rows, 'ts', cfg, 'Arial', 10, 600, 400);
  assert.equal(kpi.totalHours, 3);
  assert.equal(kpi.cat1Hours, 1);
  assert.equal(kpi.cat2Hours, 1, 'no extended zone');
  assert.equal(kpi.humidityLimitHours, 1);
});

// S-7 ---------------------------------------------------------------------------------------
test('S-7: hours in the first week of a computed running mean are flagged as warm-up', () => {
  const rows = hourly(10, () => ['24', '18']);
  const cfg = { normMode: 'en16798', indoorTempCol: 't', outdoorTempCol: 'o', rhCol: '', computeRunningMean: true, alpha: 0.8 } as any;
  const { kpi } = buildThermalComfortFigure(['ts', 't', 'o'], rows, 'ts', cfg, 'Arial', 10, 600, 400);
  assert.equal(kpi.totalHours, 240);
  assert.equal(kpi.warmupHours, RUNNING_MEAN_WARMUP_DAYS * 24);
  const colCfg = { ...cfg, computeRunningMean: false };
  assert.equal(buildThermalComfortFigure(['ts', 't', 'o'], rows, 'ts', colCfg, 'Arial', 10, 600, 400).kpi.warmupHours, undefined);
});

// S-8 ---------------------------------------------------------------------------------------
test('S-8: monthly energy is the sum of hourly means; partial months are not averaged away', () => {
  // January: 2 h at 1 kW; February: 1 h at 4 kW, sampled every 30 min.
  const ts = ['2026-01-01 00:00', '2026-01-01 01:00', '2026-02-01 00:00', '2026-02-01 00:30'];
  const sum = aggregateCalibrationPairs(ts, [1, 1, 4, 4], [1, 1, 4, 4], 'month', 'sum');
  assert.deepEqual(sum.measured, [2, 4]);
  const mean = aggregateCalibrationPairs(ts, [1, 1, 4, 4], [1, 1, 4, 4], 'month', 'mean');
  assert.deepEqual(mean.measured, [1, 4]);
});

test('S-8: calibration flags periods shorter than one year', () => {
  const rows = hourly(14, h => [String(2 + Math.sin(h)), String(2.1 + Math.sin(h))]);
  const cal = { measuredCol: 'p', simulatedCol: 's', viewMode: 'series', standard: 'hourly', showBoxOnChart: false, decimals: '2', quantity: 'energy' } as any;
  const { metrics } = buildCalibrationFigure(['ts', 'p', 's'], rows, 'ts', cal, 'Arial', 10, 600, 400);
  assert.equal(metrics.shortPeriod, true);
  assert.ok(Math.abs(metrics.spanDays! - (14 * 24 - 1) / 24) < 1e-9);
});
