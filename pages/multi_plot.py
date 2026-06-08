import dash
from dash import dcc, html, Input, Output, State, ALL, MATCH, callback
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import polars as pl
import os
import datetime
import json
from utils.storage import load_projects, delete_multiplot, save_multiplot
from utils.data_handler import load_csv_data

dash.register_page(__name__, path='/multi-plot', name='Multi Plot')

layout = html.Div([
    dbc.Row([
        dbc.Col([
            dbc.Card([
                dbc.CardHeader("Project & Subplot Config"),
                dbc.CardBody([
                    html.Label("Project", className="small fw-bold"),
                    dcc.Dropdown(id='mp-project-selector', placeholder="Select Project", className="mb-2"),
                    html.Label("Recall MultiPlot", className="small fw-bold"),
                    dbc.Row([
                        dbc.Col(dcc.Dropdown(id='mp-saved-selector', placeholder="Select Layout"), width=8, className="pe-1"),
                        dbc.Col(dbc.Button("Delete", id='mp-delete-btn', color="danger", size="sm", className="w-100"), width=4, className="ps-0")
                    ], className="mb-2"),
                    html.Hr(),
                    html.Label("Save Configuration", className="small fw-bold"),
                    dbc.Input(id='mp-name', placeholder="Layout Name...", size="sm", className="mb-2"),
                    dbc.Row([
                        dbc.Col(dbc.Button("Save", id='mp-save-btn', color="success", size="sm", className="w-100"), width=6, className="pe-1"),
                        dbc.Col(dbc.Button("Update", id='mp-update-btn', color="primary", size="sm", className="w-100"), width=6, className="ps-1")
                    ]),
                    html.Div(id='mp-save-status', className="text-muted small mt-2 text-center")
                ])
            ], className="mb-3")
        ], width=3),
        
        dbc.Col([
            dbc.Card([
                dbc.CardHeader("Layout & Variables Properties"),
                dbc.CardBody([
                    dbc.Row([
                        dbc.Col([
                            html.Label("Layout Mode", className="small fw-bold mb-0"),
                            dbc.RadioItems(
                                id='mp-mode',
                                options=[
                                    {'label': 'Variante A (Matrice Custom Individuale)', 'value': 'A'},
                                    {'label': 'Variante B (Pairplot Combinatorio)', 'value': 'B'}
                                ],
                                value='A',
                                inline=True,
                                className="small mb-2"
                            )
                        ], width=12),
                    ]),
                    # Common settings
                    dbc.Row([
                        dbc.Col([
                            html.Label("Global Styling", className="small fw-bold mb-0"),
                            dcc.Dropdown(
                                id='mp-ctype',
                                options=[{'label': 'Line', 'value': 'line'}, {'label': 'Scatter', 'value': 'scatter'}, {'label': 'Area', 'value': 'area'}, {'label': 'Bar', 'value': 'bar'}],
                                value='line', className="small"
                            )
                        ], width=4),
                        dbc.Col([
                            html.Label("Axis Linkage", className="small fw-bold mb-0"),
                            dbc.Checklist(
                                options=[
                                    {"label": "Share X", "value": "x"},
                                    {"label": "Share Y", "value": "y"},
                                ],
                                value=[],
                                id="mp-shared-axes",
                                inline=True,
                                switch=True,
                                className="small mt-1"
                            ),
                        ], width=4),
                        dbc.Col([
                            html.Div([
                                html.Label("Rows", className="small fw-bold mb-0"),
                                dbc.Input(id='mp-rows', type='number', value=2, min=1, step=1, size="sm")
                            ], id="mp-rows-container")
                        ], width=2),
                        dbc.Col([
                            html.Div([
                                html.Label("Cols", className="small fw-bold mb-0"),
                                dbc.Input(id='mp-cols', type='number', value=2, min=1, step=1, size="sm")
                            ], id="mp-cols-container")
                        ], width=2)
                    ], className="mb-3 align-items-center"),
                    html.Hr(),
                    
                    # Store to decouple save/load cycles
                    dcc.Store(id='mp-current-config', data={}),
                    
                    # Wrapper for Mode A (Manual Cell Allocation)
                    html.Div(id='mp-variant-a-ui', children=[
                        dbc.Row([
                            dbc.Col([
                                html.Label("Global Dashboard", className="small fw-bold mb-1 text-muted"),
                                html.Div([
                                    dbc.Button("Sync X-Axis", id='mp-sync-x', color="info", size="sm", className="me-2"),
                                    dbc.Checklist(
                                        id='mp-uniform-y',
                                        options=[{"label": "Uniform Y-Scale", "value": "uniform"}],
                                        value=[],
                                        switch=True,
                                        inline=True,
                                        className="small me-3"
                                    ),
                                    html.Div([
                                        html.Label("Palette", className="small me-2 mb-0"),
                                        dcc.Dropdown(
                                            id='mp-palette',
                                            options=[
                                                {'label':'Default','value':'plotly'},
                                                {'label':'Viridis','value':'viridis'},
                                                {'label':'Muted','value':'muted'}
                                            ],
                                            value='plotly',
                                            className="small",
                                            style={'width': '120px'}
                                        )
                                    ], className="d-inline-flex align-items-center")
                                ], className="border rounded p-2 bg-light mb-3 d-flex align-items-center")
                            ], width=12)
                        ]),
                        dbc.Row([
                            dbc.Col([
                                html.Label("Visual Navigator", className="small fw-bold mb-1 text-muted"),
                                html.Div(id='mp-visual-navigator', className="border rounded p-2 bg-light mb-2 d-flex flex-column align-items-center", style={'minHeight': '100px', 'maxHeight': '400px', 'overflowY': 'auto'})
                            ], width=3),
                            dbc.Col([
                                dbc.Row([
                                    dbc.Col(dbc.Button("Apply X to All", id='mp-apply-x-all', size="sm", color="info", outline=True, className="w-100"), width=6, className="pe-1"),
                                    dbc.Col(dbc.Button("Clear All", id='mp-clear-all', size="sm", color="secondary", outline=True, className="w-100"), width=6, className="ps-1"),
                                ], className="mb-2"),
                                html.Div(id='mp-config-table-container', style={'maxHeight': '400px', 'overflowY': 'auto'}, className="border rounded")
                            ], width=9)
                        ])
                    ]),

                    # Wrapper for Mode B (Pairplot)
                    html.Div(id='mp-variant-b-ui', children=[
                        dbc.Row([
                            dbc.Col([
                                html.Label("Group X Data (Pairplot)", className="small fw-bold mb-0"),
                                dcc.Dropdown(id='mp-pair-x', multi=True, placeholder="Seleziona colonne X...", className="small")
                            ], width=6),
                            dbc.Col([
                                html.Label("Group Y Data (Pairplot)", className="small fw-bold mb-0"),
                                dcc.Dropdown(id='mp-pair-y', multi=True, placeholder="Seleziona colonne Y...", className="small")
                            ], width=6)
                        ])
                    ], style={'display':'none'})
                ])
            ])
        ], width=9)
    ], className="mb-3"),

    
    dbc.Row([
        dbc.Col([
            dbc.Card([
                dbc.CardBody([
                    dbc.Row([
                        dbc.Col(html.Label("Format", className="small fw-bold"), width="auto"),
                        dbc.Col(dbc.Select(id='mp-dl-format', options=[{'label':'PNG','value':'png'}, {'label':'SVG','value':'svg'}, {'label':'JPEG','value':'jpeg'}], value='png', size="sm"), width="auto"),
                        dbc.Col(html.Label("Width (cm)", className="small fw-bold"), width="auto"),
                        dbc.Col(dbc.Input(id='mp-dl-width', type='number', value=30, size="sm", style={'width': '80px'}), width="auto"),
                        dbc.Col(html.Label("Height (cm)", className="small fw-bold"), width="auto"),
                        dbc.Col(dbc.Input(id='mp-dl-height', type='number', value=20, size="sm", style={'width': '80px'}), width="auto"),
                        dbc.Col(html.Label("DPI", className="small fw-bold"), width="auto"),
                        dbc.Col(dbc.Select(id='mp-dl-dpi', options=[{'label':'96','value':96}, {'label':'150','value':150}, {'label':'300','value':300}, {'label':'600','value':600}], value=300, size="sm", style={'width': '80px'}), width="auto"),
                        dbc.Col(dbc.Button("Download High-Res Vector", id='mp-dl-btn', color="success", size="sm", className="ms-auto"), width="auto")
                    ], className="align-items-center mb-3 justify-content-end"),
                    html.Div([
                        dcc.Graph(id='mp-graph')
                    ], style={'overflow': 'auto', 'maxHeight': '80vh', 'borderRadius': '10px', 'border': '1px dashed #ccc'})
                ])
            ])
        ], width=12)
    ]),
    
    html.Div(id='mp-store', style={'display': 'none'}, children=0),
    dcc.ConfirmDialog(id='mp-delete-dialog', message='Are you sure you want to delete this multiplot?'),
    dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Update / Overwrite MultiPlot?")),
            dbc.ModalBody(id="mp-overwrite-body", children="Are you sure you want to overwrite?"),
            dbc.ModalFooter([
                dbc.Button("Cancel", id="mp-overwrite-cancel", className="ms-auto", n_clicks=0),
                dbc.Button("Confirm", id="mp-overwrite-confirm", color="primary", n_clicks=0),
            ]),
        ],
        id="mp-overwrite-modal",
        is_open=False,
    )
], className="container-fluid p-4")

