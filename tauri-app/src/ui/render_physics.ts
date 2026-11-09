import type { Rows } from '../source';
import { computeVariableStats, generatePublicationTableCode, fmtDec } from '../scientific_modules';
import { state, t } from '../core/state';
import { renderColumnOptions } from './render_helpers';

export function renderPhysicsSidebarContent(): string {
  if (state.physicsMode === 'carpet') {
    const c = state.carpetState;
    return `
      <section class="sidebar-section">
        <div class="sidebar-title">${t('carpet_config_title')}</div>
        <div class="form-group">
          <label class="form-label">${t('carpet_var_label')}</label>
          <select class="form-select" id="phys-carpet-var">
            ${renderColumnOptions(c.variableCol)}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('carpet_agg_label')}</label>
            <select class="form-select" id="phys-carpet-agg">
              <option value="mean" ${c.aggMethod === 'mean' ? 'selected' : ''}>${t('carpet_agg_mean')}</option>
              <option value="max" ${c.aggMethod === 'max' ? 'selected' : ''}>${t('carpet_agg_max')}</option>
              <option value="min" ${c.aggMethod === 'min' ? 'selected' : ''}>${t('carpet_agg_min')}</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('carpet_colorscale_label')}</label>
            <select class="form-select" id="phys-carpet-cscale">
              <option value="Thermal" ${c.colorscale === 'Thermal' ? 'selected' : ''}>Thermal (Blue–Red)</option>
              <option value="Viridis" ${c.colorscale === 'Viridis' ? 'selected' : ''}>Viridis</option>
              <option value="Plasma" ${c.colorscale === 'Plasma' ? 'selected' : ''}>Plasma</option>
              <option value="Turbo" ${c.colorscale === 'Turbo' ? 'selected' : ''}>Turbo</option>
              <option value="RdBu" ${c.colorscale === 'RdBu' ? 'selected' : ''}>RdBu (Diverging)</option>
              <option value="Emerald" ${c.colorscale === 'Emerald' ? 'selected' : ''}>Emerald</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">${t('carpet_filter_label')}</label>
          <select class="form-select" id="phys-carpet-filter">
            <option value="all" ${c.dayFilter === 'all' ? 'selected' : ''}>${t('carpet_filter_all')}</option>
            <option value="weekdays" ${c.dayFilter === 'weekdays' ? 'selected' : ''}>${t('carpet_filter_weekdays')}</option>
            <option value="weekends" ${c.dayFilter === 'weekends' ? 'selected' : ''}>${t('carpet_filter_weekends')}</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('carpet_zmin_label')}</label>
            <input type="number" step="any" class="form-input" id="phys-carpet-zmin" value="${c.zMin ?? ''}" placeholder="Auto" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('carpet_zmax_label')}</label>
            <input type="number" step="any" class="form-input" id="phys-carpet-zmax" value="${c.zMax ?? ''}" placeholder="Auto" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('axis_decimals_label')}</label>
            <select class="form-select" id="phys-carpet-dec">
              <option value="auto" ${c.decimals === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="0" ${c.decimals === '0' ? 'selected' : ''}>0</option>
              <option value="1" ${c.decimals === '1' ? 'selected' : ''}>1</option>
              <option value="2" ${c.decimals === '2' ? 'selected' : ''}>2</option>
              <option value="3" ${c.decimals === '3' ? 'selected' : ''}>3</option>
            </select>
          </div>
        </div>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer; margin-bottom: 8px;">
          <input type="checkbox" id="phys-carpet-contours" ${c.showContours ? 'checked' : ''} />
          <span style="font-weight: 600;">${t('carpet_contours_toggle')}</span>
        </label>
        ${c.showContours ? `
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">${t('carpet_contour_step_label')}</label>
            <input type="number" step="any" min="0.1" class="form-input" id="phys-carpet-cstep" value="${c.contourStep ?? ''}" placeholder="e.g. 1.0" />
          </div>
        ` : ''}
      </section>
    `;
  }

  if (state.physicsMode === 'comfort') {
    const c = state.comfortState;
    return `
      <section class="sidebar-section">
        <div class="sidebar-title">${t('comfort_config_title')}</div>
        <div class="form-group">
          <label class="form-label">${t('comfort_norm_label')}</label>
          <select class="form-select" id="phys-comfort-norm">
            <option value="en16798" ${c.normMode === 'en16798' ? 'selected' : ''}>${t('comfort_norm_en16798')}</option>
            <option value="ashrae55" ${c.normMode === 'ashrae55' ? 'selected' : ''}>${t('comfort_norm_ashrae55')}</option>
            <option value="psychro" ${c.normMode === 'psychro' ? 'selected' : ''}>${t('comfort_norm_psychro')}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">${t('comfort_in_temp_label')}</label>
          <select class="form-select" id="phys-comfort-intemp">
            ${renderColumnOptions(c.indoorTempCol)}
          </select>
        </div>
        ${c.normMode !== 'psychro' ? `<div class="cm-note" style="font-size: 0.72rem; line-height: 1.35; margin: -4px 0 10px; padding: 6px 8px; border-left: 3px solid #b45309; background: rgba(180,83,9,0.06); color: #000000;">${t('comfort_conditions_note')}</div>` : ''}
        ${c.normMode === 'psychro' ? `
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">${t('comfort_rh_label')}</label>
            <select class="form-select" id="phys-comfort-rh">
              ${renderColumnOptions(c.rhCol)}
            </select>
          </div>
        ` : `
          <div class="form-group">
            <label class="form-label">${t('comfort_out_temp_label')}</label>
            <select class="form-select" id="phys-comfort-outtemp">
              ${renderColumnOptions(c.outdoorTempCol)}
            </select>
          </div>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="phys-comfort-trm" ${c.computeRunningMean ? 'checked' : ''} />
            <span style="font-weight: 600;">${t('comfort_calc_trm_toggle')}</span>
          </label>
        `}
      </section>
    `;
  }

  if (state.physicsMode === 'duration') {
    const d = state.durationState;
    return `
      <section class="sidebar-section">
        <div class="sidebar-title">${t('dur_config_title')}</div>
        <div class="form-group">
          <label class="form-label">${t('dur_var_label')}</label>
          <select class="form-select" id="phys-dur-var">
            ${renderColumnOptions(d.variableCol)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">${t('dur_compare_var_label')}</label>
          <select class="form-select" id="phys-dur-cmp">
            <option value="">${t('none_option')}</option>
            ${renderColumnOptions(d.compareCol)}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1.5;">
            <label class="form-label">${t('dur_x_mode_label')}</label>
            <select class="form-select" id="phys-dur-xmode">
              <option value="hours" ${d.xMode === 'hours' ? 'selected' : ''}>${t('dur_x_hours')}</option>
              <option value="pct" ${d.xMode === 'pct' ? 'selected' : ''}>${t('dur_x_pct')}</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('dur_dt_label')}</label>
            <select class="form-select" id="phys-dur-dtmode" style="margin-bottom: 4px;">
              <option value="auto" ${(d.dtMode ?? 'auto') === 'auto' ? 'selected' : ''}>${t('dur_dt_auto')}</option>
              <option value="manual" ${d.dtMode === 'manual' ? 'selected' : ''}>${t('dur_dt_manual')}</option>
            </select>
            ${d.dtMode === 'manual' ? `<input type="number" step="0.05" min="0.01" class="form-input" id="phys-dur-dt" value="${d.dtHours}" />` : ''}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('dur_thresh1_label')}</label>
            <input type="number" step="any" class="form-input" id="phys-dur-t1" value="${d.threshold1 ?? ''}" placeholder="e.g. 26.0" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('dur_thresh2_label')}</label>
            <input type="number" step="any" class="form-input" id="phys-dur-t2" value="${d.threshold2 ?? ''}" placeholder="e.g. 28.0" />
          </div>
        </div>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
          <input type="checkbox" id="phys-dur-shade" ${d.shadeExceedance ? 'checked' : ''} />
          <span style="font-weight: 600;">${t('dur_shade_toggle')}</span>
        </label>
      </section>
    `;
  }

  // Calibration Mode (Track 5)
  const cal = state.calibState;
  return `
    <section class="sidebar-section">
      <div class="sidebar-title">${t('cal_config_title')}</div>
      <div class="form-group">
        <label class="form-label">${t('cal_measured_label')}</label>
        <select class="form-select" id="phys-cal-meas">
          ${renderColumnOptions(cal.measuredCol)}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">${t('cal_simulated_label')}</label>
        <select class="form-select" id="phys-cal-sim">
          ${renderColumnOptions(cal.simulatedCol)}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">${t('cal_view_label')}</label>
        <select class="form-select" id="phys-cal-view">
          <option value="series" ${cal.viewMode === 'series' ? 'selected' : ''}>${t('cal_view_series')}</option>
          <option value="parity" ${cal.viewMode === 'parity' ? 'selected' : ''}>${t('cal_view_parity')}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">${t('cal_quantity_label')}</label>
        <select class="form-select" id="phys-cal-qty">
          <option value="energy" ${(cal.quantity ?? 'energy') === 'energy' ? 'selected' : ''}>${t('cal_qty_energy')}</option>
          <option value="other" ${cal.quantity === 'other' ? 'selected' : ''}>${t('cal_qty_other')}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">${t('cal_criteria_label')}</label>
        <select class="form-select" id="phys-cal-std">
          <option value="hourly" ${cal.standard === 'hourly' ? 'selected' : ''}>${t('cal_crit_hourly')}</option>
          <option value="monthly" ${cal.standard === 'monthly' ? 'selected' : ''}>${t('cal_crit_monthly')}</option>
        </select>
      </div>
      <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
        <input type="checkbox" id="phys-cal-box" ${cal.showBoxOnChart ? 'checked' : ''} />
        <span style="font-weight: 600;">${t('cal_show_on_chart')}</span>
      </label>
    </section>
  `;
}

