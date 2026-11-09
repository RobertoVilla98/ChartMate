import { axisValues, cellText, getColumn, isNumericColumn, numericValues, rowCount } from '../data/table';
// @ts-ignore
import Plotly from 'plotly.js-dist-min';
import { buildAxisStyle, calculatePeakAnnotations, decimateSeries, decimationTarget, WEBGL_THRESHOLD } from './chart_utils';
import { state, t } from '../core/state';
import { toISODate } from '../data/loader';

export function updateChart() {
  const chartEl = document.getElementById('plotly-chart');
  if (!chartEl) return;

  const ratio = state.widthCm / state.heightCm;
  let pxW = 850;
  let pxH = Math.round(pxW / ratio);

  if (state.preset === 'square') {
    pxW = 600;
    pxH = 600;
  } else if (state.preset === 'single') {
    pxW = 550;
    pxH = Math.round(pxW / ratio);
  }

  let xVals: any[] = [];
  let traces: any[] = [];
  const annotations: any[] = [];
  const decimatedTraces: string[] = [];
  let drawnPoints = 0;

  if (state.dataset && state.selectedX) {
    const ds = state.dataset;
    // Row selection for the time window, as indices into the typed columns.
    let sel: number[] | undefined;
    if (state.timeframeMode !== 'all' && state.hasTimestamp && state.selectedX === state.timestampCol && (state.startDate || state.endDate)) {
      const xc = getColumn(ds, state.selectedX);
      sel = [];
      const n = rowCount(ds);
      for (let i = 0; i < n; i++) {
        const val = toISODate(xc && !isNumericColumn(xc) ? xc[i] : cellText(ds, i, ds.columns.indexOf(state.selectedX)));
        if (val && state.startDate && val < state.startDate) continue;
        if (val && state.endDate && val > state.endDate) continue;
        sel.push(i);
      }
    }

    xVals = axisValues(ds, state.selectedX, sel);

    state.traces.forEach((tr) => {
      const yIdx = state.dataset!.columns.indexOf(tr.column);
      if (yIdx === -1) return;

      const yVals = numericValues(ds, tr.column, sel);
      const decCfg = state.axisScales[tr.axis]?.decimals || 'auto';
      const hoverFmt = decCfg === 'auto' ? '' : `:.${decCfg}f`;

      let pType = 'scatter';
      let pMode: string | undefined = 'lines';
      let pFill: string | undefined = undefined;

      if (tr.chartType === 'line') {
        pType = 'scatter';
        pMode = 'lines';
      } else if (tr.chartType === 'scatter') {
        pType = 'scatter';
        pMode = 'markers';
      } else if (tr.chartType === 'area') {
        pType = 'scatter';
        pMode = 'lines';
        pFill = 'tozeroy';
      } else if (tr.chartType === 'bar') {
        pType = 'bar';
        pMode = undefined;
      }

      // Large series: min-max decimation for lines/areas, WebGL for very large marker clouds.
      let xs: any[] = xVals;
      let ys: (number | null)[] = yVals;
      if (state.decimateLargeSeries && (tr.chartType === 'line' || tr.chartType === 'area')) {
        const d = decimateSeries(xVals, yVals, decimationTarget(state.widthCm * 37.795 * 2));
        xs = d.x;
        ys = d.y;
        if (d.decimated) decimatedTraces.push(`${tr.column}: ${ys.length.toLocaleString()} / ${yVals.length.toLocaleString()}`);
      } else if (tr.chartType === 'scatter' && yVals.length > WEBGL_THRESHOLD) {
        pType = 'scattergl';
      }
      drawnPoints += ys.length;

      const traceObj: any = {
        x: xs,
        y: ys,
        name: tr.column,
        yaxis: tr.axis === 'y1' ? 'y' : tr.axis,
        type: pType,
        mode: pMode,
        fill: pFill,
        line: { color: tr.color, width: tr.lineWidth, dash: tr.lineDash },
        marker: { size: 5, color: tr.color },
        hovertemplate: `%{x}<br><b>${tr.column}</b>: %{y${hoverFmt}}<extra></extra>`
      };

      if (tr.chartType === 'bar') {
        traceObj.marker = { color: tr.color, opacity: 0.85 };
        delete traceObj.mode;
        delete traceObj.line;
      }

      traces.push(traceObj);

      if (state.peakMode !== 'none' && yVals.length > 0 && tr.axis === 'y1') {
        calculatePeakAnnotations(xVals, yVals, state.peakMode, annotations, 'y', decCfg);
      }
    });

    if (traces.length === 0) {
      annotations.push({
        text: t('no_traces_msg'),
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: 0.5,
        showarrow: false,
        font: { size: 13, color: '#64748b' }
      });
    }
  } else {
    const steps = 30;
    xVals = Array.from({ length: steps }, (_, i) => `2026-09-01 ${String(i % 24).padStart(2, '0')}:00`);
    const yVals = Array.from({ length: steps }, (_, i) => 21.0 + 4.0 * Math.sin(i / 3));
    traces.push({
      x: xVals,
      y: yVals,
      name: 'Indoor Temperature (°C)',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#000000', width: 2.2 },
      marker: { size: 5, color: '#000000' }
    });
  }

  const hasY2 = state.traces.some(tr => tr.axis === 'y2');
  const hasY3 = state.traces.some(tr => tr.axis === 'y3');
  const hasY4 = state.traces.some(tr => tr.axis === 'y4');

  let rightMargin = state.legendPos === 'right' ? 140 : 35;
  if (hasY4) rightMargin = Math.max(rightMargin, 155);
  else if (hasY3) rightMargin = Math.max(rightMargin, 115);
  else if (hasY2) rightMargin = Math.max(rightMargin, 70);

  let legendObj: any = {
    orientation: 'h',
    x: 0.5,
    y: 1.12,
    xanchor: 'center',
    font: { size: state.fontSize - 1, color: '#000000' }
  };
  if (state.legendPos === 'right') {
    legendObj = { orientation: 'v', x: 1.03, y: 1, xanchor: 'left', font: { size: state.fontSize - 1, color: '#000000' } };
  } else if (state.legendPos === 'bottom') {
    legendObj = { orientation: 'h', x: 0.5, y: -0.22, xanchor: 'center', font: { size: state.fontSize - 1, color: '#000000' } };
  } else if (state.legendPos === 'inside') {
    legendObj = { orientation: 'v', x: 0.98, y: 0.98, xanchor: 'right', yanchor: 'top', bgcolor: 'rgba(255,255,255,0.85)', bordercolor: '#cbd5e1', borderwidth: 1, font: { size: state.fontSize - 1, color: '#000000' } };
  }

  const layout: any = {
    width: pxW,
    height: pxH,
    margin: { l: 65, r: rightMargin, t: state.legendPos === 'top' ? 42 : 25, b: state.legendPos === 'bottom' ? 75 : 52 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: state.fontFamily, size: state.fontSize, color: '#000000' },
    showlegend: state.legendPos !== 'none',
    legend: legendObj,
    annotations,
    xaxis: buildAxisStyle(state.xTitle || state.selectedX || 'Time / Parameter', '#000000', undefined, true),
    yaxis: buildAxisStyle(state.y1Title || 'Primary Y1', '#000000', state.axisScales.y1, false),
    shapes: []
  };

  if (hasY2) {
    layout.yaxis2 = {
      ...buildAxisStyle(state.y2Title || 'Y2 Axis', '#0284c7', state.axisScales.y2, false),
      overlaying: 'y',
      side: 'right',
      showgrid: false,
      mirror: false
    };
  }

  if (hasY3) {
    layout.yaxis3 = {
      ...buildAxisStyle(state.y3Title || 'Y3 Axis', '#d97706', state.axisScales.y3, false),
      overlaying: 'y',
      side: 'right',
      position: 0.93,
      showgrid: false,
      mirror: false
    };
  }

  if (hasY4) {
    layout.yaxis4 = {
      ...buildAxisStyle(state.y4Title || 'Y4 Axis', '#7c3aed', state.axisScales.y4, false),
      overlaying: 'y',
      side: 'right',
      position: 0.86,
      showgrid: false,
      mirror: false
    };
  }

  if (state.comfortBand) {
    layout.shapes.push({
      type: 'rect',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: state.comfortMin,
      y1: state.comfortMax,
      fillcolor: state.comfortSeason === 'winter' ? 'rgba(5, 150, 105, 0.12)' : 'rgba(217, 119, 6, 0.12)',
      line: { width: 0 },
      layer: 'below'
    });
  }

  // Shown in the interface, never drawn into the exported figure.
  state.decimationInfo = decimatedTraces.length > 0 ? decimatedTraces.join(' · ') : '';
  const t0 = performance.now();
  Promise.resolve(Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false })).then(() => {
    state.renderTiming = { renderMs: performance.now() - t0, points: drawnPoints };
    const el = document.getElementById('render-timing');
    if (el) {
      el.textContent = `${t('render_time_label')} ${state.renderTiming.renderMs.toFixed(0)} ms · ${drawnPoints.toLocaleString()} pts` +
        (state.decimationInfo ? ` · ${t('decimation_label')} ${state.decimationInfo}` : '');
    }
  });
}
