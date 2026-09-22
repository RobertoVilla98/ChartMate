import './style.css';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
// @ts-ignore
import Plotly from 'plotly.js-dist-min';

interface DatasetPreview {
  columns: string[];
  rows: string[][];
  total_rows: number;
  detected_sep: string;
}

interface AppState {
  filePath: string | null;
  dataset: DatasetPreview | null;
  selectedX: string;
  selectedY1: string[];
  selectedY2: string[];
  selectedY3: string[];
  chartType: string;
  preset: 'single' | 'double' | 'square' | 'custom';
  widthCm: number;
  heightCm: number;
  showGrid: boolean;
  peakTracker: boolean;
  comfortBand: boolean;
  comfortMin: number;
  comfortMax: number;
}

const state: AppState = {
  filePath: null,
  dataset: null,
  selectedX: '',
  selectedY1: [],
  selectedY2: [],
  selectedY3: [],
  chartType: 'scatter',
  preset: 'double',
  widthCm: 17.0,
  heightCm: 9.5,
  showGrid: true,
  peakTracker: false,
  comfortBand: false,
  comfortMin: 20.0,
  comfortMax: 26.0,
};

// Preset dimensions in CM
const PRESETS = {
  single: { w: 8.5, h: 6.5 },
  double: { w: 17.0, h: 9.5 },
  square: { w: 12.0, h: 12.0 },
  custom: { w: 17.0, h: 9.5 }
};

const appContainer = document.querySelector<HTMLDivElement>('#app')!;

function renderApp() {
  appContainer.innerHTML = `
    <header class="cm-navbar">
      <div class="brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 3V21H21" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M7 16L12 11L15 14L20 7" stroke="#0284c7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="20" cy="7" r="2" fill="#d97706"/>
        </svg>
        <span>CHARTMATE</span>
        <span class="brand-badge">STUDIO</span>
      </div>
      <nav class="nav-tabs">
        <button class="nav-btn active" id="tab-canvas">Single Canvas</button>
        <button class="nav-btn" id="tab-multi">MultiPlot Grid</button>
        <button class="nav-btn" id="tab-maps">Maps (GIS)</button>
      </nav>
      <div>
        <button class="btn btn-primary" id="btn-export">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Export Figure
        </button>
      </div>
    </header>

    <div class="main-container">
      <!-- Left Sidebar: Data & Axis Config -->
      <aside class="sidebar">
        <!-- 1. Data Ingestion -->
        <section class="sidebar-section">
          <div class="sidebar-title">Dataset / SharePoint Source</div>
          <div class="dropzone" id="dropzone">
            <div class="dropzone-icon">📁</div>
            <div style="font-weight: 600; font-size: 0.88rem;">Drag & drop file here</div>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">or click to browse local path</div>
          </div>
          <div id="file-info" style="display: ${state.filePath ? 'block' : 'none'}; margin-top: 10px;">
            <div class="file-path-display">${state.filePath || ''}</div>
            <div style="display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-muted); margin-top: 4px;">
              <span>Rows: <strong>${state.dataset?.total_rows || 0}</strong></span>
              <span>Delim: <strong>${state.dataset?.detected_sep || ''}</strong></span>
            </div>
          </div>
        </section>

        <!-- 2. Variables & Axes -->
        <section class="sidebar-section">
          <div class="sidebar-title">Axes & Mapping</div>
          
          <div class="form-group">
            <label class="form-label">X Axis (Timestamp / Variable)</label>
            <select class="form-select" id="select-x">
              <option value="">Select variable...</option>
              ${renderColumnOptions(state.selectedX)}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Y1 Primary Axis (Left)</label>
            <select class="form-select" id="select-y1" multiple style="height: 75px;">
              ${renderMultipleColumnOptions(state.selectedY1)}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Y2 Secondary Axis (Right 1)</label>
            <select class="form-select" id="select-y2" multiple style="height: 60px;">
              ${renderMultipleColumnOptions(state.selectedY2)}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Chart Type</label>
            <select class="form-select" id="select-ctype">
              <option value="line" ${state.chartType === 'line' ? 'selected' : ''}>Continuous Line</option>
              <option value="scatter" ${state.chartType === 'scatter' ? 'selected' : ''}>Scatter Points</option>
              <option value="bar" ${state.chartType === 'bar' ? 'selected' : ''}>Bar Chart</option>
              <option value="area" ${state.chartType === 'area' ? 'selected' : ''}>Area Chart</option>
              <option value="box" ${state.chartType === 'box' ? 'selected' : ''}>Box Plot</option>
            </select>
          </div>
        </section>

        <!-- 3. Smart Annotations -->
        <section class="sidebar-section">
          <div class="sidebar-title">Smart Scientific Annotations</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer;">
              <input type="checkbox" id="check-peaks" ${state.peakTracker ? 'checked' : ''} />
              <span><strong>Peak & Valley Tracker</strong> (Diurnal Max/Min)</span>
            </label>
            
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer;">
              <input type="checkbox" id="check-comfort" ${state.comfortBand ? 'checked' : ''} />
              <span><strong>Comfort / Target Band</strong> (e.g. 20 - 26 °C)</span>
            </label>

            <div id="comfort-inputs" style="display: ${state.comfortBand ? 'flex' : 'none'}; gap: 6px; margin-top: 4px;">
              <input type="number" class="form-input" id="comfort-min" value="${state.comfortMin}" style="width: 50%; font-size: 0.78rem;" placeholder="Min" />
              <input type="number" class="form-input" id="comfort-max" value="${state.comfortMax}" style="width: 50%; font-size: 0.78rem;" placeholder="Max" />
            </div>
          </div>
        </section>
      </aside>

      <!-- Right Area: Interactive Canvas & Toolbar -->
      <main class="canvas-container">
        <div class="canvas-toolbar">
          <div class="preset-selector">
            <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-muted); align-self: center; margin-right: 4px;">Format:</span>
            <button class="preset-btn ${state.preset === 'single' ? 'active' : ''}" data-preset="single">Single Col (8.5cm)</button>
            <button class="preset-btn ${state.preset === 'double' ? 'active' : ''}" data-preset="double">Double Col (17cm)</button>
            <button class="preset-btn ${state.preset === 'square' ? 'active' : ''}" data-preset="square">Square (12×12cm)</button>
          </div>

          <div style="display: flex; align-items: center; gap: 12px; font-size: 0.8rem; color: var(--text-muted);">
            <span>Dimensions: <strong id="dim-badge">${state.widthCm} × ${state.heightCm} cm</strong></span>
            <span style="background: var(--surface-hover); padding: 2px 6px; border-radius: 4px; font-family: monospace;">600 DPI Export Ready</span>
          </div>
        </div>

        <div class="chart-viewport">
          <div id="plotly-chart" class="plot-wrapper"></div>
        </div>
      </main>
    </div>
  `;

  attachEventListeners();
  updateChart();
}

