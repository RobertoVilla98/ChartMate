import dash
from dash import html, dcc
import dash_bootstrap_components as dbc
from typing import List, Dict, Any

# Scientific publication palette optimized for light backgrounds
DEFAULT_PALETTE = ['#059669', '#0284c7', '#d97706', '#6366f1', '#e11d48', '#0d9488', '#8b5cf6', '#ea580c']

def render_trace_controls(selected_traces: List[str], dom_state: Dict[str, Any], saved_state: Dict[str, Any]) -> html.Div:
    """
    Renders individual per-trace formatting controls (color picker, line styles, opacity, order, type override).
    """
    if not selected_traces:
        return html.Div("Select at least one variable on Y1, Y2, or Y3 to customize individual trace appearance.", className="text-muted small p-2")

    trace_rows = []
    for i, col in enumerate(selected_traces):
        default_c = DEFAULT_PALETTE[i % len(DEFAULT_PALETTE)]
        val_name = dom_state.get(col, {}).get('name') or saved_state.get(col, {}).get('name') or col
        val_color = dom_state.get(col, {}).get('color') or saved_state.get(col, {}).get('color') or default_c
        val_type = dom_state.get(col, {}).get('type') or saved_state.get(col, {}).get('type') or 'global'
        val_style = dom_state.get(col, {}).get('style') or saved_state.get(col, {}).get('style') or 'solid'
        
        val_width = dom_state.get(col, {}).get('width')
        if val_width is None:
            val_width = saved_state.get(col, {}).get('width', 2)
            
        val_opac = dom_state.get(col, {}).get('opacity')
        if val_opac is None:
            val_opac = saved_state.get(col, {}).get('opacity', 1.0)
            
        val_order = dom_state.get(col, {}).get('order') or saved_state.get(col, {}).get('order') or (i + 1)

        row = html.Div([
            dbc.Row(dbc.Col(html.Span([
                html.Span(f"#{i+1}", className="font-mono text-muted me-2 small"),
                html.Strong(col, className="font-mono text-dark", style={'fontSize': '0.88rem'})
            ])), className="mb-2"),
            
            dbc.Row([
                dbc.Col(html.Label("Name", className="small text-secondary mb-0"), width=1, className="pe-0"),
                dbc.Col(dbc.Input(type="text", id={'type': 'trace-name', 'index': col}, value=val_name, size="sm", className="font-mono"), width=3),
                
                dbc.Col(html.Label("Color", className="small text-secondary mb-0"), width=1, className="pe-0"),
                dbc.Col(dbc.Input(type="color", id={'type': 'trace-color', 'index': col}, value=val_color, size="sm", style={'height': '32px', 'padding': '2px'}), width=1),
                
                dbc.Col(html.Label("Type", className="small text-secondary mb-0"), width=1, className="pe-0"),
                dbc.Col(dcc.Dropdown(
                    id={'type': 'trace-chart-type', 'index': col},
                    options=[
                        {'label': 'Global', 'value': 'global'},
                        {'label': 'Line', 'value': 'line'},
                        {'label': 'Bar', 'value': 'bar'},
                        {'label': 'Scatter', 'value': 'scatter'},
                        {'label': 'Area', 'value': 'area'}
                    ],
                    value=val_type,
                    clearable=False,
                    className="small"
                ), width=2),
                
                dbc.Col(html.Label("Style", className="small text-secondary mb-0"), width=1, className="pe-0"),
                dbc.Col(dcc.Dropdown(
                    id={'type': 'trace-line-style', 'index': col},
                    options=[
                        {'label': 'Solid ──', 'value': 'solid'},
                        {'label': 'Dash - -', 'value': 'dash'},
                        {'label': 'Dot · ·', 'value': 'dot'},
                        {'label': 'Dash-Dot -·', 'value': 'dashdot'}
                    ],
                    value=val_style,
                    clearable=False,
                    className="small"
                ), width=2),
            ], className="mb-2 align-items-center"),
            
            dbc.Row([
                dbc.Col(html.Label("Width", className="small text-secondary mb-0"), width=1, className="pe-0"),
                dbc.Col(dbc.Input(type="number", id={'type': 'trace-thickness', 'index': col}, value=val_width, min=0, step=1, size="sm", className="font-mono text-center"), width=2),
                
                dbc.Col(html.Label("Opacity", className="small text-secondary mb-0"), width=1, className="pe-0"),
                dbc.Col(dbc.Input(type="number", id={'type': 'trace-opacity', 'index': col}, value=val_opac, min=0.0, max=1.0, step=0.1, size="sm", className="font-mono text-center"), width=2),
                
                dbc.Col(html.Label("Z-Order", className="small text-secondary mb-0"), width=1, className="pe-0"),
                dbc.Col(dbc.Input(type="number", id={'type': 'trace-order', 'index': col}, value=val_order, step=1, size="sm", className="font-mono text-center"), width=2),
            ], className="mb-2 align-items-center")
        ], style={'borderBottom': '1px solid #e2e8f0', 'paddingBottom': '8px', 'marginBottom': '8px'} if i < len(selected_traces)-1 else {})
        trace_rows.append(row)

    return html.Div(trace_rows)
