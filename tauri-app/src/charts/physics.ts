import type { Rows } from '../source';
// @ts-ignore
import Plotly from 'plotly.js-dist-min';
import { buildCarpetPlotFigure, buildThermalComfortFigure, buildDurationCurveFigure, buildCalibrationFigure, buildCompositePlateFigure } from '../scientific_modules';
import { state } from '../core/state';
import { renderPhysicsKpiBar } from '../ui/render_physics';
import { reduceTracesForDisplay } from './decimation';

export function updatePhysicsChart() {
  const chartEl = document.getElementById('plotly-physics-chart');
  if (!chartEl || !state.dataset || state.dataset.columns.length === 0) return;

  const pxW = Math.round(state.widthCm * 37.795 * 1.15);
  const pxH = Math.round(state.heightCm * 37.795 * 1.15);
  const cols = state.dataset.columns;
  // Column table (typed columns); the text-row view is never built here.
  const rows: Rows = state.dataset;
  const tsCol = state.timestampCol || cols[0] || '';

  if (state.physicsMode === 'carpet') {
    const { traces, layout } = buildCarpetPlotFigure(
      cols, rows, tsCol, state.carpetState, state.fontFamily, state.fontSize, pxW, pxH
    );
    Plotly.newPlot(chartEl, reduceTracesForDisplay(traces, pxW), layout, { responsive: true, displayModeBar: false });
  } else if (state.physicsMode === 'comfort') {
    const { traces, layout, kpi } = buildThermalComfortFigure(
      cols, rows, tsCol, state.comfortState, state.fontFamily, state.fontSize, pxW, pxH
    );
    state.comfortKpi = kpi;
    Plotly.newPlot(chartEl, reduceTracesForDisplay(traces, pxW), layout, { responsive: true, displayModeBar: false });
  } else if (state.physicsMode === 'duration') {
    const { traces, layout, kpi } = buildDurationCurveFigure(
      cols, rows, state.durationState, state.fontFamily, state.fontSize, pxW, pxH, state.hasTimestamp ? tsCol : undefined
    );
    state.durationKpi = kpi;
    Plotly.newPlot(chartEl, reduceTracesForDisplay(traces, pxW), layout, { responsive: true, displayModeBar: false });
  } else {
    const { traces, layout, metrics } = buildCalibrationFigure(
      cols, rows, tsCol, state.calibState, state.fontFamily, state.fontSize, pxW, pxH
    );
    state.calibMetrics = metrics;
    Plotly.newPlot(chartEl, reduceTracesForDisplay(traces, pxW), layout, { responsive: true, displayModeBar: false });
  }

  const banner = document.getElementById('physics-kpi-banner');
  if (banner) {
    banner.innerHTML = renderPhysicsKpiBar();
  }
}

export function updateEditorialSuite() {
  const plateEl = document.getElementById('plotly-plate-chart');
  if (!plateEl || !state.dataset || state.dataset.columns.length === 0) return;

  const { traces, layout } = buildCompositePlateFigure(
    state.dataset.columns,
    state.dataset,
    state.timestampCol || state.dataset.columns[0] || '',
    state.editorialState,
    state.fontFamily,
    state.fontSize,
    state.gridFrame,
    {
      carpet: state.carpetState,
      comfort: state.comfortState,
      duration: state.durationState,
      calibration: state.calibState
    }
  );
  Plotly.newPlot(plateEl, reduceTracesForDisplay(traces, 900), layout, { responsive: true, displayModeBar: false });
}
