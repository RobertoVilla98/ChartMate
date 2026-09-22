import dash
from dash import html, dcc, Input, Output, State, callback
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
import polars as pl
import os
import datetime

from components.export_toolbar import render_export_toolbar, render_viewport_controls
from components.trace_styler import render_trace_controls
from components.axis_panel import render_global_controls, render_axis_accordion, render_timeframe_accordion
from components.annotation_panel import render_annotation_accordion
from utils.chart_engine import build_single_chart_figure
from utils.storage import load_projects, save_canvas, delete_canvas
from utils.data_handler import load_data_file

dash.register_page(__name__, path='/canvas', name="Canvas")

layout = html.Div([
    # Top Row: Project Selection & Chart Controls
    dbc.Row([
        # Left Side (width=3): Project & Canvas Selector
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    html.I(className="bi bi-folder-symlink me-2 text-emerald"),
                    "Project & Canvas View"
                ]),
                dbc.CardBody([
                    html.Label("Active Project", className="small fw-bold text-secondary mb-1"),
                    dcc.Dropdown(id='project-selector', placeholder="Select Project...", className="mb-2 small font-mono"),
                    
                    html.Label("Recall Canvas", className="small fw-bold text-secondary mb-1"),
                    dbc.Row([
                        dbc.Col(dcc.Dropdown(id='saved-canvas-selector', placeholder="Select Canvas...", className="small font-mono"), width=8, className="pe-1"),
                        dbc.Col(dbc.Button([html.I(className="bi bi-trash3")], id='delete-canvas-btn', color="danger", size="sm", className="w-100"), width=4, className="ps-0")
                    ], className="mb-2"),
                    
                    dcc.ConfirmDialog(
                        id='delete-confirm-dialog',
                        message='Are you sure you want to permanently delete this saved canvas?',
                    ),
                    html.Hr(className="border-subtle my-2"),
                    
                    html.Label("Save / Update Canvas", className="small fw-bold text-secondary mb-1"),
                    dbc.Input(id='canvas-name', placeholder="Canvas Name (e.g. CO2_Analysis)...", size="sm", className="mb-2 font-mono"),
                    dbc.Row([
                        dbc.Col(dbc.Button([html.I(className="bi bi-plus-lg me-1"), "Save New"], id='save-canvas-btn', color="success", size="sm", className="w-100"), width=6, className="pe-1"),
                        dbc.Col(dbc.Button([html.I(className="bi bi-arrow-repeat me-1"), "Update"], id='update-canvas-btn', color="primary", size="sm", className="w-100"), width=6, className="ps-1")
                    ]),
                    html.Div(id='save-status-msg', className="text-muted small mt-2 text-center font-mono")
                ])
            ], className="mb-3")
        ], width=12, lg=3),
        
        # Right Side (width=9): Chart Controls
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    html.I(className="bi bi-sliders2 me-2 text-emerald"),
                    "Variables, Layout & Axis Properties"
                ]),
                dbc.CardBody([
                    html.Div(id='plot-controls')
                ], style={'maxHeight': '48vh', 'overflowY': 'auto'})
            ], className="mb-3")
        ], width=12, lg=9)
    ], className="mb-3"),
    
    # Middle Row: Per-Trace Series Styling & Smart Annotations (Accordion)
    dbc.Row([
        dbc.Col([
            dbc.Accordion([
                dbc.AccordionItem(
                    html.Div(id='trace-controls'),
                    title="🎨 Per-Trace Series Styling (Colors, Line Styles, Opacity & Ordering)",
                    item_id="trace-settings"
                ),
                render_annotation_accordion(),
            ], start_collapsed=True, className="mb-3", always_open=True)
        ], width=12)
    ], className="mb-3"),
    
    # Bottom Row: Canvas Viewport & Export Studio
    dbc.Row([
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    html.Div([
                        html.Div([
                            html.I(className="bi bi-display me-2 text-emerald"),
                            html.Span("Interactive Canvas & Export Studio", className="fw-bold")
                        ], className="d-flex align-items-center"),
                        render_viewport_controls(prefix="viewport")
                    ], className="d-flex flex-wrap justify-content-between align-items-center w-100")
                ]),
                dbc.CardBody([
                    render_export_toolbar(prefix="dl", default_preset="double_col"),
                    html.Div([
                        dcc.Graph(
                            id='main-graph',
                            config={'displaylogo': False, 'responsive': True, 'modeBarButtonsToRemove': ['lasso2d', 'select2d']}
                        )
                    ], id='main-graph-wrapper', className="graph-preview-container")
                ])
            ])
        ], width=12)
    ]),
    
    html.Div(id='canvas-saved-store', style={'display': 'none'}, children=0),
    html.Div(id='dl-dummy-output', style={'display': 'none'}),

    dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Update / Overwrite Canvas?")),
            dbc.ModalBody(id="overwrite-modal-body", children="Are you sure you want to update/overwrite this canvas?"),
            dbc.ModalFooter([
                dbc.Button("Cancel", id="cancel-overwrite-canvas", className="ms-auto", n_clicks=0, color="secondary"),
                dbc.Button("Confirm", id="confirm-overwrite-canvas", color="primary", n_clicks=0),
            ]),
        ],
        id="overwrite-modal-canvas",
        is_open=False,
    ),
], className="py-2")

