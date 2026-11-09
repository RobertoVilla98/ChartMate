import { rowCount } from '../data/table';
import { updateMapChart } from '../charts/map';
import { updateMultiPlotChart } from '../charts/multiplot';
import { updateEditorialSuite, updatePhysicsChart } from '../charts/physics';
import { updateChart } from '../charts/single_canvas';
import { getMultiPlotDimensions } from '../core/panels';
import { state, t } from '../core/state';
import { attachEventListeners } from '../events/index';
import { renderCanvasSelectOptions, renderColumnOptions, renderMapSelectOptions, renderMultiPlotSelectOptions, renderPreviewTable } from './render_helpers';
import { renderEditorialView, renderPhysicsKpiBar, renderPhysicsSidebarContent } from './render_physics';
import { renderMultiPlotSubTabContent, renderSingleCanvasSubTabContent } from './render_sidebars';

export const appContainer = document.querySelector<HTMLDivElement>('#app')!;

export function renderApp() {
  const mpDims = getMultiPlotDimensions();
  if (state.mpActivePanelIdx >= mpDims.count) {
    state.mpActivePanelIdx = 0;
  }

  appContainer.innerHTML = `
    <!-- Top Navigation Bar -->
    <header class="cm-navbar">
      <div class="brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 3V21H21" stroke="#000000" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M7 16L12 11L15 14L20 7" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="20" cy="7" r="2.5" fill="#0284c7"/>
        </svg>
        <span>CHARTMATE</span>
        <span class="brand-badge">DESKTOP STUDIO</span>
      </div>
      <nav class="nav-tabs">
        <button class="nav-btn ${state.currentTab === 'data' ? 'active' : ''}" id="tab-nav-data">${t('nav_tab1')}</button>
        <button class="nav-btn ${state.currentTab === 'canvas' ? 'active' : ''}" id="tab-nav-canvas">${t('nav_tab2')}</button>
        <button class="nav-btn ${state.currentTab === 'multi' ? 'active' : ''}" id="tab-nav-multi">${t('nav_tab3')}</button>
        <button class="nav-btn ${state.currentTab === 'maps' ? 'active' : ''}" id="tab-nav-maps">${t('nav_tab4')}</button>
        <button class="nav-btn ${state.currentTab === 'physics' ? 'active' : ''}" id="tab-nav-physics">${t('nav_tab5')}</button>
        <button class="nav-btn ${state.currentTab === 'editorial' ? 'active' : ''}" id="tab-nav-editorial">${t('nav_tab6')}</button>
      </nav>
      <div style="display: flex; align-items: center;">
        <!-- Language Toggle (EN Default | IT) -->
        <div class="lang-switch" title="Switch Interface Language (English / Italiano)">
          <button class="lang-btn ${state.lang === 'en' ? 'active' : ''}" id="btn-lang-en">EN</button>
          <button class="lang-btn ${state.lang === 'it' ? 'active' : ''}" id="btn-lang-it">IT</button>
        </div>
        <button class="btn btn-primary" id="btn-export">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          ${state.currentTab === 'maps' ? t('btn_export_png') : t('btn_export_svg')}
        </button>
        ${state.currentTab !== 'maps' && state.currentTab !== 'data' ? `
        <button class="btn btn-primary" id="btn-export-pdf" style="margin-left: 6px;" title="Vector PDF, standard fonts, exact physical size">
          PDF
        </button>
        <button class="btn btn-primary" id="btn-export-png" style="margin-left: 6px;" title="${t('btn_export_png_dpi')}">
          PNG
        </button>
        <select id="sel-export-dpi" class="form-select" style="margin-left: 4px; width: auto;" title="${t('btn_export_png_dpi')}">
          <option value="300" ${state.exportDpi === 300 ? 'selected' : ''}>300 dpi</option>
          <option value="600" ${state.exportDpi === 600 ? 'selected' : ''}>600 dpi</option>
        </select>` : ''}
      </div>
    </header>

    <div class="main-container">
      <!-- VIEW 1: DATA INGESTION -->
      <div class="view-panel ${state.currentTab === 'data' ? 'active' : ''}" id="view-data">
        <aside class="sidebar">
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 2px solid var(--border);">
            <div class="sidebar-title">
              <span>${t('proj_title')}</span>
              ${state.activeProject ? `
                <span class="cm-badge cm-badge-emerald">${t('proj_active')}: ${state.activeProject}</span>
              ` : `
                <span class="cm-badge cm-badge-sky">${t('proj_new_badge')}</span>
              `}
            </div>

            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.74rem;">${t('proj_load_label')}</label>
              <select class="form-select" id="sel-load-project" style="font-size: 0.8rem;">
                <option value="">${t('proj_select_placeholder')}</option>
                ${Object.keys(state.projectsStore).map(p => `
                  <option value="${p}" ${p === state.activeProject ? 'selected' : ''}>
                    📁 ${p} (${Object.keys(state.projectsStore[p].canvases || {}).length} ${t('proj_charts_count')})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.74rem;">${t('proj_name_label')}</label>
              <input type="text" class="form-input" id="inp-project-name" value="${state.activeProject}" placeholder="${t('proj_name_placeholder')}" style="font-size: 0.82rem;" />
            </div>

            <div style="display: flex; gap: 6px;">
              <button class="btn btn-primary" id="btn-save-project" style="flex: 1; font-size: 0.76rem; padding: 5px 8px;">
                ${t('btn_save_proj')}
              </button>
              ${state.activeProject ? `
                <button class="btn btn-secondary" id="btn-new-project" style="font-size: 0.76rem; padding: 5px 8px;">
                  ${t('btn_new_proj')}
                </button>
                <button class="btn btn-secondary" id="btn-delete-project" style="font-size: 0.76rem; padding: 5px 8px; color: var(--rose);">
                  ${t('btn_del_proj')}
                </button>
              ` : ''}
            </div>
          </section>

          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>${t('src_title')}</span>
              <span class="cm-badge cm-badge-emerald">${state.sourceType === 'sql' ? 'MySQL DB' : 'Direct I/O'}</span>
            </div>

            <div class="source-toggle-group">
              <button class="source-toggle-btn ${state.sourceType === 'file' ? 'active' : ''}" id="btn-src-file">
                ${t('src_file_btn')}
              </button>
              <button class="source-toggle-btn ${state.sourceType === 'sql' ? 'active' : ''}" id="btn-src-sql">
                ${t('src_sql_btn')}
              </button>
            </div>

            ${state.sourceType === 'file' ? `
              <div class="dropzone" id="dropzone-data">
                <div class="dropzone-icon">📂</div>
                <div style="font-weight: 600; font-size: 0.88rem; color: #000000;">${t('dropzone_main')}</div>
                <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">${t('dropzone_sub')}</div>
              </div>
              ${state.filePath ? `
                <div class="file-path-display">${state.filePath}</div>
                <div style="margin-top: 6px; display: flex; justify-content: space-between; font-size: 0.75rem;">
                  <span>${t('total_rows')}: <strong>${state.dataset?.total_rows || 0}</strong></span>
                  <span class="cm-badge cm-badge-sky">${state.dataset?.detected_sep || 'Auto'}</span>
                </div>
                ${state.dataset?.truncated ? `
                  <div style="margin-top: 6px; font-size: 0.74rem; padding: 6px 8px; border-left: 3px solid var(--rose); background: rgba(225,29,72,0.06); color: #000000;">
                    ⚠ ${t('truncation_banner').replace('{shown}', rowCount(state.dataset).toLocaleString()).replace('{total}', state.dataset.total_rows.toLocaleString())}
                  </div>` : ''}
                ${(state.dataset?.notes || []).filter(n => !state.dataset?.truncated || !n.includes('limite righe')).map(n => `
                  <div style="margin-top: 4px; font-size: 0.72rem; color: #000000;">ℹ ${n}</div>`).join('')}
                ${state.loadTiming ? `
                  <div style="margin-top: 6px; font-size: 0.72rem; color: #000000; font-family: 'JetBrains Mono', monospace;">
                    ⏱ ${t('load_time_label')} ${state.loadTiming.totalMs.toFixed(0)} ms (${t('parse_time_label')} ${state.loadTiming.parseMs.toFixed(0)} ms) · ${state.loadTiming.rows.toLocaleString()} ${t('preview_rows')}
                  </div>` : ''}
              ` : ''}
              <div class="form-row" style="margin-top: 8px; align-items: flex-end;">
                <div class="form-group" style="flex: 1; margin-bottom: 0;">
                  <label class="form-label">${t('row_limit_label')}</label>
                  <select class="form-select" id="data-row-limit">
                    ${[100_000, 500_000, 2_000_000, 5_000_000, 0].map(v => `<option value="${v}" ${state.rowLimit === v ? 'selected' : ''}>${v === 0 ? t('row_limit_all') : v.toLocaleString()}</option>`).join('')}
                  </select>
                </div>
              </div>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.76rem; cursor: pointer; margin-top: 6px;">
                <input type="checkbox" id="data-decimate" ${state.decimateLargeSeries ? 'checked' : ''} />
                <span>${t('decimate_toggle')}</span>
              </label>
            ` : `
              <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
                <div class="form-row">
                  <div class="form-group" style="flex: 2;">
                    <label class="form-label">${t('sql_host')}</label>
                    <input type="text" class="form-input" id="sql-host" value="${state.sqlConfig.host}" placeholder="localhost" />
                  </div>
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">${t('sql_port')}</label>
                    <input type="number" class="form-input" id="sql-port" value="${state.sqlConfig.port}" />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">${t('sql_db')}</label>
                    <input type="text" class="form-input" id="sql-db" value="${state.sqlConfig.database}" placeholder="building_db" />
                  </div>
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">${t('sql_user')}</label>
                    <input type="text" class="form-input" id="sql-user" value="${state.sqlConfig.user}" placeholder="root" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">${t('sql_pass')}</label>
                  <input type="password" class="form-input" id="sql-pass" value="${state.sqlConfig.password || ''}" placeholder="••••••••" />
                </div>

                <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px;">
                  <button class="btn btn-secondary" id="btn-sql-test" style="flex: 1; font-size: 0.76rem;">
                    ${t('btn_sql_test')}
                  </button>
                  ${state.sqlStatus ? `
                    <span class="cm-badge ${state.sqlStatus.connected ? 'cm-badge-emerald' : 'cm-badge-rose'}">
                      ${state.sqlStatus.connected ? `✓ ${state.sqlStatus.latency_ms}ms` : '✕ Error'}
                    </span>
                  ` : ''}
                </div>

                ${state.sqlStatus?.tables && state.sqlStatus.tables.length > 0 ? `
                  <div class="form-group">
                    <label class="form-label">${t('sql_tables_label')}</label>
                    <select class="form-select" id="sql-table-select">
                      <option value="">${t('sql_tables_placeholder')}</option>
                      ${state.sqlStatus.tables.map(tbl => `<option value="${tbl}">📋 ${tbl}</option>`).join('')}
                    </select>
                  </div>
                ` : ''}

                <div class="form-group" style="margin-bottom: 8px;">
                  <label class="form-label">${t('sql_query_label')}</label>
                  <textarea class="sql-editor" id="sql-query-input">${state.sqlQuery}</textarea>
                </div>

                <button class="btn btn-primary" id="btn-sql-exec" style="width: 100%; font-size: 0.78rem;">
                  ${t('btn_sql_exec')}
                </button>
              </div>
            `}
          </section>

          ${state.sourceType === 'file' ? `
            <section class="sidebar-section">
              <div class="sidebar-title">${t('delim_title')}</div>
              <div class="form-row">
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">${t('sep_label')}</label>
                  <select class="form-select" id="cfg-separator">
                    <option value="auto" ${state.separator === 'auto' ? 'selected' : ''}>${t('sep_auto')}</option>
                    <option value="," ${state.separator === ',' ? 'selected' : ''}>${t('sep_comma')}</option>
                    <option value=";" ${state.separator === ';' ? 'selected' : ''}>${t('sep_semi')}</option>
                    <option value="\t" ${state.separator === '\t' ? 'selected' : ''}>${t('sep_tab')}</option>
                    <option value="|" ${state.separator === '|' ? 'selected' : ''}>${t('sep_pipe')}</option>
                  </select>
                </div>

                <div class="form-group" style="flex: 1;">
                  <label class="form-label">${t('dec_label')}</label>
                  <select class="form-select" id="cfg-decimal">
                    <option value="." ${state.decimal === '.' ? 'selected' : ''}>${t('dec_dot')}</option>
                    <option value="," ${state.decimal === ',' ? 'selected' : ''}>${t('dec_comma')}</option>
                  </select>
                </div>
              </div>
              <button class="btn btn-secondary" id="btn-reparse" style="width: 100%; margin-top: 2px;">
                ${t('btn_reparse')}
              </button>
            </section>
          ` : ''}

          <section class="sidebar-section">
            <div class="sidebar-title">${t('ts_title')}</div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; margin-bottom: 8px;">
              <input type="checkbox" id="cfg-has-ts" ${state.hasTimestamp ? 'checked' : ''} />
              <span style="font-weight: 600; color: #000000;">${t('ts_has_col')}</span>
            </label>

            <div id="ts-config-panel" style="display: ${state.hasTimestamp ? 'block' : 'none'};">
              <div class="form-group">
                <label class="form-label">${t('ts_col_label')}</label>
                <select class="form-select" id="cfg-ts-col">
                  <option value="">${t('ts_col_placeholder')}</option>
                  ${renderColumnOptions(state.timestampCol)}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">${t('ts_fmt_label')}</label>
                <input type="text" class="form-input" id="cfg-ts-format" value="${state.timestampFormat}" placeholder="%Y-%m-%d %H:%M:%S" />
              </div>
            </div>
          </section>

          <!-- TRACK 4: RUST HIGH-SPEED RESAMPLING & SMOOTHING ENGINE -->
          <section class="sidebar-section" style="background: #f0fdf4; border-left: 3px solid var(--primary);">
            <div class="sidebar-title">
              <span>${t('resample_title')}</span>
              <span class="cm-badge ${state.isResampled ? 'cm-badge-amber' : 'cm-badge-emerald'}">
                ${state.isResampled ? `${t('resample_active_badge')} (${state.resampleInterval})` : t('resample_raw_badge')}
              </span>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('resample_interval_label')}</label>
                <select class="form-select" id="sel-resample-interval">
                  <option value="1m" ${state.resampleInterval === '1m' ? 'selected' : ''}>1 min (1m)</option>
                  <option value="5m" ${state.resampleInterval === '5m' ? 'selected' : ''}>5 min (5m)</option>
                  <option value="15m" ${state.resampleInterval === '15m' ? 'selected' : ''}>15 min (15m)</option>
                  <option value="30m" ${state.resampleInterval === '30m' ? 'selected' : ''}>30 min (30m)</option>
                  <option value="1h" ${state.resampleInterval === '1h' ? 'selected' : ''}>1 hour (1h)</option>
                  <option value="1d" ${state.resampleInterval === '1d' ? 'selected' : ''}>1 day (24h)</option>
                </select>
              </div>
              <div class="form-group" style="flex: 1.3;">
                <label class="form-label">${t('resample_agg_label')}</label>
                <select class="form-select" id="sel-resample-agg">
                  <option value="mean" ${state.resampleAgg === 'mean' ? 'selected' : ''}>${t('resample_agg_mean')}</option>
                  <option value="median" ${state.resampleAgg === 'median' ? 'selected' : ''}>${t('resample_agg_median')}</option>
                  <option value="max" ${state.resampleAgg === 'max' ? 'selected' : ''}>${t('resample_agg_max')}</option>
                  <option value="min" ${state.resampleAgg === 'min' ? 'selected' : ''}>${t('resample_agg_min')}</option>
                  <option value="p95" ${state.resampleAgg === 'p95' ? 'selected' : ''}>${t('resample_agg_p95')}</option>
                  <option value="p5" ${state.resampleAgg === 'p5' ? 'selected' : ''}>${t('resample_agg_p5')}</option>
                  <option value="sum" ${state.resampleAgg === 'sum' ? 'selected' : ''}>${t('resample_agg_sum')}</option>
                </select>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-primary" id="btn-resample-apply" style="flex: 1; font-size: 0.76rem;">
                ${t('btn_resample_apply')}
              </button>
              ${state.isResampled ? `
                <button class="btn btn-secondary" id="btn-resample-reset" style="font-size: 0.75rem;">
                  ${t('btn_resample_reset')}
                </button>
              ` : ''}
            </div>
          </section>

          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>${t('geo_title')}</span>
              <span class="cm-badge cm-badge-sky">GIS Ready</span>
            </div>
            <div class="form-group">
              <label class="form-label">${t('geo_fmt_label')}</label>
              <select class="form-select" id="cfg-geo-format">
                <option value="decimal_degrees" ${state.geoCoordFormat === 'decimal_degrees' ? 'selected' : ''}>${t('geo_fmt_dd')}</option>
                <option value="dms" ${state.geoCoordFormat === 'dms' ? 'selected' : ''}>${t('geo_fmt_dms')}</option>
              </select>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('geo_lat_label')}</label>
                <select class="form-select" id="cfg-geo-lat">
                  <option value="">${t('none_option')}</option>
                  ${renderColumnOptions(state.geoLatCol)}
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('geo_lon_label')}</label>
                <select class="form-select" id="cfg-geo-lon">
                  <option value="">${t('none_option')}</option>
                  ${renderColumnOptions(state.geoLonCol)}
                </select>
              </div>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <button class="btn btn-primary" id="btn-goto-canvas" style="flex: 1; font-size: 0.76rem;">
                ${t('btn_goto_canvas')}
              </button>
              <button class="btn btn-secondary" id="btn-goto-maps" style="flex: 1; font-size: 0.76rem;">
                ${t('btn_goto_maps')}
              </button>
            </div>
          </section>
        </aside>

        <main class="data-ingestion-view">
          <div class="data-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div>
                <h2 style="font-size: 1.1rem; font-weight: 700; color: #000000;">${t('preview_title')}</h2>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                  ${t('preview_sub')}
                </div>
              </div>
              <div>
                ${state.dataset ? `
                  <span class="cm-badge cm-badge-emerald" style="font-size: 0.8rem; padding: 4px 8px;">
                    ✓ ${state.dataset.columns.length} ${t('preview_cols')} · ${state.dataset.total_rows} ${t('preview_rows')}
                  </span>
                ` : `<span style="font-size: 0.8rem; color: var(--text-muted);">${t('no_dataset_title')}</span>`}
              </div>
            </div>
            <div class="table-preview-scroll">
              ${renderPreviewTable()}
            </div>
          </div>
        </main>
      </div>

      <!-- VIEW 2: SINGLE CANVAS STUDIO (WITH PROGRESSIVE SUB-TABS) -->
      <div class="view-panel ${state.currentTab === 'canvas' ? 'active' : ''}" id="view-canvas">
        <aside class="sidebar">
          <!-- Saved Canvases Header -->
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
            <div class="sidebar-title">
              <span>${t('canvas_saved_title')}</span>
              <span class="cm-badge cm-badge-emerald">${state.activeCanvas || 'Canvas_1'}</span>
            </div>
            <div style="display: flex; gap: 6px; margin-bottom: 6px;">
              <select class="form-select" id="sel-canvas" style="flex: 1; font-size: 0.8rem; font-weight: 600; padding: 4px 8px;">
                ${renderCanvasSelectOptions()}
              </select>
              <button class="btn btn-primary" id="btn-save-canvas" style="font-size: 0.75rem; padding: 4px 10px;">
                ${t('btn_save')}
              </button>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary" id="btn-new-canvas" style="flex: 1; font-size: 0.73rem; padding: 3px 6px;">
                ${t('btn_save_as_new')}
              </button>
              <button class="btn btn-secondary" id="btn-delete-canvas" style="font-size: 0.73rem; padding: 3px 6px; color: var(--rose);">
                ${t('btn_delete')}
              </button>
            </div>
          </section>

          <!-- Progressive Step-by-Step Sub-Tabs Bar -->
          <div class="subtab-bar">
            <button class="subtab-btn ${state.canvasSubTab === 'traces' ? 'active' : ''}" data-csub="traces">${t('sub_traces')}</button>
            <button class="subtab-btn ${state.canvasSubTab === 'axes' ? 'active' : ''}" data-csub="axes">${t('sub_axes')}</button>
            <button class="subtab-btn ${state.canvasSubTab === 'grid' ? 'active' : ''}" data-csub="grid">${t('sub_grid')}</button>
            <button class="subtab-btn ${state.canvasSubTab === 'style' ? 'active' : ''}" data-csub="style">${t('sub_style')}</button>
          </div>

          ${renderSingleCanvasSubTabContent()}
        </aside>

        <!-- Single Canvas Display Area -->
        <main class="canvas-container">
          <div class="canvas-toolbar">
            <div class="preset-selector">
              <span style="font-size: 0.78rem; font-weight: 700; color: #000000; align-self: center; margin-right: 4px;">${t('preset_pub_label')}</span>
              <button class="preset-btn ${state.preset === 'single' ? 'active' : ''}" data-preset="single">${t('preset_single')}</button>
              <button class="preset-btn ${state.preset === 'double' ? 'active' : ''}" data-preset="double">${t('preset_double')}</button>
              <button class="preset-btn ${state.preset === 'square' ? 'active' : ''}" data-preset="square">${t('preset_square')}</button>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem;">
              <span>${t('dim_label')}</span>
              <input type="number" step="0.5" min="5" max="40" id="inp-canvas-w" value="${state.widthCm}" style="width: 52px; padding: 2px 4px; font-size: 0.76rem; font-weight: 700; border: 1px solid var(--border); border-radius: 4px;" title="Width (cm)" />
              <span>×</span>
              <input type="number" step="0.5" min="4" max="40" id="inp-canvas-h" value="${state.heightCm}" style="width: 52px; padding: 2px 4px; font-size: 0.76rem; font-weight: 700; border: 1px solid var(--border); border-radius: 4px;" title="Height (cm)" />
              <span>cm</span>
              <span class="cm-badge cm-badge-emerald">Vector 600 DPI</span>
            </div>
          </div>

          <div class="chart-viewport">
            <div id="plotly-chart" class="plot-wrapper"></div>
            <div id="render-timing" style="font-size: 0.7rem; color: #000000; font-family: 'JetBrains Mono', monospace; margin-top: 4px; min-height: 1em;"></div>
          </div>
        </main>
      </div>

      <!-- VIEW 3: MULTIPLOT GRID STUDIO (WITH PROGRESSIVE SUB-TABS & PARALLEL CANVASES) -->
      <div class="view-panel ${state.currentTab === 'multi' ? 'active' : ''}" id="view-multi">
        <aside class="sidebar">
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
            <div class="sidebar-title">
              <span>${t('mp_saved_title')}</span>
              <span class="cm-badge cm-badge-emerald">${state.activeMultiPlot || 'MultiPlot_1'}</span>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 6px;">
              <select class="form-select" id="sel-multiplot" style="flex: 1; font-size: 0.8rem; font-weight: 600;">
                ${renderMultiPlotSelectOptions()}
              </select>
              <button class="btn btn-primary" id="btn-save-multiplot" style="font-size: 0.75rem; padding: 4px 10px;">
                ${t('btn_save')}
              </button>
            </div>

            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary" id="btn-new-multiplot" style="flex: 1; font-size: 0.73rem; padding: 3px 6px;">
                ${t('btn_save_as_new')}
              </button>
              <button class="btn btn-secondary" id="btn-delete-multiplot" style="font-size: 0.73rem; padding: 3px 6px; color: var(--rose);">
                ${t('btn_delete')}
              </button>
            </div>
          </section>

          <!-- MultiPlot Step-by-Step Sub-Tabs Bar -->
          <div class="subtab-bar">
            <button class="subtab-btn ${state.mpSubTab === 'layout' ? 'active' : ''}" data-mpsub="layout">${t('sub_mp_layout')}</button>
            <button class="subtab-btn ${state.mpSubTab === 'panels' ? 'active' : ''}" data-mpsub="panels">${t('sub_mp_panels')}</button>
            <button class="subtab-btn ${state.mpSubTab === 'axes' ? 'active' : ''}" data-mpsub="axes">${t('sub_mp_axes')}</button>
            <button class="subtab-btn ${state.mpSubTab === 'style' ? 'active' : ''}" data-mpsub="style">${t('sub_mp_style')}</button>
          </div>

          ${renderMultiPlotSubTabContent()}
        </aside>

        <!-- MultiPlot Viewport -->
        <main class="canvas-container">
          <div class="canvas-toolbar">
            <div class="preset-selector">
              <span style="font-size: 0.78rem; font-weight: 700; color: #000000; align-self: center; margin-right: 4px;">${t('preset_pub_label')}</span>
              <button class="preset-btn mp-preset-btn ${state.mpPreset === 'single_stack' ? 'active' : ''}" data-mppreset="single_stack">${t('preset_single')}</button>
              <button class="preset-btn mp-preset-btn ${state.mpPreset === 'double_stack' ? 'active' : ''}" data-mppreset="double_stack">${t('preset_double')}</button>
              <button class="preset-btn mp-preset-btn ${state.mpPreset === 'square_grid' ? 'active' : ''}" data-mppreset="square_grid">${t('preset_square')}</button>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem;">
              <span>${t('dim_label')}</span>
              <input type="number" step="0.5" min="6" max="50" id="inp-mp-w" value="${state.mpWidthCm}" style="width: 52px; padding: 2px 4px; font-size: 0.76rem; font-weight: 700; border: 1px solid var(--border); border-radius: 4px;" />
              <span>×</span>
              <input type="number" step="0.5" min="6" max="50" id="inp-mp-h" value="${state.mpHeightCm}" style="width: 52px; padding: 2px 4px; font-size: 0.76rem; font-weight: 700; border: 1px solid var(--border); border-radius: 4px;" />
              <span>cm</span>
              <span class="cm-badge cm-badge-emerald">${mpDims.rows}×${mpDims.cols} Grid</span>
            </div>
          </div>

          <div class="chart-viewport">
            <div id="plotly-multi-chart" class="plot-wrapper"></div>
          </div>
        </main>
      </div>

      <!-- VIEW 4: MAPS & GEO-ANALYTICS STUDIO -->
      <div class="view-panel ${state.currentTab === 'maps' ? 'active' : ''}" id="view-maps">
        <aside class="sidebar">
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 2px solid var(--border);">
            <div class="sidebar-title">
              <span>${t('map_saved_title')}</span>
              <span class="cm-badge cm-badge-emerald">${state.activeMap || 'Map_1'}</span>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 6px;">
              <select class="form-select" id="sel-map" style="flex: 1; font-size: 0.8rem; font-weight: 600;">
                ${renderMapSelectOptions()}
              </select>
              <button class="btn btn-primary" id="btn-save-map" style="font-size: 0.76rem; padding: 4px 10px;">
                ${t('btn_save')}
              </button>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 8px;">
              <button class="btn btn-secondary" id="btn-new-map" style="flex: 1; font-size: 0.74rem; padding: 4px 6px;">
                ${t('btn_save_as_new')}
              </button>
              <button class="btn btn-secondary" id="btn-delete-map" style="font-size: 0.74rem; padding: 4px 6px; color: var(--rose);">
                ${t('btn_delete')}
              </button>
            </div>

            <!-- Direct Dataset Loader & Status inside Tab 4 -->
            <button class="btn btn-secondary" id="btn-map-load-file" style="width: 100%; font-size: 0.76rem; border-style: dashed;">
              ${t('map_load_data_btn')}
            </button>
            ${state.dataset ? `
              <div style="margin-top: 6px; font-size: 0.72rem; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">${state.filePath || 'Dataset'}</span>
                <span class="cm-badge ${state.geoLatCol && state.geoLonCol ? 'cm-badge-emerald' : 'cm-badge-amber'}">
                  ${state.geoLatCol && state.geoLonCol ? `✓ GPS (${state.geoLatCol}, ${state.geoLonCol})` : '⚠ Select Lat/Lon'}
                </span>
              </div>
            ` : ''}
          </section>

          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>${t('map_mode_title')}</span>
              <span class="cm-badge cm-badge-sky">GIS Engine</span>
            </div>

            <div class="map-mode-group">
              <button class="map-mode-btn ${state.mapMode === 'bubble' ? 'active' : ''}" data-mapmode="bubble">
                📍 Bubble Map
              </button>
              <button class="map-mode-btn ${state.mapMode === 'density' ? 'active' : ''}" data-mapmode="density">
                🔥 Heatmap
              </button>
              <button class="map-mode-btn ${state.mapMode === 'track' ? 'active' : ''}" data-mapmode="track">
                〰️ GPS Track
              </button>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">${t('map_basemap_label')}</label>
              <select class="form-select" id="map-basemap">
                <option value="carto-positron" ${state.mapBasemap === 'carto-positron' ? 'selected' : ''}>🏙️ CartoDB Positron (Light Paper)</option>
                <option value="esri-satellite" ${state.mapBasemap === 'esri-satellite' ? 'selected' : ''}>🛰️ ESRI World Imagery Satellite</option>
                <option value="open-street-map" ${state.mapBasemap === 'open-street-map' ? 'selected' : ''}>🗺️ OpenStreetMap (Road & Urban)</option>
                <option value="carto-darkmatter" ${state.mapBasemap === 'carto-darkmatter' ? 'selected' : ''}>🌑 CartoDB Dark Matter</option>
                <option value="opentopomap" ${state.mapBasemap === 'opentopomap' ? 'selected' : ''}>🏔️ OpenTopoMap (Topographic)</option>
              </select>
            </div>
          </section>

          <section class="sidebar-section">
            <div class="sidebar-title">${t('map_coords_title')}</div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('map_lat_label')}</label>
                <select class="form-select" id="map-lat-col">
                  <option value="">${t('none_option')}</option>
                  ${renderColumnOptions(state.geoLatCol)}
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('map_lon_label')}</label>
                <select class="form-select" id="map-lon-col">
                  <option value="">${t('none_option')}</option>
                  ${renderColumnOptions(state.geoLonCol)}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('map_color_label')}</label>
                <select class="form-select" id="map-color-col">
                  <option value="">${t('map_uniform_opt')}</option>
                  ${renderColumnOptions(state.mapColorCol)}
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">${t('map_size_label')}</label>
                <select class="form-select" id="map-size-col">
                  <option value="">${t('map_fixed_opt')}</option>
                  ${renderColumnOptions(state.mapSizeCol)}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 2; margin-bottom: 0;">
                <label class="form-label">${t('map_colorscale_label')}</label>
                <select class="form-select" id="map-colorscale">
                  <option value="Viridis" ${state.mapColorscale === 'Viridis' ? 'selected' : ''}>Viridis</option>
                  <option value="Plasma" ${state.mapColorscale === 'Plasma' ? 'selected' : ''}>Plasma</option>
                  <option value="RdBu" ${state.mapColorscale === 'RdBu' ? 'selected' : ''}>RdBu (Blue-Red)</option>
                  <option value="YlOrRd" ${state.mapColorscale === 'YlOrRd' ? 'selected' : ''}>YlOrRd (Heat)</option>
                  <option value="Emerald" ${state.mapColorscale === 'Emerald' ? 'selected' : ''}>Emerald</option>
                </select>
              </div>
              <div class="form-group" style="flex: 1; margin-bottom: 0;">
                <label class="form-label">${t('map_decimals_label')}</label>
                <select class="form-select" id="map-decimals">
                  <option value="auto" ${state.mapDecimals === 'auto' ? 'selected' : ''}>${t('dec_auto')}</option>
                  <option value="0" ${state.mapDecimals === '0' ? 'selected' : ''}>0</option>
                  <option value="1" ${state.mapDecimals === '1' ? 'selected' : ''}>1</option>
                  <option value="2" ${state.mapDecimals === '2' ? 'selected' : ''}>2</option>
                  <option value="3" ${state.mapDecimals === '3' ? 'selected' : ''}>3</option>
                </select>
              </div>
            </div>
          </section>

          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>${t('map_cluster_title')}</span>
              <span class="cm-badge cm-badge-amber">Geo-Stats</span>
            </div>

            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; margin-bottom: 8px;">
              <input type="checkbox" id="map-cluster-toggle" ${state.mapClusterEnabled ? 'checked' : ''} />
              <span style="font-weight: 600; color: #000000;">${t('map_cluster_enable')}</span>
            </label>

            <div id="map-cluster-panel" style="display: ${state.mapClusterEnabled ? 'block' : 'none'}; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
              <div class="form-group">
                <label class="form-label">${t('map_cluster_op_label')}</label>
                <select class="form-select" id="map-cluster-agg">
                  <option value="mean" ${state.mapClusterAgg === 'mean' ? 'selected' : ''}>${t('map_op_mean')}</option>
                  <option value="sum" ${state.mapClusterAgg === 'sum' ? 'selected' : ''}>${t('map_op_sum')}</option>
                  <option value="mode" ${state.mapClusterAgg === 'mode' ? 'selected' : ''}>${t('map_op_mode')}</option>
                  <option value="max" ${state.mapClusterAgg === 'max' ? 'selected' : ''}>${t('map_op_max')}</option>
                  <option value="min" ${state.mapClusterAgg === 'min' ? 'selected' : ''}>${t('map_op_min')}</option>
                  <option value="count" ${state.mapClusterAgg === 'count' ? 'selected' : ''}>${t('map_op_count')}</option>
                </select>
              </div>

              <div class="form-group" style="margin-bottom: 4px;">
                <label class="form-label">${t('map_grid_label')}</label>
                <select class="form-select" id="map-cluster-grid">
                  <option value="0.0005" ${state.mapClusterGridDeg === 0.0005 ? 'selected' : ''}>0.0005° (~50m - Building)</option>
                  <option value="0.002" ${state.mapClusterGridDeg === 0.002 ? 'selected' : ''}>0.002° (~200m - Block / Campus)</option>
                  <option value="0.005" ${state.mapClusterGridDeg === 0.005 ? 'selected' : ''}>0.005° (~500m - Neighborhood)</option>
                  <option value="0.02" ${state.mapClusterGridDeg === 0.02 ? 'selected' : ''}>0.02° (~2km - Urban District)</option>
                  <option value="0.1" ${state.mapClusterGridDeg === 0.1 ? 'selected' : ''}>0.10° (~10km - Regional)</option>
                </select>
              </div>
            </div>

            <div class="cluster-stats-banner" id="map-cluster-banner">
              <span>${state.mapClusterEnabled ? t('map_active_clusters') : t('map_valid_pts')} <strong id="lbl-cluster-count">${state.mapClusterEnabled ? state.mapLastClusterCount : state.mapValidGpsCount}</strong></span>
              <span class="cm-badge cm-badge-emerald" id="lbl-cluster-stat">${state.mapLastSummaryStat || 'Ready'}</span>
            </div>
          </section>
        </aside>

        <main class="canvas-container">
          <div class="canvas-toolbar">
            <div class="preset-selector">
              <span style="font-size: 0.78rem; font-weight: 700; color: #000000; align-self: center; margin-right: 4px;">${t('preset_pub_label')}</span>
              <button class="preset-btn map-preset-btn ${state.mapPreset === 'single' ? 'active' : ''}" data-mappreset="single">${t('preset_single')}</button>
              <button class="preset-btn map-preset-btn ${state.mapPreset === 'double' ? 'active' : ''}" data-mappreset="double">${t('preset_double')}</button>
              <button class="preset-btn map-preset-btn ${state.mapPreset === 'square' ? 'active' : ''}" data-mappreset="square">${t('preset_square')}</button>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; font-size: 0.8rem;">
              <span>${t('dim_label')} <strong style="color: #000000;">${state.mapWidthCm} × ${state.mapHeightCm} cm</strong></span>
              <span class="cm-badge cm-badge-sky">▲ North · Auto-BBox</span>
            </div>
          </div>

          <div class="chart-viewport">
            <div id="plotly-map-chart" class="plot-wrapper"></div>
          </div>
        </main>
      </div>

      <!-- VIEW 5: BUILDING PHYSICS & IEQ STUDIO (TRACKS 1, 2, 3, 5) -->
      <div class="view-panel ${state.currentTab === 'physics' ? 'active' : ''}" id="view-physics">
        <aside class="sidebar">
          <section class="sidebar-section" style="background: #f8fafc; border-bottom: 2px solid var(--border);">
            <div class="sidebar-title">
              <span>${t('phys_mode_title')}</span>
              <span class="cm-badge cm-badge-emerald">EN / ASHRAE</span>
            </div>
            <div class="physics-mode-grid">
              <button class="physics-mode-btn ${state.physicsMode === 'carpet' ? 'active' : ''}" data-physmode="carpet">
                <span>${t('phys_mode_carpet')}</span>
                <span class="cm-badge cm-badge-sky">Track 1</span>
              </button>
              <button class="physics-mode-btn ${state.physicsMode === 'comfort' ? 'active' : ''}" data-physmode="comfort">
                <span>${t('phys_mode_comfort')}</span>
                <span class="cm-badge cm-badge-emerald">Track 2</span>
              </button>
              <button class="physics-mode-btn ${state.physicsMode === 'duration' ? 'active' : ''}" data-physmode="duration">
                <span>${t('phys_mode_duration')}</span>
                <span class="cm-badge cm-badge-amber">Track 3</span>
              </button>
              <button class="physics-mode-btn ${state.physicsMode === 'calib' ? 'active' : ''}" data-physmode="calib">
                <span>${t('phys_mode_calib')}</span>
                <span class="cm-badge cm-badge-sky">Track 5</span>
              </button>
            </div>
          </section>

          ${renderPhysicsSidebarContent()}
        </aside>

        <main class="canvas-container">
          <div class="canvas-toolbar">
            <div class="preset-selector">
              <span style="font-size: 0.78rem; font-weight: 700; color: #000000; align-self: center; margin-right: 4px;">${t('preset_pub_label')}</span>
              <button class="preset-btn ${state.preset === 'single' ? 'active' : ''}" data-preset="single">${t('preset_single')}</button>
              <button class="preset-btn ${state.preset === 'double' ? 'active' : ''}" data-preset="double">${t('preset_double')}</button>
              <button class="preset-btn ${state.preset === 'square' ? 'active' : ''}" data-preset="square">${t('preset_square')}</button>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 0.78rem;">
              <span>${t('dim_label')} <strong>${state.widthCm} × ${state.heightCm} cm</strong></span>
              <span class="cm-badge cm-badge-emerald">600 DPI Journal Ready</span>
            </div>
          </div>

          <div class="physics-kpi-bar" id="physics-kpi-banner">
            ${renderPhysicsKpiBar()}
          </div>

          <div class="chart-viewport">
            <div id="plotly-physics-chart" class="plot-wrapper"></div>
          </div>
        </main>
      </div>

      <!-- VIEW 6: EDITORIAL & LATEX SUITE (TRACK 6) -->
      <div class="view-panel ${state.currentTab === 'editorial' ? 'active' : ''}" id="view-editorial">
        ${state.currentTab === 'editorial' ? renderEditorialView() : '' /* statistics over all rows: build only when visible */}
      </div>
    </div>
  `;

  attachEventListeners();
  if (state.currentTab === 'canvas') {
    updateChart();
  } else if (state.currentTab === 'multi') {
    updateMultiPlotChart();
  } else if (state.currentTab === 'maps') {
    updateMapChart();
  } else if (state.currentTab === 'physics') {
    updatePhysicsChart();
  } else if (state.currentTab === 'editorial') {
    updateEditorialSuite();
  }
}
