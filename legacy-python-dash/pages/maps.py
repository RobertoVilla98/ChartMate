import dash
from dash import dcc, html, Input, Output, State, callback
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
import polars as pl
import os

from components.export_toolbar import render_export_toolbar, render_viewport_controls
from utils.chart_engine import build_map_figure
from utils.storage import load_projects
from utils.data_handler import load_data_file

dash.register_page(__name__, path='/maps', name='Maps')

layout = html.Div([
    # Top Row: Project Selector & Map Configuration Controls
    dbc.Row([
        # Left Side (width=3): Project & Layer Controls
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    html.I(className="bi bi-globe-americas me-2 text-sky"),
                    "Project & Map Studio"
                ]),
                dbc.CardBody([
                    html.Label("Active Project", className="small fw-bold text-secondary mb-1"),
                    dcc.Dropdown(id='map-project-selector', placeholder="Select Project...", className="mb-3 small font-mono"),
                    
                    html.Label("Base Map Provider", className="small fw-bold text-secondary mb-1"),
                    dcc.Dropdown(
                        id='map-type',
                        options=[
                            {'label': '🛰️ ESRI World Satellite (High-Res)', 'value': 'satellite'},
                            {'label': '🗺️ OpenStreetMap (Standard Roads)', 'value': 'osm'},
                            {'label': '🏙️ CartoDB Positron (Clean Light)', 'value': 'positron'},
                            {'label': '🌑 CartoDB Dark Matter (Dark Mode)', 'value': 'darkmatter'},
                            {'label': '🏔️ OpenTopoMap (Topographic)', 'value': 'topo'}
                        ],
                        value='satellite',
                        clearable=False,
                        className="mb-2 small font-mono"
                    ),
                    
                    html.Label("Visualization Mode", className="small fw-bold text-secondary mb-1"),
                    dcc.Dropdown(
                        id='map-viz-mode',
                        options=[
                            {'label': '📍 Bubble Scatter Map', 'value': 'scatter'},
                            {'label': '🔥 Spatial Density Heatmap', 'value': 'density'},
                            {'label': '〰️ GPS Trajectory / Track', 'value': 'track'}
                        ],
                        value='scatter',
                        clearable=False,
                        className="mb-2 small font-mono"
                    ),
                    
                    html.Label("Scientific Color Scale", className="small fw-bold text-secondary mb-1"),
                    dcc.Dropdown(
                        id='map-palette',
                        options=[
                            {'label': 'Viridis', 'value': 'Viridis'},
                            {'label': 'Plasma', 'value': 'Plasma'},
                            {'label': 'Turbo', 'value': 'Turbo'},
                            {'label': 'Coolwarm (RdBu)', 'value': 'RdBu'},
                            {'label': 'Yellow-Orange-Red', 'value': 'YlOrRd'},
                            {'label': 'Emerald-Sky (Tealgrn)', 'value': 'Tealgrn'}
                        ],
                        value='Viridis',
                        clearable=False,
                        className="mb-2 small font-mono"
                    ),
                    
                    dbc.Row([
                        dbc.Col([
                            html.Label("Point Size", className="small fw-bold text-secondary mb-1"),
                            dbc.Input(id='map-point-size', type='number', value=10, min=2, max=50, step=1, size="sm", className="font-mono text-center")
                        ], width=6, className="pe-1"),
                        dbc.Col([
                            html.Label("Opacity", className="small fw-bold text-secondary mb-1"),
                            dbc.Input(id='map-point-opacity', type='number', value=0.85, min=0.1, max=1.0, step=0.05, size="sm", className="font-mono text-center")
                        ], width=6, className="ps-1"),
                    ], className="mb-2")
                ])
            ], className="mb-3")
        ], width=12, lg=3),
        
        # Right Side (width=9): Coordinate & Data Mapping
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    html.I(className="bi bi-geo-alt me-2 text-emerald"),
                    "Geospatial Coordinates & Variable Mapping"
                ]),
                dbc.CardBody([
                    dbc.Row([
                        dbc.Col([
                            html.Label("Latitude (Lat) Column", className="small fw-bold text-emerald mb-1"),
                            dcc.Dropdown(id='map-lat-col', placeholder="Select Latitude...", className="small font-mono mb-2")
                        ], xs=12, md=6),
                        dbc.Col([
                            html.Label("Longitude (Lon) Column", className="small fw-bold text-emerald mb-1"),
                            dcc.Dropdown(id='map-lon-col', placeholder="Select Longitude...", className="small font-mono mb-2")
                        ], xs=12, md=6),
                    ], className="mb-2"),
                    
                    dbc.Row([
                        dbc.Col([
                            html.Label("Color Metric (Values / Intensity)", className="small fw-bold text-sky mb-1"),
                            dcc.Dropdown(id='map-val-col', placeholder="Optional Value/Metric...", clearable=True, className="small font-mono mb-2")
                        ], xs=12, md=4),
                        dbc.Col([
                            html.Label("Tooltip / Label Identifier", className="small fw-bold text-secondary mb-1"),
                            dcc.Dropdown(id='map-hover-col', placeholder="Optional Site/Sensor Name...", clearable=True, className="small font-mono mb-2")
                        ], xs=12, md=4),
                        dbc.Col([
                            html.Label("Bubble Size Metric", className="small fw-bold text-secondary mb-1"),
                            dcc.Dropdown(id='map-size-col', placeholder="Optional Size Scale...", clearable=True, className="small font-mono mb-2")
                        ], xs=12, md=4),
                    ], className="mb-2"),
                    
                    html.Hr(className="border-subtle my-2"),
                    
                    # Optional Map Center Overrides
                    html.Div([
                        html.Label("Manual Center & Zoom Override (Optional)", className="small fw-bold text-secondary mb-1"),
                        dbc.Row([
                            dbc.Col(dbc.Input(id='map-custom-lat', type='number', placeholder="Center Lat...", size="sm", className="font-mono"), width=4, className="pe-1"),
                            dbc.Col(dbc.Input(id='map-custom-lon', type='number', placeholder="Center Lon...", size="sm", className="font-mono"), width=4, className="px-1"),
                            dbc.Col(dbc.Input(id='map-custom-zoom', type='number', placeholder="Zoom (1-18)...", min=1, max=18, size="sm", className="font-mono"), width=4, className="ps-1"),
                        ])
                    ])
                ])
            ], className="mb-3")
        ], width=12, lg=9)
    ], className="mb-3"),

    # Bottom Row: Map Viewport & Vector Export Studio
    dbc.Row([
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    html.Div([
                        html.Div([
                            html.I(className="bi bi-map me-2 text-sky"),
                            html.Span("Geospatial Map Viewport & High-Res Export", className="fw-bold")
                        ], className="d-flex align-items-center"),
                        render_viewport_controls(prefix="map-viewport")
                    ], className="d-flex flex-wrap justify-content-between align-items-center w-100")
                ]),
                dbc.CardBody([
                    render_export_toolbar(prefix="map-dl", default_preset="double_col"),
                    html.Div([
                        dcc.Graph(
                            id='map-graph',
                            config={'displaylogo': False, 'responsive': True}
                        )
                    ], id='map-graph-wrapper', className="graph-preview-container")
                ])
            ])
        ], width=12)
    ]),
    
    html.Div(id='map-dl-dummy-output', style={'display': 'none'})
], className="py-2")

