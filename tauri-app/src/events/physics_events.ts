import { updatePhysicsChart } from '../charts/physics';
import { state } from '../core/state';
import { renderApp } from '../ui/render_app';

export function attachPhysicsEvents() {
  // Tab 5: Building Physics Mode Switcher
  document.querySelectorAll('[data-physmode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const m = (e.currentTarget as HTMLElement).getAttribute('data-physmode') as any;
      if (m) {
        state.physicsMode = m;
        renderApp();
      }
    });
  });

  // Track 1: Carpet Plot Listeners
  document.getElementById('phys-carpet-var')?.addEventListener('change', (e) => {
    state.carpetState.variableCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-agg')?.addEventListener('change', (e) => {
    state.carpetState.aggMethod = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-cscale')?.addEventListener('change', (e) => {
    state.carpetState.colorscale = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-filter')?.addEventListener('change', (e) => {
    state.carpetState.dayFilter = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-zmin')?.addEventListener('input', (e) => {
    const raw = (e.target as HTMLInputElement).value.trim();
    state.carpetState.zMin = raw === '' ? null : parseFloat(raw);
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-zmax')?.addEventListener('input', (e) => {
    const raw = (e.target as HTMLInputElement).value.trim();
    state.carpetState.zMax = raw === '' ? null : parseFloat(raw);
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-dec')?.addEventListener('change', (e) => {
    state.carpetState.decimals = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-carpet-contours')?.addEventListener('change', (e) => {
    state.carpetState.showContours = (e.target as HTMLInputElement).checked;
    renderApp();
  });
  document.getElementById('phys-carpet-cstep')?.addEventListener('input', (e) => {
    const num = parseFloat((e.target as HTMLInputElement).value);
    state.carpetState.contourStep = (!isNaN(num) && num > 0) ? num : null;
    updatePhysicsChart();
  });

  // Track 2: Thermal Comfort Listeners
  document.getElementById('phys-comfort-norm')?.addEventListener('change', (e) => {
    state.comfortState.normMode = (e.target as HTMLSelectElement).value as any;
    renderApp();
  });
  document.getElementById('phys-comfort-intemp')?.addEventListener('change', (e) => {
    state.comfortState.indoorTempCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-comfort-outtemp')?.addEventListener('change', (e) => {
    state.comfortState.outdoorTempCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-comfort-rh')?.addEventListener('change', (e) => {
    state.comfortState.rhCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-comfort-trm')?.addEventListener('change', (e) => {
    state.comfortState.computeRunningMean = (e.target as HTMLInputElement).checked;
    updatePhysicsChart();
  });

  // Track 3: Duration Curve & Exceedance Listeners
  document.getElementById('phys-dur-var')?.addEventListener('change', (e) => {
    state.durationState.variableCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-cmp')?.addEventListener('change', (e) => {
    state.durationState.compareCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-xmode')?.addEventListener('change', (e) => {
    state.durationState.xMode = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-dtmode')?.addEventListener('change', (e) => {
    state.durationState.dtMode = (e.target as HTMLSelectElement).value === 'manual' ? 'manual' : 'auto';
    renderApp();
  });
  document.getElementById('phys-cal-qty')?.addEventListener('change', (e) => {
    state.calibState.quantity = (e.target as HTMLSelectElement).value === 'other' ? 'other' : 'energy';
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-dt')?.addEventListener('input', (e) => {
    state.durationState.dtHours = parseFloat((e.target as HTMLInputElement).value) || 1.0;
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-t1')?.addEventListener('input', (e) => {
    const raw = (e.target as HTMLInputElement).value.trim();
    state.durationState.threshold1 = raw === '' ? null : parseFloat(raw);
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-t2')?.addEventListener('input', (e) => {
    const raw = (e.target as HTMLInputElement).value.trim();
    state.durationState.threshold2 = raw === '' ? null : parseFloat(raw);
    updatePhysicsChart();
  });
  document.getElementById('phys-dur-shade')?.addEventListener('change', (e) => {
    state.durationState.shadeExceedance = (e.target as HTMLInputElement).checked;
    updatePhysicsChart();
  });

  // Track 5: ASHRAE Guideline 14 Calibration Listeners
  document.getElementById('phys-cal-meas')?.addEventListener('change', (e) => {
    state.calibState.measuredCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-cal-sim')?.addEventListener('change', (e) => {
    state.calibState.simulatedCol = (e.target as HTMLSelectElement).value;
    updatePhysicsChart();
  });
  document.getElementById('phys-cal-view')?.addEventListener('change', (e) => {
    state.calibState.viewMode = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-cal-std')?.addEventListener('change', (e) => {
    state.calibState.standard = (e.target as HTMLSelectElement).value as any;
    updatePhysicsChart();
  });
  document.getElementById('phys-cal-box')?.addEventListener('change', (e) => {
    state.calibState.showBoxOnChart = (e.target as HTMLInputElement).checked;
    updatePhysicsChart();
  });
}