@callback(
    Output('mp-graph', 'style'),
    Input('mp-dl-width', 'value'),
    Input('mp-dl-height', 'value')
)
def update_mp_preview_size(w_cm, h_cm):
    if not w_cm or not h_cm:
        return {'height': '75vh'}
    w_px = (w_cm / 2.54) * 96
    h_px = (h_cm / 2.54) * 96
    return {'width': f'{w_px}px', 'height': f'{h_px}px', 'margin': '0 auto'}

dash.clientside_callback(
    """
    function(n_clicks, format, width_cm, height_cm, dpi) {
        if (n_clicks) {
            const width_px = (width_cm / 2.54) * 96;
            const height_px = (height_cm / 2.54) * 96;
            const scale = dpi / 96;
            const gd = document.getElementById('mp-graph').querySelector('.js-plotly-plot') || document.getElementById('mp-graph');
            Plotly.downloadImage(gd, {
                format: format,
                width: width_px,
                height: height_px,
                scale: scale,
                filename: 'chartmate_multiplot'
            });
        }
        return window.dash_clientside.no_update;
    }
    """,
    Output('mp-dl-btn', 'id'),
    Input('mp-dl-btn', 'n_clicks'),
    State('mp-dl-format', 'value'),
    State('mp-dl-width', 'value'),
    State('mp-dl-height', 'value'),
    State('mp-dl-dpi', 'value'),
    prevent_initial_call=True
)

