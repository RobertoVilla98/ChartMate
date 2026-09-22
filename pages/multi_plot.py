import dash
from dash import dcc, html, Input, Output, State, ALL, MATCH, callback
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
import polars as pl
import os

from components.export_toolbar import render_export_toolbar, render_viewport_controls
from components.grid_navigator import build_grid_navigator, TOPOLOGY_PRESETS
from utils.chart_engine import build_multiplot_figure
from utils.storage import load_projects, delete_multiplot, save_multiplot
from utils.data_handler import load_data_file

dash.register_page(__name__, path='/multi-plot', name='Multi Plot')

layout = html.Div([
    # Top Row: Project & Matrix Setup Controls
    dbc.Row([
        # Left Side (width=3): Project & MultiPlot Recall
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    html.I(className="bi bi-grid-3x3-gap me-2 text-sky"),
                    "MultiPlot Setup & Recall"
                ]),
                dbc.CardBody([
                    html.Label("Active Project", className="small fw-bold text-secondary mb-1"),
                    dcc.Dropdown(id='mp-project-selector', placeholder="Select Project...", className="mb-2 small font-mono"),
                    
                    html.Label("Recall Layout", className="small fw-bold text-secondary mb-1"),
                    dbc.Row([
                        dbc.Col(dcc.Dropdown(id='mp-saved-selector', placeholder="Select Layout...", className="small font-mono"), width=8, className="pe-1"),
                        dbc.Col(dbc.Button([html.I(className="bi bi-trash3")], id='mp-delete-btn', color="danger", size="sm", className="w-100"), width=4, className="ps-0")
                    ], className="mb-2"),
                    
                    html.Hr(className="border-subtle my-2"),
                    
                    html.Label("Save Configuration", className="small fw-bold text-secondary mb-1"),
                    dbc.Input(id='mp-name', placeholder="Layout Name (e.g. Overview_Grid)...", size="sm", className="mb-2 font-mono"),
                    dbc.Row([
                        dbc.Col(dbc.Button([html.I(className="bi bi-plus-lg me-1"), "Save"], id='mp-save-btn', color="success", size="sm", className="w-100"), width=6, className="pe-1"),
                        dbc.Col(dbc.Button([html.I(className="bi bi-arrow-repeat me-1"), "Update"], id='mp-update-btn', color="primary", size="sm", className="w-100"), width=6, className="ps-1")
                    ]),
                    html.Div(id='mp-save-status', className="text-muted small mt-2 text-center font-mono")
                ])
            ], className="mb-3")
        ], width=12, lg=3),
        
        # Right Side (width=9): Layout Matrix & Topology Presets
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    html.I(className="bi bi-diagram-3 me-2 text-emerald"),
                    "Matrix Topology & Subplot Mapping"
                ]),
                dbc.CardBody([
                    # Topology Preset & Subplot Mode Selection
                    dbc.Row([
                        dbc.Col([
                            html.Label("Topology Preset (Journal Standard)", className="small fw-bold text-secondary mb-1"),
                            dcc.Dropdown(
                                id='mp-topology-preset',
                                options=[{'label': v['label'], 'value': k} for k, v in TOPOLOGY_PRESETS.items()],
                                value='stack_3x1',
                                clearable=False,
                                className="small font-mono mb-2"
                            )
                        ], xs=12, md=6),
                        dbc.Col([
                            html.Label("Subplot Mode", className="small fw-bold text-secondary mb-1"),
                            dbc.RadioItems(
                                id='mp-mode',
                                options=[
                                    {'label': '  Custom Grid (A)', 'value': 'A'},
                                    {'label': '  Pairplot (B)', 'value': 'B'}
                                ],
                                value='A',
                                inline=True,
                                className="small mt-1 font-mono"
                            )
                        ], xs=6, md=3),
                        dbc.Col([
                            html.Label("Academic Lettering", className="small fw-bold text-secondary mb-1"), html.Br(),
                            dbc.Switch(id='mp-use-lettering', label='(a), (b), (c)...', value=True, className="small mt-1 font-mono")
                        ], xs=6, md=3)
                    ], className="mb-3 align-items-center"),
                    
                    # Common Grid Settings
                    dbc.Row([
                        dbc.Col([
                            html.Label("Global Style", className="small fw-bold text-secondary mb-1"),
                            dcc.Dropdown(
                                id='mp-ctype',
                                options=[
                                    {'label': 'Line', 'value': 'line'},
                                    {'label': 'Scatter', 'value': 'scatter'},
                                    {'label': 'Area', 'value': 'area'},
                                    {'label': 'Bar', 'value': 'bar'}
                                ],
                                value='line', className="small"
                            )
                        ], xs=6, md=3),
                        dbc.Col([
                            html.Label("Axis Linkage", className="small fw-bold text-secondary mb-1"),
                            dbc.Checklist(
                                options=[
                                    {"label": "Share X", "value": "x"},
                                    {"label": "Share Y", "value": "y"},
                                ],
                                value=["x"],
                                id="mp-shared-axes",
                                inline=True,
                                switch=True,
                                className="small mt-1"
                            ),
                        ], xs=6, md=3),
                        dbc.Col([
                            html.Div([
                                html.Label("Rows (R)", className="small fw-bold text-secondary mb-1"),
                                dbc.Input(id='mp-rows', type='number', value=3, min=1, step=1, size="sm", className="font-mono text-center")
                            ], id="mp-rows-container")
                        ], xs=6, md=3),
                        dbc.Col([
                            html.Div([
                                html.Label("Cols (C)", className="small fw-bold text-secondary mb-1"),
                                dbc.Input(id='mp-cols', type='number', value=1, min=1, step=1, size="sm", className="font-mono text-center")
                            ], id="mp-cols-container")
                        ], xs=6, md=3)
                    ], className="mb-3 align-items-center"),
                    
                    html.Hr(className="border-subtle my-2"),
                    dcc.Store(id='mp-current-config', data={}),
                    
                    # Mode A Wrapper (Custom Individual Matrix)
                    html.Div(id='mp-variant-a-ui', children=[
                        dbc.Row([
                            dbc.Col([
                                html.Div([
                                    dbc.Button([html.I(className="bi bi-arrows-collapse me-1"), "Sync 1st X-Axis to All"], id='mp-sync-x', color="info", size="sm", className="me-2"),
                                    dbc.Checklist(
                                        id='mp-uniform-y',
                                        options=[{"label": "Uniform Y-Scale Across Matrix", "value": "uniform"}],
                                        value=[],
                                        switch=True,
                                        inline=True,
                                        className="small me-3"
                                    ),
                                    html.Div([
                                        html.Label("Palette", className="small me-2 mb-0 text-secondary"),
                                        dcc.Dropdown(
                                            id='mp-palette',
                                            options=[
                                                {'label':'Velth Emerald','value':'plotly_white'},
                                                {'label':'Viridis','value':'viridis'},
                                                {'label':'Muted Scientific','value':'plotly'}
                                            ],
                                            value='plotly_white',
                                            className="small",
                                            style={'width': '160px'}
                                        )
                                    ], className="d-inline-flex align-items-center ms-auto")
                                ], className="border border-subtle rounded p-2 bg-surface-elevated mb-3 d-flex flex-wrap align-items-center")
                            ], width=12)
                        ]),
                        dbc.Row([
                            dbc.Col([
                                html.Label("Grid Navigator", className="small fw-bold mb-1 text-secondary"),
                                html.Div(id='mp-visual-navigator', className="border border-subtle rounded p-2 bg-surface-elevated mb-2 d-flex flex-column align-items-center", style={'minHeight': '100px', 'maxHeight': '320px', 'overflowY': 'auto'})
                            ], xs=12, md=3),
                            dbc.Col([
                                dbc.Row([
                                    dbc.Col(dbc.Button("Apply 1st X to All", id='mp-apply-x-all', size="sm", color="info", outline=True, className="w-100"), width=6, className="pe-1"),
                                    dbc.Col(dbc.Button("Clear All Cells", id='mp-clear-all', size="sm", color="secondary", outline=True, className="w-100"), width=6, className="ps-1"),
                                ], className="mb-2"),
                                html.Div(id='mp-config-table-container', style={'maxHeight': '320px', 'overflowY': 'auto'}, className="border border-subtle rounded")
                            ], xs=12, md=9)
                        ])
                    ]),

                    # Mode B Wrapper (Pairplot)
                    html.Div(id='mp-variant-b-ui', children=[
                        dbc.Row([
                            dbc.Col([
                                html.Label("Group X Data Columns (Pairplot)", className="small fw-bold text-secondary mb-1"),
                                dcc.Dropdown(id='mp-pair-x', multi=True, placeholder="Select X columns...", className="small font-mono")
                            ], width=6),
                            dbc.Col([
                                html.Label("Group Y Data Columns (Pairplot)", className="small fw-bold text-secondary mb-1"),
                                dcc.Dropdown(id='mp-pair-y', multi=True, placeholder="Select Y columns...", className="small font-mono")
                            ], width=6)
                        ])
                    ], style={'display':'none'})
                ])
            ], className="mb-3")
        ], width=12, lg=9)
    ], className="mb-3"),

    # Bottom Row: MultiPlot Interactive Viewport & Export Studio
    dbc.Row([
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    html.Div([
                        html.Div([
                            html.I(className="bi bi-display me-2 text-sky"),
                            html.Span("MultiPlot Matrix Preview & Vector Export Studio", className="fw-bold")
                        ], className="d-flex align-items-center"),
                        render_viewport_controls(prefix="mp-viewport")
                    ], className="d-flex flex-wrap justify-content-between align-items-center w-100")
                ]),
                dbc.CardBody([
                    render_export_toolbar(prefix="mp-dl", default_preset="double_col"),
                    html.Div([
                        dcc.Graph(
                            id='mp-graph',
                            config={'displaylogo': False, 'responsive': True, 'modeBarButtonsToRemove': ['lasso2d', 'select2d']}
                        )
                    ], id='mp-graph-wrapper', className="graph-preview-container")
                ])
            ])
        ], width=12)
    ]),
    
    html.Div(id='mp-store', style={'display': 'none'}, children=0),
    html.Div(id='mp-dl-dummy-output', style={'display': 'none'}),
    dcc.ConfirmDialog(id='mp-delete-dialog', message='Are you sure you want to permanently delete this multiplot layout?'),
    
    dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Update / Overwrite MultiPlot?")),
            dbc.ModalBody(id="mp-overwrite-body", children="Are you sure you want to update/overwrite this configuration?"),
            dbc.ModalFooter([
                dbc.Button("Cancel", id="mp-overwrite-cancel", className="ms-auto", n_clicks=0, color="secondary"),
                dbc.Button("Confirm", id="mp-overwrite-confirm", color="primary", n_clicks=0),
            ]),
        ],
        id="mp-overwrite-modal",
        is_open=False,
    )
], className="py-2")

