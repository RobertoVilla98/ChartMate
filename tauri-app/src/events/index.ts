import { attachCanvasEvents } from './canvas_events';
import { attachDataEvents, attachResamplingEvents } from './data_events';
import { attachEditorialEvents } from './editorial_events';
import { attachExportEvents } from './export_events';
import { attachMapEvents } from './map_events';
import { attachMultiPlotEvents } from './multiplot_events';
import { attachPhysicsEvents } from './physics_events';
import { attachProjectEvents } from './project_events';
import { attachShellEvents } from './shell_events';

export function attachEventListeners() {
  attachShellEvents();
  attachDataEvents();
  attachCanvasEvents();
  attachMultiPlotEvents();
  attachMapEvents();
  attachExportEvents();
  attachResamplingEvents();
  attachPhysicsEvents();
  attachEditorialEvents();
  attachProjectEvents();
}
