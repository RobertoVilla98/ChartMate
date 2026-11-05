import { state } from '../core/state';
import type { AxisScaleConfig } from '../core/types';

export function parseNumericValue(rawVal: any): number | null {
  let valStr = String(rawVal ?? '').trim();
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
}

export function parseGeoCoordinate(rawVal: any, format: 'decimal_degrees' | 'dms'): number | null {
  if (rawVal === null || rawVal === undefined) return null;
  const str = String(rawVal).trim();
  if (!str) return null;

  if (format === 'dms' || /[°'"NSEW]/i.test(str)) {
    const m = str.match(/(-?\d+(?:\.\d+)?)\s*[°d:]?\s*(\d+(?:\.\d+)?)?\s*['m:]?\s*(\d+(?:\.\d+)?)?\s*["s]?\s*([NSEW])?/i);
    if (m) {
      const deg = parseFloat(m[1]) || 0;
      const min = parseFloat(m[2]) || 0;
      const sec = parseFloat(m[3]) || 0;
      const dir = (m[4] || '').toUpperCase();
      let dd = Math.abs(deg) + min / 60.0 + sec / 3600.0;
      if (deg < 0 || dir === 'S' || dir === 'W') dd = -dd;
      return isNaN(dd) ? null : dd;
    }
  }
  return parseNumericValue(str);
}

export function getTickFormat(decimals?: 'auto' | '0' | '1' | '2' | '3'): string | undefined {
  if (!decimals || decimals === 'auto') return undefined;
  return `.${decimals}f`;
}

export function formatNumberWithDecimals(val: number, decimals?: 'auto' | '0' | '1' | '2' | '3'): string {
  if (!decimals || decimals === 'auto') {
    return Number.isInteger(val) ? String(val) : val.toFixed(2);
  }
  return val.toFixed(parseInt(decimals, 10));
}

export function buildAxisStyle(
  titleText: string,
  color: string,
  scaleCfg: AxisScaleConfig | undefined,
  isXAxis: boolean = false
): any {
  const gf = state.gridFrame;
  const showLine = gf.frameMode !== 'none';
  const mirrorVal: any = gf.frameMode === 'box' ? true : (gf.frameMode === 'ticks' ? 'ticks' : false);
  const ticksVal = gf.tickDir === 'none' ? '' : gf.tickDir;

  const axObj: any = {
    title: { text: titleText, font: { size: state.fontSize + 1, color, weight: 600 } },
    showgrid: isXAxis ? gf.showXGrid : gf.showYGrid,
    gridcolor: gf.majorGridColor || '#cbd5e1',
    gridwidth: 1.0,
    zeroline: gf.showZeroLine,
    zerolinecolor: '#94a3b8',
    zerolinewidth: 1.1,
    showline: showLine,
    linecolor: color,
    linewidth: 1.2,
    mirror: mirrorVal,
    ticks: ticksVal,
    ticklen: gf.tickDir === 'none' ? 0 : 4,
    tickcolor: color,
    tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color }
  };

  if (!isXAxis && scaleCfg) {
    const tf = getTickFormat(scaleCfg.decimals);
    if (tf) axObj.tickformat = tf;

    if (scaleCfg.min !== null && scaleCfg.min !== undefined && !isNaN(scaleCfg.min) &&
        scaleCfg.max !== null && scaleCfg.max !== undefined && !isNaN(scaleCfg.max)) {
      axObj.range = [scaleCfg.min, scaleCfg.max];
      axObj.autorange = false;
    }

    if (scaleCfg.majorStep && scaleCfg.majorStep > 0) {
      axObj.dtick = scaleCfg.majorStep;
    }

    if (gf.showMinorGrid || (scaleCfg.minorStep && scaleCfg.minorStep > 0)) {
      axObj.minor = {
        showgrid: true,
        gridcolor: gf.minorGridColor || '#f1f5f9',
        gridwidth: 0.6,
        dtick: (scaleCfg.minorStep && scaleCfg.minorStep > 0) ? scaleCfg.minorStep : undefined
      };
    }
  }

  return axObj;
}

export function calculatePeakAnnotations(
  xVals: any[],
  yVals: (number | null)[],
  mode: string,
  annotations: any[],
  yref: string,
  decimals: 'auto' | '0' | '1' | '2' | '3' = 'auto'
) {
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
        yref,
        text: `🔴 Max: ${formatNumberWithDecimals(maxVal, decimals)}`,
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
        yref,
        text: `🔵 Min: ${formatNumberWithDecimals(minVal, decimals)}`,
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
        yref,
        text: formatNumberWithDecimals(g.maxVal, decimals),
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
        yref,
        text: formatNumberWithDecimals(g.minVal, decimals),
        showarrow: true,
        arrowhead: 1,
        arrowsize: 0.8,
        arrowcolor: '#0284c7',
        font: { size: 9, color: '#0284c7', family: 'JetBrains Mono, monospace' }
      });
    });
  }
}
