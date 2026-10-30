import type { GridFrameConfig } from './main';

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
}

export interface DurationCurveState {
  variableCol: string;
  compareCol: string;
  xMode: 'hours' | 'pct';
  dtHours: number;
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
}

export interface CalibrationState {
  measuredCol: string;
  simulatedCol: string;
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

function parseDateAndHour(rawTs: string): { dateStr: string; hour: number; dow: number } | null {
  const s = (rawTs || '').trim();
  if (!s) return null;
  const norm = s.replace('T', ' ');
  const parts = norm.split(/\s+/);
  const datePart = parts[0];
  const timePart = parts[1] || '00:00:00';

  let y = 2026, m = 1, d = 1;
  if (datePart.includes('-')) {
    const dp = datePart.split('-').map(Number);
    if (dp.length !== 3 || dp.some(isNaN)) return null;
    if (dp[0] > 1900) { [y, m, d] = dp; } else { [d, m, y] = dp; }
  } else if (datePart.includes('/')) {
    const dp = datePart.split('/').map(Number);
    if (dp.length !== 3 || dp.some(isNaN)) return null;
    if (dp[0] > 1900) { [y, m, d] = dp; } else { [d, m, y] = dp; }
  } else {
    return null;
  }

  const tp = timePart.split(':').map(Number);
  const hour = (!isNaN(tp[0]) && tp[0] >= 0 && tp[0] <= 23) ? Math.floor(tp[0]) : 0;

  const dt = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(dt.getTime())) return null;
  const dow = dt.getUTCDay(); // 0 = Sun, 6 = Sat
  const dateStr = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { dateStr, hour, dow };
}