export function renderPhysicsKpiBar(): string {
  if (state.physicsMode === 'carpet') {
    const c = state.carpetState;
    return `
      <span class="physics-kpi-chip">📊 Variable: <strong>${c.variableCol || '—'}</strong></span>
      <span class="physics-kpi-chip">🧮 Bin Method: <strong>${c.aggMethod.toUpperCase()}</strong></span>
      <span class="physics-kpi-chip">📅 Schedule Filter: <strong>${c.dayFilter.toUpperCase()}</strong></span>
      <span class="physics-kpi-chip">🎨 Palette: <strong>${c.colorscale}</strong></span>
    `;
  }
  if (state.physicsMode === 'comfort') {
    const k = state.comfortKpi;
    return `
      <span class="physics-kpi-chip">${t('comfort_kpi_total')} <strong>${k.totalHours} h</strong></span>
      <span class="physics-kpi-chip" style="border-color: var(--primary);">${t('comfort_kpi_cat1')} <strong style="color: var(--primary);">${k.cat1Hours} h (${k.cat1Pct.toFixed(1)}%)</strong></span>
      <span class="physics-kpi-chip">${t('comfort_kpi_cat2')} <strong>${k.cat2Hours} h (${k.cat2Pct.toFixed(1)}%)</strong></span>
      <span class="physics-kpi-chip" style="border-color: var(--rose);">${t('comfort_kpi_overheat')} <strong style="color: var(--rose);">${k.overheatHours} h (${k.overheatPct.toFixed(1)}%)</strong></span>
      <span class="physics-kpi-chip">${t('comfort_kpi_undercool')} <strong>${k.undercoolHours} h (${k.undercoolPct.toFixed(1)}%)</strong></span>
      ${state.comfortState.normMode !== 'psychro' && k.outOfRangeHours > 0 ? `<span class="physics-kpi-chip">${t('comfort_kpi_out_of_range')} <strong>${k.outOfRangeHours} h</strong></span>` : ''}
      ${state.comfortState.normMode !== 'psychro' && k.trmSource === 'no_timestamps' ? `<span class="physics-kpi-chip" style="border-color: var(--rose);"><strong style="color: var(--rose);">${t('comfort_kpi_no_timestamps')}</strong></span>` : ''}
    `;
  }
  if (state.physicsMode === 'duration') {
    const k = state.durationKpi;
    return `
      <span class="physics-kpi-chip">${t('dur_kpi_exc1')} <strong style="color: #b45309;">${k.exc1Hours.toFixed(1)} h (${k.exc1Pct.toFixed(1)}%)</strong></span>
      <span class="physics-kpi-chip">${t('dur_kpi_exc2')} <strong style="color: var(--rose);">${k.exc2Hours.toFixed(1)} h (${k.exc2Pct.toFixed(1)}%)</strong></span>
      <span class="physics-kpi-chip">${t('dur_kpi_integral')} <strong style="color: var(--primary);">${k.exposureIntegral.toFixed(1)} unit·h</strong></span>
      <span class="physics-kpi-chip">${t('dur_kpi_peak')} <strong>${k.peakVal.toFixed(1)} / ${k.p95Val.toFixed(1)} / ${k.medianVal.toFixed(1)}</strong></span>
      <span class="physics-kpi-chip">Δt <strong>${(k.dtHours ?? 1).toPrecision(3)} h</strong> (${t('dur_dt_src_' + (k.dtSource ?? 'default'))})</span>
      ${k.irregularSampling ? `<span class="physics-kpi-chip" style="border-color: var(--rose);"><strong style="color: var(--rose);">${t('dur_irregular_warning')}</strong></span>` : ''}
    `;
  }
  const m = state.calibMetrics;
  const isPass = state.calibState.standard === 'monthly' ? m.monthlyPass : m.hourlyPass;
  const insufficient = m.periods < 2;
  const applicable = m.criteriaApplicable !== false;
  return `
    <span class="cm-badge ${!applicable ? 'cm-badge-sky' : isPass ? 'cm-badge-emerald' : 'cm-badge-rose'}" style="font-size: 0.78rem; padding: 5px 10px;">
      ${insufficient ? t('cal_badge_insufficient') : !applicable ? t('cal_badge_indices_only') : isPass ? t('cal_badge_pass') : t('cal_badge_fail')}
    </span>
    <span class="physics-kpi-chip">${t('cal_kpi_periods')} <strong>${m.periods} ${state.calibState.standard === 'monthly' ? t('cal_unit_months') : 'h'}</strong></span>
    ${insufficient ? '' : `
    <span class="physics-kpi-chip">NMBE: <strong>${m.nmbePct >= 0 ? '+' : ''}${m.nmbePct.toFixed(2)}%</strong></span>
    <span class="physics-kpi-chip">CV(RMSE): <strong>${m.cvRmsePct.toFixed(2)}%</strong></span>
    <span class="physics-kpi-chip">R²: <strong>${m.rSquared.toFixed(4)}</strong></span>
    <span class="physics-kpi-chip">RMSE / MAE: <strong>${m.rmse.toFixed(2)} / ${m.mae.toFixed(2)}</strong></span>
    `}
  `;
}

