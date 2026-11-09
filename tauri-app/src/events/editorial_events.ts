// @ts-ignore
import Plotly from 'plotly.js-dist-min';
import { computeVariableStats, generatePublicationTableCode } from '../scientific_modules';
import { updateEditorialSuite } from '../charts/physics';
import { state } from '../core/state';
import { renderApp } from '../ui/render_app';

export function attachEditorialEvents() {
  // Track 6: Editorial & LaTeX Suite Listeners
  document.getElementById('ed-output-fmt')?.addEventListener('change', (e) => {
    state.editorialState.outputFormat = (e.target as HTMLSelectElement).value as any;
    renderApp();
  });
  document.getElementById('ed-caption')?.addEventListener('input', (e) => {
    state.editorialState.caption = (e.target as HTMLInputElement).value;
    const codeBox = document.getElementById('ed-code-output') as HTMLTextAreaElement | null;
    if (codeBox && state.dataset) {
      const sr = computeVariableStats(state.dataset.columns, state.dataset, state.editorialState, state.hasTimestamp ? state.timestampCol : undefined);
      codeBox.value = generatePublicationTableCode(sr, state.editorialState);
    }
  });
  document.getElementById('ed-label-id')?.addEventListener('input', (e) => {
    state.editorialState.latexLabel = (e.target as HTMLInputElement).value;
    const codeBox = document.getElementById('ed-code-output') as HTMLTextAreaElement | null;
    if (codeBox && state.dataset) {
      const sr = computeVariableStats(state.dataset.columns, state.dataset, state.editorialState, state.hasTimestamp ? state.timestampCol : undefined);
      codeBox.value = generatePublicationTableCode(sr, state.editorialState);
    }
  });
  document.getElementById('ed-decimals')?.addEventListener('change', (e) => {
    state.editorialState.decimals = (e.target as HTMLSelectElement).value as any;
    renderApp();
  });
  document.querySelectorAll('.ed-var-chk').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-vidx') || '0', 10);
      if (state.editorialState.variables[idx]) {
        state.editorialState.variables[idx].selected = (e.target as HTMLInputElement).checked;
        renderApp();
      }
    });
  });
  document.querySelectorAll('.ed-var-unit').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-vidx') || '0', 10);
      if (state.editorialState.variables[idx]) {
        state.editorialState.variables[idx].unit = (e.target as HTMLInputElement).value;
        renderApp();
      }
    });
  });
  document.querySelectorAll('.ed-var-thresh').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-vidx') || '0', 10);
      if (state.editorialState.variables[idx]) {
        const raw = (e.target as HTMLInputElement).value.trim();
        state.editorialState.variables[idx].threshold = raw === '' ? null : parseFloat(raw);
        renderApp();
      }
    });
  });

  document.getElementById('btn-ed-copy-code')?.addEventListener('click', () => {
    const codeBox = document.getElementById('ed-code-output') as HTMLTextAreaElement | null;
    if (codeBox) {
      navigator.clipboard.writeText(codeBox.value);
      const btn = document.getElementById('btn-ed-copy-code');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied to Clipboard!';
        setTimeout(() => { btn.textContent = orig; }, 1600);
      }
    }
  });

  document.getElementById('btn-ed-download-code')?.addEventListener('click', () => {
    const codeBox = document.getElementById('ed-code-output') as HTMLTextAreaElement | null;
    if (!codeBox) return;
    const ext = state.editorialState.outputFormat === 'latex' ? 'tex' : (state.editorialState.outputFormat === 'markdown' ? 'md' : 'tsv');
    const blob = new Blob([codeBox.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ChartMate_Statistical_Table.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('ed-plate-preset')?.addEventListener('change', (e) => {
    state.editorialState.plateWidthPreset = (e.target as HTMLSelectElement).value as any;
    updateEditorialSuite();
  });
  document.getElementById('ed-plate-grid')?.addEventListener('change', (e) => {
    state.editorialState.plateGrid = (e.target as HTMLSelectElement).value as any;
    updateEditorialSuite();
  });
  document.getElementById('ed-plate-dpi')?.addEventListener('change', (e) => {
    state.editorialState.plateDpi = (parseInt((e.target as HTMLSelectElement).value, 10) === 300 ? 300 : 600);
  });
  document.querySelectorAll('.ed-plate-slot').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const sIdx = parseInt((e.target as HTMLElement).getAttribute('data-sidx') || '0', 10);
      state.editorialState.plateSlots[sIdx] = (e.target as HTMLSelectElement).value;
      updateEditorialSuite();
    });
  });

  document.getElementById('btn-ed-plate-svg')?.addEventListener('click', () => {
    const mm = state.editorialState.plateWidthPreset === 'single_85mm' ? 85 : (state.editorialState.plateWidthPreset === 'half_120mm' ? 120 : 170);
    // SVG user units = CSS px at 96 px/in, so the drawing is exactly mm wide when placed at 100 %.
    Plotly.downloadImage('plotly-plate-chart', {
      format: 'svg',
      width: Math.round(mm * 96 / 25.4),
      height: Math.round(mm * 0.85 * 96 / 25.4),
      filename: `ChartMate_Composite_Plate_${mm}mm`
    });
  });

  document.getElementById('btn-ed-plate-png')?.addEventListener('click', () => {
    const mm = state.editorialState.plateWidthPreset === 'single_85mm' ? 85 : (state.editorialState.plateWidthPreset === 'half_120mm' ? 120 : 170);
    // Layout in CSS pixels at 96 px/in (1 mm = 3.7795 px), rasterised at dpi/96 so that the PNG has
    // exactly mm/25.4 × dpi pixels: 170 mm at 600 dpi → 4016 px (previously 2× / 4× = 192 / 384 dpi).
    const pxPerMm = 96 / 25.4;
    Plotly.downloadImage('plotly-plate-chart', {
      format: 'png',
      width: Math.round(mm * pxPerMm),
      height: Math.round(mm * 0.85 * pxPerMm),
      scale: state.editorialState.plateDpi / 96,
      filename: `ChartMate_Composite_Plate_${mm}mm_${state.editorialState.plateDpi}DPI`
    } as any);
  });
}
