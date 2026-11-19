// @ts-ignore
import Plotly from 'plotly.js-dist-min';
import { state } from '../core/state';
import { standardizeFontsFor } from '../charts/export_fonts';

/** CSS pixels per millimetre (96 px/in). Plotly SVG user units are CSS pixels. */
const PX_PER_MM = 96 / 25.4;

export interface ExportTarget {
  elementId: string;
  widthPx: number;
  heightPx: number;
  filename: string;
  /** Raster formats only (maps): device pixel ratio. */
  rasterScale?: number;
}

function plateWidthMm(): number {
  const p = state.editorialState.plateWidthPreset;
  return p === 'single_85mm' ? 85 : p === 'half_120mm' ? 120 : 170;
}

/** Figure of the current tab, sized in CSS px so that 1 px = 1/96 in on paper. */
function currentTarget(): ExportTarget {
  switch (state.currentTab) {
    case 'multi':
      return { elementId: 'plotly-multi-chart', widthPx: state.mpWidthCm * 10 * PX_PER_MM, heightPx: state.mpHeightCm * 10 * PX_PER_MM, filename: `ChartMate_MultiPlot_${state.mpTopology}` };
    case 'maps':
      return { elementId: 'plotly-map-chart', widthPx: state.mapWidthCm * 10 * PX_PER_MM, heightPx: state.mapHeightCm * 10 * PX_PER_MM, filename: `ChartMate_Map_${state.mapMode}_${state.mapClusterAgg}`, rasterScale: 2 };
    case 'physics':
      return { elementId: 'plotly-physics-chart', widthPx: state.widthCm * 10 * PX_PER_MM, heightPx: state.heightCm * 10 * PX_PER_MM, filename: `ChartMate_Physics_${state.physicsMode}` };
    case 'editorial': {
      const el: any = document.getElementById('plotly-plate-chart');
      const lw = el?.layout?.width || 1, lh = el?.layout?.height || 1;
      const w = plateWidthMm() * PX_PER_MM;
      return { elementId: 'plotly-plate-chart', widthPx: w, heightPx: w * (lh / lw), filename: `ChartMate_Journal_Plate_${state.editorialState.plateWidthPreset}` };
    }
    default:
      return { elementId: 'plotly-chart', widthPx: state.widthCm * 10 * PX_PER_MM, heightPx: state.heightCm * 10 * PX_PER_MM, filename: `ChartMate_${state.preset}_figure` };
  }
}

/**
 * Vector PDF export. The Plotly SVG is converted with svg2pdf.js; text stays
 * text and is set in one standard PDF font (Helvetica, Times or Courier, following the category of the
 * figure font), which every PDF reader and journal system has, so no font embedding is needed.
 * The page size equals the figure size (1 px = 0.75 pt).
 */
export async function exportPdf(target: ExportTarget): Promise<void> {
  const svgText = await figureSvgText(target);
  if (svgText === null) return;
  const svgEl = new DOMParser().parseFromString(standardizeFonts(svgText, 'pdf'), 'image/svg+xml').documentElement;

  const { jsPDF } = await import('jspdf');
  await import('svg2pdf.js');
  const wPt = target.widthPx * 0.75;
  const hPt = target.heightPx * 0.75;
  const doc = new jsPDF({ unit: 'pt', format: [wPt, hPt], orientation: wPt >= hPt ? 'landscape' : 'portrait', compress: true });
  doc.setProperties({ title: target.filename, creator: 'ChartMate' });
  await (doc as any).svg(svgEl, { x: 0, y: 0, width: wPt, height: hPt });
  doc.save(`${target.filename}.pdf`);
}

/** Sets the exported text in one standard font following the user's figure font (see charts/export_fonts.ts). */
function standardizeFonts(svg: string, target: 'pdf' | 'svg'): string {
  return standardizeFontsFor(svg, target, state.fontFamily);
}

/** Kept for compatibility: PDF font mapping. */
export function mapToStandardFonts(svg: string): string {
  return standardizeFonts(svg, 'pdf');
}

async function figureSvgText(target: ExportTarget): Promise<string | null> {
  const gd = document.getElementById(target.elementId);
  if (!gd) return null;
  const url: string = await Plotly.toImage(gd, { format: 'svg', width: Math.round(target.widthPx), height: Math.round(target.heightPx) });
  return url.startsWith('data:image/svg+xml;base64,')
    ? atob(url.slice('data:image/svg+xml;base64,'.length))
    : decodeURIComponent(url.replace(/^data:image\/svg\+xml,/, ''));
}

function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** SVG export at the physical size of the figure (1 px = 1/96 in), with standard fonts. */
export async function exportSvg(target: ExportTarget): Promise<void> {
  const svg = await figureSvgText(target);
  if (svg === null) return;
  saveBlob(new Blob([standardizeFonts(svg, 'svg')], { type: 'image/svg+xml' }), `${target.filename}.svg`);
}

/** PNG export at the physical size of the figure and the chosen resolution (dpi). */
export function exportPng(target: ExportTarget, dpi: number) {
  Plotly.downloadImage(target.elementId, {
    format: 'png',
    width: Math.round(target.widthPx),
    height: Math.round(target.heightPx),
    scale: dpi / 96,
    filename: `${target.filename}_${dpi}dpi`
  } as any);
}

export function attachExportEvents() {
  // Universal Export Button: SVG with standard fonts (PNG for maps, whose basemap tiles are raster)
  document.getElementById('btn-export')?.addEventListener('click', async () => {
    const tg = currentTarget();
    if (state.currentTab === 'maps') {
      Plotly.downloadImage(tg.elementId, {
        format: 'png',
        width: Math.round(tg.widthPx),
        height: Math.round(tg.heightPx),
        ...(tg.rasterScale ? { scale: tg.rasterScale } : {}),
        filename: tg.filename
      } as any);
      return;
    }
    try {
      await exportSvg(tg);
    } catch (err) {
      alert(`SVG export failed: ${err}`);
    }
  });

  document.getElementById('btn-export-pdf')?.addEventListener('click', async () => {
    try {
      await exportPdf(currentTarget());
    } catch (err) {
      alert(`PDF export failed: ${err}`);
    }
  });

  document.getElementById('btn-export-png')?.addEventListener('click', () => {
    exportPng(currentTarget(), state.exportDpi);
  });
  document.getElementById('sel-export-dpi')?.addEventListener('change', (e) => {
    state.exportDpi = parseInt((e.target as HTMLSelectElement).value, 10) === 600 ? 600 : 300;
  });
}
