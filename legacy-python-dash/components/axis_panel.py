from dash import html, dcc
import dash_bootstrap_components as dbc
from typing import List

def render_global_controls(cols: List[str], default_x: str, y: List[str], y2: List[str], y3: List[str]) -> html.Div:
    """
    Renders top variables, chart type, legend position, scientific fonts and sizes.
    """
    return html.Div([
        # Row 1: Axes Variables (X, Y1, Y2, Y3)
        dbc.Row([
            dbc.Col([
                html.Label("X-Axis Variable", className="small fw-bold text-secondary mb-1"),
                dcc.Dropdown(id='x-axis', options=[{'label': i, 'value': i} for i in cols], value=default_x, className="small font-mono")
            ], xs=12, md=3),
            dbc.Col([
                html.Label("Y1-Axis (Primary)", className="small fw-bold text-emerald mb-1"),
                dcc.Dropdown(id='y-axis', options=[{'label': i, 'value': i} for i in cols], value=y, multi=True, className="small font-mono")
            ], xs=12, md=3),
            dbc.Col([
                html.Label("Y2-Axis (Secondary)", className="small fw-bold text-sky mb-1"),
                dcc.Dropdown(id='secondary-y-axis', options=[{'label': i, 'value': i} for i in cols], value=y2, multi=True, className="small font-mono")
            ], xs=12, md=3),
            dbc.Col([
                html.Label("Y3-Axis (Tertiary)", className="small fw-bold text-amber mb-1"),
                dcc.Dropdown(id='tertiary-y-axis', options=[{'label': i, 'value': i} for i in cols], value=y3, multi=True, className="small font-mono")
            ], xs=12, md=3),
        ], className="mb-3"),
        
        # Row 2: Chart Type, Legend, Global Font & Gaps
        dbc.Row([
            dbc.Col([
                html.Label("Global Chart Type", className="small fw-bold text-secondary mb-1"),
                dcc.Dropdown(id='chart-type', options=[
                    {'label': '📈 Line (Continuous)', 'value': 'line'},
                    {'label': '⚬ Scatter (Markers Only)', 'value': 'scatter'},
                    {'label': '📊 Bar Chart', 'value': 'bar'},
                    {'label': '🌄 Area (Filled Below)', 'value': 'area'},
                    {'label': '📦 Box Plot (Distributions & Medians)', 'value': 'box'},
                    {'label': '🎻 Violin Plot (KDE Distributions)', 'value': 'violin'},
                    {'label': '📊 Grouped Bar (Mean ± σ Error Bars)', 'value': 'bar_error'},
                    {'label': '🔥 Correlation Matrix Heatmap', 'value': 'correlation'},
                    {'label': '📈 Histogram & Frequency (KDE)', 'value': 'histogram'},
                    {'label': '🕸️ Radar / Spider Plot (Multi-Metric)', 'value': 'radar'}
                ], value='line', className="small font-mono"),
            ], xs=6, md=3),
            dbc.Col([
                html.Label("Legend Position", className="small fw-bold text-secondary mb-1"),
                dcc.Dropdown(id='legend-pos', options=[
                    {'label': 'Top (Horizontal)', 'value': 'top'},
                    {'label': 'Right (Vertical)', 'value': 'right'},
                    {'label': 'Bottom (Horizontal)', 'value': 'bottom'},
                    {'label': 'Hidden (None)', 'value': 'none'}
                ], value='top', className="small"),
            ], xs=6, md=3),
            dbc.Col([
                html.Label("Scientific Font Family", className="small fw-bold text-secondary mb-1"),
                dcc.Dropdown(id='global-font', options=[
                    {'label': 'Outfit (Modern Clean)', 'value': 'Outfit'},
                    {'label': 'Times New Roman (Academic)', 'value': 'Times New Roman'},
                    {'label': 'Arial (Standard)', 'value': 'Arial'},
                    {'label': 'Roboto (Neutral)', 'value': 'Roboto'},
                    {'label': 'Courier New (Monospace)', 'value': 'Courier New'},
                    {'label': 'JetBrains Mono (Technical)', 'value': 'JetBrains Mono'},
                    {'label': 'Georgia (Serif)', 'value': 'Georgia'}
                ], value='Outfit', clearable=False, className="small"),
            ], xs=6, md=3),
            dbc.Col([
                html.Label("Data Gaps", className="small fw-bold text-secondary mb-1"), html.Br(),
                dbc.Checkbox(id='connect-gaps', label="Connect Null Gaps", value=False, className="small mt-1")
            ], xs=6, md=3)
        ], className="mb-3"),
        
        # Row 3: Font Sizes
        dbc.Row([
            dbc.Col([
                html.Label("Global Font Size", className="small fw-bold text-secondary mb-1"),
                dbc.Input(id='global-font-size', type='number', value=12, size="sm", className="font-mono text-center")
            ], xs=6, md=3),
            dbc.Col([
                html.Label("Legend Font Size", className="small fw-bold text-secondary mb-1"),
                dbc.Input(id='legend-font-size', type='number', value=11, size="sm", className="font-mono text-center")
            ], xs=6, md=3),
            dbc.Col([
                html.Label("Axis Title Size", className="small fw-bold text-secondary mb-1"),
                dbc.Input(id='axis-title-size', type='number', value=13, size="sm", className="font-mono text-center")
            ], xs=6, md=3),
            dbc.Col([
                html.Label("Axis Tick Size", className="small fw-bold text-secondary mb-1"),
                dbc.Input(id='axis-tick-size', type='number', value=11, size="sm", className="font-mono text-center")
            ], xs=6, md=3),
        ], className="mb-3"),
    ])