# Publication Preset Callback
@callback(
    Output('dl-width', 'value'),
    Output('dl-height', 'value'),
    Output('global-font-size', 'value', allow_duplicate=True),
    Output('axis-title-size', 'value', allow_duplicate=True),
    Output('axis-tick-size', 'value', allow_duplicate=True),
    Output('legend-font-size', 'value', allow_duplicate=True),
    Input('dl-preset', 'value'),
    prevent_initial_call=True
)
def apply_canvas_preset(preset_key):
    from components.export_toolbar import PUBLICATION_PRESETS
    if preset_key not in PUBLICATION_PRESETS or preset_key == 'custom':
        return [dash.no_update] * 6
    p = PUBLICATION_PRESETS[preset_key]
    return p['width'], p['height'], p['fs_glob'], p['fs_tit'], p['fs_tick'], p['fs_leg']

# Proportional Aspect Ratio Sizing & Badge Callback
@callback(
    Output('main-graph', 'style'),
    Output('main-graph-wrapper', 'style'),
    Output('viewport-ratio-badge', 'children'),
    Input('dl-width', 'value'),
    Input('dl-height', 'value')
)
def update_canvas_preview_size(w_cm, h_cm):
    if not w_cm or not h_cm or float(w_cm) <= 0 or float(h_cm) <= 0:
        w_cm, h_cm = 17.0, 9.5
    
    w_cm = float(w_cm)
    h_cm = float(h_cm)
    ratio = w_cm / h_cm
    
    # Calculate responsive proportional dimensions (Large Screen Multiplier)
    calc_w = 1150
    calc_h = int(calc_w / ratio)
    
    if calc_h > 680:
        calc_h = 680
        calc_w = int(calc_h * ratio)
    elif calc_h < 420:
        calc_h = 420
        calc_w = min(int(calc_h * ratio), 1200)
        
    badge_txt = f"{w_cm:.1f} × {h_cm:.1f} cm (Ratio {ratio:.2f}:1)"
    
    wrapper_style = {
        'display': 'flex',
        'justifyContent': 'center',
        'alignItems': 'center',
        'width': '100%',
        'minHeight': f'{calc_h + 24}px',
        'padding': '12px',
        'transition': 'all 0.25s ease'
    }
    
    graph_style = {
        'width': f'{calc_w}px',
        'maxWidth': '100%',
        'height': f'{calc_h}px',
        'margin': '0 auto',
        'transition': 'all 0.25s ease'
    }
    
    return graph_style, wrapper_style, badge_txt

@callback(
    Output('project-selector', 'options'),
    Input('project-selector', 'id')
)
def update_project_options(_):
    projects = load_projects()
    return [{'label': k, 'value': k} for k in projects.keys()]

@callback(
    Output('canvas-selector', 'options'),
    Output('canvas-selector', 'value'),
    Input('project-selector', 'value'),
    Input('canvas-saved-store', 'data')
)
def update_canvas_options(project_name, save_data):
    if not project_name: return [], None
    canvases = load_projects().get(project_name, {}).get('canvases', {})
    return [{'label': k, 'value': k} for k in canvases.keys()], None

