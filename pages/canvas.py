import dash
from dash import html, dcc, Input, Output, State, callback
import dash_bootstrap_components as dbc
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from utils.storage import load_projects, save_canvas, delete_canvas
from utils.data_handler import load_csv_data
import polars as pl
import os
import datetime

dash.register_page(__name__, path='/canvas')

layout = html.Div([
    # Top Row: Project Selection/Save & Controls
    dbc.Row([
        # Left Side (width=3)
        dbc.Col([
            dbc.Card([
                dbc.CardHeader("Project Selection & Saving"),
                dbc.CardBody([
                    html.Label("Project", className="small fw-bold"),
                    dcc.Dropdown(id='project-selector', placeholder="Select Project", className="mb-2"),
                    html.Label("Recall Canvas", className="small fw-bold"),
                    dbc.Row([
                        dbc.Col(dcc.Dropdown(id='canvas-selector', placeholder="Select Canvas"), width=8, className="pe-1"),
                        dbc.Col(dbc.Button("Delete", id='delete-canvas-btn', color="danger", size="sm", className="w-100"), width=4, className="ps-0")
                    ], className="mb-2"),
                    dcc.ConfirmDialog(
                        id='delete-confirm-dialog',
                        message='Are you sure you want to delete this canvas?',
                    ),
                    html.Hr(),
                    html.Label("Save Configurations", className="small fw-bold"),
                    dbc.Input(id='canvas-name', placeholder="Canvas Name...", size="sm", className="mb-2"),
                    dbc.Row([
                        dbc.Col(dbc.Button("Save New", id='save-canvas-btn', color="success", size="sm", className="w-100"), width=6, className="pe-1"),
                        dbc.Col(dbc.Button("Update", id='update-canvas-btn', color="primary", size="sm", className="w-100"), width=6, className="ps-1")
                    ]),
                    html.Div(id='save-status-msg', className="text-muted small mt-2 text-center")
                ])
            ], className="mb-3")
        ], width=3),
        
        # Right Side (width=9)
        dbc.Col([
            dbc.Card([
                dbc.CardHeader("Chart Controls"),
                dbc.CardBody([
                    html.Div(id='plot-controls')
                ], style={'maxHeight': '45vh', 'overflowY': 'auto'})
            ])
        ], width=9)
    ], className="mb-3"),
    
    # Middle Row: Trace Formatting (Full Width)
    dbc.Row([
        dbc.Col([
            dbc.Accordion([
                dbc.AccordionItem(html.Div(id='trace-controls'), title="Trace Formatting (Per-Line Settings)"),
            ], start_collapsed=True, className="mb-3")
        ], width=12)
    ], className="mb-3"),
    
    # Bottom Row: Graph (Full Width)
    dbc.Row([
        dbc.Col([
            dbc.Card([
                dbc.CardBody([
                    dbc.Row([
                        dbc.Col(html.Label("Format", className="small fw-bold"), width="auto"),
                        dbc.Col(dbc.Select(id='dl-format', options=[{'label':'PNG','value':'png'}, {'label':'SVG','value':'svg'}, {'label':'JPEG','value':'jpeg'}], value='png', size="sm"), width="auto"),
                        dbc.Col(html.Label("Width (cm)", className="small fw-bold"), width="auto"),
                        dbc.Col(dbc.Input(id='dl-width', type='number', value=20, size="sm", style={'width': '80px'}), width="auto"),
                        dbc.Col(html.Label("Height (cm)", className="small fw-bold"), width="auto"),
                        dbc.Col(dbc.Input(id='dl-height', type='number', value=15, size="sm", style={'width': '80px'}), width="auto"),
                        dbc.Col(html.Label("DPI", className="small fw-bold"), width="auto"),
                        dbc.Col(dbc.Select(id='dl-dpi', options=[{'label':'96','value':96}, {'label':'150','value':150}, {'label':'300','value':300}, {'label':'600','value':600}], value=300, size="sm", style={'width': '80px'}), width="auto"),
                        dbc.Col(dbc.Button("Download High-Res Image", id='dl-btn', color="success", size="sm", className="ms-auto"), width="auto")
                    ], className="align-items-center mb-3"),
                    html.Div([
                        dcc.Graph(id='main-graph')
                    ], style={'overflow': 'auto', 'maxHeight': '75vh', 'borderRadius': '10px', 'border': '1px dashed #ccc'})
                ])
            ])
        ], width=12)
    ]),
    
    html.Div(id='canvas-saved-store', style={'display': 'none'}, children=0),
    html.Div(id='dl-dummy-output'),

    dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Update / Overwrite Canvas?")),
            dbc.ModalBody(id="overwrite-modal-body", children="Are you sure you want to update/overwrite this canvas?"),
            dbc.ModalFooter([
                dbc.Button("Cancel", id="cancel-overwrite-canvas", className="ms-auto", n_clicks=0),
                dbc.Button("Confirm", id="confirm-overwrite-canvas", color="primary", n_clicks=0),
            ]),
        ],
        id="overwrite-modal-canvas",
        is_open=False,
    ),

], className="container-fluid p-4")