@callback(
    Output('mp-project-selector', 'options'),
    Input('mp-project-selector', 'id')
)
def mp_load_projects(_):
    projects = load_projects()
    return [{'label': k, 'value': k} for k in projects.keys()] if projects else []

@callback(
    Output('mp-saved-selector', 'options'),
    Input('mp-project-selector', 'value'),
    Input('mp-store', 'data')
)
def mp_update_saved_dropdown(project_name, store_val):
    if not project_name: return []
    canvases = load_projects().get(project_name, {}).get('multiplots', {})
    return [{'label': k, 'value': k} for k in canvases.keys()]

@callback(
    Output('mp-delete-dialog', 'displayed'),
    Input('mp-delete-btn', 'n_clicks'),
    State('mp-saved-selector', 'value'),
    prevent_initial_call=True
)
def mp_display_del(n, val):
    return True if n and val else False

@callback(
    Output('mp-current-config', 'data'),
    Output('mp-mode', 'value'),
    Output('mp-rows', 'value'),
    Output('mp-cols', 'value'),
    Output('mp-shared-axes', 'value'),
    Output('mp-ctype', 'value'),
    Output('mp-uniform-y', 'value'),
    Output('mp-palette', 'value'),
    Input('mp-saved-selector', 'value'),
    State('mp-project-selector', 'value'),
    prevent_initial_call=True
)
def load_config_from_saved(name, proj):
    if not name or not proj: 
        return dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update
    c = load_projects().get(proj, {}).get('multiplots', {}).get(name)
    if not c: 
        return dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update
    return (
        c, 
        c.get('mode', 'A'), 
        c.get('rows', 2), 
        c.get('cols', 2), 
        c.get('shared', []), 
        c.get('ctype', 'line'),
        c.get('uniform_y', []),
        c.get('palette', 'plotly')
    )