@callback(
    Output('plot-controls', 'children'),
    Output('canvas-name', 'value'),
    Input('project-selector', 'value')
)
def update_main_controls(project_name):
    if not project_name:
        return html.Div("Please select a project to configure chart axes and properties.", className="text-muted small p-3"), ""
    
    projects = load_projects()
    if project_name not in projects:
        return html.Div("Project not found.", className="text-danger small"), ""
    
    config = projects[project_name]
    file_path = config['file_path']
    if not os.path.exists(file_path):
        return html.Div(f"Dataset file not found at: {file_path}", className="text-danger small"), ""
    
    df = load_data_file(
        file_path, sep=config.get('sep', ','), decimal=config.get('decimal', '.'),
        timestamp_col=config.get('timestamp_col'), timestamp_format=config.get('timestamp_format')
    )
    if df is None:
        return html.Div("Error loading dataset.", className="text-danger small"), ""
    
    cols = df.columns
    ts_col = config.get('timestamp_col')
    default_x = ts_col if ts_col and ts_col in cols else cols[0]
    remaining_cols = [c for c in cols if c != default_x]
    y = [remaining_cols[0]] if remaining_cols else [cols[0]]

    return html.Div([
        render_global_controls(cols, default_x, y, [], []),
        dbc.Accordion([
            render_axis_accordion(),
            render_timeframe_accordion()
        ], start_collapsed=True)
    ]), ""

@callback(
    Output('trace-controls', 'children'),
    Input('y-axis', 'value'),
    Input('secondary-y-axis', 'value'),
    Input('tertiary-y-axis', 'value'),
    State('project-selector', 'value'),
    State('canvas-selector', 'value'),
    State({'type': 'trace-name', 'index': dash.ALL}, 'id'),
    State({'type': 'trace-name', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-color', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-chart-type', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-line-style', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-thickness', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-opacity', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-order', 'index': dash.ALL}, 'value'),
    prevent_initial_call=True
)
def update_trace_controls_cb(y, y2, y3, project_name, canvas_name, t_ids, t_names, t_cols, t_types, t_styles, t_thick, t_opac, t_order):
    if not project_name: return "Please select a project."
    projects = load_projects()
    if project_name not in projects: return "Project not found."
    
    config = projects[project_name]
    file_path = config['file_path']
    if not os.path.exists(file_path): return ""
    
    df = load_data_file(file_path, sep=config.get('sep', ','), decimal=config.get('decimal', '.'))
    if df is None: return "Error loading dataset."
    
    cols = df.columns
    selected_traces = []
    if y: selected_traces.extend(y if isinstance(y, list) else [y])
    if y2: selected_traces.extend(y2 if isinstance(y2, list) else [y2])
    if y3: selected_traces.extend(y3 if isinstance(y3, list) else [y3])
    selected_traces = list(dict.fromkeys([c for c in selected_traces if c in cols]))

    dom_state = {}
    if t_ids:
        for idx, tid in enumerate(t_ids):
            c_name = tid['index']
            dom_state[c_name] = {
                'name': t_names[idx] if t_names and idx < len(t_names) else c_name,
                'color': t_cols[idx] if t_cols and idx < len(t_cols) else None,
                'type': t_types[idx] if t_types and idx < len(t_types) else 'global',
                'style': t_styles[idx] if t_styles and idx < len(t_styles) else 'solid',
                'width': t_thick[idx] if t_thick and idx < len(t_thick) else 2,
                'opacity': t_opac[idx] if t_opac and idx < len(t_opac) else 1.0,
                'order': t_order[idx] if t_order and idx < len(t_order) else None
            }
            
    saved_state = config.get('canvases', {}).get(canvas_name, {}).get('tc', {}) if canvas_name else {}
    return render_trace_controls(selected_traces, dom_state, saved_state)