@callback(
    Output('main-graph', 'style'),
    Input('dl-width', 'value'),
    Input('dl-height', 'value')
)
def update_canvas_preview_size(w_cm, h_cm):
    if not w_cm or not h_cm:
        return {'height': '65vh'}
    w_px = (w_cm / 2.54) * 96
    h_px = (h_cm / 2.54) * 96
    return {'width': f'{w_px}px', 'height': f'{h_px}px', 'margin': '0 auto'}

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
    if not project_name:
        return [], None
    projects = load_projects()
    canvases = projects.get(project_name, {}).get('canvases', {})
    return [{'label': k, 'value': k} for k in canvases.keys()], None

@callback(
    Output('plot-controls', 'children'),
    Output('canvas-name', 'value'),
    Input('project-selector', 'value')
)
def update_main_controls(project_name):
    if not project_name:
        return "Please select a project.", ""
    
    projects = load_projects()
    if project_name not in projects:
        return "Project not found.", ""
    
    config = projects[project_name]
    file_path = config['file_path']
    
    if not os.path.exists(file_path):
        return f"File not found: {file_path}. Check Home screen.", ""
    
    df = load_csv_data(
        file_path, sep=config.get('sep', ','), decimal=config.get('decimal', '.'),
        timestamp_col=config.get('timestamp_col'), timestamp_format=config.get('timestamp_format')
    )
    
    if df is None:
        return "Error loading data.", ""
    
    cols = df.columns
    
    # Default Y choices
    y = [cols[1]] if len(cols) > 1 else [cols[0]]
    y2 = []
    y3 = []

    # MAIN CHART CONTROLS
    controls = html.Div([
        dbc.Row([
            dbc.Col([
                html.Label("X-Axis", className="small fw-bold"),
                dcc.Dropdown(id='x-axis', options=[{'label': i, 'value': i} for i in cols], value=cols[0])
            ], width=3),
            dbc.Col([
                html.Label("Y-Axis (Primary)", className="small fw-bold"),
                dcc.Dropdown(id='y-axis', options=[{'label': i, 'value': i} for i in cols], value=y, multi=True)
            ], width=3),
            dbc.Col([
                html.Label("Y-Axis (Secondary)", className="small fw-bold"),
                dcc.Dropdown(id='secondary-y-axis', options=[{'label': i, 'value': i} for i in cols], value=y2, multi=True)
            ], width=3),
            dbc.Col([
                html.Label("Y-Axis (Tertiary)", className="small fw-bold"),
                dcc.Dropdown(id='tertiary-y-axis', options=[{'label': i, 'value': i} for i in cols], value=y3, multi=True)
            ], width=3),
        ], className="mb-2"),
        
        dbc.Row([
            dbc.Col([
                html.Label("Global Chart Type", className="small fw-bold"),
                dcc.Dropdown(id='chart-type', options=[
                    {'label': 'Scatter', 'value': 'scatter'}, {'label': 'Line', 'value': 'line'},
                    {'label': 'Bar', 'value': 'bar'}, {'label': 'Area', 'value': 'area'}
                ], value='line'),
            ], width=3),
            dbc.Col([
                html.Label("Legend Position", className="small fw-bold"),
                dcc.Dropdown(id='legend-pos', options=[
                    {'label': 'Right', 'value': 'right'}, {'label': 'Top', 'value': 'top'},
                    {'label': 'Bottom', 'value': 'bottom'}, {'label': 'Hidden', 'value': 'none'}
                ], value='top'),
            ], width=3),
            dbc.Col([
                html.Label("Global Font", className="small fw-bold"),
                dcc.Dropdown(id='global-font', options=[
                    {'label': 'Arial', 'value': 'Arial'}, {'label': 'Roboto', 'value': 'Roboto'},
                    {'label': 'Times New Roman', 'value': 'Times New Roman'},
                    {'label': 'Courier New', 'value': 'Courier New'}, {'label': 'Verdana', 'value': 'Verdana'},
                    {'label': 'Georgia', 'value': 'Georgia'}, {'label': 'Comic Sans MS', 'value': 'Comic Sans MS'},
                    {'label': 'Trebuchet MS', 'value': 'Trebuchet MS'}, {'label': 'Impact', 'value': 'Impact'}
                ], value='Arial', clearable=False),
            ], width=3),
            dbc.Col([
                html.Label("Options", className="small fw-bold"), html.Br(),
                dbc.Checkbox(id='connect-gaps', label="Connect Gaps", value=False)
            ], width=3)
        ]),
        
        dbc.Row([
            dbc.Col([
                html.Label("Global Font Size", className="small fw-bold"),
                dbc.Input(id='global-font-size', type='number', value=12, size="sm")
            ], width=3),
            dbc.Col([
                html.Label("Legend Font Size", className="small fw-bold"),
                dbc.Input(id='legend-font-size', type='number', value=12, size="sm")
            ], width=3),
            dbc.Col([
                html.Label("Axis Title Size", className="small fw-bold"),
                dbc.Input(id='axis-title-size', type='number', value=14, size="sm")
            ], width=3),
            dbc.Col([
                html.Label("Axis Tick Size", className="small fw-bold"),
                dbc.Input(id='axis-tick-size', type='number', value=12, size="sm")
            ], width=3),
        ], className="mb-2"),
        
        html.Hr(),
        dbc.Accordion([
            dbc.AccordionItem([
                dbc.Row([
                    dbc.Col(html.Strong("Axis", className="small"), width=1),
                    dbc.Col(html.Strong("Show", className="small"), width=1, className="text-center"),
                    dbc.Col(html.Strong("Labels", className="small"), width=4),
                    dbc.Col(html.Strong("Grid", className="small"), width=2, className="text-center"),
                    dbc.Col(html.Strong("Min", className="small"), width=2),
                    dbc.Col(html.Strong("Max", className="small"), width=2)
                ], className="mb-2 border-bottom pb-1"),
                # X-Axis Row
                dbc.Row([
                    dbc.Col(html.Label("X", className="small fw-bold pt-1"), width=1),
                    dbc.Col(dbc.Checklist(options=[{"label": "", "value": "1"}], value=["1"], id="show-x-label", switch=True), width=1, className="d-flex justify-content-center"),
                    dbc.Col(dbc.Input(id='x-axis-label', placeholder="Custom X Label", size="sm"), width=4),
                    dbc.Col(dbc.Checklist(options=[{"label": "", "value": "x"}], value=["x"], id="grid-x-switch", switch=True), width=2, className="d-flex justify-content-center"),
                    dbc.Col(dbc.Input(id='x-axis-min', placeholder="Auto", size="sm", type="number"), width=2),
                    dbc.Col(dbc.Input(id='x-axis-max', placeholder="Auto", size="sm", type="number"), width=2),
                ], className="mb-2 align-items-center"),
                # Y1-Axis Row
                dbc.Row([
                    dbc.Col(html.Label("Y1", className="small fw-bold pt-1", title="Primary Y Axis"), width=1),
                    dbc.Col(dbc.Checklist(options=[{"label": "", "value": "1"}], value=["1"], id="show-y-label", switch=True), width=1, className="d-flex justify-content-center"),
                    dbc.Col(dbc.Input(id='y-axis-label', placeholder="Custom Y1 Label", size="sm"), width=4),
                    dbc.Col(dbc.Checklist(options=[{"label": "", "value": "y"}], value=["y"], id="grid-y-switch", switch=True), width=2, className="d-flex justify-content-center"),
                    dbc.Col(dbc.Input(id='y-axis-min', placeholder="Auto", size="sm", type="number"), width=2),
                    dbc.Col(dbc.Input(id='y-axis-max', placeholder="Auto", size="sm", type="number"), width=2),
                ], className="mb-2 align-items-center"),
                # Y2-Axis Row
                dbc.Row([
                    dbc.Col(html.Label("Y2", className="small fw-bold pt-1", title="Secondary Y Axis"), width=1),
                    dbc.Col(dbc.Checklist(options=[{"label": "", "value": "1"}], value=["1"], id="show-y2-label", switch=True), width=1, className="d-flex justify-content-center"),
                    dbc.Col(dbc.Input(id='y2-axis-label', placeholder="Custom Y2 Label", size="sm"), width=4),
                    dbc.Col(dbc.Checklist(options=[{"label": "", "value": "y2"}], value=[], id="grid-y2-switch", switch=True), width=2, className="d-flex justify-content-center"),
                    dbc.Col(dbc.Input(id='y2-axis-min', placeholder="Auto", size="sm", type="number"), width=2),
                    dbc.Col(dbc.Input(id='y2-axis-max', placeholder="Auto", size="sm", type="number"), width=2),
                ], className="mb-2 align-items-center"),
                # Y3-Axis Row
                dbc.Row([
                    dbc.Col(html.Label("Y3", className="small fw-bold pt-1", title="Tertiary Y Axis"), width=1),
                    dbc.Col(dbc.Checklist(options=[{"label": "", "value": "1"}], value=["1"], id="show-y3-label", switch=True), width=1, className="d-flex justify-content-center"),
                    dbc.Col(dbc.Input(id='y3-axis-label', placeholder="Custom Y3 Label", size="sm"), width=4),
                    dbc.Col(dbc.Checklist(options=[{"label": "", "value": "y3"}], value=[], id="grid-y3-switch", switch=True), width=2, className="d-flex justify-content-center"),
                    dbc.Col(dbc.Input(id='y3-axis-min', placeholder="Auto", size="sm", type="number"), width=2),
                    dbc.Col(dbc.Input(id='y3-axis-max', placeholder="Auto", size="sm", type="number"), width=2),
                ], className="mb-2 align-items-center"),
                # Hidden old grid-switches for backward compatibility if needed, or we just remove it and merge them in callbacks
                html.Div(id='grid-switches', style={'display': 'none'})
            ], title="Axes Configuration"),
            
            dbc.AccordionItem([
                dbc.Row([
                    dbc.Col([
                        html.Label("Timeframe Preset", className="small fw-bold"),
                        dcc.Dropdown(id='timeframe-dropdown', options=[
                            {'label': 'All Time', 'value': 'all_time'},
                            {'label': 'Daily', 'value': 'daily'},
                            {'label': 'Weekly', 'value': 'weekly'}, 
                            {'label': 'Monthly', 'value': 'monthly'},
                            {'label': 'Yearly', 'value': 'yearly'},
                            {'label': 'Custom Range', 'value': 'custom'}
                        ], value='all_time')
                    ], width=6),
                    dbc.Col([
                        html.Div(id='reference-date-div', children=[
                            html.Label("Reference Date", className="small fw-bold"), html.Br(),
                            dcc.DatePickerSingle(id='reference-date-picker', display_format='YYYY-MM-DD', first_day_of_week=1)
                        ])
                    ], width=6)
                ]),
                html.Div(id='date-picker-div', children=[
                    html.Label("Custom Range", className="small fw-bold mt-2"), html.Br(),
                    dcc.DatePickerRange(id='date-picker-range', display_format='YYYY-MM-DD', first_day_of_week=1)
                ], style={'display': 'none'})
            ], title="Timeframe")
        ], start_collapsed=True)
    ])
    
    return controls, ""

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
def update_trace_controls(y, y2, y3, project_name, canvas_name, t_ids, t_names, t_cols, t_types, t_styles, t_thick, t_opac, t_order):
    if not project_name: return "Please select a project."
    projects = load_projects()
    if project_name not in projects: return "Project not found."
    
    config = projects[project_name]
    file_path = config['file_path']
    if not os.path.exists(file_path): return ""
    
    df = load_csv_data(
        file_path, sep=config.get('sep', ','), decimal=config.get('decimal', '.'),
        timestamp_col=config.get('timestamp_col'), timestamp_format=config.get('timestamp_format')
    )
    if df is None: return "Error loading data."
    
    cols = df.columns

    # TRACE CONTROLS GENERATION (Filtered by selected Y axes)
    selected_traces = []
    if y:
        selected_traces.extend(y if isinstance(y, list) else [y])
    if y2:
        selected_traces.extend(y2 if isinstance(y2, list) else [y2])
    if y3:
        selected_traces.extend(y3 if isinstance(y3, list) else [y3])
    
    # Remove duplicates while preserving order
    selected_traces = list(dict.fromkeys(selected_traces))
    # Filter only valid columns
    selected_traces = [col for col in selected_traces if col in cols]

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
            
    saved_state = {}
    if canvas_name and canvas_name in config.get('canvases', {}):
        saved_state = config['canvases'][canvas_name].get('tc', {})

    trace_rows = []
    for i, col in enumerate(selected_traces):
        val_name = dom_state.get(col, {}).get('name') or saved_state.get(col, {}).get('name') or col
        val_color = dom_state.get(col, {}).get('color') or saved_state.get(col, {}).get('color')
        val_type = dom_state.get(col, {}).get('type') or saved_state.get(col, {}).get('type') or 'global'
        val_style = dom_state.get(col, {}).get('style') or saved_state.get(col, {}).get('style') or 'solid'
        
        val_width = dom_state.get(col, {}).get('width')
        if val_width is None: val_width = saved_state.get(col, {}).get('width', 2)
            
        val_opac = dom_state.get(col, {}).get('opacity')
        if val_opac is None: val_opac = saved_state.get(col, {}).get('opacity', 1.0)
            
        val_order = dom_state.get(col, {}).get('order') or saved_state.get(col, {}).get('order') or (i + 1)

        row = html.Div([
            dbc.Row(dbc.Col(html.Strong(col, style={'fontSize': '0.9rem', 'wordBreak': 'break-all'})), className="mb-1"),
            dbc.Row([
                dbc.Col(html.Label("Name", style={'fontSize': '0.75rem'}), width=1, className="pe-0"),
                dbc.Col(dbc.Input(type="text", id={'type': 'trace-name', 'index': col}, value=val_name, size="sm"), width=3),
                dbc.Col(html.Label("Color", style={'fontSize': '0.75rem'}), width=1, className="pe-0"),
                dbc.Col(dbc.Input(type="color", id={'type': 'trace-color', 'index': col}, value=val_color, size="sm", style={'height': '30px', 'padding': '0px'}), width=1),
                dbc.Col(html.Label("Type", style={'fontSize': '0.75rem'}), width=1, className="pe-0"),
                dbc.Col(dcc.Dropdown(
                    id={'type': 'trace-chart-type', 'index': col},
                    options=[{'label': 'Global', 'value': 'global'}, {'label': 'Line', 'value': 'line'},
                             {'label': 'Bar', 'value': 'bar'}, {'label': 'Scatter', 'value': 'scatter'}, {'label': 'Area', 'value': 'area'}],
                    value=val_type, clearable=False, className="small"
                ), width=2),
                dbc.Col(html.Label("Style", style={'fontSize': '0.75rem'}), width=1, className="pe-0"),
                dbc.Col(dcc.Dropdown(
                    id={'type': 'trace-line-style', 'index': col},
                    options=[{'label': 'Solid', 'value': 'solid'}, {'label': 'Dash', 'value': 'dash'},
                             {'label': 'Dot', 'value': 'dot'}, {'label': 'Dash-Dot', 'value': 'dashdot'}],
                    value=val_style, clearable=False, className="small"
                ), width=2),
            ], className="mb-2 align-items-center"),
            dbc.Row([
                dbc.Col(html.Label("Width", style={'fontSize': '0.75rem'}), width=1, className="pe-0"),
                dbc.Col(dbc.Input(type="number", id={'type': 'trace-thickness', 'index': col}, value=val_width, min=0, step=1, size="sm"), width=2),
                dbc.Col(html.Label("Opacity", style={'fontSize': '0.75rem'}), width=1, className="pe-0"),
                dbc.Col(dbc.Input(type="number", id={'type': 'trace-opacity', 'index': col}, value=val_opac, min=0.0, max=1.0, step=0.1, size="sm"), width=2),
                dbc.Col(html.Label("Order", style={'fontSize': '0.75rem'}), width=1, className="pe-0"),
                dbc.Col(dbc.Input(type="number", id={'type': 'trace-order', 'index': col}, value=val_order, step=1, size="sm"), width=2),
            ], className="mb-2 align-items-center")
        ], style={'borderBottom': '1px solid #eee', 'paddingBottom': '5px', 'marginBottom': '5px'} if i < len(selected_traces)-1 else {})
        trace_rows.append(row)

    if not trace_rows:
        trace_rows = html.Div("Please select at least one Y axis data to format traces.", className="text-muted small")

    return trace_rows

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
    df = load_csv_data(file_path, sep=config.get('sep', ','), decimal=config.get('decimal', '.'), timestamp_col=ts_col, timestamp_format=config.get('timestamp_format'))
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
    if n_clicks and canvas_name: return True
    return False

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
        if not target or not proj: return "Need Name & Project", store_data, dash.no_update, dash.no_update
        
        # Check for overwrite/update confirmation requirement
        if trig == 'save-canvas-btn' and target in projects.get(proj, {}).get('canvases', {}):
            return "", store_data, True, f"A canvas named '{target}' already exists. Do you want to overwrite it?"
        if trig == 'update-canvas-btn':
            return "", store_data, True, f"Are you sure you want to update the canvas '{target}'?"
        
        # If no conflict for Save New, just proceed directly
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
            return "Saved!", store_data + 1, dash.no_update, dash.no_update
            
    if trig == 'confirm-overwrite-canvas':
        # Determine target from the modal's current text
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
            return "Saved!", store_data + 1, False, dash.no_update
            
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
            c.get('ctype', c.get('type', 'line')), c.get('leg', c.get('legend', 'top')), c.get('font', 'Arial'),
            c.get('fs_glob', 12), c.get('fs_leg', 12), c.get('fs_tit', 14), c.get('fs_tick', 12),
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
def render_graph(x, y, y2, y3, ctype, leg, font, fs_glob, fs_leg, fs_tit, fs_tick, xl, yl, y2l, y3l, xmin, xmax, ymin, ymax, y2min, y2max, y3min, y3max, gx, gy, gy2, gy3,
                 sx, sy, sy2, sy3, gaps, sd, ed,
                t_names, t_cols, t_types, t_styles, t_thick, t_opac, t_order, t_ids, proj):
    if not all([x, proj, ctype]): return go.Figure()
    if y is None: y = []
    if y2 is None: y2 = []
    if y3 is None: y3 = []
    if gx is None: gx = []
    if gy is None: gy = []
    if gy2 is None: gy2 = []
    if gy3 is None: gy3 = []
    
    config = load_projects()[proj]
    df = load_csv_data(config['file_path'], sep=config.get('sep', ','), decimal=config.get('decimal', '.'), timestamp_col=config.get('timestamp_col'), timestamp_format=config.get('timestamp_format'))
    if df is None: return go.Figure()
    
    ts_col = config.get('timestamp_col')
    is_time_x = False
    if ts_col and ts_col in df.columns and df[ts_col].dtype in [pl.Datetime, pl.Date]:
        if sd: df = df.filter(pl.col(ts_col) >= datetime.datetime.strptime(sd.split('T')[0], '%Y-%m-%d'))
        if ed: df = df.filter(pl.col(ts_col) < datetime.datetime.strptime(ed.split('T')[0], '%Y-%m-%d') + datetime.timedelta(days=1))
        if x == ts_col: is_time_x = True

    has_sec = len(y2) > 0
    has_tert = len(y3) > 0
    fig = go.Figure()
    if has_sec or has_tert:
        fig = make_subplots(specs=[[{"secondary_y": True}]])
    if has_tert:
        fig.update_layout(
            xaxis=dict(domain=[0, 0.92]),
            yaxis3=dict(overlaying='y', side='right', anchor='free', position=1.0, showgrid=bool(gy3))
        )

    tc = {}
    if t_ids:
        for i, tid in enumerate(t_ids):
            tc[tid['index']] = {'name': t_names[i], 'color': t_cols[i], 'type': t_types[i], 'style': t_styles[i] if t_styles and i < len(t_styles) else 'solid', 'width': t_thick[i], 'opacity': t_opac[i], 'order': t_order[i]}

    def add(col, ax):
        c = tc.get(col, {})
        ctype_actual = ctype if c.get('type', 'global') == 'global' else c.get('type')
        name = c.get('name') or col
        color = c.get('color')
        width = c.get('width', 2)
        style = c.get('style', 'solid')
        opac = c.get('opacity', 1.0)
        
        md = dict(color=color, opacity=opac) if color else dict(opacity=opac)
        ld = dict(color=color, width=width) if color else dict(width=width)
        if style != 'solid': ld['dash'] = style
        
        x_data = df[x].to_list()
        y_series = df[col]
        if y_series.dtype in [pl.Utf8, pl.String, pl.Object]:
            try:
                y_series = y_series.str.replace(",", ".").cast(pl.Float64, strict=False)
            except Exception:
                pass
        y_data = y_series.to_list()
        
        if ctype_actual == 'scatter':
            t = go.Scatter(x=x_data, y=y_data, mode='markers', name=name, marker=md)
        elif ctype_actual == 'bar':
            t = go.Bar(x=x_data, y=y_data, name=name, marker=md)
        elif ctype_actual == 'area':
            ld['width'] = 0
            t = go.Scatter(x=x_data, y=y_data, mode='lines', name=name, line=ld, fill='tozeroy', connectgaps=gaps, opacity=opac)
        else:
            t = go.Scatter(x=x_data, y=y_data, mode='lines', name=name, line=ld, connectgaps=gaps, opacity=opac)
        
        return t
            
    if isinstance(y, str): y = [y]
    if isinstance(y2, str): y2 = [y2]
    if isinstance(y3, str): y3 = [y3]
    
    traces_to_add = []
    for col in y:
        traces_to_add.append({'trace': add(col, 'y'), 'order': tc.get(col, {}).get('order', 1), 'ax': 'y'})
    for col in y2:
        traces_to_add.append({'trace': add(col, 'y2'), 'order': tc.get(col, {}).get('order', 1), 'ax': 'y2'})
    for col in y3:
        traces_to_add.append({'trace': add(col, 'y3'), 'order': tc.get(col, {}).get('order', 1), 'ax': 'y3'})
        
    traces_to_add.sort(key=lambda item: (item['order'] if item['order'] is not None else 0))
    
    for item in traces_to_add:
        if item['ax'] == 'y3':
            item['trace'].update(yaxis='y3')
            fig.add_trace(item['trace'])
        else:
            if has_sec or has_tert:
                fig.add_trace(item['trace'], secondary_y=(item['ax'] == 'y2'))
            else:
                fig.add_trace(item['trace'])

    ldict = {}
    if leg == 'none': ldict = dict(showlegend=False)
    elif leg == 'top': ldict = dict(legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="center", x=0.5))
    elif leg == 'bottom': ldict = dict(legend=dict(orientation="h", yanchor="top", y=-0.2, xanchor="center", x=0.5))

    fig.update_layout(
        margin=dict(l=20, r=(100 if has_tert else (60 if has_sec else 20)), t=40, b=20),
        template='plotly_white', font=dict(family=font, size=fs_glob),
        xaxis_title=(xl if xl else x) if bool(sx) else None, 
        yaxis_title=(yl if yl else (y[0] if len(y)==1 else "Values")) if bool(sy) else None,
        **ldict
    )
    if y2l and bool(sy2): fig.update_yaxes(title_text=y2l, secondary_y=True)
    if y3l and bool(sy3): 
        fig.update_layout(yaxis3=dict(title=y3l, side='right', overlaying='y', anchor='free', position=1.0, automargin=True))
    
    if leg != 'none' and fs_leg: fig.update_layout(legend=dict(font=dict(size=fs_leg)))
    fig.update_xaxes(title_font=dict(size=fs_tit), tickfont=dict(size=fs_tick), automargin=True)
    fig.update_yaxes(title_font=dict(size=fs_tit), tickfont=dict(size=fs_tick), automargin=True)
    
    fig.update_xaxes(showgrid=bool(gx), range=[xmin, xmax] if xmin is not None and xmax is not None else None, automargin=True)
    if is_time_x:
        fig.update_xaxes(tickformat="%d/%m/%Y", automargin=True)
        
    # Only pass secondary_y if the figure was created with make_subplots
    yaxes_params = dict(showgrid=bool(gy), range=[ymin, ymax] if ymin is not None and ymax is not None else None, automargin=True)
    if has_sec or has_tert:
        yaxes_params['secondary_y'] = False
    fig.update_yaxes(**yaxes_params)

    if has_sec or has_tert:
        fig.update_yaxes(showgrid=bool(gy2), range=[y2min, y2max] if y2min is not None and y2max is not None else None, secondary_y=True, automargin=True)
    
    if has_tert:
        fig.update_layout(yaxis3=dict(range=[y3min, y3max] if y3min is not None and y3max is not None else None, automargin=True))
        
    return fig

dash.clientside_callback(
    """
    function(n_clicks, format, width_cm, height_cm, dpi) {
        if (n_clicks) {
            const width_px = (width_cm / 2.54) * 96;
            const height_px = (height_cm / 2.54) * 96;
            const scale = dpi / 96;
            const gd = document.getElementById('main-graph').querySelector('.js-plotly-plot') || document.getElementById('main-graph');
            Plotly.downloadImage(gd, {
                format: format,
                width: width_px,
                height: height_px,
                scale: scale,
                filename: 'chartmate_export'
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
    prevent_initial_call=True
)
