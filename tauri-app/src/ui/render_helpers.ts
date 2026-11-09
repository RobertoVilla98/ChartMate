import { cellText, rowCount } from '../data/table';
import { state, t } from '../core/state';

export function renderColumnOptions(selected: string): string {
  if (!state.dataset) return '';
  return state.dataset.columns
    .map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`)
    .join('');
}

export function renderAddColumnOptions(): string {
  if (!state.dataset || state.dataset.columns.length === 0) {
    return `<option value="">-- Load Dataset --</option>`;
  }
  const available = state.dataset.columns.filter(c => c !== state.selectedX && !state.traces.some(tr => tr.column === c));
  const defaultCol = available.length > 0 ? available[0] : (state.dataset.columns[1] || state.dataset.columns[0]);

  return state.dataset.columns
    .map(c => `<option value="${c}" ${c === defaultCol ? 'selected' : ''}>${c}</option>`)
    .join('');
}

export function renderCanvasSelectOptions(): string {
  const project = state.activeProject ? state.projectsStore[state.activeProject] : null;
  const canvases = project?.canvases || {};
  const keys = Object.keys(canvases);
  if (keys.length === 0) {
    const current = state.activeCanvas || 'Canvas_1';
    return `<option value="${current}" selected>📊 ${current}</option>`;
  }
  return keys.map(k => `<option value="${k}" ${k === state.activeCanvas ? 'selected' : ''}>📊 ${k}</option>`).join('');
}

export function renderMultiPlotSelectOptions(): string {
  const project = state.activeProject ? state.projectsStore[state.activeProject] : null;
  const mps = project?.multiplots || {};
  const keys = Object.keys(mps);
  if (keys.length === 0) {
    const current = state.activeMultiPlot || 'MultiPlot_1';
    return `<option value="${current}" selected>▦ ${current}</option>`;
  }
  return keys.map(k => `<option value="${k}" ${k === state.activeMultiPlot ? 'selected' : ''}>▦ ${k}</option>`).join('');
}

export function renderMapSelectOptions(): string {
  const project = state.activeProject ? state.projectsStore[state.activeProject] : null;
  const maps = project?.maps || {};
  const keys = Object.keys(maps);
  if (keys.length === 0) {
    const current = state.activeMap || 'Map_1';
    return `<option value="${current}" selected>🗺️ ${current}</option>`;
  }
  return keys.map(k => `<option value="${k}" ${k === state.activeMap ? 'selected' : ''}>🗺️ ${k}</option>`).join('');
}

export function renderTraceCards(): string {
  if (state.traces.length === 0) {
    return `<div style="font-size: 0.78rem; color: var(--text-muted); text-align: center; padding: 14px; border: 1px dashed var(--border); border-radius: 6px;">
      ${t('no_traces_msg')}
    </div>`;
  }

  return state.traces.map((trace, idx) => `
    <div class="trace-card" data-idx="${idx}">
      <div class="trace-header">
        <div style="display: flex; align-items: center; gap: 6px; flex: 1; margin-right: 8px;">
          <span style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted);">Y:</span>
          <select class="trace-select sel-trace-column" data-idx="${idx}" style="font-weight: 600; flex: 1; font-size: 0.82rem; padding: 3px 6px;">
            ${renderColumnOptions(trace.column)}
          </select>
        </div>
        <button class="btn btn-secondary btn-del-trace" data-idx="${idx}" style="padding: 2px 7px; font-size: 0.7rem; color: var(--rose);">
          ✕
        </button>
      </div>
      
      <div class="trace-controls">
        <select class="trace-select sel-trace-axis" data-idx="${idx}">
          <option value="y1" ${trace.axis === 'y1' ? 'selected' : ''}>${t('axis_left_y1')}</option>
          <option value="y2" ${trace.axis === 'y2' ? 'selected' : ''}>${t('axis_right_y2')}</option>
          <option value="y3" ${trace.axis === 'y3' ? 'selected' : ''}>${t('axis_right_y3')}</option>
          <option value="y4" ${trace.axis === 'y4' ? 'selected' : ''}>${t('axis_right_y4')}</option>
        </select>

        <select class="trace-select sel-trace-type" data-idx="${idx}">
          <option value="line" ${trace.chartType === 'line' ? 'selected' : ''}>${t('type_line')}</option>
          <option value="scatter" ${trace.chartType === 'scatter' ? 'selected' : ''}>${t('type_scatter')}</option>
          <option value="bar" ${trace.chartType === 'bar' ? 'selected' : ''}>${t('type_bar')}</option>
          <option value="area" ${trace.chartType === 'area' ? 'selected' : ''}>${t('type_area')}</option>
        </select>

        <select class="trace-select sel-trace-dash" data-idx="${idx}">
          <option value="solid" ${trace.lineDash === 'solid' ? 'selected' : ''}>${t('dash_solid')}</option>
          <option value="dash" ${trace.lineDash === 'dash' ? 'selected' : ''}>${t('dash_dash')}</option>
          <option value="dot" ${trace.lineDash === 'dot' ? 'selected' : ''}>${t('dash_dot')}</option>
        </select>

        <input type="color" class="trace-color-input inp-trace-color" data-idx="${idx}" value="${trace.color}" />
      </div>
    </div>
  `).join('');
}

export function renderPreviewTable(): string {
  if (!state.dataset || state.dataset.columns.length === 0) {
    return `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 8px;">📊</div>
        <div style="font-weight: 600;">${t('no_dataset_title')}</div>
        <div style="font-size: 0.8rem; margin-top: 4px;">${t('no_dataset_sub')}</div>
      </div>
    `;
  }

  const thead = `<tr>${state.dataset.columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
  const ds = state.dataset;
  const nShow = Math.min(50, rowCount(ds));
  const tbody = Array.from({ length: nShow }, (_, i) =>
    `<tr>${ds.columns.map((_, j) => `<td>${cellText(ds, i, j)}</td>`).join('')}</tr>`
  ).join('');

  return `<table class="cm-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}
