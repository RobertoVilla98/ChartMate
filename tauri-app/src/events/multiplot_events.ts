import { updateMultiPlotChart } from '../charts/multiplot';
import { ensurePanelNormalized, getMultiPlotDimensions, getPanelLetter } from '../core/panels';
import { DEFAULT_PALETTE, MP_PRESETS, state } from '../core/state';
import { persistProjectsStore, saveMultiPlot } from '../data/persistence';
import { renderApp } from '../ui/render_app';

export function attachMultiPlotEvents() {
  // MultiPlot Studio Listeners
  document.querySelectorAll('.topo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const topo = (e.currentTarget as HTMLElement).getAttribute('data-topo') as any;
      if (topo) {
        state.mpTopology = topo;
        renderApp();
      }
    });
  });

  document.getElementById('mp-custom-rows')?.addEventListener('change', (e) => {
    state.mpCustomRows = Math.max(1, Math.min(5, parseInt((e.target as HTMLInputElement).value, 10) || 2));
    renderApp();
  });
  document.getElementById('mp-custom-cols')?.addEventListener('change', (e) => {
    state.mpCustomCols = Math.max(1, Math.min(5, parseInt((e.target as HTMLInputElement).value, 10) || 2));
    renderApp();
  });

  document.getElementById('mp-share-x')?.addEventListener('change', (e) => {
    state.mpShareX = (e.target as HTMLInputElement).checked;
    updateMultiPlotChart();
  });
  document.getElementById('mp-share-y')?.addEventListener('change', (e) => {
    state.mpShareY = (e.target as HTMLInputElement).checked;
    updateMultiPlotChart();
  });
  document.getElementById('mp-lettering')?.addEventListener('change', (e) => {
    state.mpAutoLettering = (e.target as HTMLInputElement).checked;
    updateMultiPlotChart();
  });
  document.getElementById('mp-letter-pos')?.addEventListener('change', (e) => {
    state.mpLetterPos = (e.target as HTMLSelectElement).value as any;
    updateMultiPlotChart();
  });
  document.getElementById('mp-legend-mode')?.addEventListener('change', (e) => {
    state.mpLegendMode = (e.target as HTMLSelectElement).value as any;
    updateMultiPlotChart();
  });
  document.getElementById('mp-macro-x')?.addEventListener('input', (e) => {
    state.mpMacroX = (e.target as HTMLInputElement).value;
    updateMultiPlotChart();
  });
  document.getElementById('mp-macro-y')?.addEventListener('input', (e) => {
    state.mpMacroY = (e.target as HTMLInputElement).value;
    updateMultiPlotChart();
  });

  // MultiPlot Active Cell Selector Pills
  document.querySelectorAll('[data-mpcell]').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-mpcell') || '0', 10);
      state.mpActivePanelIdx = idx;
      renderApp();
    });
  });

  // MultiPlot Import Full Canvas into Active Panel
  document.getElementById('mp-import-canvas')?.addEventListener('change', (e) => {
    const canvasName = (e.target as HTMLSelectElement).value;
    const proj = state.activeProject ? state.projectsStore[state.activeProject] : null;
    const cfg = proj?.canvases?.[canvasName];
    if (cfg) {
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      p.traces = JSON.parse(JSON.stringify(cfg.traces || []));
      p.yTitle = cfg.y1_title || p.traces[0]?.column || `Panel ${getPanelLetter(state.mpActivePanelIdx)}`;
      p.y2Title = cfg.y2_title || '';
      if (cfg.axis_scales?.y1) {
        p.y1Min = cfg.axis_scales.y1.min;
        p.y1Max = cfg.axis_scales.y1.max;
        p.y1Decimals = cfg.axis_scales.y1.decimals || 'auto';
        p.y1MajorStep = cfg.axis_scales.y1.majorStep;
        p.y1MinorStep = cfg.axis_scales.y1.minorStep;
      }
      renderApp();
    }
  });

  // Active Panel Title, Range, Decimals & Grid Step
  document.getElementById('mp-active-y1-title')?.addEventListener('input', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    p.yTitle = (e.target as HTMLInputElement).value;
    updateMultiPlotChart();
  });
  document.getElementById('mp-active-y2-title')?.addEventListener('input', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    p.y2Title = (e.target as HTMLInputElement).value;
    updateMultiPlotChart();
  });
  document.getElementById('mp-active-min')?.addEventListener('input', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    const raw = (e.target as HTMLInputElement).value.trim();
    p.y1Min = raw === '' ? null : parseFloat(raw);
    updateMultiPlotChart();
  });
  document.getElementById('mp-active-max')?.addEventListener('input', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    const raw = (e.target as HTMLInputElement).value.trim();
    p.y1Max = raw === '' ? null : parseFloat(raw);
    updateMultiPlotChart();
  });
  document.getElementById('mp-active-dec')?.addEventListener('change', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    p.y1Decimals = (e.target as HTMLSelectElement).value as any;
    updateMultiPlotChart();
  });
  document.getElementById('mp-active-major')?.addEventListener('input', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    const raw = (e.target as HTMLInputElement).value.trim();
    const num = parseFloat(raw);
    p.y1MajorStep = (!isNaN(num) && num > 0) ? num : null;
    updateMultiPlotChart();
  });
  document.getElementById('mp-active-minor')?.addEventListener('input', (e) => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    const raw = (e.target as HTMLInputElement).value.trim();
    const num = parseFloat(raw);
    p.y1MinorStep = (!isNaN(num) && num > 0) ? num : null;
    if (p.y1MinorStep) state.gridFrame.showMinorGrid = true;
    updateMultiPlotChart();
  });

  document.getElementById('btn-mp-sync-all-scales')?.addEventListener('click', () => {
    const src = ensurePanelNormalized(state.mpActivePanelIdx);
    const dims = getMultiPlotDimensions();
    for (let i = 0; i < dims.count; i++) {
      const dst = ensurePanelNormalized(i);
      dst.y1Min = src.y1Min;
      dst.y1Max = src.y1Max;
      dst.y1Decimals = src.y1Decimals;
      dst.y1MajorStep = src.y1MajorStep;
      dst.y1MinorStep = src.y1MinorStep;
    }
    updateMultiPlotChart();
  });

  // Active Panel Multi-Trace Controls
  document.getElementById('btn-mp-add-trace')?.addEventListener('click', () => {
    const p = ensurePanelNormalized(state.mpActivePanelIdx);
    const selEl = document.getElementById('sel-mp-new-trace-col') as HTMLSelectElement | null;
    const col = selEl?.value || state.dataset?.columns[1] || state.dataset?.columns[0] || '';
    const nextColor = DEFAULT_PALETTE[p.traces.length % DEFAULT_PALETTE.length];
    p.traces.push({
      column: col,
      axis: p.traces.length === 0 ? 'y1' : 'y2',
      chartType: 'line',
      color: nextColor,
      lineWidth: 1.9,
      lineDash: p.traces.length === 0 ? 'solid' : 'dash'
    });
    if (p.traces.length === 1 && (!p.yTitle || p.yTitle.startsWith('Panel'))) {
      p.yTitle = col;
    }
    renderApp();
  });

  document.querySelectorAll('.sel-mptrace-col').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const tIdx = parseInt((e.target as HTMLElement).getAttribute('data-mptidx') || '0', 10);
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      if (p.traces[tIdx]) {
        p.traces[tIdx].column = (e.target as HTMLSelectElement).value;
        if (tIdx === 0 && (!p.yTitle || p.yTitle.startsWith('Panel'))) {
          p.yTitle = p.traces[tIdx].column;
        }
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-del-mptrace').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tIdx = parseInt((e.target as HTMLElement).getAttribute('data-mptidx') || '0', 10);
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      p.traces.splice(tIdx, 1);
      renderApp();
    });
  });

  document.querySelectorAll('.sel-mptrace-axis').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const tIdx = parseInt((e.target as HTMLElement).getAttribute('data-mptidx') || '0', 10);
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      if (p.traces[tIdx]) {
        p.traces[tIdx].axis = (e.target as HTMLSelectElement).value as any;
        updateMultiPlotChart();
      }
    });
  });

  document.querySelectorAll('.sel-mptrace-type').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const tIdx = parseInt((e.target as HTMLElement).getAttribute('data-mptidx') || '0', 10);
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      if (p.traces[tIdx]) {
        p.traces[tIdx].chartType = (e.target as HTMLSelectElement).value as any;
        updateMultiPlotChart();
      }
    });
  });

  document.querySelectorAll('.sel-mptrace-dash').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const tIdx = parseInt((e.target as HTMLElement).getAttribute('data-mptidx') || '0', 10);
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      if (p.traces[tIdx]) {
        p.traces[tIdx].lineDash = (e.target as HTMLSelectElement).value as any;
        updateMultiPlotChart();
      }
    });
  });

  document.querySelectorAll('.inp-mptrace-color').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const tIdx = parseInt((e.target as HTMLElement).getAttribute('data-mptidx') || '0', 10);
      const p = ensurePanelNormalized(state.mpActivePanelIdx);
      if (p.traces[tIdx]) {
        p.traces[tIdx].color = (e.target as HTMLInputElement).value;
        updateMultiPlotChart();
      }
    });
  });

  // MultiPlot Presets & Custom Dimensions
  document.querySelectorAll('.mp-preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = (e.target as HTMLElement).getAttribute('data-mppreset') as keyof typeof MP_PRESETS | null;
      if (p && MP_PRESETS[p]) {
        state.mpPreset = p;
        state.mpWidthCm = MP_PRESETS[p].w;
        state.mpHeightCm = MP_PRESETS[p].h;
        renderApp();
      }
    });
  });

  document.getElementById('inp-mp-w')?.addEventListener('change', (e) => {
    state.mpWidthCm = parseFloat((e.target as HTMLInputElement).value) || 17.0;
    state.mpPreset = 'custom';
    updateMultiPlotChart();
  });
  document.getElementById('inp-mp-h')?.addEventListener('change', (e) => {
    state.mpHeightCm = parseFloat((e.target as HTMLInputElement).value) || 13.5;
    state.mpPreset = 'custom';
    updateMultiPlotChart();
  });

  // MultiPlot Save/Load
  document.getElementById('sel-multiplot')?.addEventListener('change', async (e) => {
    const mpName = (e.target as HTMLSelectElement).value;
    if (mpName && state.activeProject && state.projectsStore[state.activeProject]?.multiplots?.[mpName]) {
      const cfg = state.projectsStore[state.activeProject].multiplots![mpName];
      state.activeMultiPlot = cfg.name;
      state.mpTopology = cfg.topology;
      state.mpCustomRows = cfg.custom_rows || 2;
      state.mpCustomCols = cfg.custom_cols || 2;
      state.mpShareX = cfg.share_x;
      state.mpShareY = !!cfg.share_y;
      state.mpAutoLettering = cfg.auto_lettering;
      state.mpLetterPos = cfg.letter_pos || 'outside_top';
      state.mpLegendMode = cfg.legend_mode || 'per_panel';
      state.mpMacroX = cfg.macro_x_label || '';
      state.mpMacroY = cfg.macro_y_label || '';
      if (cfg.grid_frame) state.gridFrame = { ...cfg.grid_frame };
      state.mpPreset = cfg.preset as any;
      state.mpWidthCm = cfg.width_cm;
      state.mpHeightCm = cfg.height_cm;
      state.mpPanels = JSON.parse(JSON.stringify(cfg.panels));
      renderApp();
    }
  });

  document.getElementById('btn-save-multiplot')?.addEventListener('click', async () => {
    await saveMultiPlot(state.activeMultiPlot || 'MultiPlot_1');
  });

  document.getElementById('btn-new-multiplot')?.addEventListener('click', async () => {
    const newName = prompt('Enter new MultiPlot name:', `MultiPlot_${Date.now().toString().slice(-3)}`);
    if (newName && newName.trim()) {
      state.activeMultiPlot = newName.trim();
      await saveMultiPlot(newName.trim());
    }
  });

  document.getElementById('btn-delete-multiplot')?.addEventListener('click', async () => {
    if (!state.activeProject || !state.projectsStore[state.activeProject]?.multiplots) return;
    delete state.projectsStore[state.activeProject].multiplots![state.activeMultiPlot];
    await persistProjectsStore();
    renderApp();
  });
}