function renderColumnOptions(selected: string): string {
  if (!state.dataset?.columns) return '';
  return state.dataset.columns.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

function renderMultipleColumnOptions(selectedArr: string[]): string {
  if (!state.dataset?.columns) return '';
  return state.dataset.columns.map(c => `<option value="${c}" ${selectedArr.includes(c) ? 'selected' : ''}>${c}</option>`).join('');
}

function attachEventListeners() {
  const dropzone = document.getElementById('dropzone');
  dropzone?.addEventListener('click', handleFileSelect);

  // Drag and drop from explorer / sharepoint
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // On web/tauri, if path available
      const filePath = (file as any).path || file.name;
      await loadFile(filePath);
    }
  });

  // Select X
  document.getElementById('select-x')?.addEventListener('change', (e) => {
    state.selectedX = (e.target as HTMLSelectElement).value;
    updateChart();
  });

  // Select Y1
  document.getElementById('select-y1')?.addEventListener('change', (e) => {
    const opts = Array.from((e.target as HTMLSelectElement).selectedOptions);
    state.selectedY1 = opts.map(o => o.value);
    updateChart();
  });

  // Select Y2
  document.getElementById('select-y2')?.addEventListener('change', (e) => {
    const opts = Array.from((e.target as HTMLSelectElement).selectedOptions);
    state.selectedY2 = opts.map(o => o.value);
    updateChart();
  });

  // Chart Type
  document.getElementById('select-ctype')?.addEventListener('change', (e) => {
    state.chartType = (e.target as HTMLSelectElement).value;
    updateChart();
  });

  // Presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = (e.target as HTMLElement).getAttribute('data-preset') as any;
      if (p && PRESETS[p as keyof typeof PRESETS]) {
        state.preset = p;
        state.widthCm = PRESETS[p as keyof typeof PRESETS].w;
        state.heightCm = PRESETS[p as keyof typeof PRESETS].h;
        renderApp();
      }
    });
  });

  // Annotations
  document.getElementById('check-peaks')?.addEventListener('change', (e) => {
    state.peakTracker = (e.target as HTMLInputElement).checked;
    updateChart();
  });

  document.getElementById('check-comfort')?.addEventListener('change', (e) => {
    state.comfortBand = (e.target as HTMLInputElement).checked;
    const inputs = document.getElementById('comfort-inputs');
    if (inputs) inputs.style.display = state.comfortBand ? 'flex' : 'none';
    updateChart();
  });

  document.getElementById('comfort-min')?.addEventListener('input', (e) => {
    state.comfortMin = parseFloat((e.target as HTMLInputElement).value) || 0;
    updateChart();
  });

  document.getElementById('comfort-max')?.addEventListener('input', (e) => {
    state.comfortMax = parseFloat((e.target as HTMLInputElement).value) || 0;
    updateChart();
  });

  // Export
  document.getElementById('btn-export')?.addEventListener('click', () => {
    Plotly.downloadImage('plotly-chart', {
      format: 'svg',
      width: state.widthCm * 37.795,
      height: state.heightCm * 37.795,
      filename: `ChartMate_${state.preset}_figure`
    });
  });
}

