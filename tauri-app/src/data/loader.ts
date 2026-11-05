import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getPanelLetter } from '../core/panels';
import { DEFAULT_PALETTE, state } from '../core/state';
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

export async function handleFileSelect() {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'Supported Datasets', extensions: ['parquet', 'pq', 'csv', 'xlsx', 'xls', 'tsv', 'txt'] },
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
      max_rows: undefined
    };

    const preview = await invoke<DatasetPreview>('read_dataset_sample', { filePath: path, options });
    state.dataset = preview;
    state.rawDatasetBackup = JSON.parse(JSON.stringify(preview));
    state.isResampled = false;
    applyDatasetMetadata(preview, resetCanvas);

    renderApp();
  } catch (err) {
    alert(`Error reading local file: ${err}`);
  }
}
