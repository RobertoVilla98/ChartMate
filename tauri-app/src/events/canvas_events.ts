import { updateMapChart } from '../charts/map';
import { updateMultiPlotChart } from '../charts/multiplot';
import { updateChart } from '../charts/single_canvas';
import { DEFAULT_PALETTE, PRESETS, state } from '../core/state';
import { calculateTimeframeDates } from '../data/loader';
import { renderApp } from '../ui/render_app';

function refreshActiveChart() {
  if (state.currentTab === 'multi') updateMultiPlotChart();
  else if (state.currentTab === 'maps') updateMapChart();
  else updateChart();
}

export function attachCanvasEvents() {
  // Canvas: Timeframe
  document.querySelectorAll('.timeframe-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const mode = (e.target as HTMLElement).getAttribute('data-tf') as any;
      if (mode) {
        state.timeframeMode = mode;
        calculateTimeframeDates(mode);
        renderApp();
      }
    });
  });

  document.getElementById('canvas-start-date')?.addEventListener('change', (e) => {
    state.startDate = (e.target as HTMLInputElement).value;
    state.timeframeMode = 'custom';
    updateChart();
  });
  document.getElementById('canvas-end-date')?.addEventListener('change', (e) => {
    state.endDate = (e.target as HTMLInputElement).value;
    state.timeframeMode = 'custom';
    updateChart();
  });

  // Canvas: Select X & Custom X Title
  document.getElementById('select-x')?.addEventListener('change', (e) => {
    state.selectedX = (e.target as HTMLSelectElement).value;
    updateChart();
  });
  document.getElementById('axis-x-title')?.addEventListener('input', (e) => {
    state.xTitle = (e.target as HTMLInputElement).value;
    updateChart();
  });

  // Trace Styler: Add Trace
  document.getElementById('btn-add-trace')?.addEventListener('click', () => {
    if (!state.dataset || state.dataset.columns.length === 0) return;
    const selEl = document.getElementById('sel-new-trace-col') as HTMLSelectElement | null;
    let chosenCol = selEl?.value;
    if (!chosenCol) {
      const available = state.dataset.columns.filter(c => c !== state.selectedX && !state.traces.some(tr => tr.column === c));
      chosenCol = available.length > 0 ? available[0] : state.dataset.columns[1] || state.dataset.columns[0];
    }
    const nextColor = DEFAULT_PALETTE[state.traces.length % DEFAULT_PALETTE.length];
    const nextAxis: 'y1' | 'y2' | 'y3' | 'y4' = state.traces.length === 0 ? 'y1' : (state.traces.length === 1 ? 'y2' : (state.traces.length === 2 ? 'y3' : (state.traces.length === 3 ? 'y4' : 'y1')));

    state.traces.push({
      column: chosenCol,
      axis: nextAxis,
      chartType: 'line',
      color: nextColor,
      lineWidth: 2.0,
      lineDash: 'solid'
    });

    if (nextAxis === 'y1' && !state.y1Title) state.y1Title = chosenCol;
    if (nextAxis === 'y2' && !state.y2Title) state.y2Title = chosenCol;
    if (nextAxis === 'y3' && !state.y3Title) state.y3Title = chosenCol;
    if (nextAxis === 'y4' && !state.y4Title) state.y4Title = chosenCol;

    renderApp();
  });

  // Trace Styler Controls
  document.querySelectorAll('.sel-trace-column').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      if (state.traces[idx]) {
        state.traces[idx].column = (e.target as HTMLSelectElement).value;
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-del-trace').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces.splice(idx, 1);
      renderApp();
    });
  });

  document.querySelectorAll('.sel-trace-axis').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].axis = (e.target as HTMLSelectElement).value as any;
      renderApp();
    });
  });

  document.querySelectorAll('.sel-trace-type').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].chartType = (e.target as HTMLSelectElement).value as any;
      updateChart();
    });
  });

  document.querySelectorAll('.sel-trace-dash').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].lineDash = (e.target as HTMLSelectElement).value as any;
      updateChart();
    });
  });

  document.querySelectorAll('.inp-trace-color').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].color = (e.target as HTMLInputElement).value;
      updateChart();
    });
  });

  // Sub-Tab 2: Per-Axis Scale, Range, Decimals & Grid Step Listeners
  document.querySelectorAll('.inp-axis-title').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const ax = (e.target as HTMLElement).getAttribute('data-ax') as 'y1' | 'y2' | 'y3' | 'y4';
      const val = (e.target as HTMLInputElement).value;
      if (ax === 'y1') state.y1Title = val;
      else if (ax === 'y2') state.y2Title = val;
      else if (ax === 'y3') state.y3Title = val;
      else if (ax === 'y4') state.y4Title = val;
      state.axisScales[ax].title = val;
      updateChart();
    });
  });

  document.querySelectorAll('.inp-axis-min').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const ax = (e.target as HTMLElement).getAttribute('data-ax') as 'y1' | 'y2' | 'y3' | 'y4';
      const raw = (e.target as HTMLInputElement).value.trim();
      state.axisScales[ax].min = raw === '' ? null : parseFloat(raw);
      updateChart();
    });
  });

  document.querySelectorAll('.inp-axis-max').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const ax = (e.target as HTMLElement).getAttribute('data-ax') as 'y1' | 'y2' | 'y3' | 'y4';
      const raw = (e.target as HTMLInputElement).value.trim();
      state.axisScales[ax].max = raw === '' ? null : parseFloat(raw);
      updateChart();
    });
  });

  document.querySelectorAll('.sel-axis-dec').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const ax = (e.target as HTMLElement).getAttribute('data-ax') as 'y1' | 'y2' | 'y3' | 'y4';
      state.axisScales[ax].decimals = (e.target as HTMLSelectElement).value as any;
      updateChart();
    });
  });

  document.querySelectorAll('.inp-axis-major').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const ax = (e.target as HTMLElement).getAttribute('data-ax') as 'y1' | 'y2' | 'y3' | 'y4';
      const raw = (e.target as HTMLInputElement).value.trim();
      const num = parseFloat(raw);
      state.axisScales[ax].majorStep = (!isNaN(num) && num > 0) ? num : null;
      updateChart();
    });
  });

  document.querySelectorAll('.inp-axis-minor').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const ax = (e.target as HTMLElement).getAttribute('data-ax') as 'y1' | 'y2' | 'y3' | 'y4';
      const raw = (e.target as HTMLInputElement).value.trim();
      const num = parseFloat(raw);
      state.axisScales[ax].minorStep = (!isNaN(num) && num > 0) ? num : null;
      if (state.axisScales[ax].minorStep) {
        state.gridFrame.showMinorGrid = true;
      }
      updateChart();
    });
  });

  // Sub-Tab 3: Frame Mode, Ticks & Gridline Toggles (Shared by Single Canvas & MultiPlot)

  document.getElementById('cfg-frame-mode')?.addEventListener('change', (e) => {
    state.gridFrame.frameMode = (e.target as HTMLSelectElement).value as any;
    refreshActiveChart();
  });
  document.getElementById('cfg-tick-dir')?.addEventListener('change', (e) => {
    state.gridFrame.tickDir = (e.target as HTMLSelectElement).value as any;
    refreshActiveChart();
  });
  document.getElementById('chk-x-grid')?.addEventListener('change', (e) => {
    state.gridFrame.showXGrid = (e.target as HTMLInputElement).checked;
    refreshActiveChart();
  });
  document.getElementById('chk-y-grid')?.addEventListener('change', (e) => {
    state.gridFrame.showYGrid = (e.target as HTMLInputElement).checked;
    refreshActiveChart();
  });
  document.getElementById('chk-minor-grid')?.addEventListener('change', (e) => {
    state.gridFrame.showMinorGrid = (e.target as HTMLInputElement).checked;
    refreshActiveChart();
  });
  document.getElementById('chk-zero-line')?.addEventListener('change', (e) => {
    state.gridFrame.showZeroLine = (e.target as HTMLInputElement).checked;
    refreshActiveChart();
  });
  document.getElementById('inp-major-grid-color')?.addEventListener('input', (e) => {
    state.gridFrame.majorGridColor = (e.target as HTMLInputElement).value;
    refreshActiveChart();
  });
  document.getElementById('inp-minor-grid-color')?.addEventListener('input', (e) => {
    state.gridFrame.minorGridColor = (e.target as HTMLInputElement).value;
    refreshActiveChart();
  });

  // Sub-Tab 4: Global Typography, Legend & Annotations
  document.getElementById('cfg-font-family')?.addEventListener('change', (e) => {
    state.fontFamily = (e.target as HTMLSelectElement).value;
    refreshActiveChart();
  });
  document.getElementById('cfg-font-size')?.addEventListener('input', (e) => {
    state.fontSize = parseInt((e.target as HTMLInputElement).value, 10) || 11;
    refreshActiveChart();
  });
  document.getElementById('cfg-legend-pos')?.addEventListener('change', (e) => {
    state.legendPos = (e.target as HTMLSelectElement).value as any;
    updateChart();
  });

  // Single Canvas Presets & Custom Dimensions
  document.querySelectorAll('.preset-btn:not(.mp-preset-btn):not(.map-preset-btn)').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = (e.target as HTMLElement).getAttribute('data-preset') as keyof typeof PRESETS | null;
      if (p && PRESETS[p]) {
        state.preset = p;
        state.widthCm = PRESETS[p].w;
        state.heightCm = PRESETS[p].h;
        renderApp();
      }
    });
  });

  document.getElementById('inp-canvas-w')?.addEventListener('change', (e) => {
    state.widthCm = parseFloat((e.target as HTMLInputElement).value) || 17.0;
    state.preset = 'custom';
    updateChart();
  });
  document.getElementById('inp-canvas-h')?.addEventListener('change', (e) => {
    state.heightCm = parseFloat((e.target as HTMLInputElement).value) || 9.5;
    state.preset = 'custom';
    updateChart();
  });

  // Peak & Comfort Band Listeners
  document.getElementById('cfg-peak-mode')?.addEventListener('change', (e) => {
    state.peakMode = (e.target as HTMLSelectElement).value as any;
    updateChart();
  });
  document.getElementById('check-comfort')?.addEventListener('change', (e) => {
    state.comfortBand = (e.target as HTMLInputElement).checked;
    const panel = document.getElementById('comfort-panel');
    if (panel) panel.style.display = state.comfortBand ? 'block' : 'none';
    updateChart();
  });
  document.getElementById('cfg-comfort-season')?.addEventListener('change', (e) => {
    const season = (e.target as HTMLSelectElement).value;
    state.comfortSeason = season as any;
    if (season === 'winter') {
      state.comfortMin = 20.0;
      state.comfortMax = 22.0;
    } else if (season === 'summer') {
      state.comfortMin = 24.0;
      state.comfortMax = 26.0;
    }
    renderApp();
  });
  document.getElementById('comfort-min')?.addEventListener('input', (e) => {
    state.comfortMin = parseFloat((e.target as HTMLInputElement).value) || 0;
    state.comfortSeason = 'custom';
    updateChart();
  });
  document.getElementById('comfort-max')?.addEventListener('input', (e) => {
    state.comfortMax = parseFloat((e.target as HTMLInputElement).value) || 0;
    state.comfortSeason = 'custom';
    updateChart();
  });
}