# Publication Preset Callback for Maps
@callback(
    Output('map-dl-width', 'value'),
    Output('map-dl-height', 'value'),
    Input('map-dl-preset', 'value'),
    prevent_initial_call=True
)
def apply_map_preset(preset_key):
    from components.export_toolbar import PUBLICATION_PRESETS
    if preset_key not in PUBLICATION_PRESETS or preset_key == 'custom':
        return dash.no_update, dash.no_update
    p = PUBLICATION_PRESETS[preset_key]
    return p['width'], p['height']

# Proportional Aspect Ratio Sizing & Badge Callback for Maps
@callback(
    Output('map-graph', 'style'),
    Output('map-graph-wrapper', 'style'),
    Output('map-viewport-ratio-badge', 'children'),
    Input('map-dl-width', 'value'),
    Input('map-dl-height', 'value')
)
def update_map_preview_size(w_cm, h_cm):
    if not w_cm or not h_cm or float(w_cm) <= 0 or float(h_cm) <= 0:
        w_cm, h_cm = 17.0, 11.0
    
    w_cm = float(w_cm)
    h_cm = float(h_cm)
    ratio = w_cm / h_cm
    
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
        'borderRadius': '8px',
        'overflow': 'hidden',
        'transition': 'all 0.25s ease'
    }
    
    return graph_style, wrapper_style, badge_txt

# Populate Projects Dropdown
@callback(
    Output('map-project-selector', 'options'),
    Input('map-project-selector', 'id')
)
def map_load_projects(_):
    projects = load_projects()
    return [{'label': k, 'value': k} for k in projects.keys()] if projects else []

