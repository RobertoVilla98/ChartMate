// @ts-ignore
import Plotly from 'plotly.js-dist-min';
import { formatNumberWithDecimals, getTickFormat, parseGeoCoordinate, parseNumericValue } from './chart_utils';
import { state } from '../core/state';
import { applyDatasetMetadata } from '../data/loader';

export function computeMathematicalAggregation(
  values: number[],
  rawStrings: string[],
  agg: string,
  decimals: 'auto' | '0' | '1' | '2' | '3'
): { val: number; label: string } {
  if (agg === 'count') {
    return { val: rawStrings.length, label: `N = ${rawStrings.length}` };
  }
  if (agg === 'mode') {
    const freq: Record<string, number> = {};
    let bestKey = rawStrings[0] || '0';
    let bestCount = 0;
    for (const s of rawStrings) {
      const k = s.trim();
      if (!k) continue;
      freq[k] = (freq[k] || 0) + 1;
      if (freq[k] > bestCount) {
        bestCount = freq[k];
        bestKey = k;
      }
    }
    const numVal = parseNumericValue(bestKey) ?? bestCount;
    return { val: numVal, label: `Mo: ${bestKey} (${bestCount}×)` };
  }

  if (values.length === 0) return { val: 0, label: 'N/A' };

  if (agg === 'sum') {
    const s = values.reduce((a, b) => a + b, 0);
    return { val: s, label: `Σ = ${formatNumberWithDecimals(s, decimals)}` };
  }
  if (agg === 'max') {
    const m = Math.max(...values);
    return { val: m, label: `Max = ${formatNumberWithDecimals(m, decimals)}` };
  }
  if (agg === 'min') {
    const m = Math.min(...values);
    return { val: m, label: `Min = ${formatNumberWithDecimals(m, decimals)}` };
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { val: mean, label: `μ = ${formatNumberWithDecimals(mean, decimals)}` };
}

export function updateMapChart() {
  const chartEl = document.getElementById('plotly-map-chart');
  if (!chartEl) return;

  const ratio = state.mapWidthCm / state.mapHeightCm;
  let pxW = 850;
  let pxH = Math.round(pxW / ratio);
  if (state.mapPreset === 'square') {
    pxW = 620;
    pxH = 620;
  } else if (state.mapPreset === 'single') {
    pxW = 550;
    pxH = Math.round(pxW / ratio);
  }

  const lats: number[] = [];
  const lons: number[] = [];
  const vals: number[] = [];
  const sizes: number[] = [];
  const hoverTexts: string[] = [];
  let validRawGps = 0;

  if (state.dataset && (!state.geoLatCol || !state.geoLonCol)) {
    applyDatasetMetadata(state.dataset, false);
  }

  if (state.dataset && state.geoLatCol && state.geoLonCol) {
    const latIdx = state.dataset.columns.indexOf(state.geoLatCol);
    const lonIdx = state.dataset.columns.indexOf(state.geoLonCol);
    const colIdx = state.mapColorCol ? state.dataset.columns.indexOf(state.mapColorCol) : -1;
    const sizeIdx = state.mapSizeCol ? state.dataset.columns.indexOf(state.mapSizeCol) : -1;

    if (latIdx !== -1 && lonIdx !== -1) {
      if (state.mapClusterEnabled) {
        const grid = state.mapClusterGridDeg || 0.002;
        const bins: Record<string, { lats: number[]; lons: number[]; nums: number[]; raws: string[] }> = {};

        for (const r of state.dataset.rows) {
          const lat = parseGeoCoordinate(r[latIdx], state.geoCoordFormat);
          const lon = parseGeoCoordinate(r[lonIdx], state.geoCoordFormat);
          if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
          validRawGps++;

          const bLat = Math.round(lat / grid) * grid;
          const bLon = Math.round(lon / grid) * grid;
          const key = `${bLat.toFixed(5)}_${bLon.toFixed(5)}`;

          if (!bins[key]) {
            bins[key] = { lats: [], lons: [], nums: [], raws: [] };
          }
          bins[key].lats.push(lat);
          bins[key].lons.push(lon);

          const rawStr = colIdx !== -1 ? String(r[colIdx] ?? '') : '1';
          bins[key].raws.push(rawStr);
          const num = colIdx !== -1 ? parseNumericValue(r[colIdx]) : 1;
          if (num !== null) bins[key].nums.push(num);
        }

        Object.values(bins).forEach(b => {
          const cLat = b.lats.reduce((a, c) => a + c, 0) / b.lats.length;
          const cLon = b.lons.reduce((a, c) => a + c, 0) / b.lons.length;
          const aggRes = computeMathematicalAggregation(b.nums, b.raws, state.mapClusterAgg, state.mapDecimals);

          lats.push(cLat);
          lons.push(cLon);
          vals.push(aggRes.val);
          sizes.push(Math.min(28, 12 + Math.log2(b.lats.length + 1) * 4));
          hoverTexts.push(
            `<b>Cluster (${b.lats.length} pts)</b><br>Lat: ${cLat.toFixed(4)}, Lon: ${cLon.toFixed(4)}<br>${state.mapColorCol || 'Metric'}: <b>${aggRes.label}</b>`
          );
        });

        state.mapValidGpsCount = validRawGps;
        state.mapLastClusterCount = lats.length;
        state.mapLastSummaryStat = `${state.mapClusterAgg.toUpperCase()} · ${lats.length} clusters (${validRawGps} pts)`;
      } else {
        for (const r of state.dataset.rows) {
          const lat = parseGeoCoordinate(r[latIdx], state.geoCoordFormat);
          const lon = parseGeoCoordinate(r[lonIdx], state.geoCoordFormat);
          if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
          validRawGps++;

          const num = colIdx !== -1 ? (parseNumericValue(r[colIdx]) ?? 0) : 1;
          const sz = sizeIdx !== -1 ? Math.max(6, Math.min(26, parseNumericValue(r[sizeIdx]) ?? 11)) : 11;
          lats.push(lat);
          lons.push(lon);
          vals.push(num);
          sizes.push(sz);
          hoverTexts.push(
            `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}<br>${state.mapColorCol || 'Value'}: <b>${formatNumberWithDecimals(num, state.mapDecimals)}</b>`
          );
        }
        state.mapValidGpsCount = validRawGps;
        state.mapLastClusterCount = validRawGps;
        state.mapLastSummaryStat = `Raw · ${validRawGps} GPS pts`;
      }
    }
  }

  const cntEl = document.getElementById('lbl-cluster-count');
  const stEl = document.getElementById('lbl-cluster-stat');
  if (cntEl) cntEl.textContent = String(state.mapClusterEnabled ? state.mapLastClusterCount : state.mapValidGpsCount);
  if (stEl) stEl.textContent = state.mapLastSummaryStat || 'Ready';

  // Fallback Demo Geo Data ONLY when no dataset is loaded
  if (lats.length === 0 && !state.dataset) {
    const demoCoords = [
      [45.4781, 9.2270, 21.4],
      [45.4795, 9.2292, 22.8],
      [45.4768, 9.2251, 20.9],
      [45.4810, 9.2315, 24.1],
      [45.4752, 9.2288, 23.2]
    ];
    for (const [la, lo, v] of demoCoords) {
      lats.push(la);
      lons.push(lo);
      vals.push(v);
      sizes.push(12);
      hoverTexts.push(`Demo Sensor<br>Lat: ${la}, Lon: ${lo}<br>Value: <b>${v} °C</b>`);
    }
  }

  const minLat = lats.length > 0 ? Math.min(...lats) : 45.478;
  const maxLat = lats.length > 0 ? Math.max(...lats) : 45.482;
  const minLon = lons.length > 0 ? Math.min(...lons) : 9.225;
  const maxLon = lons.length > 0 ? Math.max(...lons) : 9.232;
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  const maxSpan = Math.max(maxLat - minLat, maxLon - minLon, 0.002);
  let zoom = Math.floor(Math.log2(360 / maxSpan)) - 1;
  zoom = Math.max(1, Math.min(16, zoom));

  const cbTickFmt = getTickFormat(state.mapDecimals);
  const traces: any[] = [];

  if (state.mapMode === 'density') {
    traces.push({
      type: 'densitymapbox',
      lat: lats,
      lon: lons,
      z: vals,
      radius: 22,
      colorscale: state.mapColorscale,
      colorbar: {
        title: { text: state.mapColorCol || 'Metric', font: { size: state.fontSize, color: '#000000' } },
        tickformat: cbTickFmt,
        tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color: '#000000' }
      },
      hoverinfo: 'text',
      text: hoverTexts
    });
  } else if (state.mapMode === 'track') {
    traces.push({
      type: 'scattermapbox',
      mode: 'lines+markers',
      lat: lats,
      lon: lons,
      line: { width: 2.8, color: '#059669' },
      marker: {
        size: 9,
        color: vals,
        colorscale: state.mapColorscale,
        showscale: true,
        colorbar: {
          title: { text: state.mapColorCol || 'Metric', font: { size: state.fontSize, color: '#000000' } },
          tickformat: cbTickFmt,
          tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color: '#000000' }
        }
      },
      hoverinfo: 'text',
      text: hoverTexts,
      name: state.mapColorCol || 'GPS Track'
    });
  } else {
    traces.push({
      type: 'scattermapbox',
      mode: 'markers',
      lat: lats,
      lon: lons,
      marker: {
        size: sizes.length > 0 ? sizes : 12,
        opacity: 0.9,
        color: vals,
        colorscale: state.mapColorscale,
        showscale: true,
        colorbar: {
          title: { text: `${state.mapColorCol || 'Metric'} (${state.mapClusterEnabled ? state.mapClusterAgg.toUpperCase() : 'Raw'})`, font: { size: state.fontSize, color: '#000000' } },
          tickformat: cbTickFmt,
          tickfont: { family: 'JetBrains Mono, monospace', size: state.fontSize - 1, color: '#000000' }
        }
      },
      hoverinfo: 'text',
      text: hoverTexts,
      name: state.mapColorCol || 'Geo Points'
    });
  }

  const mapboxCfg: any = {
    center: { lat: centerLat, lon: centerLon },
    zoom
  };

  if (state.mapBasemap === 'esri-satellite') {
    mapboxCfg.style = 'white-bg';
    mapboxCfg.layers = [{
      sourcetype: 'raster',
      source: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      below: 'traces'
    }];
  } else if (state.mapBasemap === 'opentopomap') {
    mapboxCfg.style = 'white-bg';
    mapboxCfg.layers = [{
      sourcetype: 'raster',
      source: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
      below: 'traces'
    }];
  } else {
    mapboxCfg.style = state.mapBasemap;
  }

  const layout: any = {
    width: pxW,
    height: pxH,
    margin: { l: 15, r: 15, t: 15, b: 15 },
    paper_bgcolor: '#ffffff',
    font: { family: state.fontFamily, size: state.fontSize, color: '#000000' },
    mapbox: mapboxCfg,
    showlegend: false
  };

  Plotly.newPlot(chartEl, traces, layout, { responsive: true, displayModeBar: false });
}