# Topology Preset Callback
@callback(
    Output('mp-rows', 'value', allow_duplicate=True),
    Output('mp-cols', 'value', allow_duplicate=True),
    Output('mp-shared-axes', 'value', allow_duplicate=True),
    Output('mp-dl-width', 'value', allow_duplicate=True),
    Output('mp-dl-height', 'value', allow_duplicate=True),
    Input('mp-topology-preset', 'value'),
    prevent_initial_call=True
)
def apply_topology_preset(preset_key):
    if preset_key not in TOPOLOGY_PRESETS or preset_key == 'custom':
        return [dash.no_update] * 5
    p = TOPOLOGY_PRESETS[preset_key]
    return p['rows'], p['cols'], p['shared'], p['w_cm'], p['h_cm']

# Publication Preset Callback for MultiPlot
@callback(
    Output('mp-dl-width', 'value'),
    Output('mp-dl-height', 'value'),
    Input('mp-dl-preset', 'value'),
    prevent_initial_call=True
)
def apply_mp_preset(preset_key):
    from components.export_toolbar import PUBLICATION_PRESETS
    if preset_key not in PUBLICATION_PRESETS or preset_key == 'custom':
        return dash.no_update, dash.no_update
    p = PUBLICATION_PRESETS[preset_key]
    return p['width'], p['height']