# Populate Coordinate Columns based on selected Project
@callback(
    Output('map-lat-col', 'options'),
    Output('map-lon-col', 'options'),
    Output('map-val-col', 'options'),
    Output('map-hover-col', 'options'),
    Output('map-size-col', 'options'),
    Output('map-lat-col', 'value'),
    Output('map-lon-col', 'value'),
    Input('map-project-selector', 'value')
)
def map_populate_columns(proj):
    if not proj:
        return [], [], [], [], [], None, None
    cfg = load_projects().get(proj, {})
    if not cfg or 'file_path' not in cfg or not os.path.exists(cfg['file_path']):
        return [], [], [], [], [], None, None
        
    df = load_data_file(cfg['file_path'], sep=cfg.get('sep', ','), decimal=cfg.get('decimal', '.'))
    if df is None:
        return [], [], [], [], [], None, None
        
    cols = [{'label': c, 'value': c} for c in df.columns]
    
    # Auto-detect latitude and longitude columns
    def_lat, def_lon = None, None
    for c in df.columns:
        c_low = c.lower()
        if 'lat' in c_low and not def_lat:
            def_lat = c
        if ('lon' in c_low or 'lng' in c_low) and not def_lon:
            def_lon = c
            
    return cols, cols, cols, cols, cols, def_lat, def_lon

# Render Map Figure Callback
@callback(
    Output('map-graph', 'figure'),
    Input('map-lat-col', 'value'),
    Input('map-lon-col', 'value'),
    Input('map-val-col', 'value'),
    Input('map-hover-col', 'value'),
    Input('map-size-col', 'value'),
    Input('map-type', 'value'),
    Input('map-viz-mode', 'value'),
    Input('map-palette', 'value'),
    Input('map-point-size', 'value'),
    Input('map-point-opacity', 'value'),
    Input('map-dl-width', 'value'),
    Input('map-dl-height', 'value'),
    Input('map-custom-zoom', 'value'),
    Input('map-custom-lat', 'value'),
    Input('map-custom-lon', 'value'),
    State('map-project-selector', 'value')
)
def render_map_cb(lat_col, lon_col, val_col, hover_col, size_col, map_type, viz_mode, palette,
                  pt_size, pt_opac, w_cm, h_cm, c_zoom, c_lat, c_lon, proj):
    if not proj or not lat_col or not lon_col:
        return go.Figure()
        
    cfg = load_projects().get(proj, {})
    if not cfg or 'file_path' not in cfg or not os.path.exists(cfg['file_path']):
        return go.Figure()
        
    df = load_data_file(cfg['file_path'], sep=cfg.get('sep', ','), decimal=cfg.get('decimal', '.'))
    if df is None:
        return go.Figure()
        
    return build_map_figure(
        df=df,
        lat_col=lat_col,
        lon_col=lon_col,
        val_col=val_col,
        hover_col=hover_col,
        size_col=size_col,
        map_type=map_type or 'satellite',
        viz_mode=viz_mode or 'scatter',
        palette=palette or 'Viridis',
        point_size=int(pt_size or 10),
        point_opacity=float(pt_opac or 0.85),
        w_cm=w_cm or 17.0,
        h_cm=h_cm or 11.0,
        custom_zoom=int(c_zoom) if c_zoom else None,
        custom_lat=float(c_lat) if c_lat else None,
        custom_lon=float(c_lon) if c_lon else None
    )

# Clientside vector/raster export callback for Maps
dash.clientside_callback(
    """
    function(n_clicks, format, width_cm, height_cm, dpi, proj) {
        if (n_clicks) {
            const width_px = (width_cm / 2.54) * 96;
            const height_px = (height_cm / 2.54) * 96;
            const scale = (dpi || 300) / 96;
            const gd = document.getElementById('map-graph').querySelector('.js-plotly-plot') || document.getElementById('map-graph');
            const fname = (proj || 'ChartMate') + '_map_export';
            
            Plotly.downloadImage(gd, {
                format: format || 'png',
                width: width_px,
                height: height_px,
                scale: scale,
                filename: fname
            });
        }
        return window.dash_clientside.no_update;
    }
    """,
    Output('map-dl-dummy-output', 'children'),
    Input('map-dl-btn', 'n_clicks'),
    State('map-dl-format', 'value'),
    State('map-dl-width', 'value'),
    State('map-dl-height', 'value'),
    State('map-dl-dpi', 'value'),
    State('map-project-selector', 'value'),
    prevent_initial_call=True
)
