import { ensurePanelNormalized, getMultiPlotDimensions, getPanelLetter } from '../core/panels';
import { state, t } from '../core/state';
import { renderAddColumnOptions, renderColumnOptions, renderTraceCards } from './render_helpers';

export function renderSingleCanvasSubTabContent(): string {
  if (state.canvasSubTab === 'traces') {
    return `
      ${state.hasTimestamp ? `
        <section class="sidebar-section">
          <div class="sidebar-title">
            <span>${t('tf_title')}</span>
            <span class="cm-badge cm-badge-sky">Filter</span>
          </div>
          <div style="display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap;">
            <button class="timeframe-pill ${state.timeframeMode === 'all' ? 'active' : ''}" data-tf="all">Full</button>
            <button class="timeframe-pill ${state.timeframeMode === 'day' ? 'active' : ''}" data-tf="day">1 Day</button>
            <button class="timeframe-pill ${state.timeframeMode === 'week' ? 'active' : ''}" data-tf="week">1 Week</button>
            <button class="timeframe-pill ${state.timeframeMode === 'month' ? 'active' : ''}" data-tf="month">1 Month</button>
            <button class="timeframe-pill ${state.timeframeMode === 'custom' ? 'active' : ''}" data-tf="custom">Custom</button>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('tf_start')}</label>
              <input type="date" class="form-input" id="canvas-start-date" value="${state.startDate}" />
            </div>
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('tf_end')}</label>
              <input type="date" class="form-input" id="canvas-end-date" value="${state.endDate}" />
            </div>
          </div>
        </section>
      ` : ''}

      <section class="sidebar-section">
        <div class="sidebar-title">${t('x_axis_title')}</div>
        <div class="form-group" style="margin-bottom: 0;">
          <select class="form-select" id="select-x">
            <option value="">${t('x_axis_placeholder')}</option>
            ${renderColumnOptions(state.selectedX)}
          </select>
        </div>
      </section>

      <section class="sidebar-section">
        <div class="sidebar-title">
          <span>${t('traces_title')}</span>
          <span class="cm-badge cm-badge-emerald">${state.traces.length} ${t('active_badge')}</span>
        </div>
        <div style="display: flex; gap: 6px; margin-bottom: 10px;">
          <select class="form-select" id="sel-new-trace-col" style="flex: 1; font-size: 0.8rem; padding: 4px 8px;">
            ${renderAddColumnOptions()}
          </select>
          <button class="btn btn-primary" id="btn-add-trace" style="font-size: 0.78rem; padding: 4px 10px; white-space: nowrap;">
            ${t('btn_add_series')}
          </button>
        </div>
        <div id="traces-list-container">
          ${renderTraceCards()}
        </div>
      </section>
    `;
  }

  if (state.canvasSubTab === 'axes') {
    const activeAxes: ('y1' | 'y2' | 'y3' | 'y4')[] = ['y1'];
    if (state.traces.some(tr => tr.axis === 'y2')) activeAxes.push('y2');
    if (state.traces.some(tr => tr.axis === 'y3')) activeAxes.push('y3');
    if (state.traces.some(tr => tr.axis === 'y4')) activeAxes.push('y4');

    const axisLabels: Record<string, string> = {
      y1: t('axis_left_y1'),
      y2: t('axis_right_y2'),
      y3: t('axis_right_y3'),
      y4: t('axis_right_y4')
    };

    return `
      <section class="sidebar-section">
        <div class="sidebar-title">${t('axis_config_title')}</div>
        ${activeAxes.map(ax => {
          const cfg = state.axisScales[ax];
          const curTitle = ax === 'y1' ? state.y1Title : (ax === 'y2' ? state.y2Title : (ax === 'y3' ? state.y3Title : state.y4Title));
          return `
            <div class="axis-cfg-card">
              <div class="axis-cfg-header">
                <span>${axisLabels[ax]}</span>
                <span class="cm-badge cm-badge-sky">${ax.toUpperCase()}</span>
              </div>
              <div class="form-group">
                <label class="form-label">${t('axis_title_label')}</label>
                <input type="text" class="form-input inp-axis-title" data-ax="${ax}" value="${curTitle}" placeholder="e.g. Temperature [°C]" />
              </div>
              <div class="form-row">
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">${t('axis_min_label')}</label>
                  <input type="number" step="any" class="form-input inp-axis-min" data-ax="${ax}" value="${cfg.min ?? ''}" placeholder="${t('axis_auto_placeholder')}" />
                </div>
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">${t('axis_max_label')}</label>
                  <input type="number" step="any" class="form-input inp-axis-max" data-ax="${ax}" value="${cfg.max ?? ''}" placeholder="${t('axis_auto_placeholder')}" />
                </div>
                <div class="form-group" style="flex: 1.2;">
                  <label class="form-label">${t('axis_decimals_label')}</label>
                  <select class="form-select sel-axis-dec" data-ax="${ax}">
                    <option value="auto" ${cfg.decimals === 'auto' ? 'selected' : ''}>${t('dec_auto')}</option>
                    <option value="0" ${cfg.decimals === '0' ? 'selected' : ''}>${t('dec_0')}</option>
                    <option value="1" ${cfg.decimals === '1' ? 'selected' : ''}>${t('dec_1')}</option>
                    <option value="2" ${cfg.decimals === '2' ? 'selected' : ''}>${t('dec_2')}</option>
                    <option value="3" ${cfg.decimals === '3' ? 'selected' : ''}>${t('dec_3')}</option>
                  </select>
                </div>
              </div>
              <div class="form-row" style="margin-bottom: 0;">
                <div class="form-group" style="flex: 1; margin-bottom: 0;">
                  <label class="form-label">${t('major_dtick_label')}</label>
                  <input type="number" step="any" min="0" class="form-input inp-axis-major" data-ax="${ax}" value="${cfg.majorStep ?? ''}" placeholder="${t('grid_step_placeholder')}" />
                </div>
                <div class="form-group" style="flex: 1; margin-bottom: 0;">
                  <label class="form-label">${t('minor_dtick_label')}</label>
                  <input type="number" step="any" min="0" class="form-input inp-axis-minor" data-ax="${ax}" value="${cfg.minorStep ?? ''}" placeholder="${t('minor_step_placeholder')}" />
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </section>

      <section class="sidebar-section">
        <div class="sidebar-title">${t('x_decimals_title')}</div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">${t('x_custom_title')}</label>
          <input type="text" class="form-input" id="axis-x-title" value="${state.xTitle}" placeholder="${state.selectedX || 'Time'}" />
        </div>
      </section>
    `;
  }

  if (state.canvasSubTab === 'grid') {
    const gf = state.gridFrame;
    return `
      <section class="sidebar-section">
        <div class="sidebar-title">${t('frame_title')}</div>
        <div class="form-group">
          <label class="form-label">${t('frame_mode_label')}</label>
          <select class="form-select" id="cfg-frame-mode">
            <option value="open_l" ${gf.frameMode === 'open_l' ? 'selected' : ''}>${t('frame_open_l')}</option>
            <option value="box" ${gf.frameMode === 'box' ? 'selected' : ''}>${t('frame_box')}</option>
            <option value="ticks" ${gf.frameMode === 'ticks' ? 'selected' : ''}>${t('frame_ticks')}</option>
            <option value="none" ${gf.frameMode === 'none' ? 'selected' : ''}>${t('frame_none')}</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">${t('ticks_dir_label')}</label>
          <select class="form-select" id="cfg-tick-dir">
            <option value="outside" ${gf.tickDir === 'outside' ? 'selected' : ''}>${t('ticks_outside')}</option>
            <option value="inside" ${gf.tickDir === 'inside' ? 'selected' : ''}>${t('ticks_inside')}</option>
            <option value="none" ${gf.tickDir === 'none' ? 'selected' : ''}>${t('ticks_none')}</option>
          </select>
        </div>
      </section>

      <section class="sidebar-section">
        <div class="sidebar-title">${t('grid_title')}</div>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-x-grid" ${gf.showXGrid ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('show_x_grid')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-y-grid" ${gf.showYGrid ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('show_y_grid')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-minor-grid" ${gf.showMinorGrid ? 'checked' : ''} />
            <span style="font-weight: 600; color: var(--primary);">${t('show_minor_grid')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-zero-line" ${gf.showZeroLine ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('show_zeroline')}</span>
          </label>
        </div>

        <div class="form-row" style="margin-bottom: 0;">
          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label class="form-label">${t('major_grid_color')}</label>
            <input type="color" class="form-input" id="inp-major-grid-color" value="${gf.majorGridColor}" style="height: 30px; padding: 2px;" />
          </div>
          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label class="form-label">${t('minor_grid_color')}</label>
            <input type="color" class="form-input" id="inp-minor-grid-color" value="${gf.minorGridColor}" style="height: 30px; padding: 2px;" />
          </div>
        </div>
      </section>
    `;
  }

  // Sub-Tab 4: Typography, Legend & Smart Annotations
  return `
    <section class="sidebar-section">
      <div class="sidebar-title">${t('typo_title')}</div>
      <div class="form-row">
        <div class="form-group" style="flex: 2; margin-bottom: 0;">
          <label class="form-label">${t('font_family_label')}</label>
          <select class="form-select" id="cfg-font-family">
            <option value="Outfit, sans-serif" ${state.fontFamily.includes('Outfit') ? 'selected' : ''}>Outfit (Modern Scientific)</option>
            <option value="Arial, sans-serif" ${state.fontFamily.includes('Arial') ? 'selected' : ''}>Arial / Helvetica</option>
            <option value="'Times New Roman', serif" ${state.fontFamily.includes('Times') ? 'selected' : ''}>Times New Roman (Classic)</option>
            <option value="'JetBrains Mono', monospace" ${state.fontFamily.includes('JetBrains') ? 'selected' : ''}>JetBrains Mono</option>
          </select>
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
          <label class="form-label">${t('font_size_label')}</label>
          <input type="number" min="8" max="20" class="form-input" id="cfg-font-size" value="${state.fontSize}" />
        </div>
      </div>
    </section>

    <section class="sidebar-section">
      <div class="sidebar-title">${t('legend_title')}</div>
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label">${t('legend_pos_label')}</label>
        <select class="form-select" id="cfg-legend-pos">
          <option value="top" ${state.legendPos === 'top' ? 'selected' : ''}>${t('leg_top')}</option>
          <option value="right" ${state.legendPos === 'right' ? 'selected' : ''}>${t('leg_right')}</option>
          <option value="bottom" ${state.legendPos === 'bottom' ? 'selected' : ''}>${t('leg_bottom')}</option>
          <option value="inside" ${state.legendPos === 'inside' ? 'selected' : ''}>${t('leg_inside')}</option>
          <option value="none" ${state.legendPos === 'none' ? 'selected' : ''}>${t('leg_none')}</option>
        </select>
      </div>
    </section>

    <section class="sidebar-section">
      <div class="sidebar-title">${t('annot_title')}</div>
      <div class="form-group">
        <label class="form-label">${t('peak_label')}</label>
        <select class="form-select" id="cfg-peak-mode">
          <option value="none" ${state.peakMode === 'none' ? 'selected' : ''}>${t('peak_none')}</option>
          <option value="global" ${state.peakMode === 'global' ? 'selected' : ''}>${t('peak_global')}</option>
          <option value="daily" ${state.peakMode === 'daily' ? 'selected' : ''}>${t('peak_daily')}</option>
        </select>
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; margin-bottom: 6px;">
          <input type="checkbox" id="check-comfort" ${state.comfortBand ? 'checked' : ''} />
          <span style="font-weight: 600; color: #000000;">${t('comfort_toggle')}</span>
        </label>

        <div id="comfort-panel" style="display: ${state.comfortBand ? 'block' : 'none'}; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
          <div class="form-group">
            <label class="form-label">${t('comfort_season_label')}</label>
            <select class="form-select" id="cfg-comfort-season">
              <option value="winter" ${state.comfortSeason === 'winter' ? 'selected' : ''}>${t('season_winter')}</option>
              <option value="summer" ${state.comfortSeason === 'summer' ? 'selected' : ''}>${t('season_summer')}</option>
              <option value="custom" ${state.comfortSeason === 'custom' ? 'selected' : ''}>${t('season_custom')}</option>
            </select>
          </div>
          <div class="form-row" style="margin-bottom: 0;">
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('comfort_min_label')}</label>
              <input type="number" step="0.5" class="form-input" id="comfort-min" value="${state.comfortMin}" />
            </div>
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('comfort_max_label')}</label>
              <input type="number" step="0.5" class="form-input" id="comfort-max" value="${state.comfortMax}" />
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function renderMultiPlotSubTabContent(): string {
  const dims = getMultiPlotDimensions();

  if (state.mpSubTab === 'layout') {
    return `
      <section class="sidebar-section">
        <div class="sidebar-title">
          <span>${t('mp_topo_title')}</span>
          <span class="cm-badge cm-badge-sky">${dims.rows}×${dims.cols} (${dims.count})</span>
        </div>

        <div class="topo-grid">
          <button class="topo-btn ${state.mpTopology === '3x1' ? 'active' : ''}" data-topo="3x1">
            <span>☰ Stack 3×1</span>
            <span style="font-size: 0.68rem; opacity: 0.8;">(a)-(c)</span>
          </button>
          <button class="topo-btn ${state.mpTopology === '2x1' ? 'active' : ''}" data-topo="2x1">
            <span>≣ Stack 2×1</span>
            <span style="font-size: 0.68rem; opacity: 0.8;">(a)-(b)</span>
          </button>
          <button class="topo-btn ${state.mpTopology === '2x2' ? 'active' : ''}" data-topo="2x2">
            <span>▦ Grid 2×2</span>
            <span style="font-size: 0.68rem; opacity: 0.8;">4 Cells</span>
          </button>
          <button class="topo-btn ${state.mpTopology === '1x2' ? 'active' : ''}" data-topo="1x2">
            <span>◫ Side 1×2</span>
            <span style="font-size: 0.68rem; opacity: 0.8;">2 Cells</span>
          </button>
        </div>

        <button class="topo-btn ${state.mpTopology === 'custom' ? 'active' : ''}" data-topo="custom" style="width: 100%; margin-bottom: 10px;">
          <span>⊞ ${t('mp_custom_rc')} (1×1 ... 5×5)</span>
          <span class="cm-badge cm-badge-emerald">${state.mpCustomRows}×${state.mpCustomCols}</span>
        </button>

        ${state.mpTopology === 'custom' ? `
          <div class="form-row" style="background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 10px;">
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('mp_rows_label')} [1-5]</label>
              <input type="number" min="1" max="5" class="form-input" id="mp-custom-rows" value="${state.mpCustomRows}" />
            </div>
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('mp_cols_label')} [1-5]</label>
              <input type="number" min="1" max="5" class="form-input" id="mp-custom-cols" value="${state.mpCustomCols}" />
            </div>
          </div>
        ` : ''}

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="mp-share-x" ${state.mpShareX ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('mp_share_x')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="mp-share-y" ${state.mpShareY ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('mp_share_y')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="mp-lettering" ${state.mpAutoLettering ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('mp_lettering')}</span>
          </label>
        </div>

        <div class="form-group" style="margin-top: 10px; margin-bottom: 0;">
          <label class="form-label">${t('mp_letter_pos_label')}</label>
          <select class="form-select" id="mp-letter-pos">
            <option value="outside_top" ${state.mpLetterPos === 'outside_top' ? 'selected' : ''}>${t('mp_pos_outside_top')}</option>
            <option value="outside_side" ${state.mpLetterPos === 'outside_side' ? 'selected' : ''}>${t('mp_pos_outside_side')}</option>
            <option value="inside" ${state.mpLetterPos === 'inside' ? 'selected' : ''}>${t('mp_pos_inside')}</option>
          </select>
        </div>
      </section>
    `;
  }

  if (state.mpSubTab === 'panels') {
    const pIdx = state.mpActivePanelIdx;
    const panel = ensurePanelNormalized(pIdx);
    const letter = getPanelLetter(pIdx);
    const project = state.activeProject ? state.projectsStore[state.activeProject] : null;
    const savedCanvases = Object.keys(project?.canvases || {});

    return `
      <section class="sidebar-section">
        <div class="sidebar-title">
          <span>${t('mp_select_panel_label')}</span>
          <span class="cm-badge cm-badge-emerald">${letter}</span>
        </div>

        <!-- Cell Selector Pills (a), (b), (c)... -->
        <div class="mp-cell-selector">
          ${Array.from({ length: dims.count }, (_, i) => `
            <button class="mp-cell-pill ${i === pIdx ? 'active' : ''}" data-mpcell="${i}">
              ${getPanelLetter(i)}
            </button>
          `).join('')}
        </div>

        ${savedCanvases.length > 0 ? `
          <div class="form-group">
            <label class="form-label">${t('mp_import_canvas_label')}</label>
            <select class="form-select" id="mp-import-canvas">
              <option value="">${t('mp_import_placeholder')}</option>
              ${savedCanvases.map(c => `<option value="${c}">📊 ${c}</option>`).join('')}
            </select>
          </div>
        ` : ''}

        <!-- Active Panel Titles & Scale -->
        <div class="axis-cfg-card">
          <div class="form-row">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">${t('mp_panel_title_label')}</label>
              <input type="text" class="form-input" id="mp-active-y1-title" value="${panel.yTitle || ''}" placeholder="Y1 Title" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label">${t('mp_panel_y2_title_label')}</label>
              <input type="text" class="form-input" id="mp-active-y2-title" value="${panel.y2Title || ''}" placeholder="Optional Y2" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">${t('axis_min_label')}</label>
              <input type="number" step="any" class="form-input" id="mp-active-min" value="${panel.y1Min ?? ''}" placeholder="Auto" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label">${t('axis_max_label')}</label>
              <input type="number" step="any" class="form-input" id="mp-active-max" value="${panel.y1Max ?? ''}" placeholder="Auto" />
            </div>
            <div class="form-group" style="flex: 1.1;">
              <label class="form-label">${t('axis_decimals_label')}</label>
              <select class="form-select" id="mp-active-dec">
                <option value="auto" ${(panel.y1Decimals || 'auto') === 'auto' ? 'selected' : ''}>Auto</option>
                <option value="0" ${panel.y1Decimals === '0' ? 'selected' : ''}>0 (Int)</option>
                <option value="1" ${panel.y1Decimals === '1' ? 'selected' : ''}>1 (0.0)</option>
                <option value="2" ${panel.y1Decimals === '2' ? 'selected' : ''}>2 (0.00)</option>
                <option value="3" ${panel.y1Decimals === '3' ? 'selected' : ''}>3 (0.000)</option>
              </select>
            </div>
          </div>

          <div class="form-row" style="margin-bottom: 6px;">
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('major_dtick_label')}</label>
              <input type="number" step="any" min="0" class="form-input" id="mp-active-major" value="${panel.y1MajorStep ?? ''}" placeholder="Auto" />
            </div>
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label class="form-label">${t('minor_dtick_label')}</label>
              <input type="number" step="any" min="0" class="form-input" id="mp-active-minor" value="${panel.y1MinorStep ?? ''}" placeholder="Auto" />
            </div>
          </div>

          <button class="btn btn-secondary" id="btn-mp-sync-all-scales" style="width: 100%; font-size: 0.72rem; padding: 4px;">
            ⚡ ${t('mp_apply_all_scales')}
          </button>
        </div>

        <!-- Full Multi-Trace Manager for the Selected Panel -->
        <div class="sidebar-title" style="margin-top: 8px;">
          <span>${letter} — ${t('traces_title')}</span>
          <span class="cm-badge cm-badge-emerald">${panel.traces.length}</span>
        </div>

        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
          <select class="form-select" id="sel-mp-new-trace-col" style="flex: 1; font-size: 0.78rem; padding: 4px 8px;">
            ${renderColumnOptions('')}
          </select>
          <button class="btn btn-primary" id="btn-mp-add-trace" style="font-size: 0.75rem; padding: 4px 10px; white-space: nowrap;">
            ${t('btn_add_series')}
          </button>
        </div>

        <div>
          ${panel.traces.map((tr, tIdx) => `
            <div class="trace-card" data-mptidx="${tIdx}">
              <div class="trace-header">
                <div style="display: flex; align-items: center; gap: 6px; flex: 1; margin-right: 6px;">
                  <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">Y:</span>
                  <select class="trace-select sel-mptrace-col" data-mptidx="${tIdx}" style="font-weight: 600; flex: 1;">
                    <option value="">-- Select --</option>
                    ${renderColumnOptions(tr.column)}
                  </select>
                </div>
                <button class="btn btn-secondary btn-del-mptrace" data-mptidx="${tIdx}" style="padding: 2px 6px; font-size: 0.68rem; color: var(--rose);">✕</button>
              </div>
              <div class="trace-controls">
                <select class="trace-select sel-mptrace-axis" data-mptidx="${tIdx}">
                  <option value="y1" ${tr.axis === 'y1' ? 'selected' : ''}>Y1 (L)</option>
                  <option value="y2" ${tr.axis === 'y2' ? 'selected' : ''}>Y2 (R)</option>
                </select>
                <select class="trace-select sel-mptrace-type" data-mptidx="${tIdx}">
                  <option value="line" ${tr.chartType === 'line' ? 'selected' : ''}>${t('type_line')}</option>
                  <option value="scatter" ${tr.chartType === 'scatter' ? 'selected' : ''}>${t('type_scatter')}</option>
                  <option value="bar" ${tr.chartType === 'bar' ? 'selected' : ''}>${t('type_bar')}</option>
                  <option value="area" ${tr.chartType === 'area' ? 'selected' : ''}>${t('type_area')}</option>
                </select>
                <select class="trace-select sel-mptrace-dash" data-mptidx="${tIdx}">
                  <option value="solid" ${tr.lineDash === 'solid' ? 'selected' : ''}>—</option>
                  <option value="dash" ${tr.lineDash === 'dash' ? 'selected' : ''}>--</option>
                  <option value="dot" ${tr.lineDash === 'dot' ? 'selected' : ''}>··</option>
                </select>
                <input type="color" class="trace-color-input inp-mptrace-color" data-mptidx="${tIdx}" value="${tr.color}" />
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  if (state.mpSubTab === 'axes') {
    const gf = state.gridFrame;
    return `
      <section class="sidebar-section">
        <div class="sidebar-title">${t('frame_title')}</div>
        <div class="form-group">
          <label class="form-label">${t('frame_mode_label')}</label>
          <select class="form-select" id="cfg-frame-mode">
            <option value="open_l" ${gf.frameMode === 'open_l' ? 'selected' : ''}>${t('frame_open_l')}</option>
            <option value="box" ${gf.frameMode === 'box' ? 'selected' : ''}>${t('frame_box')}</option>
            <option value="ticks" ${gf.frameMode === 'ticks' ? 'selected' : ''}>${t('frame_ticks')}</option>
            <option value="none" ${gf.frameMode === 'none' ? 'selected' : ''}>${t('frame_none')}</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">${t('ticks_dir_label')}</label>
          <select class="form-select" id="cfg-tick-dir">
            <option value="outside" ${gf.tickDir === 'outside' ? 'selected' : ''}>${t('ticks_outside')}</option>
            <option value="inside" ${gf.tickDir === 'inside' ? 'selected' : ''}>${t('ticks_inside')}</option>
            <option value="none" ${gf.tickDir === 'none' ? 'selected' : ''}>${t('ticks_none')}</option>
          </select>
        </div>
      </section>

      <section class="sidebar-section">
        <div class="sidebar-title">${t('grid_title')}</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-x-grid" ${gf.showXGrid ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('show_x_grid')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-y-grid" ${gf.showYGrid ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('show_y_grid')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-minor-grid" ${gf.showMinorGrid ? 'checked' : ''} />
            <span style="font-weight: 600; color: var(--primary);">${t('show_minor_grid')}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="chk-zero-line" ${gf.showZeroLine ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('show_zeroline')}</span>
          </label>
        </div>
      </section>
    `;
  }

  // MultiPlot Sub-Tab 4: Legend Mode, Outer Macro-Axes & Global Typography
  return `
    <section class="sidebar-section">
      <div class="sidebar-title">${t('mp_legend_mode_label')}</div>
      <div class="form-group" style="margin-bottom: 0;">
        <select class="form-select" id="mp-legend-mode">
          <option value="per_panel" ${state.mpLegendMode === 'per_panel' ? 'selected' : ''}>${t('mp_leg_per_panel')}</option>
          <option value="global_top" ${state.mpLegendMode === 'global_top' ? 'selected' : ''}>${t('mp_leg_global_top')}</option>
          <option value="global_bottom" ${state.mpLegendMode === 'global_bottom' ? 'selected' : ''}>${t('mp_leg_global_bottom')}</option>
          <option value="none" ${state.mpLegendMode === 'none' ? 'selected' : ''}>${t('mp_leg_none')}</option>
        </select>
      </div>
    </section>

    <section class="sidebar-section">
      <div class="sidebar-title">${t('mp_macro_title')}</div>
      <div class="form-group">
        <label class="form-label">${t('mp_macro_x_label')}</label>
        <input type="text" class="form-input" id="mp-macro-x" value="${state.mpMacroX}" placeholder="${t('mp_macro_x_placeholder')}" />
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label">${t('mp_macro_y_label')}</label>
        <input type="text" class="form-input" id="mp-macro-y" value="${state.mpMacroY}" placeholder="${t('mp_macro_y_placeholder')}" />
      </div>
    </section>

    <section class="sidebar-section">
      <div class="sidebar-title">${t('typo_title')}</div>
      <div class="form-row">
        <div class="form-group" style="flex: 2; margin-bottom: 0;">
          <label class="form-label">${t('font_family_label')}</label>
          <select class="form-select" id="cfg-font-family">
            <option value="Outfit, sans-serif" ${state.fontFamily.includes('Outfit') ? 'selected' : ''}>Outfit (Modern Scientific)</option>
            <option value="Arial, sans-serif" ${state.fontFamily.includes('Arial') ? 'selected' : ''}>Arial / Helvetica</option>
            <option value="'Times New Roman', serif" ${state.fontFamily.includes('Times') ? 'selected' : ''}>Times New Roman (Classic)</option>
            <option value="'JetBrains Mono', monospace" ${state.fontFamily.includes('JetBrains') ? 'selected' : ''}>JetBrains Mono</option>
          </select>
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
          <label class="form-label">${t('font_size_label')}</label>
          <input type="number" min="8" max="20" class="form-input" id="cfg-font-size" value="${state.fontSize}" />
        </div>
      </div>
    </section>
  `;
}