@callback(
    Output('date-picker-div', 'style'),
    Output('reference-date-div', 'style'),
    Output('date-picker-range', 'min_date_allowed'),
    Output('date-picker-range', 'max_date_allowed'),
    Output('date-picker-range', 'start_date'),
    Output('date-picker-range', 'end_date'),
    Input('timeframe-dropdown', 'value'),
    Input('reference-date-picker', 'date'),
    State('project-selector', 'value')
)
def update_date_picker(timeframe, ref_date, project_name):
    if not project_name: return {'display': 'none'}, {'display': 'block'}, dash.no_update, dash.no_update, dash.no_update, dash.no_update
    projects = load_projects()
    config = projects.get(project_name, {})
    ts_col = config.get('timestamp_col')
    if not ts_col: return {'display':'none'}, {'display': 'block'}, dash.no_update, dash.no_update, dash.no_update, dash.no_update
    file_path = config.get('file_path')
    if not file_path or not os.path.exists(file_path): return {'display': 'none'}, {'display': 'block'}, dash.no_update, dash.no_update, dash.no_update, dash.no_update
    df = load_data_file(file_path, sep=config.get('sep', ','), decimal=config.get('decimal', '.'), timestamp_col=ts_col, timestamp_format=config.get('timestamp_format'))
    if df is None or ts_col not in df.columns or df[ts_col].dtype not in [pl.Datetime, pl.Date]: return {'display':'none'}, {'display': 'block'}, dash.no_update, dash.no_update, dash.no_update, dash.no_update

    min_val = df.select(pl.col(ts_col).min()).item()
    max_val = df.select(pl.col(ts_col).max()).item()
    if min_val is None or max_val is None:
        return {'display':'none'}, {'display': 'block'}, dash.no_update, dash.no_update, dash.no_update, dash.no_update
    
    min_d = min_val.strftime('%Y-%m-%d')
    max_d = max_val.strftime('%Y-%m-%d')
    today = datetime.datetime.strptime(ref_date.split('T')[0], '%Y-%m-%d').date() if ref_date else datetime.date.today()
    
    if timeframe == 'custom': return {'display':'block'}, {'display': 'none'}, min_d, max_d, dash.no_update, dash.no_update
    
    start_d, end_d = None, None
    if timeframe == 'all_time': start_d, end_d = min_d, max_d
    elif timeframe == 'daily':
        start_d = today.strftime('%Y-%m-%d')
        end_d = today.strftime('%Y-%m-%d')
    elif timeframe == 'weekly':
        start_d = (today - datetime.timedelta(days=today.weekday())).strftime('%Y-%m-%d')
        end_d = (today + datetime.timedelta(days=6 - today.weekday())).strftime('%Y-%m-%d')
    elif timeframe == 'monthly':
        start_d = today.replace(day=1).strftime('%Y-%m-%d')
        next_month = today.replace(day=28) + datetime.timedelta(days=4)
        end_d = (next_month - datetime.timedelta(days=next_month.day)).strftime('%Y-%m-%d')
    elif timeframe == 'yearly':
        start_d = today.replace(month=1, day=1).strftime('%Y-%m-%d')
        end_d = today.replace(month=12, day=31).strftime('%Y-%m-%d')

    return {'display':'block'}, {'display': 'block'}, min_d, max_d, start_d, end_d

@callback(
    Output('delete-confirm-dialog', 'displayed'),
    Input('delete-canvas-btn', 'n_clicks'),
    State('canvas-selector', 'value'),
    prevent_initial_call=True
)
def display_delete_confirm(n_clicks, canvas_name):
    return bool(n_clicks and canvas_name)

