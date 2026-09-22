from dash import html, dcc
import dash_bootstrap_components as dbc

# Preset configurations mapping
PUBLICATION_PRESETS = {
    'single_col': {
        'label': '📄 Single Column (Journal 8.5 × 6.5 cm)',
        'width': 8.5,
        'height': 6.5,
        'fs_glob': 10,
        'fs_tit': 10,
        'fs_tick': 9,
        'fs_leg': 9
    },
    'double_col': {
        'label': '📑 Double Column (Journal 17.0 × 9.5 cm)',
        'width': 17.0,
        'height': 9.5,
        'fs_glob': 11,
        'fs_tit': 11,
        'fs_tick': 10,
        'fs_leg': 10
    },
    'square': {
        'label': '📊 Square Subplot (12.0 × 12.0 cm)',
        'width': 12.0,
        'height': 12.0,
        'fs_glob': 10,
        'fs_tit': 10,
        'fs_tick': 9,
        'fs_leg': 9
    },
    'presentation': {
        'label': '🖥️ Presentation 16:9 (24.0 × 13.5 cm)',
        'width': 24.0,
        'height': 13.5,
        'fs_glob': 14,
        'fs_tit': 15,
        'fs_tick': 13,
        'fs_leg': 13
    },
    'custom': {
        'label': '⚙️ Custom Dimensions',
        'width': 17.0,
        'height': 10.0,
        'fs_glob': 12,
        'fs_tit': 13,
        'fs_tick': 11,
        'fs_leg': 11
    }
}

def render_export_toolbar(prefix: str = "dl", default_preset: str = "double_col"):
    """
    Renders a unified Publication Preset and Export Toolbar in Velth Light theme.
    """
    preset_data = PUBLICATION_PRESETS.get(default_preset, PUBLICATION_PRESETS['double_col'])
    
    return dbc.Row([
        # Preset Selector
        dbc.Col([
            html.Label("Publication Preset", className="small fw-bold text-secondary mb-0"),
            dcc.Dropdown(
                id=f'{prefix}-preset',
                options=[
                    {'label': v['label'], 'value': k} for k, v in PUBLICATION_PRESETS.items()
                ],
                value=default_preset,
                clearable=False,
                className="small font-mono",
                style={'minWidth': '260px'}
            )
        ], xs=12, md=4, lg="auto"),
        
        # Export Format
        dbc.Col([
            html.Label("Export Format", className="small fw-bold text-secondary mb-0"),
            dbc.Select(
                id=f'{prefix}-format',
                options=[
                    {'label': 'SVG (Vector Scalable)', 'value': 'svg'},
                    {'label': 'PDF (Vector Document)', 'value': 'pdf'},
                    {'label': 'PNG (Hi-Res Raster)', 'value': 'png'},
                    {'label': 'JPEG (Standard)', 'value': 'jpeg'}
                ],
                value='svg',
                size="sm",
                className="font-mono",
                style={'minWidth': '150px'}
            )
        ], xs=6, md=2, lg="auto"),
        
        # Width (cm)
        dbc.Col([
            html.Label("Width (cm)", className="small fw-bold text-secondary mb-0"),
            dbc.Input(
                id=f'{prefix}-width',
                type='number',
                value=preset_data['width'],
                step=0.5,
                size="sm",
                style={'width': '85px'},
                className="font-mono text-center"
            )
        ], xs=3, md=2, lg="auto"),
        
        # Height (cm)
        dbc.Col([
            html.Label("Height (cm)", className="small fw-bold text-secondary mb-0"),
            dbc.Input(
                id=f'{prefix}-height',
                type='number',
                value=preset_data['height'],
                step=0.5,
                size="sm",
                style={'width': '85px'},
                className="font-mono text-center"
            )
        ], xs=3, md=2, lg="auto"),
        
        # Print DPI
        dbc.Col([
            html.Label("Print DPI", className="small fw-bold text-secondary mb-0"),
            dbc.Select(
                id=f'{prefix}-dpi',
                options=[
                    {'label': '96 DPI (Web Draft)', 'value': 96},
                    {'label': '150 DPI (Draft)', 'value': 150},
                    {'label': '300 DPI (Journal Standard)', 'value': 300},
                    {'label': '600 DPI (Ultra Sharp)', 'value': 600}
                ],
                value=300,
                size="sm",
                style={'minWidth': '150px'},
                className="font-mono"
            )
        ], xs=6, md=2, lg="auto"),
        
        # Export Button
        dbc.Col([
            html.Label("\u00a0", className="d-block small mb-0"),
            dbc.Button([
                html.I(className="bi bi-download me-1"), "Export Vector / Hi-Res"
            ], id=f'{prefix}-btn', color="success", size="sm", className="ms-auto w-100")
        ], xs=12, md=12, lg="auto", className="ms-lg-auto mt-2 mt-lg-0")
    ], className="align-items-end mb-3 p-2 rounded bg-surface-elevated border border-subtle")


def render_viewport_controls(prefix: str = "viewport"):
    """
    Renders clean header information for the true proportional preview.
    """
    return html.Div([
        html.Span(id=f'{prefix}-ratio-badge', className="velth-badge velth-badge-emerald font-mono small")
    ], className="d-flex align-items-center")