// ============================================================================
// TRACK 1: CARPET PLOT / TEMPORAL HEATMAP (DAY vs HOUR 0-23h)
// ============================================================================
export function buildCarpetPlotFigure(
  columns: string[],
  rows: string[][],
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
  const binMap = new Map<string, number[]>();

  if (valIdx !== -1) {
    for (const r of rows) {
      const parsed = parseDateAndHour(r[tsIdx] || '');
      if (!parsed) continue;
      if (cfg.dayFilter === 'weekdays' && (parsed.dow === 0 || parsed.dow === 6)) continue;
      if (cfg.dayFilter === 'weekends' && (parsed.dow !== 0 && parsed.dow !== 6)) continue;

      const rawVal = (r[valIdx] || '').trim().replace(',', '.');
      const num = parseFloat(rawVal);
      if (!Number.isFinite(num)) continue;

      if (!daySet.has(parsed.dateStr)) {
        daySet.add(parsed.dateStr);
        dayList.push(parsed.dateStr);
      }
      const key = `${parsed.dateStr}_${parsed.hour}`;
      let arr = binMap.get(key);
      if (!arr) {
        arr = [];
        binMap.set(key, arr);
      }
      arr.push(num);
    }
  }

  dayList.sort();
  const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

  const zMatrix: (number | null)[][] = Array.from({ length: 24 }, () =>
    Array.from({ length: dayList.length }, () => null)
  );

  for (let h = 0; h < 24; h++) {
    for (let dIdx = 0; dIdx < dayList.length; dIdx++) {
      const key = `${dayList[dIdx]}_${h}`;
      const vals = binMap.get(key);
      if (vals && vals.length > 0) {
        if (cfg.aggMethod === 'max') {
          zMatrix[h][dIdx] = Math.max(...vals);
        } else if (cfg.aggMethod === 'min') {
          zMatrix[h][dIdx] = Math.min(...vals);
        } else {
          zMatrix[h][dIdx] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
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
export function buildThermalComfortFigure(
  columns: string[],
  rows: string[][],
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
    undercoolPct: 0
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
      for (const r of rows) {
        const tVal = parseFloat((r[inIdx] || '').replace(',', '.'));
        const rhVal = parseFloat((r[rhIdx] || '').replace(',', '.'));
        if (!Number.isFinite(tVal) || !Number.isFinite(rhVal)) continue;

        kpi.totalHours++;
        const inWinter = tVal >= 20.0 && tVal <= 24.0 && rhVal >= 30.0 && rhVal <= 70.0;
        const inSummer = tVal >= 23.0 && tVal <= 26.0 && rhVal >= 30.0 && rhVal <= 70.0;
        const inExtended = tVal >= 19.0 && tVal <= 27.0 && rhVal >= 25.0 && rhVal <= 75.0;

        if (inSummer && inWinter) {
          kpi.cat1Hours++;
          kpi.cat2Hours++;
          kpi.cat3Hours++;
          ptsInX.push(tVal);
          ptsInY.push(rhVal);
        } else if (inSummer || inWinter) {
          kpi.cat1Hours++;
          kpi.cat2Hours++;
          kpi.cat3Hours++;
          ptsInX.push(tVal);
          ptsInY.push(rhVal);
        } else if (inExtended) {
          kpi.cat2Hours++;
          kpi.cat3Hours++;
          ptsInX.push(tVal);
          ptsInY.push(rhVal);
        } else {
          ptsOutX.push(tVal);
          ptsOutY.push(rhVal);
          if (tVal > 26.0 || rhVal > 70.0) kpi.overheatHours++;
          if (tVal < 20.0 || rhVal < 30.0) kpi.undercoolHours++;
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
        text: '<b>Hygrothermal Comfort Envelope (T–RH Diagram)</b> — EN 16798 / ASHRAE 55',
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
  const xDom = [10, 30];
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

  if (inIdx !== -1 && outIdx !== -1) {
    let runningTrm: number | null = null;
    const alpha = Math.max(0.1, Math.min(0.95, cfg.alpha || 0.8));

    for (const r of rows) {
      const top = parseFloat((r[inIdx] || '').replace(',', '.'));
      const tout = parseFloat((r[outIdx] || '').replace(',', '.'));
      if (!Number.isFinite(top) || !Number.isFinite(tout)) continue;

      if (cfg.computeRunningMean) {
        runningTrm = runningTrm === null ? tout : (1 - alpha) * tout + alpha * runningTrm;
      } else {
        runningTrm = tout;
      }

      const trm = runningTrm;
      const tNeutral = calcNeutral(trm);
      kpi.totalHours++;

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
      title: { text: 'Outdoor Running Mean Temperature T_rm [°C]', font: { family: fontFamily, size: fontSize, color: '#000000' } },
      range: [10, 30],
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
  rows: string[][],
  cfg: DurationCurveState,
  fontFamily: string,
  fontSize: number,
  widthPx: number,
  heightPx: number
): { traces: any[]; layout: any; kpi: DurationKpiSummary } {
  const colIdx = columns.indexOf(cfg.variableCol);
  const cmpIdx = cfg.compareCol ? columns.indexOf(cfg.compareCol) : -1;
  const dt = cfg.dtHours > 0 ? cfg.dtHours : 1.0;

  const vals: number[] = [];
  if (colIdx !== -1) {
    for (const r of rows) {
      const v = parseFloat((r[colIdx] || '').replace(',', '.'));
      if (Number.isFinite(v)) vals.push(v);
    }
  }
  vals.sort((a, b) => b - a); // Descending order: y_(1) >= y_(2) >= ... >= y_(N)

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

  const sortedAsc = [...vals].sort((a, b) => a - b);
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
    meanVal
  };

  const traces: any[] = [];
  const tickFmt = tickFmtFromDec(cfg.decimals);

  // Shaded Exceedance Area above Primary Threshold
  if (cfg.shadeExceedance && cfg.threshold1 !== null && Number.isFinite(cfg.threshold1) && exc1Count > 0) {
    const excX = xAxisVals.slice(0, exc1Count);
    const excY = vals.slice(0, exc1Count);
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
  traces.push({
    type: 'scatter',
    mode: 'lines',
    x: xAxisVals,
    y: vals,
    line: { color: '#000000', width: 2.3 },
    name: `${cfg.variableCol} (Duration Curve)`
  });

  // Optional Secondary Comparison Duration Curve
  if (cmpIdx !== -1) {
    const cmpVals: number[] = [];
    for (const r of rows) {
      const v = parseFloat((r[cmpIdx] || '').replace(',', '.'));
      if (Number.isFinite(v)) cmpVals.push(v);
    }
    cmpVals.sort((a, b) => b - a);
    const cmpX = cmpVals.map((_, i) =>
      cfg.xMode === 'pct' ? ((i + 1) / Math.max(1, cmpVals.length)) * 100 : (i + 1) * dt
    );
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: cmpX,
      y: cmpVals,
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
      monthlyPass: false
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
  const nmbePct = (sumErr / ((n - 1) * denomMean)) * 100.0;
  const rmse = Math.sqrt(sumSqErr / (n - 1));
  const cvRmsePct = (rmse / Math.abs(denomMean)) * 100.0;
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
    monthlyPass
  };
}

export function buildCalibrationFigure(
  columns: string[],
  rows: string[][],
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

  if (mIdx !== -1 && sIdx !== -1) {
    rows.forEach((r, idx) => {
      const mv = parseFloat((r[mIdx] || '').replace(',', '.'));
      const sv = parseFloat((r[sIdx] || '').replace(',', '.'));
      if (Number.isFinite(mv) && Number.isFinite(sv)) {
        xLabels.push(r[tsIdx] || String(idx + 1));
        mVals.push(mv);
        sVals.push(sv);
        residuals.push(mv - sv);
      }
    });
  }

  const metrics = computeAshraeMetricsTS(mVals, sVals);
  const isPass = cfg.standard === 'monthly' ? metrics.monthlyPass : metrics.hourlyPass;
  const tickFmt = tickFmtFromDec(cfg.decimals);
  const traces: any[] = [];
  const annotations: any[] = [];

  if (cfg.showBoxOnChart && metrics.n >= 2) {
    const passText = isPass ? '✓ ASHRAE G14 PASS' : '⚠ OUT OF TOLERANCE';
    annotations.push({
      xref: 'paper',
      yref: 'paper',
      x: 0.98,
      y: 0.97,
      xanchor: 'right',
      yanchor: 'top',
      align: 'left',
      text: `<b>${passText} (${cfg.standard.toUpperCase()})</b><br>` +
            `NMBE: ${metrics.nmbePct >= 0 ? '+' : ''}${metrics.nmbePct.toFixed(2)}%<br>` +
            `CV(RMSE): ${metrics.cvRmsePct.toFixed(2)}%<br>` +
            `R²: ${metrics.rSquared.toFixed(4)} | RMSE: ${metrics.rmse.toFixed(2)}`,
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
    const minV = allV.length > 0 ? Math.min(...allV) * 0.95 : 0;
    const maxV = allV.length > 0 ? Math.max(...allV) * 1.05 : 100;

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

export function computeVariableStats(
  columns: string[],
  rows: string[][],
  cfg: EditorialSuiteState
): VariableStatRow[] {
  const dt = cfg.dtHours > 0 ? cfg.dtHours : 1.0;
  const results: VariableStatRow[] = [];

  for (const item of cfg.variables) {
    if (!item.selected) continue;
    const cIdx = columns.indexOf(item.column);
    if (cIdx === -1) continue;

    const nums: number[] = [];
    for (const r of rows) {
      const v = parseFloat((r[cIdx] || '').replace(',', '.'));
      if (Number.isFinite(v)) nums.push(v);
    }
    if (nums.length === 0) continue;

    nums.sort((a, b) => a - b);
    const n = nums.length;
    const mean = nums.reduce((a, b) => a + b, 0) / n;
    const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, n - 1);
    const std = Math.sqrt(variance);
    const min = nums[0];
    const max = nums[n - 1];
    const p5 = nums[Math.min(n - 1, Math.floor((n - 1) * 0.05))];
    const median = nums[Math.floor((n - 1) * 0.5)];
    const p95 = nums[Math.min(n - 1, Math.floor((n - 1) * 0.95))];

    let excCount = 0;
    if (item.threshold !== null && Number.isFinite(item.threshold)) {
      excCount = nums.filter(v => v > item.threshold!).length;
    }

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

export function buildCompositePlateFigure(
  columns: string[],
  rows: string[][],
  tsCol: string,
  cfg: EditorialSuiteState,
  fontFamily: string,
  fontSize: number,
  gridFrame: GridFrameConfig
): { traces: any[]; layout: any; widthPx: number; heightPx: number } {
  const mmToPxPreview = 3.78; // 96 DPI screen preview scaling (export uses 300/600 DPI scale factor)
  const widthMm = cfg.plateWidthPreset === 'single_85mm' ? 85 : (cfg.plateWidthPreset === 'half_120mm' ? 120 : 170);
  const gridMap: Record<string, { r: number; c: number; hMm: number }> = {
    '2x1': { r: 2, c: 1, hMm: Math.round(widthMm * 0.95) },
    '1x2': { r: 1, c: 2, hMm: Math.round(widthMm * 0.52) },
    '2x2': { r: 2, c: 2, hMm: Math.round(widthMm * 0.85) },
    '3x1': { r: 3, c: 1, hMm: Math.round(widthMm * 1.25) }
  };
  const g = gridMap[cfg.plateGrid] || gridMap['2x2'];
  const count = g.r * g.c;

  const widthPx = Math.round(widthMm * mmToPxPreview * 1.35);
  const heightPx = Math.round(g.hMm * mmToPxPreview * 1.35);

  const tsIdx = Math.max(0, columns.indexOf(tsCol));
  const xVals = rows.map((r, i) => r[tsIdx] || String(i + 1));

  const traces: any[] = [];
  const annotations: any[] = [];
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
    const x1 = x0 + cellW;
    const y1 = 1.0 - rowIdx * (cellH + vGap);
    const y0 = y1 - cellH;

    const axNum = idx === 0 ? '' : String(idx + 1);
    const xKey = `xaxis${axNum}`;
    const yKey = `yaxis${axNum}`;
    const xRef = idx === 0 ? 'x' : `x${idx + 1}`;
    const yRef = idx === 0 ? 'y' : `y${idx + 1}`;

    const slotCol = cfg.plateSlots[idx] || columns[Math.min(columns.length - 1, idx + 1)] || columns[0] || '';
    const cPos = columns.indexOf(slotCol);
    const yVals = cPos !== -1 ? rows.map(r => {
      const v = parseFloat((r[cPos] || '').replace(',', '.'));
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

    layout[xKey] = {
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

    layout[yKey] = {
      domain: [y0, y1],
      anchor: xRef,
      title: { text: slotCol, font: { family: fontFamily, size: Math.max(9, fontSize - 1), color: '#000000' } },
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
  return { traces, layout, widthPx, heightPx };
}