def render_axis_accordion() -> dbc.AccordionItem:
    """
    Renders the detailed configuration for axes (labels, switches, grids, min/max).
    """
    return dbc.AccordionItem([
        dbc.Row([
            dbc.Col(html.Strong("Axis", className="small text-secondary"), width=1),
            dbc.Col(html.Strong("Show", className="small text-secondary"), width=1, className="text-center"),
            dbc.Col(html.Strong("Custom Axis Label", className="small text-secondary"), width=4),
            dbc.Col(html.Strong("Grid", className="small text-secondary"), width=2, className="text-center"),
            dbc.Col(html.Strong("Min Limit", className="small text-secondary"), width=2),
            dbc.Col(html.Strong("Max Limit", className="small text-secondary"), width=2)
        ], className="mb-2 border-bottom border-subtle pb-1"),
        
        # X-Axis Row
        dbc.Row([
            dbc.Col(html.Label("X", className="small fw-bold pt-1 text-dark"), width=1),
            dbc.Col(dbc.Checklist(options=[{"label": "", "value": "1"}], value=["1"], id="show-x-label", switch=True), width=1, className="d-flex justify-content-center"),
            dbc.Col(dbc.Input(id='x-axis-label', placeholder="Auto: Column Name", size="sm", className="font-mono"), width=4),
            dbc.Col(dbc.Checklist(options=[{"label": "", "value": "x"}], value=["x"], id="grid-x-switch", switch=True), width=2, className="d-flex justify-content-center"),
            dbc.Col(dbc.Input(id='x-axis-min', placeholder="Auto", size="sm", type="number", className="font-mono text-center"), width=2),
            dbc.Col(dbc.Input(id='x-axis-max', placeholder="Auto", size="sm", type="number", className="font-mono text-center"), width=2),
        ], className="mb-2 align-items-center"),
        
        # Y1-Axis Row
        dbc.Row([
            dbc.Col(html.Label("Y1", className="small fw-bold pt-1 text-emerald", title="Primary Y Axis"), width=1),
            dbc.Col(dbc.Checklist(options=[{"label": "", "value": "1"}], value=["1"], id="show-y-label", switch=True), width=1, className="d-flex justify-content-center"),
            dbc.Col(dbc.Input(id='y-axis-label', placeholder="Primary Axis Label", size="sm", className="font-mono"), width=4),
            dbc.Col(dbc.Checklist(options=[{"label": "", "value": "y"}], value=["y"], id="grid-y-switch", switch=True), width=2, className="d-flex justify-content-center"),
            dbc.Col(dbc.Input(id='y-axis-min', placeholder="Auto", size="sm", type="number", className="font-mono text-center"), width=2),
            dbc.Col(dbc.Input(id='y-axis-max', placeholder="Auto", size="sm", type="number", className="font-mono text-center"), width=2),
        ], className="mb-2 align-items-center"),
        
        # Y2-Axis Row
        dbc.Row([
            dbc.Col(html.Label("Y2", className="small fw-bold pt-1 text-sky", title="Secondary Y Axis"), width=1),
            dbc.Col(dbc.Checklist(options=[{"label": "", "value": "1"}], value=["1"], id="show-y2-label", switch=True), width=1, className="d-flex justify-content-center"),
            dbc.Col(dbc.Input(id='y2-axis-label', placeholder="Secondary Axis Label", size="sm", className="font-mono"), width=4),
            dbc.Col(dbc.Checklist(options=[{"label": "", "value": "y2"}], value=[], id="grid-y2-switch", switch=True), width=2, className="d-flex justify-content-center"),
            dbc.Col(dbc.Input(id='y2-axis-min', placeholder="Auto", size="sm", type="number", className="font-mono text-center"), width=2),
            dbc.Col(dbc.Input(id='y2-axis-max', placeholder="Auto", size="sm", type="number", className="font-mono text-center"), width=2),
        ], className="mb-2 align-items-center"),
        
        # Y3-Axis Row
        dbc.Row([
            dbc.Col(html.Label("Y3", className="small fw-bold pt-1 text-amber", title="Tertiary Y Axis"), width=1),
            dbc.Col(dbc.Checklist(options=[{"label": "", "value": "1"}], value=["1"], id="show-y3-label", switch=True), width=1, className="d-flex justify-content-center"),
            dbc.Col(dbc.Input(id='y3-axis-label', placeholder="Tertiary Axis Label", size="sm", className="font-mono"), width=4),
            dbc.Col(dbc.Checklist(options=[{"label": "", "value": "y3"}], value=[], id="grid-y3-switch", switch=True), width=2, className="d-flex justify-content-center"),
            dbc.Col(dbc.Input(id='y3-axis-min', placeholder="Auto", size="sm", type="number", className="font-mono text-center"), width=2),
            dbc.Col(dbc.Input(id='y3-axis-max', placeholder="Auto", size="sm", type="number", className="font-mono text-center"), width=2),
        ], className="mb-2 align-items-center"),
        
        html.Div(id='grid-switches', style={'display': 'none'})
    ], title="Detailed Axes Configuration (Labels, Grids, Min/Max Limits)")

