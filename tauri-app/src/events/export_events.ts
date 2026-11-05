// @ts-ignore
import Plotly from 'plotly.js-dist-min';
import { state } from '../core/state';

export function attachExportEvents() {
  // Universal Export Button
  document.getElementById('btn-export')?.addEventListener('click', () => {
    if (state.currentTab === 'multi') {
      Plotly.downloadImage('plotly-multi-chart', {
        format: 'svg',
        width: state.mpWidthCm * 37.795,
        height: state.mpHeightCm * 37.795,
        filename: `ChartMate_MultiPlot_${state.mpTopology}`
      });
    } else if (state.currentTab === 'maps') {
      Plotly.downloadImage('plotly-map-chart', {
        format: 'png',
        width: state.mapWidthCm * 37.795 * 2,
        height: state.mapHeightCm * 37.795 * 2,
        filename: `ChartMate_Map_${state.mapMode}_${state.mapClusterAgg}`
      });
    } else if (state.currentTab === 'physics') {
      Plotly.downloadImage('plotly-physics-chart', {
        format: 'svg',
        width: state.widthCm * 37.795,
        height: state.heightCm * 37.795,
        filename: `ChartMate_Physics_${state.physicsMode}`
      });
    } else if (state.currentTab === 'editorial') {
      Plotly.downloadImage('plotly-plate-chart', {
        format: 'svg',
        width: 17.0 * 37.795,
        height: 14.0 * 37.795,
        filename: `ChartMate_Journal_Plate_${state.editorialState.plateWidthPreset}`
      });
    } else {
      Plotly.downloadImage('plotly-chart', {
        format: 'svg',
        width: state.widthCm * 37.795,
        height: state.heightCm * 37.795,
        filename: `ChartMate_${state.preset}_figure`
      });
    }
  });
}