@callback(
    Output('mp-variant-a-ui', 'style'),
    Output('mp-variant-b-ui', 'style'),
    Output('mp-rows-container', 'style'),
    Output('mp-cols-container', 'style'),
    Input('mp-mode', 'value')
)
def toggle_mode_uis(mode):
    if mode == 'B':
        return {'display': 'none'}, {'display': 'block'}, {'display': 'none'}, {'display': 'none'}
    return {'display': 'block'}, {'display': 'none'}, {'display': 'block'}, {'display': 'block'}

@callback(
    Output('mp-visual-navigator', 'children'),
    Output('mp-config-table-container', 'children'),
    Output('mp-pair-x', 'options'),
    Output('mp-pair-y', 'options'),
    Output('mp-pair-x', 'value'),
    Output('mp-pair-y', 'value'),
    Input('mp-mode', 'value'),
    Input('mp-rows', 'value'),
    Input('mp-cols', 'value'),
    Input('mp-project-selector', 'value'),
    Input('mp-current-config', 'data')
)
def build_dynamic_inputs(mode, rows, cols, proj, cfg):
    col_opts = []
    ts_col = None
    if proj:
        p_cfg = load_projects().get(proj)
        if p_cfg and os.path.exists(p_cfg['file_path']):
            ts_col = p_cfg.get('timestamp_col')
            df_cols = []
            try:
                # Optimized: just get headers
                with open(p_cfg['file_path'], 'r') as f:
                    header = f.readline().strip()
                    df_cols = header.split(p_cfg.get('sep', ','))
            except: pass
            col_opts = [{'label': c, 'value': c} for c in df_cols]

    cfg = cfg or {}
    px = cfg.get('pair_x', [])
    py = cfg.get('pair_y', [])

    if mode == 'B':
        return [], [], col_opts, col_opts, px, py

    # Mode A: Build Cells
    try: r, c = int(rows), int(cols)
    except: r, c = 2, 2
    
    c_x = cfg.get('cell_x', {})
    c_y = cfg.get('cell_y', {})
    c_settings = cfg.get('cell_settings', {})
    
    table_header = [
        html.Thead(html.Tr([
            html.Th("Cell", className="small text-center", style={"width": "10%"}),
            html.Th("X-Axis", className="small", style={"width": "30%"}),
            html.Th("Y-Axes", className="small", style={"width": "50%"}),
            html.Th("", style={"width": "10%"})
        ]), className="table-light")
    ]
    
    table_rows = []
    nav_grid = []
    nav_tooltips = []
    
    for i in range(r):
        nav_row = []
        for j in range(c):
            idx = i * c + j
            idx_str = str(idx)
            
            assigned_y = c_y.get(idx_str, [])
            box_class = "border d-flex align-items-center justify-content-center m-1 shadow-sm bg-white text-muted"
            if assigned_y:
                box_class = "border d-flex align-items-center justify-content-center m-1 shadow-sm bg-success text-white"
                nav_tooltips.append(dbc.Tooltip(
                    ", ".join(assigned_y),
                    target={'type': 'mp-nav-box', 'index': idx},
                    placement="top"
                ))
            
            nav_box = html.Div(
                f"{i+1},{j+1}",
                id={'type': 'mp-nav-box', 'index': idx},
                className=box_class,
                style={'width': '35px', 'height': '35px', 'fontSize': '12px', 'cursor': 'pointer', 'borderRadius': '4px'}
            )
            nav_row.append(nav_box)
            
            idx_settings = c_settings.get(idx_str, {})
            row = html.Tr([
                html.Td(f"[{i+1}, {j+1}]", className="small align-middle text-center fw-bold text-muted"),
                html.Td(dcc.Dropdown(
                    id={'type': 'mp-cell-x', 'index': idx},
                    options=col_opts,
                    value=c_x.get(idx_str, ts_col),
                    className="small",
                    clearable=True
                )),
                html.Td(dcc.Dropdown(
                    id={'type': 'mp-cell-y', 'index': idx},
                    options=col_opts,
                    value=c_y.get(idx_str, []),
                    multi=True,
                    className="small"
                )),
                html.Td([
                    dbc.Button(html.I(className="bi bi-gear"), id={'type': 'mp-gear-btn', 'index': idx}, color="link", size="sm", className="text-muted p-0"),
                    dbc.Popover([
                        dbc.PopoverHeader("Cell Settings"),
                        dbc.PopoverBody([
                            html.Label("Subplot Title", className="small fw-bold"),
                            dbc.Input(id={'type': 'mp-cell-title', 'index': idx}, placeholder="Custom Title...", size="sm", className="mb-2", value=idx_settings.get('title')),
                            html.Label("Subplot Type", className="small fw-bold"),
                            dcc.Dropdown(
                                id={'type': 'mp-cell-ctype', 'index': idx},
                                options=[
                                    {'label':'Global','value':'global'},
                                    {'label':'Line','value':'line'},
                                    {'label':'Scatter','value':'scatter'},
                                    {'label':'Area','value':'area'},
                                    {'label':'Bar','value':'bar'}
                                ],
                                value=idx_settings.get('ctype', 'global'),
                                className="small mb-2"
                            ),
                            dbc.Switch(
                                id={'type': 'mp-cell-leg', 'index': idx},
                                label="Show Legend",
                                value=idx_settings.get('leg', True),
                                className="small"
                            )
                        ])
                    ], target={'type': 'mp-gear-btn', 'index': idx}, trigger="click", id={'type': 'mp-popover', 'index': idx})
                ], className="text-center align-middle")
            ], id={'type': 'mp-table-row', 'index': idx})
            table_rows.append(row)
            
        nav_grid.append(html.Div(nav_row, className="d-flex justify-content-center"))
    
    table_body = [html.Tbody(table_rows)]
    config_table = dbc.Table(table_header + table_body, bordered=True, hover=True, responsive=True, size="sm", className="mb-0 bg-white")
    
    return html.Div(nav_grid + nav_tooltips, className="w-100"), config_table, col_opts, col_opts, dash.no_update, dash.no_update