def render_timeframe_accordion() -> dbc.AccordionItem:
    """
    Renders temporal filtering and timeframe presets.
    """
    return dbc.AccordionItem([
        dbc.Row([
            dbc.Col([
                html.Label("Timeframe Preset", className="small fw-bold text-secondary mb-1"),
                dcc.Dropdown(id='timeframe-dropdown', options=[
                    {'label': 'All Time (Full Dataset)', 'value': 'all_time'},
                    {'label': 'Daily (24 Hours)', 'value': 'daily'},
                    {'label': 'Weekly (7 Days)', 'value': 'weekly'}, 
                    {'label': 'Monthly (1 Month)', 'value': 'monthly'},
                    {'label': 'Yearly (1 Year)', 'value': 'yearly'},
                    {'label': 'Custom Date Range', 'value': 'custom'}
                ], value='all_time', className="small")
            ], xs=12, md=6),
            dbc.Col([
                html.Div(id='reference-date-div', children=[
                    html.Label("Reference Anchor Date", className="small fw-bold text-secondary mb-1"), html.Br(),
                    dcc.DatePickerSingle(id='reference-date-picker', display_format='YYYY-MM-DD', first_day_of_week=1, className="font-mono")
                ])
            ], xs=12, md=6)
        ]),
        html.Div(id='date-picker-div', children=[
            html.Label("Custom Start / End Range", className="small fw-bold text-secondary mt-2 mb-1"), html.Br(),
            dcc.DatePickerRange(id='date-picker-range', display_format='YYYY-MM-DD', first_day_of_week=1, className="font-mono")
        ], style={'display': 'none'})
    ], title="Timeframe & Temporal Filtering")
