from dash import html, dcc
import dash_bootstrap_components as dbc

def render_annotation_accordion() -> dbc.AccordionItem:
    """
    Renders the Smart Labelling & Scientific Annotations Accordion for Canvas.
    Includes:
    - Peak & Valley Tracker (Global Max/Min & Daily Extrema)
    - Threshold Lines & Target Comfort Bands
    - Statistical Reference Lines (Mean, Median, Linear Trendline with R²)
    - Time-window Event Shading
    """
    return dbc.AccordionItem([
        # Section 1: Peak & Valley Extrema Tracker
        html.Div([
            html.Div([
                html.I(className="bi bi-geo-alt-fill me-2 text-emerald"),
                html.Strong("Peak & Valley Extrema Tracker", className="font-sans text-dark")
            ], className="d-flex align-items-center mb-2"),
            
            dbc.Row([
                dbc.Col([
                    html.Label("Extrema Detection Mode", className="small fw-bold text-secondary mb-1"),
                    dcc.Dropdown(
                        id='extrema-mode',
                        options=[
                            {'label': 'Disabled (None)', 'value': 'none'},
                            {'label': '📍 Global Max & Min (Timeframe Peak)', 'value': 'global'},
                            {'label': '📅 Daily Extrema (Max & Min Per Day)', 'value': 'daily'},
                            {'label': '⭐ Top 3 Peaks & Valleys', 'value': 'top3'}
                        ],
                        value='none',
                        clearable=False,
                        className="small"
                    )
                ], xs=12, md=4),
                
                dbc.Col([
                    html.Label("Highlight Type", className="small fw-bold text-secondary mb-1"),
                    dcc.Dropdown(
                        id='extrema-type',
                        options=[
                            {'label': '🔺 Maxima (Peaks Only)', 'value': 'max'},
                            {'label': '🔻 Minima (Valleys Only)', 'value': 'min'},
                            {'label': '🔺🔻 Both Peaks & Valleys', 'value': 'both'}
                        ],
                        value='both',
                        clearable=False,
                        className="small"
                    )
                ], xs=6, md=4),
                
                dbc.Col([
                    html.Label("Badge Details", className="small fw-bold text-secondary mb-1"),
                    dcc.Dropdown(
                        id='extrema-badge-format',
                        options=[
                            {'label': 'Value & Timestamp', 'value': 'full'},
                            {'label': 'Value Only', 'value': 'value_only'},
                            {'label': 'Marker Only (Clean Pin)', 'value': 'marker_only'}
                        ],
                        value='full',
                        clearable=False,
                        className="small"
                    )
                ], xs=6, md=4),
            ], className="mb-3"),
        ], className="p-2 rounded bg-surface-elevated border border-subtle mb-3"),
        
        # Section 2: Threshold Lines & Target Bands
        html.Div([
            html.Div([
                html.I(className="bi bi-distribute-horizontal me-2 text-sky"),
                html.Strong("Threshold Reference Lines & Comfort Bands", className="font-sans text-dark")
            ], className="d-flex align-items-center mb-2"),
            
            dbc.Row([
                # Threshold Line 1
                dbc.Col([
                    html.Label("Threshold Line 1", className="small fw-bold text-secondary mb-1"),
                    dbc.Row([
                        dbc.Col(dbc.Input(id='thresh1-val', type='number', placeholder="Val (e.g. 1000)", size="sm", className="font-mono text-center"), width=5, className="pe-1"),
                        dbc.Col(dbc.Input(id='thresh1-lbl', type='text', placeholder="Label (e.g. Limit)", size="sm", className="font-mono"), width=7, className="ps-1"),
                    ]),
                ], xs=12, md=6),
                
                # Threshold Line 2
                dbc.Col([
                    html.Label("Threshold Line 2", className="small fw-bold text-secondary mb-1"),
                    dbc.Row([
                        dbc.Col(dbc.Input(id='thresh2-val', type='number', placeholder="Val (e.g. 0)", size="sm", className="font-mono text-center"), width=5, className="pe-1"),
                        dbc.Col(dbc.Input(id='thresh2-lbl', type='text', placeholder="Label (e.g. Freeze)", size="sm", className="font-mono"), width=7, className="ps-1"),
                    ]),
                ], xs=12, md=6),
            ], className="mb-2"),
            
            # Target Shaded Band
            dbc.Row([
                dbc.Col([
                    html.Label("Shaded Target Range (Min — Max)", className="small fw-bold text-secondary mb-1"),
                    dbc.Row([
                        dbc.Col(dbc.Input(id='band-min', type='number', placeholder="Min (e.g. 20)", size="sm", className="font-mono text-center"), width=3, className="pe-1"),
                        dbc.Col(dbc.Input(id='band-max', type='number', placeholder="Max (e.g. 26)", size="sm", className="font-mono text-center"), width=3, className="px-1"),
                        dbc.Col(dbc.Input(id='band-lbl', type='text', placeholder="Band Label (e.g. Comfort Zone)", size="sm", className="font-mono"), width=6, className="ps-1"),
                    ])
                ], xs=12, md=8),
                dbc.Col([
                    html.Label("Band Color", className="small fw-bold text-secondary mb-1"),
                    dcc.Dropdown(
                        id='band-color',
                        options=[
                            {'label': '🟢 Emerald Tint', 'value': 'rgba(16, 185, 129, 0.12)'},
                            {'label': '🔵 Sky Blue Tint', 'value': 'rgba(2, 132, 199, 0.12)'},
                            {'label': '🟡 Amber Tint', 'value': 'rgba(217, 119, 6, 0.12)'},
                            {'label': '⚪ Neutral Gray', 'value': 'rgba(100, 116, 139, 0.12)'}
                        ],
                        value='rgba(16, 185, 129, 0.12)',
                        clearable=False,
                        className="small"
                    )
                ], xs=12, md=4)
            ])
        ], className="p-2 rounded bg-surface-elevated border border-subtle mb-3"),
        
        # Section 3: Statistical Metrics & Trendline
        html.Div([
            html.Div([
                html.I(className="bi bi-calculator me-2 text-amber"),
                html.Strong("Statistical References & Trendline (OLS)", className="font-sans text-dark")
            ], className="d-flex align-items-center mb-2"),
            
            dbc.Row([
                dbc.Col([
                    dbc.Checklist(
                        id='stats-switches',
                        options=[
                            {"label": "  Mean Reference Line (μ)", "value": "mean"},
                            {"label": "  Median Reference Line (M)", "value": "median"},
                            {"label": "  Linear Trendline (OLS) + Formula & R²", "value": "trendline"},
                        ],
                        value=[],
                        inline=True,
                        switch=True,
                        className="small font-mono fw-semibold"
                    )
                ], width=12)
            ])
        ], className="p-2 rounded bg-surface-elevated border border-subtle mb-3"),
        
        # Section 4: Event & Time-Window Highlighting
        html.Div([
            html.Div([
                html.I(className="bi bi-calendar-event me-2 text-secondary"),
                html.Strong("Event / Time-Window Shaded Band", className="font-sans text-dark")
            ], className="d-flex align-items-center mb-2"),
            
            dbc.Row([
                dbc.Col([
                    html.Label("Event Start Date", className="small fw-bold text-secondary mb-1"), html.Br(),
                    dcc.DatePickerSingle(id='event-start-date', display_format='YYYY-MM-DD', className="font-mono")
                ], xs=6, md=3),
                dbc.Col([
                    html.Label("Event End Date", className="small fw-bold text-secondary mb-1"), html.Br(),
                    dcc.DatePickerSingle(id='event-end-date', display_format='YYYY-MM-DD', className="font-mono")
                ], xs=6, md=3),
                dbc.Col([
                    html.Label("Event Label", className="small fw-bold text-secondary mb-1"),
                    dbc.Input(id='event-label', type='text', placeholder="e.g. Heatwave / Fault Period...", size="sm", className="font-mono mt-1")
                ], xs=12, md=6)
            ])
        ], className="p-2 rounded bg-surface-elevated border border-subtle")
    ], title="🏷️ Smart Labelling & Scientific Annotations (Peaks, Daily Extrema, Limits, Stats)", item_id="smart-annotations-item")
