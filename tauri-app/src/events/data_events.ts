import { decodeDataset } from '../data/table';
import { invoke } from '@tauri-apps/api/core';
import { state } from '../core/state';
import type { DatasetPreview, SqlConnectionStatus } from '../core/types';
import { applyDatasetMetadata, handleFileSelect, loadFile } from '../data/loader';
import { renderApp } from '../ui/render_app';

export function attachDataEvents() {
  // Source Toggle (File vs SQL)
  document.getElementById('data-row-limit')?.addEventListener('change', (e) => {
    state.rowLimit = parseInt((e.target as HTMLSelectElement).value, 10) || 0;
    if (state.filePath) loadFile(state.filePath, false);
  });
  document.getElementById('data-decimate')?.addEventListener('change', (e) => {
    state.decimateLargeSeries = (e.target as HTMLInputElement).checked;
    renderApp();
  });
  document.getElementById('btn-src-file')?.addEventListener('click', () => {
    state.sourceType = 'file';
    renderApp();
  });
  document.getElementById('btn-src-sql')?.addEventListener('click', () => {
    state.sourceType = 'sql';
    renderApp();
  });

  // SQL Connection Manager Events
  document.getElementById('sql-host')?.addEventListener('input', (e) => {
    state.sqlConfig.host = (e.target as HTMLInputElement).value;
  });
  document.getElementById('sql-port')?.addEventListener('input', (e) => {
    state.sqlConfig.port = parseInt((e.target as HTMLInputElement).value, 10) || 3306;
  });
  document.getElementById('sql-db')?.addEventListener('input', (e) => {
    state.sqlConfig.database = (e.target as HTMLInputElement).value;
  });
  document.getElementById('sql-user')?.addEventListener('input', (e) => {
    state.sqlConfig.user = (e.target as HTMLInputElement).value;
  });
  document.getElementById('sql-pass')?.addEventListener('input', (e) => {
    state.sqlConfig.password = (e.target as HTMLInputElement).value;
  });
  document.getElementById('sql-query-input')?.addEventListener('input', (e) => {
    state.sqlQuery = (e.target as HTMLTextAreaElement).value;
  });

  document.getElementById('btn-sql-test')?.addEventListener('click', async () => {
    try {
      const status = await invoke<SqlConnectionStatus>('test_sql_connection', {
        config: state.sqlConfig
      });
      state.sqlStatus = status;
      renderApp();
    } catch (err) {
      state.sqlStatus = { connected: false, latency_ms: 0, tables: [], message: `${err}` };
      renderApp();
    }
  });

  document.getElementById('sql-table-select')?.addEventListener('change', (e) => {
    const tbl = (e.target as HTMLSelectElement).value;
    if (tbl) {
      state.sqlQuery = `SELECT * FROM \`${tbl}\` LIMIT 10000;`;
      const qEl = document.getElementById('sql-query-input') as HTMLTextAreaElement | null;
      if (qEl) qEl.value = state.sqlQuery;
    }
  });

  document.getElementById('btn-sql-exec')?.addEventListener('click', async () => {
    try {
      const preview = decodeDataset(await invoke<ArrayBuffer>('execute_sql_query', {
        config: state.sqlConfig,
        query: state.sqlQuery
      }));
      state.dataset = preview;
      state.rawDatasetBackup = preview;
      state.isResampled = false;
      state.filePath = `mysql://${state.sqlConfig.host}:${state.sqlConfig.port}/${state.sqlConfig.database}`;
      applyDatasetMetadata(preview, true);
      renderApp();
    } catch (err) {
      alert(`SQL Query Error: ${err}`);
    }
  });

  // Geospatial Configurator in Tab 1
  document.getElementById('cfg-geo-format')?.addEventListener('change', (e) => {
    state.geoCoordFormat = (e.target as HTMLSelectElement).value as any;
  });
  document.getElementById('cfg-geo-lat')?.addEventListener('change', (e) => {
    state.geoLatCol = (e.target as HTMLSelectElement).value;
  });
  document.getElementById('cfg-geo-lon')?.addEventListener('change', (e) => {
    state.geoLonCol = (e.target as HTMLSelectElement).value;
  });

  // Dropzone File Loading (Tab 1 + Direct File Load in Tab 4)
  const dropzone = document.getElementById('dropzone-data');
  dropzone?.addEventListener('click', handleFileSelect);
  document.getElementById('btn-map-load-file')?.addEventListener('click', handleFileSelect);

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
    if (state.filePath && state.sourceType === 'file') {
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
}

export function attachResamplingEvents() {
  // Track 4: Rust Resampling & Smoothing Listeners
  document.getElementById('sel-resample-interval')?.addEventListener('change', (e) => {
    state.resampleInterval = (e.target as HTMLSelectElement).value as any;
  });
  document.getElementById('sel-resample-agg')?.addEventListener('change', (e) => {
    state.resampleAgg = (e.target as HTMLSelectElement).value as any;
  });
  document.getElementById('btn-resample-apply')?.addEventListener('click', async () => {
    const srcData = state.rawDatasetBackup || state.dataset;
    if (!srcData || srcData.columns.length === 0) return;
    try {
      const tsCol = state.timestampCol || srcData.columns[0];
      // Re-sampling runs on the raw table cached in the back end (no data sent back).
      const resampled = srcData.id !== undefined
        ? decodeDataset(await invoke<ArrayBuffer>('resample_loaded', {
            datasetId: srcData.id,
            timestampCol: tsCol,
            interval: state.resampleInterval,
            aggMethod: state.resampleAgg
          }))
        : await invoke<DatasetPreview>('resample_in_memory', {
            columns: srcData.columns,
            rows: srcData.rows,
            timestampCol: tsCol,
            interval: state.resampleInterval,
            aggMethod: state.resampleAgg
          });
      if (!state.rawDatasetBackup) {
        state.rawDatasetBackup = srcData;
      }
      state.dataset = resampled;
      state.isResampled = true;
      renderApp();
    } catch (err) {
      alert(`Resampling error: ${err}`);
    }
  });
  document.getElementById('btn-resample-reset')?.addEventListener('click', () => {
    if (state.rawDatasetBackup) {
      state.dataset = state.rawDatasetBackup;
      state.isResampled = false;
      renderApp();
    }
  });
}
