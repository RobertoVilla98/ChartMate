// @ts-ignore
import Plotly from 'plotly.js-dist-min';
import { buildAxisStyle, parseNumericValue } from './chart_utils';
import { ensurePanelNormalized, getMultiPlotDimensions, getPanelLetter } from '../core/panels';
import { DEFAULT_PALETTE, state } from '../core/state';
import type { AxisScaleConfig } from '../core/types';

export function updateMultiPlotChart() {
  const chartEl = document.getElementById('plotly-multi-chart');
  if (!chartEl) return;

  const ratio = state.mpWidthCm / state.mpHeightCm;
  let pxW = 860;
  let pxH = Math.round(pxW / ratio);
  if (state.mpPreset === 'single_stack') {
    pxW = 550;
    pxH = Math.round(pxW / ratio);
  } else if (state.mpPreset === 'square_grid') {
    pxW = 700;
    pxH = 700;
  }

  const { rows, cols, count: panelCount } = getMultiPlotDimensions();

  const traces: any[] = [];
  const annotations: any[] = [];
  const topMargin = state.mpMacroX ? 65 : 48;
  const leftMargin = state.mpMacroY ? 85 : 65;

  const layout: any = {
    width: pxW,
    height: pxH,
    margin: { l: leftMargin, r: 55, t: topMargin, b: state.mpLegendMode === 'global_bottom' ? 75 : 55 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: state.fontFamily, size: state.fontSize, color: '#000000' },
    showlegend: state.mpLegendMode !== 'none',
    annotations
  };

  if (state.mpLegendMode === 'global_top') {
    layout.legend = { orientation: 'h', x: 0.5, y: 1.07, xanchor: 'center', font: { size: state.fontSize - 1, color: '#000000' } };
  } else if (state.mpLegendMode === 'global_bottom') {
    layout.legend = { orientation: 'h', x: 0.5, y: -0.15, xanchor: 'center', font: { size: state.fontSize - 1, color: '#000000' } };
  }

  let xVals: any[] = [];
  const activeRows = state.dataset?.rows || [];
  if (state.dataset && state.selectedX) {
    const xIdx = state.dataset.columns.indexOf(state.selectedX);
    if (xIdx !== -1) {
      xVals = activeRows.map(r => r[xIdx]);
    }
  }
  if (xVals.length === 0) {
    xVals = Array.from({ length: 24 }, (_, i) => `2026-09-01 ${String(i).padStart(2, '0')}:00`);
  }

  const vGap = rows >= 4 ? 0.06 : (rows === 3 ? 0.08 : (rows === 2 ? 0.12 : 0));
  const hGap = cols >= 4 ? 0.06 : (cols === 3 ? 0.08 : (cols === 2 ? 0.11 : 0));
  const cellH = (1.0 - vGap * (rows - 1)) / rows;
  const cellW = (1.0 - hGap * (cols - 1)) / cols;

  for (let i = 0; i < panelCount; i++) {
    const rIdx = Math.floor(i / cols);
    const cIdx = i % cols;
    const xDom0 = Number((cIdx * (cellW + hGap)).toFixed(4));
    const xDom1 = Number((xDom0 + cellW).toFixed(4));
    const yDom1 = Number((1.0 - rIdx * (cellH + vGap)).toFixed(4));
    const yDom0 = Number(Math.max(0, yDom1 - cellH).toFixed(4));

    const axNum = i === 0 ? '' : String(i + 1);
    const xAxisName = `xaxis${axNum}`;
    const yAxisName = `yaxis${axNum}`;
    const xRef = `x${axNum}`;
    const yRef = `y${axNum}`;
    const letter = getPanelLetter(i);

    const pCfg = ensurePanelNormalized(i);
    const isBottomRow = rIdx === rows - 1;
    const hideXTicks = state.mpShareX && !isBottomRow;

    const pScale: AxisScaleConfig = {
      title: pCfg.yTitle || pCfg.traces[0]?.column || `Panel ${letter}`,
      min: pCfg.y1Min,
      max: pCfg.y1Max,
      decimals: pCfg.y1Decimals || 'auto',
      majorStep: pCfg.y1MajorStep,
      minorStep: pCfg.y1MinorStep
    };

    layout[xAxisName] = {
      ...buildAxisStyle(isBottomRow ? (state.xTitle || state.selectedX || 'Time') : '', '#000000', undefined, true),
      domain: [xDom0, xDom1],
      anchor: yRef,
      showticklabels: !hideXTicks
    };
    if (state.mpShareX && i > 0) {
      layout[xAxisName].matches = 'x';
    }

    const hasPanelY2 = pCfg.traces.some(tr => tr.axis === 'y2');
    layout[yAxisName] = {
      ...buildAxisStyle(pScale.title, '#000000', pScale, false),
      domain: [yDom0, yDom1],
      anchor: xRef
    };
    if (hasPanelY2) {
      layout[yAxisName].mirror = false;
    }
    if (state.mpShareY && cIdx > 0) {
      const rowFirstAx = rIdx * cols === 0 ? 'y' : `y${rIdx * cols + 1}`;
      layout[yAxisName].matches = rowFirstAx;
    }

    // Per-Panel Individual Legend placement (legend, legend2, legend3...)
    const legName = i === 0 ? 'legend' : `legend${i + 1}`;
    if (state.mpLegendMode === 'per_panel') {
      layout[legName] = {
        x: xDom1,
        y: yDom1 + 0.005,
        xanchor: 'right',
        yanchor: 'bottom',
        orientation: 'h',
        bgcolor: 'rgba(255,255,255,0.75)',
        font: { family: state.fontFamily, size: Math.max(8, state.fontSize - 2), color: '#000000' }
      };
    }

    // Secondary Y2 Axis in this Panel if any trace uses y2
    const y2AxisId = i + 30;
    const y2Ref = `y${y2AxisId}`;
    if (hasPanelY2) {
      const y2Trace = pCfg.traces.find(tr => tr.axis === 'y2');
      const y2Color = y2Trace?.color || '#0284c7';
      layout[`yaxis${y2AxisId}`] = {
        ...buildAxisStyle(pCfg.y2Title || y2Trace?.column || 'Y2', y2Color, undefined, false),
        domain: [yDom0, yDom1],
        anchor: xRef,
        overlaying: yRef,
        side: 'right',
        showgrid: false,
        mirror: false
      };
    }

    // Render all traces in this panel
    if (pCfg.traces.length > 0 && state.dataset) {
      pCfg.traces.forEach((tr) => {
        const yIdx = state.dataset!.columns.indexOf(tr.column);
        const yVals = yIdx !== -1
          ? activeRows.map(r => parseNumericValue(r[yIdx]))
          : xVals.map((_, k) => 20 + (i + 1) * 2 * Math.sin((k + i * 3) / 3));

        const decCfg = pCfg.y1Decimals || 'auto';
        const hoverFmt = decCfg === 'auto' ? '' : `:.${decCfg}f`;

        traces.push({
          x: xVals,
          y: yVals,
          name: state.mpLegendMode === 'per_panel' ? (tr.column || `Series`) : `${letter} ${tr.column || pCfg.yTitle}`,
          xaxis: xRef,
          yaxis: tr.axis === 'y2' ? y2Ref : yRef,
          legend: state.mpLegendMode === 'per_panel' ? legName : 'legend',
          type: tr.chartType === 'bar' ? 'bar' : 'scatter',
          mode: tr.chartType === 'scatter' ? 'markers' : (tr.chartType === 'bar' ? undefined : 'lines'),
          fill: tr.chartType === 'area' ? 'tozeroy' : undefined,
          line: { color: tr.color, width: tr.lineWidth || 1.8, dash: tr.lineDash || 'solid' },
          marker: { color: tr.color, size: 4 },
          hovertemplate: `%{x}<br><b>${tr.column || letter}</b>: %{y${hoverFmt}}<extra></extra>`
        });
      });
    } else {
      // Demo fallback trace for empty panel
      const demoY = xVals.map((_, k) => 20 + (i + 1) * 2 * Math.sin((k + i * 3) / 3));
      traces.push({
        x: xVals,
        y: demoY,
        name: `${letter} Demo`,
        xaxis: xRef,
        yaxis: yRef,
        legend: state.mpLegendMode === 'per_panel' ? legName : 'legend',
        type: 'scatter',
        mode: 'lines',
        line: { color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length], width: 1.8 }
      });
    }

    // External Academic Lettering (a), (b), (c)...
    if (state.mpAutoLettering) {
      let lx = xDom0;
      let ly = yDom1 + 0.008;
      let xAnc: 'left' | 'right' = 'left';
      let yAnc: 'bottom' | 'top' = 'bottom';

      if (state.mpLetterPos === 'outside_side') {
        lx = Math.max(0, xDom0 - 0.02);
        ly = yDom1;
        xAnc = 'right';
        yAnc = 'top';
      } else if (state.mpLetterPos === 'inside') {
        lx = xDom0 + 0.012;
        ly = yDom1 - 0.018;
        xAnc = 'left';
        yAnc = 'top';
      }

      annotations.push({
        text: `<b>${letter}</b>`,
        xref: 'paper',
        yref: 'paper',
        x: lx,
        y: ly,
        xanchor: xAnc,
        yanchor: yAnc,
        showarrow: false,
        font: { family: state.fontFamily, size: state.fontSize + 2, color: '#000000' }
      });
    }
  }

  // Outer Matrix Macro-Axes (Super-Labels for parametric R×C matrices)
  if (state.mpMacroX) {
    annotations.push({
      text: `<b>${state.mpMacroX}</b>`,
      xref: 'paper',
      yref: 'paper',
      x: 0.5,
      y: 1.06,
      xanchor: 'center',
      yanchor: 'bottom',
      showarrow: false,
      font: { family: state.fontFamily, size: state.fontSize + 2, color: '#000000' }
    });
  }

  if (state.mpMacroY) {
    annotations.push({
      text: `<b>${state.mpMacroY}</b>`,
      xref: 'paper',
      yref: 'paper',
      x: -0.09,
      y: 0.5,
      xanchor: 'center',
      yanchor: 'middle',
      textangle: -90,
      showarrow: false,
      font: { family: state.fontFamily, size: state.fontSize + 2, color: '#000000' }
    });
  }

  Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
}
