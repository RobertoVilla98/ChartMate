import { DEFAULT_PALETTE, state } from './state';
import type { MultiPlotPanelConfig } from './types';

export function getMultiPlotDimensions(): { rows: number; cols: number; count: number } {
  if (state.mpTopology === '3x1') return { rows: 3, cols: 1, count: 3 };
  if (state.mpTopology === '2x1') return { rows: 2, cols: 1, count: 2 };
  if (state.mpTopology === '2x2') return { rows: 2, cols: 2, count: 4 };
  if (state.mpTopology === '1x2') return { rows: 1, cols: 2, count: 2 };
  const r = Math.max(1, Math.min(5, state.mpCustomRows || 2));
  const c = Math.max(1, Math.min(5, state.mpCustomCols || 2));
  return { rows: r, cols: c, count: r * c };
}

export function getPanelLetter(idx: number): string {
  return `(${String.fromCharCode(97 + idx)})`;
}

export function ensurePanelNormalized(idx: number): MultiPlotPanelConfig {
  while (state.mpPanels.length <= idx) {
    state.mpPanels.push({
      traces: [{ column: '', axis: 'y1', chartType: 'line', color: DEFAULT_PALETTE[state.mpPanels.length % DEFAULT_PALETTE.length], lineWidth: 1.9, lineDash: 'solid' }],
      yTitle: `Panel ${getPanelLetter(state.mpPanels.length)}`,
      y2Title: '',
      y1Min: null,
      y1Max: null,
      y1Decimals: 'auto',
      y1MajorStep: null,
      y1MinorStep: null
    });
  }
  const p = state.mpPanels[idx];
  if (!p.traces || !Array.isArray(p.traces)) {
    p.traces = [];
    if (p.y1Col) {
      p.traces.push({
        column: p.y1Col,
        axis: 'y1',
        chartType: p.y1Type || 'line',
        color: p.y1Color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length],
        lineWidth: 1.9,
        lineDash: 'solid'
      });
    }
    if (p.y2Col) {
      p.traces.push({
        column: p.y2Col,
        axis: 'y2',
        chartType: 'line',
        color: p.y2Color || '#0284c7',
        lineWidth: 1.7,
        lineDash: 'dash'
      });
    }
  }
  return p;
}