@callback(
    Output({'type': 'mp-cell-x', 'index': ALL}, 'value'),
    Output({'type': 'mp-cell-y', 'index': ALL}, 'value'),
    Input('mp-apply-x-all', 'n_clicks'),
    Input('mp-sync-x', 'n_clicks'),
    Input('mp-clear-all', 'n_clicks'),
    State({'type': 'mp-cell-x', 'index': ALL}, 'value'),
    State({'type': 'mp-cell-y', 'index': ALL}, 'value'),
    prevent_initial_call=True
)
def mp_bulk_actions(n_apply, n_sync, n_clear, cx_vals, cy_vals):
    ctx = dash.callback_context
    if not ctx.triggered: return dash.no_update, dash.no_update
    trig = ctx.triggered[0]['prop_id'].split('.')[0]
    
    if trig in ['mp-apply-x-all', 'mp-sync-x']:
        if not cx_vals: return dash.no_update, dash.no_update
        first_x = cx_vals[0]
        return [first_x] * len(cx_vals), cy_vals
    
    if trig == 'mp-clear-all':
        return [None] * len(cx_vals), [[]] * len(cy_vals)
    
    return dash.no_update, dash.no_update

dash.clientside_callback(
    """
    function(n_clicks, id) {
        if (n_clicks) {
            const rowId = JSON.stringify({index: id.index, type: "mp-table-row"});
            const el = document.getElementById(rowId);
            if (el) {
                el.scrollIntoView({behavior: "smooth", block: "center"});
                const origBg = el.style.backgroundColor;
                el.style.backgroundColor = "#fff3cd";
                setTimeout(() => { el.style.backgroundColor = origBg; }, 1500);
            }
        }
        return window.dash_clientside.no_update;
    }
    """,
    Output({'type': 'mp-nav-box', 'index': MATCH}, 'id'),
    Input({'type': 'mp-nav-box', 'index': MATCH}, 'n_clicks'),
    State({'type': 'mp-nav-box', 'index': MATCH}, 'id'),
    prevent_initial_call=True
)



