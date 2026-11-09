import { cellText, decodeDataset, rowCount } from './table';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getPanelLetter } from '../core/panels';
import { DEFAULT_PALETTE, state, t } from '../core/state';
import type { DatasetPreview, ParseOptions } from '../core/types';
import { renderApp } from '../ui/render_app';

export function toISODate(str: string): string {
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

export function calculateTimeframeDates(mode: string) {
  if (!state.dataset || !state.timestampCol) return;
  const tsIdx = state.dataset.columns.indexOf(state.timestampCol);
  if (tsIdx === -1 || rowCount(state.dataset) === 0) return;

  const n = rowCount(state.dataset);
  const firstVal = cellText(state.dataset, 0, tsIdx);
  const lastVal = cellText(state.dataset, n - 1, tsIdx);

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

export async function handleFileSelect() {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Supported Datasets',
          extensions: [
            'csv', 'tsv', 'txt', 'dat',                 // delimited text
            'xlsx', 'xlsm', 'xlsb', 'xls', 'ods',       // spreadsheets (Excel, OpenDocument)
            'parquet', 'pq',                            // Apache Parquet
            'h5', 'hdf5', 'he5', 'nc', 'nc4', 'cdf',     // HDF5, netCDF-3/4
            'mat',                                      // MATLAB v4/v5/v7/v7.3
            'sas7bdat', 'xpt', 'sav',                   // SAS, SAS transport, SPSS
            'fits', 'fit', 'fts'                        // FITS tables and 1-D/2-D images
          ]
        },
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

export function applyDatasetMetadata(preview: DatasetPreview, resetCanvas: boolean = true) {
  // Always auto-detect Lat/Lon columns if missing or if resetCanvas is true
  const latCandidate = preview.columns.find(c => /(^lat|latitude|latitudine|y_coord|coord_y|gps_lat)/i.test(c.trim()));
  const lonCandidate = preview.columns.find(c => /(^lon|^lng|^long|longitude|longitudine|x_coord|coord_x|gps_lon)/i.test(c.trim()));
  if (latCandidate && (!state.geoLatCol || resetCanvas || !preview.columns.includes(state.geoLatCol))) {
    state.geoLatCol = latCandidate;
  }
  if (lonCandidate && (!state.geoLonCol || resetCanvas || !preview.columns.includes(state.geoLonCol))) {
    state.geoLonCol = lonCandidate;
  }

  if (resetCanvas) {
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

    const nonAxisCols = preview.columns.filter(
      c => c !== state.selectedX && c !== state.geoLatCol && c !== state.geoLonCol
    );

    state.traces = [];
    if (nonAxisCols.length > 0) {
      state.traces.push({
        column: nonAxisCols[0],
        axis: 'y1',
        chartType: 'line',
        color: '#000000',
        lineWidth: 2.0,
        lineDash: 'solid'
      });
      state.y1Title = nonAxisCols[0];
      state.mapColorCol = nonAxisCols[0];
    }

    if (nonAxisCols.length > 1) {
      state.traces.push({
        column: nonAxisCols[1],
        axis: 'y2',
        chartType: 'line',
        color: '#0284c7',
        lineWidth: 1.8,
        lineDash: 'dash'
      });
      state.y2Title = nonAxisCols[1];
    }

    // Initialize MultiPlot Panels with full multi-trace array
    for (let i = 0; i < 25; i++) {
      const col = nonAxisCols[i % Math.max(1, nonAxisCols.length)] || '';
      state.mpPanels[i] = {
        traces: [
          {
            column: col,
            axis: 'y1',
            chartType: i === 2 ? 'bar' : 'line',
            color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
            lineWidth: 1.9,
            lineDash: 'solid'
          }
        ],
        yTitle: col || `Panel ${getPanelLetter(i)}`,
        y2Title: '',
        y1Min: null,
        y1Max: null,
        y1Decimals: 'auto',
        y1MajorStep: null,
        y1MinorStep: null
      };
    }

    // Initialize Building Physics & Editorial Suite defaults from dataset columns
    const cols = preview.columns;
    const findCol = (regex: RegExp, fallbackIdx: number = 0) =>
      cols.find(c => regex.test(c)) || nonAxisCols[fallbackIdx] || cols[0] || '';

    state.carpetState.variableCol = findCol(/(indoor_temp|temp|t_op|t_in|co2|power)/i, 0);
    state.comfortState.indoorTempCol = findCol(/(indoor_temp|t_in|t_op|temp)/i, 0);
    state.comfortState.outdoorTempCol = findCol(/(outdoor_temp|t_out|t_ext|trm)/i, 1);
    state.comfortState.rhCol = findCol(/(^rh|humidity|umid)/i, 2);

    state.durationState.variableCol = findCol(/(indoor_temp|co2|power|temp)/i, 0);
    state.durationState.compareCol = cols.find(c => /(sim_indoor_temp|sim_power|outdoor_temp)/i.test(c)) || '';

    state.calibState.measuredCol = findCol(/(^indoor_temp|^power_kw|measured)/i, 0);
    state.calibState.simulatedCol = findCol(/(sim_indoor_temp|sim_power|simulated|pred)/i, 1);
    // G14 acceptance criteria apply to energy / demand only.
    state.calibState.quantity = /(power|energy|kwh|kw|_kw|demand|consum|load|gas|elec)/i.test(state.calibState.measuredCol) ? 'energy' : 'other';

    // Populate Editorial Table Variables
    state.editorialState.variables = nonAxisCols
      .filter(c => !/(zone|name|id|label)/i.test(c))
      .map(c => {
        const cl = c.toLowerCase();
        let unit = '-';
        let threshold: number | null = null;
        if (cl.includes('temp')) {
          unit = '°C';
          threshold = cl.includes('out') ? null : 26.0;
        } else if (cl.includes('rh') || cl.includes('hum')) {
          unit = '%';
          threshold = 70.0;
        } else if (cl.includes('co2')) {
          unit = 'ppm';
          threshold = 1000;
        } else if (cl.includes('power') || cl.includes('kw')) {
          unit = 'kW';
          threshold = 6.0;
        }
        return {
          column: c,
          selected: true,
          unit,
          threshold
        };
      });

    state.editorialState.plateSlots = [
      nonAxisCols[0] || '',
      nonAxisCols[1] || nonAxisCols[0] || '',
      nonAxisCols[2] || nonAxisCols[0] || '',
      nonAxisCols[3] || nonAxisCols[0] || ''
    ];
  }
}

export async function loadFile(path: string, resetCanvas: boolean = true) {
  try {
    state.filePath = path;
    const options: ParseOptions = {
      separator: state.separator === 'auto' ? undefined : state.separator,
      decimal: state.decimal,
      timestamp_col: state.timestampCol || undefined,
      timestamp_format: state.timestampFormat || undefined,
      // 0 = all rows (no limit); the back end applies its default only when no value is sent.
      max_rows: state.rowLimit
    };

    const t0 = performance.now();
    // Binary, column-oriented transfer: numbers arrive as f64 arrays (see data/table.ts).
    const payload = await invoke<ArrayBuffer>('load_dataset', { filePath: path, options });
    const preview = decodeDataset(payload);
    state.loadTiming = {
      parseMs: preview.parse_ms ?? 0,
      totalMs: performance.now() - t0,
      rows: rowCount(preview)
    };
    state.dataset = preview;
    // SHA-256 of the source, stored with the project; computed off the UI thread.
    state.dataFingerprint = null;
    invoke<{ size: number; sha256: string }>('file_fingerprint', { filePath: path })
      .then(fp => { if (state.filePath === path) state.dataFingerprint = fp; })
      .catch(() => { /* fingerprint is optional */ });
    // Datasets are never mutated in place (resampling builds a new one), so a reference is enough;
    // a deep copy doubled memory and cost seconds on 10^6-row files.
    state.rawDatasetBackup = preview;
    state.isResampled = false;
    applyDatasetMetadata(preview, resetCanvas);

    renderApp();
    if (preview.truncated) {
      alert(t('truncation_alert')
        .replace('{shown}', rowCount(preview).toLocaleString())
        .replace('{total}', preview.total_rows.toLocaleString()));
    }
  } catch (err) {
    alert(`Error reading local file: ${err}`);
  }
}
