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
  suggested_ts_col?: string;
  suggested_ts_format?: string;
}

interface ParseOptions {
  separator?: string;
  decimal?: string;
  timestamp_col?: string;
  timestamp_format?: string;
  max_rows?: number;
}

interface TraceConfig {
  column: string;
  axis: 'y1' | 'y2' | 'y3' | 'y4';
  chartType: 'line' | 'scatter' | 'bar' | 'area';
  color: string;
  lineWidth: number;
  lineDash: 'solid' | 'dash' | 'dot';
}

interface AppState {
  currentTab: 'data' | 'canvas' | 'multi';
  filePath: string | null;
  dataset: DatasetPreview | null;
  
  // Ingestion & Parsing Config
  separator: string;
  decimal: string;
  hasTimestamp: boolean;
  timestampCol: string;
  timestampFormat: string;
  
  // Timeframe Filtering
  timeframeMode: 'all' | 'day' | 'week' | 'month' | 'custom';
  startDate: string;
  endDate: string;
  
  // Canvas Mapping & Axes
  selectedX: string;
  traces: TraceConfig[];
  preset: 'single' | 'double' | 'square' | 'custom';
  widthCm: number;
  heightCm: number;
  
  // Axis Titles
  y1Title: string;
  y2Title: string;
  y3Title: string;
  y4Title: string;
  
  // Typography
  fontFamily: string;
  fontSize: number;
  
  // Smart Annotations
  peakMode: 'none' | 'global' | 'daily' | 'weekly';
  comfortBand: boolean;
  comfortSeason: 'winter' | 'summer' | 'custom';
  comfortMin: number;
  comfortMax: number;
  comfortColor: string;
}

const DEFAULT_PALETTE = ['#000000', '#059669', '#0284c7', '#d97706', '#7c3aed', '#e11d48'];

const state: AppState = {
  currentTab: 'data',
  filePath: null,
  dataset: null,
  separator: 'auto',
  decimal: '.',
  hasTimestamp: true,
  timestampCol: '',
  timestampFormat: '%Y-%m-%d %H:%M:%S',
  timeframeMode: 'all',
  startDate: '',
  endDate: '',
  selectedX: '',
  traces: [],
  preset: 'double',
  widthCm: 17.0,
  heightCm: 9.5,
  y1Title: '',
  y2Title: '',
  y3Title: '',
  y4Title: '',
  fontFamily: 'Outfit, sans-serif',
  fontSize: 11,
  peakMode: 'none',
  comfortBand: false,
  comfortSeason: 'winter',
  comfortMin: 20.0,
  comfortMax: 22.0,
  comfortColor: 'rgba(5, 150, 105, 0.12)',
};

const PRESETS = {
  single: { w: 8.5, h: 6.5 },
  double: { w: 17.0, h: 9.5 },
  square: { w: 12.0, h: 12.0 },
  custom: { w: 17.0, h: 9.5 }
};

const appContainer = document.querySelector<HTMLDivElement>('#app')!;