@callback(
    Output('mp-save-status', 'children'),
    Output('mp-store', 'data', allow_duplicate=True),
    Output('mp-overwrite-modal', 'is_open'),
    Output('mp-overwrite-body', 'children'),
    Output('mp-current-config', 'data', allow_duplicate=True),
    Input('mp-save-btn', 'n_clicks'),
    Input('mp-update-btn', 'n_clicks'),
    Input('mp-overwrite-confirm', 'n_clicks'),
    Input('mp-overwrite-cancel', 'n_clicks'),
    Input('mp-delete-dialog', 'submit_n_clicks'),
    State('mp-overwrite-modal', 'is_open'),
    State('mp-overwrite-body', 'children'),
    State('mp-name', 'value'), State('mp-saved-selector', 'value'),
    State('mp-mode', 'value'), State('mp-rows', 'value'), State('mp-cols', 'value'),
    State('mp-shared-axes', 'value'), State('mp-ctype', 'value'),
    State({'type': 'mp-cell-x', 'index': dash.ALL}, 'value'),
    State({'type': 'mp-cell-x', 'index': dash.ALL}, 'id'),
    State({'type': 'mp-cell-y', 'index': dash.ALL}, 'value'),
    State({'type': 'mp-cell-y', 'index': dash.ALL}, 'id'),
    State({'type': 'mp-cell-title', 'index': dash.ALL}, 'value'),
    State({'type': 'mp-cell-title', 'index': dash.ALL}, 'id'),
    State({'type': 'mp-cell-ctype', 'index': dash.ALL}, 'value'),
    State({'type': 'mp-cell-ctype', 'index': dash.ALL}, 'id'),
    State({'type': 'mp-cell-leg', 'index': dash.ALL}, 'value'),
    State({'type': 'mp-cell-leg', 'index': dash.ALL}, 'id'),
    State('mp-pair-x', 'value'), State('mp-pair-y', 'value'),
    State('mp-uniform-y', 'value'), State('mp-palette', 'value'),
    State('mp-project-selector', 'value'), State('mp-store', 'data'),
    prevent_initial_call=True
)
def mp_save_logic(n_save, n_upd, n_conf, n_canc, n_del, is_open, mbody, new_name, old_name,
                  mode, rows, cols, shared, ctype, cx_vals, cx_ids, cy_vals, cy_ids,
                  ct_vals, ct_ids, cc_vals, cc_ids, cl_vals, cl_ids,
                  px, py, uniform_y, palette, proj, store):
    ctx = dash.callback_context
    if not ctx.triggered: return dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update
    trig = ctx.triggered[0]['prop_id'].split('.')[0]
    
    if trig == 'mp-delete-dialog' and old_name and proj:
        if delete_multiplot(proj, old_name):
            return f"Deleted '{old_name}'", store + 1, False, "", dash.no_update
            
    if trig == 'mp-overwrite-cancel':
        return "", store, False, dash.no_update, dash.no_update
        
    projects = load_projects()
    
    try: r, c = int(rows), int(cols)
    except Exception: r, c = 2, 2
    
    c_x_map = {str(k['index']): v for k, v in zip(cx_ids, cx_vals)} if cx_ids else {}
    c_y_map = {str(k['index']): v for k, v in zip(cy_ids, cy_vals)} if cy_ids else {}
    
    c_settings_map = {}
    if ct_ids:
        for ct_id, ct_val, cc_val, cl_val in zip(ct_ids, ct_vals, cc_vals, cl_vals):
            idx_s = str(ct_id['index'])
            c_settings_map[idx_s] = {
                'title': ct_val,
                'ctype': cc_val,
                'leg': cl_val
            }
    
    cfg = {
        'mode': mode, 'rows': r, 'cols': c, 'shared': shared, 'ctype': ctype, 
        'cell_x': c_x_map, 'cell_y': c_y_map, 'pair_x': px, 'pair_y': py,
        'uniform_y': uniform_y, 'palette': palette, 'cell_settings': c_settings_map
    }
    
    if trig in ['mp-save-btn', 'mp-update-btn']:
        tgt = old_name if trig == 'mp-update-btn' else new_name
        if not tgt or not proj: return "Need Name", store, dash.no_update, dash.no_update, dash.no_update
        
        if trig == 'mp-save-btn' and tgt in projects.get(proj, {}).get('multiplots', {}):
            return "", store, True, f"Overwrite '{tgt}'?", dash.no_update
        if trig == 'mp-update-btn':
            return "", store, True, f"Update '{tgt}'?", dash.no_update
            
        if save_multiplot(proj, tgt, cfg): return "Saved!", store + 1, False, dash.no_update, cfg
        
    if trig == 'mp-overwrite-confirm':
        tgt = new_name if mbody and "Overwrite" in mbody else old_name
        if save_multiplot(proj, tgt, cfg): return "Saved!", store + 1, False, dash.no_update, cfg
        
    return "", store, is_open, dash.no_update, dash.no_update