async function handleFileSelect() {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'Supported Datasets', extensions: ['csv', 'xlsx', 'xls', 'tsv', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (selected) {
      await loadFile(selected as string);
    }
  } catch (err) {
    console.warn('Fallback file selection dialog', err);
  }
}

async function loadFile(path: string) {
  try {
    state.filePath = path;
    const preview = await invoke<DatasetPreview>('read_dataset_sample', { filePath: path, maxPreviewRows: 100 });
    state.dataset = preview;

    // Auto-assign columns
    if (preview.columns.length > 0) {
      state.selectedX = preview.columns[0];
      if (preview.columns.length > 1) {
        state.selectedY1 = [preview.columns[1]];
      }
    }

    renderApp();
  } catch (err) {
    alert(`Errore lettura file locale: ${err}`);
  }
}

function updateChart() {
  const chartEl = document.getElementById('plotly-chart');
  if (!chartEl) return;

  // Calculate pixel size based on CM aspect ratio
  const ratio = state.widthCm / state.heightCm;
  let pxW = 850;
  let pxH = Math.round(pxW / ratio);

  if (state.preset === 'square') {
    pxW = 600;
    pxH = 600;
  } else if (state.preset === 'single') {
    pxW = 550;
    pxH = Math.round(pxW / ratio);
  }

  // Generate sample data if no file loaded yet
  let xVals: any[] = [];
  let traces: any[] = [];

  if (state.dataset && state.selectedX) {
    const xIdx = state.dataset.columns.indexOf(state.selectedX);
    xVals = state.dataset.rows.map(r => r[xIdx]);

    // Primary Y1 Traces
    state.selectedY1.forEach((col, idx) => {
      const yIdx = state.dataset!.columns.indexOf(col);
      const yVals = state.dataset!.rows.map(r => parseFloat(r[yIdx]?.replace(',', '.')) || null);
      traces.push({
        x: xVals,
        y: yVals,
        name: col,
        type: state.chartType === 'area' ? 'scatter' : state.chartType,
        fill: state.chartType === 'area' ? 'tozeroy' : undefined,
        mode: state.chartType === 'line' || state.chartType === 'area' ? 'lines' : 'markers',
        line: { color: ['#059669', '#0284c7', '#d97706'][idx % 3], width: 2.2 },
        marker: { size: 6 }
      });
    });

    // Secondary Y2 Traces
    state.selectedY2.forEach((col) => {
      const yIdx = state.dataset!.columns.indexOf(col);
      const yVals = state.dataset!.rows.map(r => parseFloat(r[yIdx]?.replace(',', '.')) || null);
      traces.push({
        x: xVals,
        y: yVals,
        name: `${col} (Y2)`,
        yaxis: 'y2',
        type: state.chartType === 'area' ? 'scatter' : state.chartType,
        mode: 'lines',
        line: { color: '#e11d48', width: 2, dash: 'dash' }
      });
    });
  } else {
    // Demo waveform for instant visualization
    const steps = 40;
    xVals = Array.from({ length: steps }, (_, i) => `2026-09-01 ${String(i % 24).padStart(2, '0')}:00`);
    const yVals = Array.from({ length: steps }, (_, i) => 21.5 + 4.5 * Math.sin(i / 3));
    traces.push({
      x: xVals,
      y: yVals,
      name: 'Indoor Temp (°C)',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#059669', width: 2.2 },
      marker: { size: 5, color: '#059669' }
    });
  }

  // Layout with Velth Clean Typography & Multi-axis
  const layout: any = {
    width: pxW,
    height: pxH,
    margin: { l: 60, r: state.selectedY2.length > 0 ? 60 : 30, t: 40, b: 50 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: 'Outfit, sans-serif', size: 12, color: '#0f172a' },
    xaxis: {
      title: { text: state.selectedX || 'Time / Parameter', font: { size: 12, weight: 600 } },
      gridcolor: '#f1f5f9',
      linecolor: '#cbd5e1',
      showline: true,
      mirror: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: 10 }
    },
    yaxis: {
      title: { text: state.selectedY1.join(', ') || 'Primary Y1', font: { size: 12, weight: 600 } },
      gridcolor: '#f1f5f9',
      linecolor: '#cbd5e1',
      showline: true,
      mirror: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: 10 }
    },
    legend: {
      orientation: 'h',
      x: 0.5,
      y: 1.12,
      xanchor: 'center',
      font: { size: 11 }
    },
    shapes: []
  };

  // Add Y2 Axis if needed
  if (state.selectedY2.length > 0) {
    layout.yaxis2 = {
      title: { text: state.selectedY2.join(', '), font: { size: 12, weight: 600, color: '#e11d48' } },
      overlaying: 'y',
      side: 'right',
      gridcolor: 'transparent',
      linecolor: '#e11d48',
      showline: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: 10, color: '#e11d48' }
    };
  }

  // Comfort Band Shading
  if (state.comfortBand) {
    layout.shapes.push({
      type: 'rect',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: state.comfortMin,
      y1: state.comfortMax,
      fillcolor: 'rgba(5, 150, 105, 0.12)',
      line: { width: 0 },
      layer: 'below'
    });
  }

  Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
}

// Initial Run
renderApp();