# Proportional Aspect Ratio Sizing & Badge Callback for MultiPlot
@callback(
    Output('mp-graph', 'style'),
    Output('mp-graph-wrapper', 'style'),
    Output('mp-viewport-ratio-badge', 'children'),
    Input('mp-dl-width', 'value'),
    Input('mp-dl-height', 'value')
)
def update_mp_preview_size(w_cm, h_cm):
    if not w_cm or not h_cm or float(w_cm) <= 0 or float(h_cm) <= 0:
        w_cm, h_cm = 17.0, 9.5
    
    w_cm = float(w_cm)
    h_cm = float(h_cm)
    ratio = w_cm / h_cm
    
    # Calculate responsive proportional dimensions (Large Screen Multiplier)
    calc_w = 1200
    calc_h = int(calc_w / ratio)
    if calc_h > 750:
        calc_h = 750
        calc_w = int(calc_h * ratio)
    elif calc_h < 450:
        calc_h = 450
        calc_w = min(int(calc_h * ratio), 1250)
        
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

# Clientside export callback
dash.clientside_callback(
    """
    function(n_clicks, format, width_cm, height_cm, dpi, proj, layout_name) {
        if (n_clicks) {
            const width_px = (width_cm / 2.54) * 96;
            const height_px = (height_cm / 2.54) * 96;
            const scale = (dpi || 300) / 96;
            const gd = document.getElementById('mp-graph').querySelector('.js-plotly-plot') || document.getElementById('mp-graph');
            const fname = (proj || 'ChartMate') + '_' + (layout_name || 'multiplot');
            
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
    Output('mp-dl-dummy-output', 'children'),
    Input('mp-dl-btn', 'n_clicks'),
    State('mp-dl-format', 'value'),
    State('mp-dl-width', 'value'),
    State('mp-dl-height', 'value'),
    State('mp-dl-dpi', 'value'),
    State('mp-project-selector', 'value'),
    State('mp-saved-selector', 'value'),
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
    return bool(n and val)

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
        return [dash.no_update]*8
    c = load_projects().get(proj, {}).get('multiplots', {}).get(name)
    if not c: 
        return [dash.no_update]*8
    return (
        c, 
        c.get('mode', 'A'), 
        c.get('rows', 3), 
        c.get('cols', 1), 
        c.get('shared', ['x']), 
        c.get('ctype', 'line'),
        c.get('uniform_y', []),
        c.get('palette', 'plotly_white')
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
    Input('mp-use-lettering', 'value'),
    Input('mp-project-selector', 'value'),
    Input('mp-current-config', 'data')
)
def build_dynamic_inputs(mode, rows, cols, use_lettering, proj, cfg):
    col_opts = []
    ts_col = None
    if proj:
        p_cfg = load_projects().get(proj)
        if p_cfg and os.path.exists(p_cfg['file_path']):
            ts_col = p_cfg.get('timestamp_col')
            df = load_data_file(p_cfg['file_path'], sep=p_cfg.get('sep', ','), decimal=p_cfg.get('decimal', '.'))
            if df is not None:
                col_opts = [{'label': c, 'value': c} for c in df.columns]

    cfg = cfg or {}
    px = cfg.get('pair_x', [])
    py = cfg.get('pair_y', [])

    if mode == 'B':
        return [], [], col_opts, col_opts, px, py

    try: r, c = int(rows), int(cols)
    except: r, c = 3, 1
    
    c_x = cfg.get('cell_x', {})
    c_y = cfg.get('cell_y', {})
    c_settings = cfg.get('cell_settings', {})
    
    nav_component, table_component = build_grid_navigator(r, c, c_x, c_y, c_settings, col_opts, ts_col, use_lettering=bool(use_lettering))
    return nav_component, table_component, col_opts, col_opts, dash.no_update, dash.no_update

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
                el.style.backgroundColor = "rgba(16, 185, 129, 0.25)";
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
    State({'type': 'mp-cell-ylabel', 'index': dash.ALL}, 'value'),
    State({'type': 'mp-cell-ylabel', 'index': dash.ALL}, 'id'),
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
                  ct_vals, ct_ids, cy_lbl_vals, cy_lbl_ids, cc_vals, cc_ids, cl_vals, cl_ids,
                  px, py, uniform_y, palette, proj, store):
    ctx = dash.callback_context
    if not ctx.triggered: return [dash.no_update]*5
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
    c_settings_map = {
        str(ct['index']): {
            'title': tv,
            'ylabel': ylv,
            'ctype': cv,
            'leg': lv
        }
        for ct, tv, ylv, cv, lv in zip(ct_ids, ct_vals, cy_lbl_vals, cc_vals, cl_vals)
    } if ct_ids else {}
    
    cfg = {
        'mode': mode, 'rows': r, 'cols': c, 'shared': shared, 'ctype': ctype, 
        'cell_x': c_x_map, 'cell_y': c_y_map, 'pair_x': px, 'pair_y': py,
        'uniform_y': uniform_y, 'palette': palette, 'cell_settings': c_settings_map
    }
    
    if trig in ['mp-save-btn', 'mp-update-btn']:
        tgt = old_name if trig == 'mp-update-btn' else new_name
        if not tgt or not proj: return "Provide Name & Project", store, dash.no_update, dash.no_update, dash.no_update
        
        if trig == 'mp-save-btn' and tgt in projects.get(proj, {}).get('multiplots', {}):
            return "", store, True, f"Overwrite '{tgt}'?", dash.no_update
        if trig == 'mp-update-btn':
            return "", store, True, f"Update '{tgt}'?", dash.no_update
            
        if save_multiplot(proj, tgt, cfg): return "Saved successfully!", store + 1, False, dash.no_update, cfg
        
    if trig == 'mp-overwrite-confirm':
        tgt = new_name if mbody and "Overwrite" in mbody else old_name
        if save_multiplot(proj, tgt, cfg): return "Updated successfully!", store + 1, False, dash.no_update, cfg
        
    return "", store, is_open, dash.no_update, dash.no_update

@callback(
    Output('mp-graph', 'figure'),
    Input('mp-mode', 'value'), Input('mp-rows', 'value'), Input('mp-cols', 'value'),
    Input('mp-shared-axes', 'value'), Input('mp-ctype', 'value'),
    Input({'type': 'mp-cell-x', 'index': dash.ALL}, 'value'),
    Input({'type': 'mp-cell-x', 'index': dash.ALL}, 'id'),
    Input({'type': 'mp-cell-y', 'index': dash.ALL}, 'value'),
    Input({'type': 'mp-cell-y', 'index': dash.ALL}, 'id'),
    Input({'type': 'mp-cell-title', 'index': dash.ALL}, 'value'),
    Input({'type': 'mp-cell-ylabel', 'index': dash.ALL}, 'value'),
    Input({'type': 'mp-cell-ctype', 'index': dash.ALL}, 'value'),
    Input({'type': 'mp-cell-leg', 'index': dash.ALL}, 'value'),
    Input('mp-use-lettering', 'value'),
    Input('mp-uniform-y', 'value'),
    Input('mp-palette', 'value'),
    Input('mp-dl-width', 'value'), Input('mp-dl-height', 'value'),
    Input('mp-pair-x', 'value'), Input('mp-pair-y', 'value'),
    State('mp-project-selector', 'value')
)
def render_mp_cb(mode, rows, cols, shared, ctype, cx_vals, cx_ids, cy_vals, cy_ids, 
                 ct_vals, cy_lbl_vals, cc_vals, cl_vals, use_lettering, uniform_y, palette, w_cm, h_cm, px, py, proj):
    if not proj: return go.Figure()
    cfg = load_projects().get(proj, {})
    if not cfg or 'file_path' not in cfg: return go.Figure()
    
    df = load_data_file(cfg['file_path'], sep=cfg.get('sep', ','), decimal=cfg.get('decimal', '.'), timestamp_col=cfg.get('timestamp_col'), timestamp_format=cfg.get('timestamp_format'))
    if df is None: return go.Figure()
    
    c_x_map = {k['index']: v for k, v in zip(cx_ids, cx_vals)} if cx_ids else {}
    c_y_map = {k['index']: v for k, v in zip(cy_ids, cy_vals)} if cy_ids else {}
    c_t_map = {k['index']: v for k, v in zip(cx_ids, ct_vals)} if cx_ids else {}
    c_ylabel_map = {k['index']: v for k, v in zip(cx_ids, cy_lbl_vals)} if cx_ids else {}
    c_c_map = {k['index']: v for k, v in zip(cx_ids, cc_vals)} if cx_ids else {}
    c_l_map = {k['index']: v for k, v in zip(cx_ids, cl_vals)} if cx_ids else {}

    return build_multiplot_figure(
        df=df, mode=mode, rows=rows, cols=cols, shared=shared, ctype=ctype,
        c_x_map=c_x_map, c_y_map=c_y_map, c_t_map=c_t_map, c_c_map=c_c_map, c_l_map=c_l_map,
        uniform_y=uniform_y, palette=palette, px=px, py=py,
        w_cm=w_cm, h_cm=h_cm, c_ylabel_map=c_ylabel_map, use_lettering=bool(use_lettering)
    )