@callback(
    Output('mp-graph', 'figure'),
    Input('mp-mode', 'value'), Input('mp-rows', 'value'), Input('mp-cols', 'value'),
    Input('mp-shared-axes', 'value'), Input('mp-ctype', 'value'),
    Input({'type': 'mp-cell-x', 'index': dash.ALL}, 'value'),
    Input({'type': 'mp-cell-x', 'index': dash.ALL}, 'id'),
    Input({'type': 'mp-cell-y', 'index': dash.ALL}, 'value'),
    Input({'type': 'mp-cell-y', 'index': dash.ALL}, 'id'),
    # New Inputs for Individual Settings
    Input({'type': 'mp-cell-title', 'index': dash.ALL}, 'value'),
    Input({'type': 'mp-cell-ctype', 'index': dash.ALL}, 'value'),
    Input({'type': 'mp-cell-leg', 'index': dash.ALL}, 'value'),
    Input('mp-uniform-y', 'value'),
    Input('mp-palette', 'value'),
    # End New Inputs
    Input('mp-pair-x', 'value'), Input('mp-pair-y', 'value'),
    State('mp-project-selector', 'value')
)
def render_mp(mode, rows, cols, shared, ctype, cx_vals, cx_ids, cy_vals, cy_ids, 
              ct_vals, cc_vals, cl_vals, uniform_y, palette, px, py, proj):
    if not proj: return go.Figure()
    cfg = load_projects()[proj]
    df = load_csv_data(cfg['file_path'], sep=cfg.get('sep', ','), decimal=cfg.get('decimal', '.'), timestamp_col=cfg.get('timestamp_col'), timestamp_format=cfg.get('timestamp_format'))
    if df is None: return go.Figure()
    
    share_x = 'x' in (shared or [])
    share_y = 'y' in (shared or [])
    
    fig = None
    
    def process_val(s):
        if s.dtype in [pl.Utf8, pl.String, pl.Object]:
            try: return s.str.replace(",", ".").cast(pl.Float64, strict=False)
            except Exception: pass
        return s

    if mode == 'A':
        try: r, c = int(rows), int(cols)
        except Exception: return go.Figure()
        
        c_x_map = {k['index']: v for k, v in zip(cx_ids, cx_vals)} if cx_ids else {}
        c_y_map = {k['index']: v for k, v in zip(cy_ids, cy_vals)} if cy_ids else {}
        # New settings maps
        c_t_map = {k['index']: v for k, v in zip(cx_ids, ct_vals)} if cx_ids else {}
        c_c_map = {k['index']: v for k, v in zip(cx_ids, cc_vals)} if cx_ids else {}
        c_l_map = {k['index']: v for k, v in zip(cx_ids, cl_vals)} if cx_ids else {}
        
        titles = []
        for i in range(r):
            for j in range(c):
                idx = i * c + j
                custom_title = c_t_map.get(idx)
                if custom_title:
                    titles.append(custom_title)
                else:
                    y_s = c_y_map.get(idx, [])
                    titles.append(", ".join(y_s) if y_s else f"Plot {idx+1}")
                
        fig = make_subplots(rows=r, cols=c, shared_xaxes=share_x, shared_yaxes=share_y, subplot_titles=titles)
        
        for i in range(r):
            for j in range(c):
                idx = i * c + j
                x_col = c_x_map.get(idx)
                y_cols = c_y_map.get(idx, [])
                if not x_col or not y_cols: continue
                if x_col not in df.columns: continue
                
                x_data = df[x_col].to_list()
                is_time = df[x_col].dtype in [pl.Datetime, pl.Date]
                
                # Determine cell-specific ctype
                cell_ctype = c_c_map.get(idx, 'global')
                eff_ctype = ctype if cell_ctype == 'global' else cell_ctype
                show_leg = c_l_map.get(idx, True)
                
                for y_col in y_cols:
                    if y_col not in df.columns: continue
                    y_series = process_val(df[y_col])
                    y_data = y_series.to_list()
                    
                    if eff_ctype == 'scatter': t = go.Scatter(x=x_data, y=y_data, mode='markers', name=y_col)
                    elif eff_ctype == 'bar': t = go.Bar(x=x_data, y=y_data, name=y_col)
                    elif eff_ctype == 'area': t = go.Scatter(x=x_data, y=y_data, mode='lines', fill='tozeroy', name=y_col)
                    else: t = go.Scatter(x=x_data, y=y_data, mode='lines', name=y_col)
                    
                    t.showlegend = show_leg
                    fig.add_trace(t, row=i+1, col=j+1)
                
                if is_time:
                    fig.update_xaxes(tickformat="%d/%m/%Y", row=i+1, col=j+1)
                    
    elif mode == 'B':
        px = px or []
        py = py or []
        if not px or not py: return go.Figure()
        
        r, c = len(py), len(px)
        titles = []
        for y_col in py:
            for x_col in px:
                titles.append(f"{y_col} vs {x_col}")
                
        fig = make_subplots(rows=r, cols=c, shared_xaxes=share_x, shared_yaxes=share_y, subplot_titles=titles)
        
        for i, y_col in enumerate(py):
            for j, x_col in enumerate(px):
                if x_col not in df.columns or y_col not in df.columns: continue
                
                x_data = df[x_col].to_list()
                y_series = process_val(df[y_col])
                y_data = y_series.to_list()
                is_time = df[x_col].dtype in [pl.Datetime, pl.Date]
                
                if ctype == 'scatter': t = go.Scatter(x=x_data, y=y_data, mode='markers', name=f"{y_col}-{x_col}")
                elif ctype == 'bar': t = go.Bar(x=x_data, y=y_data, name=f"{y_col}-{x_col}")
                elif ctype == 'area': t = go.Scatter(x=x_data, y=y_data, mode='lines', fill='tozeroy', name=f"{y_col}-{x_col}")
                else: t = go.Scatter(x=x_data, y=y_data, mode='lines', name=f"{y_col}-{x_col}")
                
                fig.add_trace(t, row=i+1, col=j+1)
                if is_time:
                    fig.update_xaxes(tickformat="%d/%m/%Y", row=i+1, col=j+1)

    if fig:
        # Uniform Y Logic
        if 'uniform' in (uniform_y or []):
            all_y_min = float('inf')
            all_y_max = float('-inf')
            # Check Mode A or B for relevant columns
            cols_to_check = []
            if mode == 'A':
                for y_s in c_y_map.values():
                    cols_to_check.extend(y_s)
            else:
                cols_to_check = py
            
            for y_col in set(cols_to_check):
                if y_col in df.columns:
                    y_series = process_val(df[y_col])
                    ymin, ymax = y_series.min(), y_series.max()
                    if ymin is not None and ymin < all_y_min: all_y_min = ymin
                    if ymax is not None and ymax > all_y_max: all_y_max = ymax
            
            if all_y_min != float('inf'):
                fig.update_yaxes(range=[all_y_min, all_y_max])

        template = "plotly" if palette == 'plotly' else palette
        fig.update_layout(template=template, margin=dict(l=40, r=40, t=60, b=40), hovermode="x unified", title="MultiPlot Dash")
        fig.update_xaxes(automargin=True)
        fig.update_yaxes(automargin=True)
    return fig or go.Figure()