function renderApp() {
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
        <button class="nav-btn ${state.currentTab === 'data' ? 'active' : ''}" id="tab-nav-data">1. Data Source & Parser</button>
        <button class="nav-btn ${state.currentTab === 'canvas' ? 'active' : ''}" id="tab-nav-canvas">2. Single Canvas Studio</button>
        <button class="nav-btn ${state.currentTab === 'multi' ? 'active' : ''}" id="tab-nav-multi">3. MultiPlot Grid</button>
      </nav>
      <div>
        <button class="btn btn-primary" id="btn-export">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Export Figure (SVG)
        </button>
      </div>
    </header>

    <div class="main-container">
      <!-- VIEW 1: DATA INGESTION (Source, Delimiters & Preview Table) -->
      <div class="view-panel ${state.currentTab === 'data' ? 'active' : ''}" id="view-data">
        <aside class="sidebar">
          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>Local / SharePoint File</span>
              <span class="cm-badge cm-badge-emerald">Direct I/O</span>
            </div>
            <div class="dropzone" id="dropzone-data">
              <div class="dropzone-icon">📂</div>
              <div style="font-weight: 600; font-size: 0.88rem; color: #000000;">Drag file here</div>
              <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">or click to browse local path</div>
            </div>
            ${state.filePath ? `
              <div class="file-path-display">${state.filePath}</div>
              <div style="margin-top: 6px; display: flex; justify-content: space-between; font-size: 0.75rem;">
                <span>Total Rows: <strong>${state.dataset?.total_rows || 0}</strong></span>
                <span class="cm-badge cm-badge-sky">${state.dataset?.detected_sep || 'Unknown'}</span>
              </div>
            ` : ''}
          </section>

          <!-- Separators & Formatting -->
          <section class="sidebar-section">
            <div class="sidebar-title">Delimiter & Decimals</div>
            
            <div class="form-group">
              <label class="form-label">Column Separator</label>
              <select class="form-select" id="cfg-separator">
                <option value="auto" ${state.separator === 'auto' ? 'selected' : ''}>Auto-Detect</option>
                <option value="," ${state.separator === ',' ? 'selected' : ''}>, (Comma)</option>
                <option value=";" ${state.separator === ';' ? 'selected' : ''}>; (Semicolon - Italian/EU)</option>
                <option value="\t" ${state.separator === '\t' ? 'selected' : ''}>\\t (Tab / TSV)</option>
                <option value="|" ${state.separator === '|' ? 'selected' : ''}>| (Pipe)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Decimal Format</label>
              <select class="form-select" id="cfg-decimal">
                <option value="." ${state.decimal === '.' ? 'selected' : ''}>. (Dot: 12.34)</option>
                <option value="," ${state.decimal === ',' ? 'selected' : ''}>, (Comma: 12,34)</option>
              </select>
            </div>

            <button class="btn btn-secondary" id="btn-reparse" style="width: 100%; margin-top: 6px;">
              Apply & Re-Parse
            </button>
          </section>

          <!-- Timestamp Detection -->
          <section class="sidebar-section">
            <div class="sidebar-title">Timestamp & Time-Series</div>
            
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; margin-bottom: 8px;">
              <input type="checkbox" id="cfg-has-ts" ${state.hasTimestamp ? 'checked' : ''} />
              <span style="font-weight: 600; color: #000000;">Dataset has timestamp column</span>
            </label>

            <div id="ts-config-panel" style="display: ${state.hasTimestamp ? 'block' : 'none'};">
              <div class="form-group">
                <label class="form-label">Timestamp Column</label>
                <select class="form-select" id="cfg-ts-col">
                  <option value="">Select timestamp column...</option>
                  ${renderColumnOptions(state.timestampCol)}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Datetime Parsing Format</label>
                <input type="text" class="form-input" id="cfg-ts-format" value="${state.timestampFormat}" placeholder="%Y-%m-%d %H:%M:%S" />
              </div>
            </div>

            <button class="btn btn-primary" id="btn-goto-canvas" style="width: 100%; margin-top: 14px;">
              Open in Canvas Studio →
            </button>
          </section>
        </aside>

        <!-- Ingestion Table Preview Body -->
        <main class="data-ingestion-view">
          <div class="data-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div>
                <h2 style="font-size: 1.1rem; font-weight: 700; color: #000000;">Dataset Schema & Raw Preview</h2>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                  Visualizzazione prime 100 righe del file selezionato
                </div>
              </div>
              <div>
                ${state.dataset ? `
                  <span class="cm-badge cm-badge-emerald" style="font-size: 0.8rem; padding: 4px 8px;">
                    ✓ ${state.dataset.columns.length} Colonne · ${state.dataset.total_rows} Righe Totali
                  </span>
                ` : '<span style="font-size: 0.8rem; color: var(--text-muted);">Nessun dataset caricato</span>'}
              </div>
            </div>

            <div class="table-preview-scroll">
              ${renderPreviewTable()}
            </div>
          </div>
        </main>
      </div>

      <!-- VIEW 2: SINGLE CANVAS STUDIO (Trace Styler, Multi-Axis Y1-Y4, Advanced Annotations) -->
      <div class="view-panel ${state.currentTab === 'canvas' ? 'active' : ''}" id="view-canvas">
        <aside class="sidebar">
          
          <!-- 1. TIMEFRAME SELECTOR -->
          ${state.hasTimestamp ? `
            <section class="sidebar-section">
              <div class="sidebar-title">
                <span>Timeframe & Finestra Temporale</span>
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
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">Inizio</label>
                  <input type="date" class="form-input" id="canvas-start-date" value="${state.startDate}" />
                </div>
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">Fine</label>
                  <input type="date" class="form-input" id="canvas-end-date" value="${state.endDate}" />
                </div>
              </div>
            </section>
          ` : ''}

          <!-- 2. ASSE X -->
          <section class="sidebar-section">
            <div class="sidebar-title">Asse Orizzontale (X)</div>
            <div class="form-group" style="margin-bottom: 0;">
              <select class="form-select" id="select-x">
                <option value="">Seleziona variabile X...</option>
                ${renderColumnOptions(state.selectedX)}
              </select>
            </div>
          </section>

          <!-- 3. TRACE STYLER (PER-TRACCIA: Tipo, Asse Y1-Y4, Colore, Spessore) -->
          <section class="sidebar-section">
            <div class="sidebar-title">
              <span>Tracce & Stile Per-Serie</span>
              <button class="btn btn-secondary" id="btn-add-trace" style="font-size: 0.72rem; padding: 2px 8px;">
                + Aggiungi Serie
              </button>
            </div>
            
            <div id="traces-list-container">
              ${renderTraceCards()}
            </div>
          </section>

          <!-- 4. ETICHETTE E TITOLI ASSI (Y1, Y2, Y3, Y4) -->
          <section class="sidebar-section">
            <div class="sidebar-title">Etichette Assi Scientifici</div>
            <div class="form-group">
              <label class="form-label">Titolo Y1 (Sinistra)</label>
              <input type="text" class="form-input" id="axis-y1-title" value="${state.y1Title}" placeholder="es. Temperatura [°C]" />
            </div>
            ${state.traces.some(t => t.axis === 'y2') ? `
              <div class="form-group">
                <label class="form-label">Titolo Y2 (Destra 1)</label>
                <input type="text" class="form-input" id="axis-y2-title" value="${state.y2Title}" placeholder="es. Umidità Relativa [%]" />
              </div>
            ` : ''}
            ${state.traces.some(t => t.axis === 'y3') ? `
              <div class="form-group">
                <label class="form-label">Titolo Y3 (Destra 2)</label>
                <input type="text" class="form-input" id="axis-y3-title" value="${state.y3Title}" placeholder="es. CO₂ [ppm]" />
              </div>
            ` : ''}
            ${state.traces.some(t => t.axis === 'y4') ? `
              <div class="form-group">
                <label class="form-label">Titolo Y4 (Destra 3)</label>
                <input type="text" class="form-input" id="axis-y4-title" value="${state.y4Title}" placeholder="es. Potenza Elettrica [kW]" />
              </div>
            ` : ''}
          </section>

          <!-- 5. SMART SCIENTIFIC ANNOTATIONS -->
          <section class="sidebar-section">
            <div class="sidebar-title">Smart Scientific Annotations</div>
            
            <!-- Peak Tracker Configurabile -->
            <div class="form-group">
              <label class="form-label">Peak & Valley Tracker</label>
              <select class="form-select" id="cfg-peak-mode">
                <option value="none" ${state.peakMode === 'none' ? 'selected' : ''}>Disattivato</option>
                <option value="global" ${state.peakMode === 'global' ? 'selected' : ''}>🔴 Max & 🔵 Min Globale (Intervallo Attivo)</option>
                <option value="daily" ${state.peakMode === 'daily' ? 'selected' : ''}>📅 Estremi Giornalieri (Picco Diurno / Min Notturna)</option>
                <option value="weekly" ${state.peakMode === 'weekly' ? 'selected' : ''}>📊 Estremi Settimanali (Max & Min per Settimana)</option>
              </select>
            </div>

            <!-- Comfort / Target Band Personalizzabile -->
            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; margin-bottom: 6px;">
                <input type="checkbox" id="check-comfort" ${state.comfortBand ? 'checked' : ''} />
                <span style="font-weight: 600; color: #000000;">Fascia di Target / Comfort IEQ</span>
              </label>

              <div id="comfort-panel" style="display: ${state.comfortBand ? 'block' : 'none'}; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
                <div class="form-group">
                  <label class="form-label">Stagione / Preset Range</label>
                  <select class="form-select" id="cfg-comfort-season">
                    <option value="winter" ${state.comfortSeason === 'winter' ? 'selected' : ''}>Inverno (20.0 - 22.0 °C)</option>
                    <option value="summer" ${state.comfortSeason === 'summer' ? 'selected' : ''}>Estate (24.0 - 26.0 °C)</option>
                    <option value="custom" ${state.comfortSeason === 'custom' ? 'selected' : ''}>Personalizzato (Custom)</option>
                  </select>
                </div>

                <div class="form-row">
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">Minimo [Y]</label>
                    <input type="number" step="0.5" class="form-input" id="comfort-min" value="${state.comfortMin}" />
                  </div>
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">Massimo [Y]</label>
                    <input type="number" step="0.5" class="form-input" id="comfort-max" value="${state.comfortMax}" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 6. TIPOGRAFIA SCIENTIFICA (PAPER READY) -->
          <section class="sidebar-section">
            <div class="sidebar-title">Tipografia Journal-Ready</div>
            <div class="form-row">
              <div class="form-group" style="flex: 2;">
                <label class="form-label">Font Family</label>
                <select class="form-select" id="cfg-font-family">
                  <option value="Outfit, sans-serif" ${state.fontFamily.includes('Outfit') ? 'selected' : ''}>Outfit (Modern Clean)</option>
                  <option value="Arial, sans-serif" ${state.fontFamily.includes('Arial') ? 'selected' : ''}>Arial / Helvetica</option>
                  <option value="'Times New Roman', serif" ${state.fontFamily.includes('Times') ? 'selected' : ''}>Times New Roman (Classic)</option>
                  <option value="'JetBrains Mono', monospace" ${state.fontFamily.includes('JetBrains') ? 'selected' : ''}>JetBrains Mono (Technical)</option>
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Dimensione</label>
                <input type="number" min="8" max="18" class="form-input" id="cfg-font-size" value="${state.fontSize}" />
              </div>
            </div>
          </section>
        </aside>

        <!-- Canvas Display Area -->
        <main class="canvas-container">
          <div class="canvas-toolbar">
            <div class="preset-selector">
              <span style="font-size: 0.78rem; font-weight: 700; color: #000000; align-self: center; margin-right: 4px;">Preset Pubblicazione:</span>
              <button class="preset-btn ${state.preset === 'single' ? 'active' : ''}" data-preset="single">Singola Colonna (8.5cm)</button>
              <button class="preset-btn ${state.preset === 'double' ? 'active' : ''}" data-preset="double">Doppia Colonna (17cm)</button>
              <button class="preset-btn ${state.preset === 'square' ? 'active' : ''}" data-preset="square">Quadrato (12×12cm)</button>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; font-size: 0.8rem;">
              <span>Dimensioni: <strong id="dim-badge" style="color: #000000;">${state.widthCm} × ${state.heightCm} cm</strong></span>
              <span class="cm-badge cm-badge-emerald">Vector 600 DPI Ready</span>
            </div>
          </div>

          <div class="chart-viewport">
            <div id="plotly-chart" class="plot-wrapper"></div>
          </div>
        </main>
      </div>
    </div>
  `;

  attachEventListeners();
  if (state.currentTab === 'canvas') {
    updateChart();
  }
}

function renderColumnOptions(selected: string): string {
  if (!state.dataset?.columns) return '';
  return state.dataset.columns.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

function renderTraceCards(): string {
  if (state.traces.length === 0) {
    return `<div style="font-size: 0.78rem; color: var(--text-muted); text-align: center; padding: 12px; border: 1px dashed var(--border); border-radius: 6px;">
      Nessuna serie aggiunta. Clicca "+ Aggiungi Serie" per iniziare.
    </div>`;
  }

  return state.traces.map((trace, idx) => `
    <div class="trace-card" data-idx="${idx}">
      <div class="trace-header">
        <span class="trace-name">${trace.column}</span>
        <button class="btn btn-secondary btn-del-trace" data-idx="${idx}" style="padding: 1px 6px; font-size: 0.7rem; color: var(--rose);">
          ✕ Rimuovi
        </button>
      </div>
      
      <div class="trace-controls">
        <!-- Asse Target -->
        <select class="trace-select sel-trace-axis" data-idx="${idx}" title="Asse Y">
          <option value="y1" ${trace.axis === 'y1' ? 'selected' : ''}>Y1 (Sinistra)</option>
          <option value="y2" ${trace.axis === 'y2' ? 'selected' : ''}>Y2 (Destra 1)</option>
          <option value="y3" ${trace.axis === 'y3' ? 'selected' : ''}>Y3 (Destra 2)</option>
          <option value="y4" ${trace.axis === 'y4' ? 'selected' : ''}>Y4 (Destra 3)</option>
        </select>

        <!-- Tipologia di grafico per serie -->
        <select class="trace-select sel-trace-type" data-idx="${idx}" title="Tipo di Traccia">
          <option value="line" ${trace.chartType === 'line' ? 'selected' : ''}>📈 Linea</option>
          <option value="scatter" ${trace.chartType === 'scatter' ? 'selected' : ''}>⚪ Scatter</option>
          <option value="bar" ${trace.chartType === 'bar' ? 'selected' : ''}>📊 Barre</option>
          <option value="area" ${trace.chartType === 'area' ? 'selected' : ''}>▲ Area</option>
        </select>

        <!-- Stile Tratteggio -->
        <select class="trace-select sel-trace-dash" data-idx="${idx}" title="Tratteggio Linea">
          <option value="solid" ${trace.lineDash === 'solid' ? 'selected' : ''}>— Continua</option>
          <option value="dash" ${trace.lineDash === 'dash' ? 'selected' : ''}>-- Tratteggiata</option>
          <option value="dot" ${trace.lineDash === 'dot' ? 'selected' : ''}>·· Puntata</option>
        </select>

        <!-- Colore Personalizzato -->
        <input type="color" class="trace-color-input inp-trace-color" data-idx="${idx}" value="${trace.color}" title="Colore Serie" />
      </div>
    </div>
  `).join('');
}

function renderPreviewTable(): string {
  if (!state.dataset || state.dataset.columns.length === 0) {
    return `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 8px;">📊</div>
        <div style="font-weight: 600;">Nessun dataset caricato</div>
        <div style="font-size: 0.8rem; margin-top: 4px;">Trascina un file CSV o Excel nella barra laterale sinistra per avviare l'analisi.</div>
      </div>
    `;
  }

  const thead = `<tr>${state.dataset.columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
  const tbody = state.dataset.rows.slice(0, 50).map(row => {
    return `<tr>${row.map(val => `<td>${val}</td>`).join('')}</tr>`;
  }).join('');

  return `<table class="cm-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function attachEventListeners() {
  // Navigation Tabs
  document.getElementById('tab-nav-data')?.addEventListener('click', () => {
    state.currentTab = 'data';
    renderApp();
  });

  document.getElementById('tab-nav-canvas')?.addEventListener('click', () => {
    state.currentTab = 'canvas';
    renderApp();
  });

  document.getElementById('btn-goto-canvas')?.addEventListener('click', () => {
    state.currentTab = 'canvas';
    renderApp();
  });

  // Dropzone File Loading
  const dropzone = document.getElementById('dropzone-data');
  dropzone?.addEventListener('click', handleFileSelect);

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
      const filePath = (file as any).path || file.name;
      await loadFile(filePath);
    }
  });

  // Delimiter & Decimal Config
  document.getElementById('cfg-separator')?.addEventListener('change', (e) => {
    state.separator = (e.target as HTMLSelectElement).value;
  });

  document.getElementById('cfg-decimal')?.addEventListener('change', (e) => {
    state.decimal = (e.target as HTMLSelectElement).value;
  });

  document.getElementById('btn-reparse')?.addEventListener('click', async () => {
    if (state.filePath) {
      await loadFile(state.filePath);
    }
  });

  // Timestamp Checkbox
  document.getElementById('cfg-has-ts')?.addEventListener('change', (e) => {
    state.hasTimestamp = (e.target as HTMLInputElement).checked;
    const panel = document.getElementById('ts-config-panel');
    if (panel) panel.style.display = state.hasTimestamp ? 'block' : 'none';
  });

  document.getElementById('cfg-ts-col')?.addEventListener('change', (e) => {
    state.timestampCol = (e.target as HTMLSelectElement).value;
    state.selectedX = state.timestampCol;
  });

  document.getElementById('cfg-ts-format')?.addEventListener('input', (e) => {
    state.timestampFormat = (e.target as HTMLInputElement).value;
  });

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

  // Canvas: Select X
  document.getElementById('select-x')?.addEventListener('change', (e) => {
    state.selectedX = (e.target as HTMLSelectElement).value;
    updateChart();
  });

  // Trace Styler: Add Trace Button
  document.getElementById('btn-add-trace')?.addEventListener('click', () => {
    if (!state.dataset || state.dataset.columns.length === 0) return;
    
    // Pick the first column that isn't X and isn't already added, or any column
    const available = state.dataset.columns.filter(c => c !== state.selectedX && !state.traces.some(t => t.column === c));
    const nextCol = available.length > 0 ? available[0] : state.dataset.columns[1] || state.dataset.columns[0];
    
    const nextColor = DEFAULT_PALETTE[state.traces.length % DEFAULT_PALETTE.length];
    state.traces.push({
      column: nextCol,
      axis: state.traces.length === 0 ? 'y1' : (state.traces.length === 1 ? 'y2' : 'y1'),
      chartType: 'line',
      color: nextColor,
      lineWidth: 2.0,
      lineDash: 'solid'
    });

    renderApp();
  });

  // Trace Styler: Delete Trace
  document.querySelectorAll('.btn-del-trace').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces.splice(idx, 1);
      renderApp();
    });
  });

  // Trace Styler: Per-trace Axis Change
  document.querySelectorAll('.sel-trace-axis').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].axis = (e.target as HTMLSelectElement).value as any;
      renderApp();
    });
  });

  // Trace Styler: Per-trace Type Change (Line, Scatter, Bar, Area)
  document.querySelectorAll('.sel-trace-type').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].chartType = (e.target as HTMLSelectElement).value as any;
      updateChart();
    });
  });

  // Trace Styler: Line Dash
  document.querySelectorAll('.sel-trace-dash').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].lineDash = (e.target as HTMLSelectElement).value as any;
      updateChart();
    });
  });

  // Trace Styler: Color
  document.querySelectorAll('.inp-trace-color').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0', 10);
      state.traces[idx].color = (e.target as HTMLInputElement).value;
      updateChart();
    });
  });

  // Axis Titles Inputs
  document.getElementById('axis-y1-title')?.addEventListener('input', (e) => {
    state.y1Title = (e.target as HTMLInputElement).value;
    updateChart();
  });

  document.getElementById('axis-y2-title')?.addEventListener('input', (e) => {
    state.y2Title = (e.target as HTMLInputElement).value;
    updateChart();
  });

  document.getElementById('axis-y3-title')?.addEventListener('input', (e) => {
    state.y3Title = (e.target as HTMLInputElement).value;
    updateChart();
  });

  document.getElementById('axis-y4-title')?.addEventListener('input', (e) => {
    state.y4Title = (e.target as HTMLInputElement).value;
    updateChart();
  });

  // Typography Config
  document.getElementById('cfg-font-family')?.addEventListener('change', (e) => {
    state.fontFamily = (e.target as HTMLSelectElement).value;
    updateChart();
  });

  document.getElementById('cfg-font-size')?.addEventListener('input', (e) => {
    state.fontSize = parseInt((e.target as HTMLInputElement).value, 10) || 11;
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

  // Peak Mode Selector (None, Global, Daily, Weekly)
  document.getElementById('cfg-peak-mode')?.addEventListener('change', (e) => {
    state.peakMode = (e.target as HTMLSelectElement).value as any;
    updateChart();
  });

  // Comfort Band Toggle & Season Presets
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

  // Export 1-Click SVG
  document.getElementById('btn-export')?.addEventListener('click', () => {
    Plotly.downloadImage('plotly-chart', {
      format: 'svg',
      width: state.widthCm * 37.795,
      height: state.heightCm * 37.795,
      filename: `ChartMate_${state.preset}_figure`
    });
  });
}

function toISODate(str: string): string {
  if (!str) return '';
  const part = str.trim().split(' ')[0].trim();
  const mISO = part.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (mISO) {
    return `${mISO[1]}-${mISO[2].padStart(2, '0')}-${mISO[3].padStart(2, '0')}`;
  }
  const mEU = part.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (mEU) {
    return `${mEU[3]}-${mEU[2].padStart(2, '0')}-${mEU[1].padStart(2, '0')}`;
  }
  return part;
}

function calculateTimeframeDates(mode: string) {
  if (!state.dataset || !state.timestampCol) return;
  const tsIdx = state.dataset.columns.indexOf(state.timestampCol);
  if (tsIdx === -1 || state.dataset.rows.length === 0) return;

  const firstVal = state.dataset.rows[0][tsIdx];
  const lastVal = state.dataset.rows[state.dataset.rows.length - 1][tsIdx];

  const firstDateStr = toISODate(firstVal);
  const lastDateStr = toISODate(lastVal);

  if (mode === 'all') {
    state.startDate = firstDateStr;
    state.endDate = lastDateStr;
  } else if (mode === 'day') {
    state.startDate = firstDateStr;
    state.endDate = firstDateStr;
  } else if (mode === 'week') {
    state.startDate = firstDateStr;
    const d = new Date(firstDateStr);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 7);
      state.endDate = d.toISOString().split('T')[0];
    } else {
      state.endDate = firstDateStr;
    }
  } else if (mode === 'month') {
    state.startDate = firstDateStr;
    const d = new Date(firstDateStr);
    if (!isNaN(d.getTime())) {
      d.setMonth(d.getMonth() + 1);
      state.endDate = d.toISOString().split('T')[0];
    } else {
      state.endDate = firstDateStr;
    }
  }
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
    console.warn('Dialog selection fallback', err);
  }
}

async function loadFile(path: string) {
  try {
    state.filePath = path;
    const options: ParseOptions = {
      separator: state.separator === 'auto' ? undefined : state.separator,
      decimal: state.decimal,
      timestamp_col: state.timestampCol || undefined,
      timestamp_format: state.timestampFormat || undefined,
      max_rows: undefined
    };

    const preview = await invoke<DatasetPreview>('read_dataset_sample', { filePath: path, options });
    state.dataset = preview;

    // Automatic Metadata Assignment
    if (preview.suggested_ts_col) {
      state.timestampCol = preview.suggested_ts_col;
      state.selectedX = preview.suggested_ts_col;
      state.hasTimestamp = true;
      calculateTimeframeDates('all');
    } else if (preview.columns.length > 0) {
      state.hasTimestamp = false;
      state.timestampCol = '';
      state.timeframeMode = 'all';
      state.startDate = '';
      state.endDate = '';
      state.selectedX = preview.columns[0];
    }

    if (preview.suggested_ts_format) {
      state.timestampFormat = preview.suggested_ts_format;
    }

    // Default Traces Setup
    state.traces = [];
    if (preview.columns.length > 1) {
      state.traces.push({
        column: preview.columns[1],
        axis: 'y1',
        chartType: 'line',
        color: '#000000',
        lineWidth: 2.0,
        lineDash: 'solid'
      });
      state.y1Title = preview.columns[1];
    }

    if (preview.columns.length > 2) {
      state.traces.push({
        column: preview.columns[2],
        axis: 'y2',
        chartType: 'line',
        color: '#0284c7',
        lineWidth: 1.8,
        lineDash: 'dash'
      });
      state.y2Title = preview.columns[2];
    }

    renderApp();
  } catch (err) {
    alert(`Errore lettura file locale: ${err}`);
  }
}

function updateChart() {
  const chartEl = document.getElementById('plotly-chart');
  if (!chartEl) return;

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

  let xVals: any[] = [];
  let traces: any[] = [];
  const annotations: any[] = [];

  if (state.dataset && state.selectedX) {
    const xIdx = state.dataset.columns.indexOf(state.selectedX);
    
    // Filter rows by Timeframe ONLY if mode is NOT 'all'
    let activeRows = state.dataset.rows;
    if (state.timeframeMode !== 'all' && state.hasTimestamp && state.selectedX === state.timestampCol && (state.startDate || state.endDate)) {
      activeRows = state.dataset.rows.filter(r => {
        const val = toISODate(r[xIdx]);
        if (!val) return true;
        if (state.startDate && val < state.startDate) return false;
        if (state.endDate && val > state.endDate) return false;
        return true;
      });
    }

    xVals = activeRows.map(r => r[xIdx]);

    // Build Traces based on TraceConfig (Individual types: line, bar, area, scatter)
    state.traces.forEach((t) => {
      const yIdx = state.dataset!.columns.indexOf(t.column);
      if (yIdx === -1) return;

      const yVals = activeRows.map(r => {
        let valStr = String(r[yIdx] ?? '').trim();
        if (valStr === '' || valStr === 'null' || valStr === 'nan' || valStr === 'None') return null;

        if (valStr.includes(',') && valStr.includes('.')) {
          if (valStr.indexOf('.') < valStr.indexOf(',')) {
            valStr = valStr.replace(/\./g, '').replace(',', '.');
          } else {
            valStr = valStr.replace(/,/g, '');
          }
        } else if (valStr.includes(',')) {
          valStr = valStr.replace(',', '.');
        }

        const num = parseFloat(valStr);
        return isNaN(num) ? null : num;
      });

      // Plotly Trace Configuration
      let pType = 'scatter';
      let pMode: string | undefined = 'lines';
      let pFill: string | undefined = undefined;

      if (t.chartType === 'line') {
        pType = 'scatter';
        pMode = 'lines';
      } else if (t.chartType === 'scatter') {
        pType = 'scatter';
        pMode = 'markers';
      } else if (t.chartType === 'area') {
        pType = 'scatter';
        pMode = 'lines';
        pFill = 'tozeroy';
      } else if (t.chartType === 'bar') {
        pType = 'bar';
        pMode = undefined;
      }

      const traceObj: any = {
        x: xVals,
        y: yVals,
        name: t.column,
        yaxis: t.axis === 'y1' ? 'y' : t.axis,
        type: pType,
        mode: pMode,
        fill: pFill,
        line: { color: t.color, width: t.lineWidth, dash: t.lineDash },
        marker: { size: 5, color: t.color }
      };

      if (t.chartType === 'bar') {
        traceObj.marker = { color: t.color, opacity: 0.85 };
        delete traceObj.mode;
        delete traceObj.line;
      }

      traces.push(traceObj);

      // Peak & Valley Tracker Logic for this trace
      if (state.peakMode !== 'none' && yVals.length > 0 && t.axis === 'y1') {
        calculatePeakAnnotations(xVals, yVals, state.peakMode, annotations, t.axis === 'y1' ? 'y' : t.axis);
      }
    });

    if (traces.length === 0) {
      annotations.push({
        text: 'Nessuna serie attiva.<br>Aggiungi una serie dal pannello "Tracce & Stile Per-Serie".',
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: 0.5,
        showarrow: false,
        font: { size: 13, color: '#64748b' }
      });
    }

  } else {
    // Default Demo waveform
    const steps = 30;
    xVals = Array.from({ length: steps }, (_, i) => `2026-09-01 ${String(i % 24).padStart(2, '0')}:00`);
    const yVals = Array.from({ length: steps }, (_, i) => 21.0 + 4.0 * Math.sin(i / 3));
    traces.push({
      x: xVals,
      y: yVals,
      name: 'Indoor Temperature (°C)',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#000000', width: 2.2 },
      marker: { size: 5, color: '#000000' }
    });
  }

  // Multi-Axis Verification
  const hasY2 = state.traces.some(t => t.axis === 'y2');
  const hasY3 = state.traces.some(t => t.axis === 'y3');
  const hasY4 = state.traces.some(t => t.axis === 'y4');

  let rightMargin = 30;
  if (hasY4) rightMargin = 150;
  else if (hasY3) rightMargin = 110;
  else if (hasY2) rightMargin = 65;

  const layout: any = {
    width: pxW,
    height: pxH,
    margin: { l: 65, r: rightMargin, t: 35, b: 50 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: state.fontFamily, size: state.fontSize, color: '#000000' },
    annotations: annotations,
    xaxis: {
      title: { text: state.selectedX || 'Time / Parameter', font: { size: state.fontSize + 1, color: '#000000', weight: 600 } },
      gridcolor: '#e2e8f0',
      linecolor: '#000000',
      linewidth: 1.2,
      showline: true,
      mirror: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color: '#000000' }
    },
    yaxis: {
      title: { text: state.y1Title || 'Primary Y1', font: { size: state.fontSize + 1, color: '#000000', weight: 600 } },
      gridcolor: '#e2e8f0',
      linecolor: '#000000',
      linewidth: 1.2,
      showline: true,
      mirror: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color: '#000000' }
    },
    legend: {
      orientation: 'h',
      x: 0.5,
      y: 1.12,
      xanchor: 'center',
      font: { size: state.fontSize - 1, color: '#000000' }
    },
    shapes: []
  };

  // Y2 Axis (Destra 1)
  if (hasY2) {
    layout.yaxis2 = {
      title: { text: state.y2Title || 'Y2 Axis', font: { size: state.fontSize, color: '#0284c7', weight: 600 } },
      overlaying: 'y',
      side: 'right',
      gridcolor: 'transparent',
      linecolor: '#0284c7',
      linewidth: 1.2,
      showline: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 2, color: '#0284c7' }
    };
  }

  // Y3 Axis (Destra 2 con Offset)
  if (hasY3) {
    layout.yaxis3 = {
      title: { text: state.y3Title || 'Y3 Axis', font: { size: state.fontSize, color: '#d97706', weight: 600 } },
      overlaying: 'y',
      side: 'right',
      position: 0.93,
      gridcolor: 'transparent',
      linecolor: '#d97706',
      linewidth: 1.2,
      showline: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 2, color: '#d97706' }
    };
  }

  // Y4 Axis (Destra 3 con Offset Avanzato)
  if (hasY4) {
    layout.yaxis4 = {
      title: { text: state.y4Title || 'Y4 Axis', font: { size: state.fontSize, color: '#7c3aed', weight: 600 } },
      overlaying: 'y',
      side: 'right',
      position: 0.86,
      gridcolor: 'transparent',
      linecolor: '#7c3aed',
      linewidth: 1.2,
      showline: true,
      tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 2, color: '#7c3aed' }
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
      fillcolor: state.comfortSeason === 'winter' ? 'rgba(5, 150, 105, 0.12)' : 'rgba(217, 119, 6, 0.12)',
      line: { width: 0 },
      layer: 'below'
    });
  }

  Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
}

function calculatePeakAnnotations(xVals: any[], yVals: (number | null)[], mode: string, annotations: any[], yref: string) {
  if (mode === 'global') {
    let maxVal = -Infinity;
    let minVal = Infinity;
    let maxIdx = -1;
    let minIdx = -1;

    for (let i = 0; i < yVals.length; i++) {
      const v = yVals[i];
      if (v !== null && !isNaN(v)) {
        if (v > maxVal) { maxVal = v; maxIdx = i; }
        if (v < minVal) { minVal = v; minIdx = i; }
      }
    }

    if (maxIdx !== -1) {
      annotations.push({
        x: xVals[maxIdx],
        y: maxVal,
        xref: 'x',
        yref: yref,
        text: `🔴 Max: ${maxVal.toFixed(2)}`,
        showarrow: true,
        arrowhead: 2,
        arrowcolor: '#e11d48',
        font: { size: 10, color: '#e11d48', family: 'JetBrains Mono, monospace' },
        bgcolor: '#ffffff',
        bordercolor: '#e11d48',
        borderwidth: 1
      });
    }

    if (minIdx !== -1) {
      annotations.push({
        x: xVals[minIdx],
        y: minVal,
        xref: 'x',
        yref: yref,
        text: `🔵 Min: ${minVal.toFixed(2)}`,
        showarrow: true,
        arrowhead: 2,
        arrowcolor: '#0284c7',
        font: { size: 10, color: '#0284c7', family: 'JetBrains Mono, monospace' },
        bgcolor: '#ffffff',
        bordercolor: '#0284c7',
        borderwidth: 1
      });
    }
  } else if (mode === 'daily') {
    // Group by Day (YYYY-MM-DD)
    const dayGroups: Record<string, { maxVal: number; maxIdx: number; minVal: number; minIdx: number }> = {};

    for (let i = 0; i < yVals.length; i++) {
      const v = yVals[i];
      if (v === null || isNaN(v)) continue;
      const day = String(xVals[i]).split(' ')[0];
      if (!dayGroups[day]) {
        dayGroups[day] = { maxVal: v, maxIdx: i, minVal: v, minIdx: i };
      } else {
        if (v > dayGroups[day].maxVal) { dayGroups[day].maxVal = v; dayGroups[day].maxIdx = i; }
        if (v < dayGroups[day].minVal) { dayGroups[day].minVal = v; dayGroups[day].minIdx = i; }
      }
    }

    Object.values(dayGroups).forEach(g => {
      annotations.push({
        x: xVals[g.maxIdx],
        y: g.maxVal,
        xref: 'x',
        yref: yref,
        text: `${g.maxVal.toFixed(1)}`,
        showarrow: true,
        arrowhead: 1,
        arrowsize: 0.8,
        arrowcolor: '#e11d48',
        font: { size: 9, color: '#e11d48', family: 'JetBrains Mono, monospace' }
      });
      annotations.push({
        x: xVals[g.minIdx],
        y: g.minVal,
        xref: 'x',
        yref: yref,
        text: `${g.minVal.toFixed(1)}`,
        showarrow: true,
        arrowhead: 1,
        arrowsize: 0.8,
        arrowcolor: '#0284c7',
        font: { size: 9, color: '#0284c7', family: 'JetBrains Mono, monospace' }
      });
    });
  }
}

// Boot application
renderApp();