export function renderEditorialView(): string {
  const ed = state.editorialState;
  const cols = state.dataset?.columns || [];
  const rows: Rows = state.dataset ?? [];
  const statRows = computeVariableStats(cols, rows, ed, state.hasTimestamp ? state.timestampCol : undefined);
  const generatedCode = generatePublicationTableCode(statRows, ed);

  return `
    <aside class="sidebar">
      <section class="sidebar-section">
        <div class="sidebar-title">
          <span>${t('ed_tables_title')}</span>
          <span class="cm-badge cm-badge-emerald">LaTeX / MD</span>
        </div>
        <div class="form-group">
          <label class="form-label">${t('ed_format_label')}</label>
          <select class="form-select" id="ed-output-fmt">
            <option value="latex" ${ed.outputFormat === 'latex' ? 'selected' : ''}>${t('ed_fmt_latex')}</option>
            <option value="markdown" ${ed.outputFormat === 'markdown' ? 'selected' : ''}>${t('ed_fmt_md')}</option>
            <option value="tsv" ${ed.outputFormat === 'tsv' ? 'selected' : ''}>${t('ed_fmt_tsv')}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">${t('ed_caption_label')}</label>
          <input type="text" class="form-input" id="ed-caption" value="${ed.caption}" />
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1.4;">
            <label class="form-label">${t('ed_label_id')}</label>
            <input type="text" class="form-input" id="ed-label-id" value="${ed.latexLabel}" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('axis_decimals_label')}</label>
            <select class="form-select" id="ed-decimals">
              <option value="0" ${ed.decimals === '0' ? 'selected' : ''}>0</option>
              <option value="1" ${ed.decimals === '1' ? 'selected' : ''}>1</option>
              <option value="2" ${ed.decimals === '2' ? 'selected' : ''}>2</option>
              <option value="3" ${ed.decimals === '3' ? 'selected' : ''}>3</option>
            </select>
          </div>
        </div>
        <div style="font-size: 0.74rem; font-weight: 700; margin-bottom: 6px; color: #000000;">
          Variables, Units & Thresholds:
        </div>
        <div>
          ${ed.variables.map((v, idx) => `
            <div class="editorial-var-row">
              <input type="checkbox" class="ed-var-chk" data-vidx="${idx}" ${v.selected ? 'checked' : ''} />
              <span style="font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${v.column}">${v.column}</span>
              <input type="text" class="form-input ed-var-unit" data-vidx="${idx}" value="${v.unit}" placeholder="Unit" style="padding: 3px 6px; font-size: 0.74rem;" />
              <input type="number" step="any" class="form-input ed-var-thresh" data-vidx="${idx}" value="${v.threshold ?? ''}" placeholder="Thresh" style="padding: 3px 6px; font-size: 0.74rem;" />
            </div>
          `).join('')}
        </div>
      </section>

      <section class="sidebar-section">
        <div class="sidebar-title">
          <span>${t('ed_plate_title')}</span>
          <span class="cm-badge cm-badge-sky">600 DPI</span>
        </div>
        <div class="form-group">
          <label class="form-label">${t('ed_plate_preset_label')}</label>
          <select class="form-select" id="ed-plate-preset">
            <option value="single_85mm" ${ed.plateWidthPreset === 'single_85mm' ? 'selected' : ''}>${t('ed_plate_1col')}</option>
            <option value="half_120mm" ${ed.plateWidthPreset === 'half_120mm' ? 'selected' : ''}>${t('ed_plate_15col')}</option>
            <option value="double_170mm" ${ed.plateWidthPreset === 'double_170mm' ? 'selected' : ''}>${t('ed_plate_2col')}</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('ed_plate_grid_label')}</label>
            <select class="form-select" id="ed-plate-grid">
              <option value="2x2" ${ed.plateGrid === '2x2' ? 'selected' : ''}>2×2 Matrix (4 Panels)</option>
              <option value="2x1" ${ed.plateGrid === '2x1' ? 'selected' : ''}>2×1 Vertical (2 Panels)</option>
              <option value="1x2" ${ed.plateGrid === '1x2' ? 'selected' : ''}>1×2 Side-by-Side (2 Panels)</option>
              <option value="3x1" ${ed.plateGrid === '3x1' ? 'selected' : ''}>3×1 Stack (3 Panels)</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">${t('ed_plate_dpi_label')}</label>
            <select class="form-select" id="ed-plate-dpi">
              <option value="300" ${ed.plateDpi === 300 ? 'selected' : ''}>300 DPI</option>
              <option value="600" ${ed.plateDpi === 600 ? 'selected' : ''}>600 DPI</option>
            </select>
          </div>
        </div>
        ${[0, 1, 2, 3].map(sIdx => `
          <div class="form-group" style="margin-bottom: 6px;">
            <label class="form-label">Slot (${String.fromCharCode(97 + sIdx)}) Series</label>
            <select class="form-select ed-plate-slot" data-sidx="${sIdx}">
              <optgroup label="${t('ed_slot_group_columns')}">
                ${renderColumnOptions(ed.plateSlots[sIdx] || '')}
              </optgroup>
              <optgroup label="${t('ed_slot_group_physics')}">
                ${['carpet', 'comfort', 'duration', 'calibration'].map(k => `<option value="physics:${k}" ${ed.plateSlots[sIdx] === 'physics:' + k ? 'selected' : ''}>${t('ed_slot_physics_' + k)}</option>`).join('')}
              </optgroup>
            </select>
          </div>
        `).join('')}
      </section>
    </aside>

    <main class="data-ingestion-view" style="display: flex; flex-direction: column; gap: 16px;">
      <!-- Card 1: Statistical Summary Table & LaTeX / Markdown Exporter -->
      <div class="data-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <h2 style="font-size: 1.05rem; font-weight: 700; color: #000000;">${t('ed_tables_title')}</h2>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${t('ed_tables_sub')}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary" id="btn-ed-copy-code" style="font-size: 0.78rem;">
              ${t('ed_btn_copy')}
            </button>
            <button class="btn btn-secondary" id="btn-ed-download-code" style="font-size: 0.78rem;">
              ${t('ed_btn_download')}
            </button>
          </div>
        </div>

        <div class="table-preview-scroll" style="max-height: 210px; margin-bottom: 12px;">
          <table class="cm-table">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Unit</th>
                <th>N</th>
                <th>Mean</th>
                <th>Std</th>
                <th>Min</th>
                <th>P5</th>
                <th>Median (P50)</th>
                <th>P95</th>
                <th>Max</th>
                <th>Exceedance</th>
              </tr>
            </thead>
            <tbody>
              ${statRows.map(r => `
                <tr>
                  <td><strong>${r.variable}</strong></td>
                  <td>${r.unit}</td>
                  <td>${r.n}</td>
                  <td>${fmtDec(r.mean, ed.decimals)}</td>
                  <td>${fmtDec(r.std, ed.decimals)}</td>
                  <td>${fmtDec(r.min, ed.decimals)}</td>
                  <td>${fmtDec(r.p5, ed.decimals)}</td>
                  <td><strong>${fmtDec(r.median, ed.decimals)}</strong></td>
                  <td>${fmtDec(r.p95, ed.decimals)}</td>
                  <td>${fmtDec(r.max, ed.decimals)}</td>
                  <td>${r.threshold !== null ? `${r.excHours.toFixed(1)} h (>${r.threshold}, ${r.excPct.toFixed(1)}%)` : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <textarea class="editorial-code-box" id="ed-code-output" readonly>${generatedCode}</textarea>
      </div>

      <!-- Card 2: Composite Figure Plate Compiler -->
      <div class="data-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <h2 style="font-size: 1.05rem; font-weight: 700; color: #000000;">${t('ed_plate_title')}</h2>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${t('ed_plate_sub')}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary" id="btn-ed-plate-svg" style="font-size: 0.78rem;">
              ${t('ed_plate_btn_svg')}
            </button>
            <button class="btn btn-secondary" id="btn-ed-plate-png" style="font-size: 0.78rem;">
              ${t('ed_plate_btn_png')}
            </button>
          </div>
        </div>
        <div style="display: flex; justify-content: center; background: #f8fafc; padding: 14px; border: 1px solid var(--border); border-radius: 8px; overflow: auto;">
          <div id="plotly-plate-chart" class="plot-wrapper"></div>
        </div>
      </div>
    </main>
  `;
}