@callback(
    Output('save-status-msg', 'children'),
    Output('canvas-saved-store', 'data', allow_duplicate=True),
    Output('overwrite-modal-canvas', 'is_open'),
    Output('overwrite-modal-body', 'children'),
    Input('save-canvas-btn', 'n_clicks'),
    Input('update-canvas-btn', 'n_clicks'),
    Input('confirm-overwrite-canvas', 'n_clicks'),
    Input('cancel-overwrite-canvas', 'n_clicks'),
    Input('delete-confirm-dialog', 'submit_n_clicks'),
    State('overwrite-modal-canvas', 'is_open'),
    State('overwrite-modal-body', 'children'),
    State('canvas-name', 'value'), State('canvas-selector', 'value'),
    State('x-axis', 'value'), State('y-axis', 'value'), State('secondary-y-axis', 'value'), State('tertiary-y-axis', 'value'),
    State('chart-type', 'value'), State('legend-pos', 'value'), State('global-font', 'value'),
    State('global-font-size', 'value'), State('legend-font-size', 'value'), State('axis-title-size', 'value'), State('axis-tick-size', 'value'),
    State('x-axis-label', 'value'), State('y-axis-label', 'value'), State('y2-axis-label', 'value'), State('y3-axis-label', 'value'),
    State('x-axis-min', 'value'), State('x-axis-max', 'value'), State('y-axis-min', 'value'), State('y-axis-max', 'value'),
    State('y2-axis-min', 'value'), State('y2-axis-max', 'value'), State('y3-axis-min', 'value'), State('y3-axis-max', 'value'),
    State('grid-x-switch', 'value'), State('grid-y-switch', 'value'), State('grid-y2-switch', 'value'), State('grid-y3-switch', 'value'),
    State('show-x-label', 'value'), State('show-y-label', 'value'), State('show-y2-label', 'value'), State('show-y3-label', 'value'),
    State('connect-gaps', 'value'), State('timeframe-dropdown', 'value'),
    State('reference-date-picker', 'date'), State('date-picker-range', 'start_date'), State('date-picker-range', 'end_date'),
    State({'type': 'trace-name', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-color', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-chart-type', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-line-style', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-thickness', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-opacity', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-order', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-name', 'index': dash.ALL}, 'id'),
    State('project-selector', 'value'),
    State('canvas-saved-store', 'data'),
    prevent_initial_call=True
)
def save_canvas_callback(n_save, n_update, n_confirm, n_cancel, n_delete, is_open, modal_body, new_name, existing_name, x, y, y2, y3, c_type, leg, font,
                        fs_glob, fs_leg, fs_tit, fs_tick,
                        xl, yl, y2l, y3l, xmin, xmax, ymin, ymax, y2min, y2max, y3min, y3max, gx, gy, gy2, gy3, 
                        sx, sy, sy2, sy3, gaps, tf, ref, sd, ed,
                        t_names, t_cols, t_types, t_styles, t_thick, t_opac, t_order, t_ids, proj, store_data):
    ctx = dash.callback_context
    if not ctx.triggered: return dash.no_update, dash.no_update, dash.no_update, dash.no_update
    trig = ctx.triggered[0]['prop_id'].split('.')[0]

    if trig == 'delete-confirm-dialog' and existing_name and proj:
        if delete_canvas(proj, existing_name):
            return f"Deleted '{existing_name}'", store_data + 1, dash.no_update, dash.no_update
        return "Delete Failed", store_data, dash.no_update, dash.no_update
        
    projects = load_projects()
    if trig == 'cancel-overwrite-canvas':
        return "", store_data, False, dash.no_update
        
    if trig in ['save-canvas-btn', 'update-canvas-btn']:
        target = existing_name if trig == 'update-canvas-btn' else new_name
        if not target or not proj: return "Please provide Name & Project", store_data, dash.no_update, dash.no_update
        
        if trig == 'save-canvas-btn' and target in projects.get(proj, {}).get('canvases', {}):
            return "", store_data, True, f"A canvas named '{target}' already exists. Do you want to overwrite it?"
        if trig == 'update-canvas-btn':
            return "", store_data, True, f"Are you sure you want to update the canvas '{target}'?"
        
        tc = {}
        if t_ids:
            for i, tid in enumerate(t_ids):
                col = tid['index']
                tc[col] = {'name': t_names[i], 'color': t_cols[i], 'type': t_types[i], 'style': t_styles[i], 'width': t_thick[i], 'opacity': t_opac[i], 'order': t_order[i]}

        cfg = {'x':x, 'y':y, 'y2':y2, 'y3':y3, 'ctype':c_type, 'leg':leg, 'font':font, 
               'fs_glob':fs_glob, 'fs_leg':fs_leg, 'fs_tit':fs_tit, 'fs_tick':fs_tick,
               'xl':xl, 'yl':yl, 'y2l':y2l, 'y3l':y3l, 'xmin':xmin, 'xmax':xmax, 'ymin':ymin, 'ymax':ymax, 'y2min':y2min, 'y2max':y2max, 'y3min':y3min, 'y3max':y3max,
               'gx':gx, 'gy':gy, 'gy2':gy2, 'gy3':gy3, 'gaps':gaps, 
               'sx':sx, 'sy':sy, 'sy2':sy2, 'sy3':sy3, 'tf':tf, 'ref':ref, 'sd':sd, 'ed':ed, 'tc':tc}
        if save_canvas(proj, target, cfg):
            return "Saved successfully!", store_data + 1, dash.no_update, dash.no_update
            
    if trig == 'confirm-overwrite-canvas':
        target = new_name if modal_body and "already exists" in modal_body else existing_name
        if not target: return "Need Name & Project", store_data, False, dash.no_update
        
        tc = {}
        if t_ids:
            for i, tid in enumerate(t_ids):
                col = tid['index']
                tc[col] = {'name': t_names[i], 'color': t_cols[i], 'type': t_types[i], 'style': t_styles[i], 'width': t_thick[i], 'opacity': t_opac[i], 'order': t_order[i]}

        cfg = {'x':x, 'y':y, 'y2':y2, 'y3':y3, 'ctype':c_type, 'leg':leg, 'font':font, 
               'fs_glob':fs_glob, 'fs_leg':fs_leg, 'fs_tit':fs_tit, 'fs_tick':fs_tick,
               'xl':xl, 'yl':yl, 'y2l':y2l, 'y3l':y3l, 'xmin':xmin, 'xmax':xmax, 'ymin':ymin, 'ymax':ymax, 'y2min':y2min, 'y2max':y2max, 'y3min':y3min, 'y3max':y3max,
               'gx':gx, 'gy':gy, 'gy2':gy2, 'gy3':gy3, 'gaps':gaps, 
               'sx':sx, 'sy':sy, 'sy2':sy2, 'sy3':sy3, 'tf':tf, 'ref':ref, 'sd':sd, 'ed':ed, 'tc':tc}
        if save_canvas(proj, target, cfg):
            return "Updated successfully!", store_data + 1, False, dash.no_update
            
    return "", store_data, is_open, dash.no_update

@callback(
    Output('x-axis', 'value'), Output('y-axis', 'value'), Output('secondary-y-axis', 'value'), Output('tertiary-y-axis', 'value'),
    Output('chart-type', 'value'), Output('legend-pos', 'value'), Output('global-font', 'value'),
    Output('global-font-size', 'value'), Output('legend-font-size', 'value'), Output('axis-title-size', 'value'), Output('axis-tick-size', 'value'),
    Output('x-axis-label', 'value'), Output('y-axis-label', 'value'), Output('y2-axis-label', 'value'), Output('y3-axis-label', 'value'),
    Output('x-axis-min', 'value'), Output('x-axis-max', 'value'), Output('y-axis-min', 'value'), Output('y-axis-max', 'value'),
    Output('y2-axis-min', 'value'), Output('y2-axis-max', 'value'), Output('y3-axis-min', 'value'), Output('y3-axis-max', 'value'),
    Output('grid-x-switch', 'value'), Output('grid-y-switch', 'value'), Output('grid-y2-switch', 'value'), Output('grid-y3-switch', 'value'),
    Output('show-x-label', 'value'), Output('show-y-label', 'value'), Output('show-y2-label', 'value'), Output('show-y3-label', 'value'),
    Output('connect-gaps', 'value'), Output('timeframe-dropdown', 'value'), Output('reference-date-picker', 'date'),
    Output('date-picker-range', 'start_date', allow_duplicate=True), Output('date-picker-range', 'end_date', allow_duplicate=True),
    Output({'type': 'trace-name', 'index': dash.ALL}, 'value'),
    Output({'type': 'trace-color', 'index': dash.ALL}, 'value'),
    Output({'type': 'trace-chart-type', 'index': dash.ALL}, 'value'),
    Output({'type': 'trace-line-style', 'index': dash.ALL}, 'value'),
    Output({'type': 'trace-thickness', 'index': dash.ALL}, 'value'),
    Output({'type': 'trace-opacity', 'index': dash.ALL}, 'value'),
    Output({'type': 'trace-order', 'index': dash.ALL}, 'value'),
    Input('canvas-selector', 'value'), State('project-selector', 'value'), State({'type': 'trace-name', 'index': dash.ALL}, 'id'),
    prevent_initial_call=True
)
def load_canvas(canvas_name, proj, t_ids):
    if not canvas_name or not proj: return [dash.no_update]*43
    projs = load_projects()
    if canvas_name not in projs.get(proj, {}).get('canvases', {}): return [dash.no_update]*43
    c = projs[proj]['canvases'][canvas_name]
    
    y = c.get('y', []); 
    if isinstance(y, str): y = [y]
    
    names, cols, types, styles, thicks, opacs, orders = [], [], [], [], [], [], []
    for i, tid in enumerate(t_ids):
        col = tid['index']
        tc = c.get('tc', {}).get(col, {})
        names.append(tc.get('name', dash.no_update))
        cols.append(tc.get('color', dash.no_update))
        types.append(tc.get('type', dash.no_update))
        styles.append(tc.get('style', dash.no_update))
        thicks.append(tc.get('width', dash.no_update))
        opacs.append(tc.get('opacity', dash.no_update))
        orders.append(tc.get('order', i+1))
        
    old_grids = c.get('grids', [])
    gx = c.get('gx', ['x']) if 'gx' in c else (['x'] if 'x' in old_grids else [])
    gy = c.get('gy', ['y']) if 'gy' in c else (['y'] if 'y' in old_grids else [])
    gy2 = c.get('gy2', []) if 'gy2' in c else (['y2'] if 'y2' in old_grids else [])
    gy3 = c.get('gy3', []) if 'gy3' in c else (['y3'] if 'y3' in old_grids else [])

    return (c.get('x'), y, c.get('y2', c.get('secondary_y', [])), c.get('y3', c.get('tertiary_y', [])),
            c.get('ctype', c.get('type', 'line')), c.get('leg', c.get('legend', 'top')), c.get('font', 'Outfit'),
            c.get('fs_glob', 12), c.get('fs_leg', 11), c.get('fs_tit', 13), c.get('fs_tick', 11),
            c.get('xl', ''), c.get('yl', ''), c.get('y2l', ''), c.get('y3l', ''),
            c.get('xmin'), c.get('xmax'), c.get('ymin'), c.get('ymax'), c.get('y2min'), c.get('y2max'), c.get('y3min'), c.get('y3max'),
            gx, gy, gy2, gy3, 
            c.get('sx', ["1"] if 'slbl' not in c or c.get('slbl', True) else []), 
            c.get('sy', ["1"] if 'slbl' not in c or c.get('slbl', True) else []), 
            c.get('sy2', ["1"] if 'slbl' not in c or c.get('slbl', True) else []), 
            c.get('sy3', ["1"] if 'slbl' not in c or c.get('slbl', True) else []),
            c.get('gaps', False), c.get('tf', 'all_time'), c.get('ref'), c.get('sd'), c.get('ed'),
            names, cols, types, styles, thicks, opacs, orders)

@callback(
    Output('main-graph', 'figure'),
    Input('x-axis', 'value'), Input('y-axis', 'value'), Input('secondary-y-axis', 'value'), Input('tertiary-y-axis', 'value'),
    Input('chart-type', 'value'), Input('legend-pos', 'value'), Input('global-font', 'value'),
    Input('global-font-size', 'value'), Input('legend-font-size', 'value'), Input('axis-title-size', 'value'), Input('axis-tick-size', 'value'),
    Input('x-axis-label', 'value'), Input('y-axis-label', 'value'), Input('y2-axis-label', 'value'), Input('y3-axis-label', 'value'),
    Input('x-axis-min', 'value'), Input('x-axis-max', 'value'), Input('y-axis-min', 'value'), Input('y-axis-max', 'value'),
    Input('y2-axis-min', 'value'), Input('y2-axis-max', 'value'), Input('y3-axis-min', 'value'), Input('y3-axis-max', 'value'),
    Input('grid-x-switch', 'value'), Input('grid-y-switch', 'value'), Input('grid-y2-switch', 'value'), Input('grid-y3-switch', 'value'),
    Input('show-x-label', 'value'), Input('show-y-label', 'value'), Input('show-y2-label', 'value'), Input('show-y3-label', 'value'),
    Input('connect-gaps', 'value'),
    Input('dl-width', 'value'), Input('dl-height', 'value'),
    Input('extrema-mode', 'value'), Input('extrema-type', 'value'), Input('extrema-badge-format', 'value'),
    Input('thresh1-val', 'value'), Input('thresh1-lbl', 'value'),
    Input('thresh2-val', 'value'), Input('thresh2-lbl', 'value'),
    Input('band-min', 'value'), Input('band-max', 'value'), Input('band-lbl', 'value'), Input('band-color', 'value'),
    Input('stats-switches', 'value'),
    Input('event-start-date', 'date'), Input('event-end-date', 'date'), Input('event-label', 'value'),
    Input('date-picker-range', 'start_date'), Input('date-picker-range', 'end_date'),
    Input({'type': 'trace-name', 'index': dash.ALL}, 'value'),
    Input({'type': 'trace-color', 'index': dash.ALL}, 'value'),
    Input({'type': 'trace-chart-type', 'index': dash.ALL}, 'value'),
    Input({'type': 'trace-line-style', 'index': dash.ALL}, 'value'),
    Input({'type': 'trace-thickness', 'index': dash.ALL}, 'value'),
    Input({'type': 'trace-opacity', 'index': dash.ALL}, 'value'),
    Input({'type': 'trace-order', 'index': dash.ALL}, 'value'),
    State({'type': 'trace-name', 'index': dash.ALL}, 'id'),
    State('project-selector', 'value')
)
def render_graph_cb(x, y, y2, y3, ctype, leg, font, fs_glob, fs_leg, fs_tit, fs_tick, xl, yl, y2l, y3l, xmin, xmax, ymin, ymax, y2min, y2max, y3min, y3max, gx, gy, gy2, gy3,
                    sx, sy, sy2, sy3, gaps, w_cm, h_cm,
                    ext_mode, ext_type, ext_badge,
                    th1_val, th1_lbl, th2_val, th2_lbl,
                    b_min, b_max, b_lbl, b_col,
                    stats_sw, ev_sd, ev_ed, ev_lbl,
                    sd, ed,
                    t_names, t_cols, t_types, t_styles, t_thick, t_opac, t_order, t_ids, proj):
    if not all([x, proj, ctype]): return go.Figure()
    
    config = load_projects().get(proj, {})
    if not config or 'file_path' not in config: return go.Figure()
    
    df = load_data_file(config['file_path'], sep=config.get('sep', ','), decimal=config.get('decimal', '.'), timestamp_col=config.get('timestamp_col'), timestamp_format=config.get('timestamp_format'))
    if df is None: return go.Figure()
    
    tc = {}
    if t_ids:
        for i, tid in enumerate(t_ids):
            tc[tid['index']] = {'name': t_names[i], 'color': t_cols[i], 'type': t_types[i], 'style': t_styles[i] if t_styles and i < len(t_styles) else 'solid', 'width': t_thick[i], 'opacity': t_opac[i], 'order': t_order[i]}

    return build_single_chart_figure(
        df=df, x=x, y=y, y2=y2, y3=y3, ctype=ctype, leg=leg, font=font,
        fs_glob=fs_glob, fs_leg=fs_leg, fs_tit=fs_tit, fs_tick=fs_tick,
        xl=xl, yl=yl, y2l=y2l, y3l=y3l, xmin=xmin, xmax=xmax, ymin=ymin, ymax=ymax,
        y2min=y2min, y2max=y2max, y3min=y3min, y3max=y3max,
        gx=gx, gy=gy, gy2=gy2, gy3=gy3, sx=sx, sy=sy, sy2=sy2, sy3=sy3,
        gaps=gaps, sd=sd, ed=ed, ts_col=config.get('timestamp_col'), tc=tc,
        w_cm=w_cm, h_cm=h_cm,
        extrema_mode=ext_mode, extrema_type=ext_type, extrema_badge=ext_badge,
        thresh1_val=th1_val, thresh1_lbl=th1_lbl,
        thresh2_val=th2_val, thresh2_lbl=th2_lbl,
        band_min=b_min, band_max=b_max, band_lbl=b_lbl, band_color=b_col,
        stats_switches=stats_sw,
        event_start=ev_sd, event_end=ev_ed, event_label=ev_lbl
    )

# Clientside vector/raster export callback
dash.clientside_callback(
    """
    function(n_clicks, format, width_cm, height_cm, dpi, proj, canvas_name) {
        if (n_clicks) {
            const width_px = (width_cm / 2.54) * 96;
            const height_px = (height_cm / 2.54) * 96;
            const scale = (dpi || 300) / 96;
            const gd = document.getElementById('main-graph').querySelector('.js-plotly-plot') || document.getElementById('main-graph');
            const fname = (proj || 'ChartMate') + '_' + (canvas_name || 'canvas');
            
            Plotly.downloadImage(gd, {
                format: format || 'svg',
                width: width_px,
                height: height_px,
                scale: scale,
                filename: fname
            });
        }
        return window.dash_clientside.no_update;
    }
    """,
    Output('dl-dummy-output', 'children'),
    Input('dl-btn', 'n_clicks'),
    State('dl-format', 'value'),
    State('dl-width', 'value'),
    State('dl-height', 'value'),
    State('dl-dpi', 'value'),
    State('project-selector', 'value'),
    State('canvas-selector', 'value'),
    prevent_initial_call=True
)
