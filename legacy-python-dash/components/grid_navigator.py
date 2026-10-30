from dash import html, dcc
import dash_bootstrap_components as dbc
from typing import Dict, List, Any, Tuple

# Topology Presets for Academic Subplots
TOPOLOGY_PRESETS = {
    'stack_3x1': {
        'label': '📊 Vertical Stack 3×1 (IEQ / Time-Series)',
        'rows': 3,
        'cols': 1,
        'shared': ['x'],
        'w_cm': 17.0,
        'h_cm': 18.0
    },
    'stack_2x1': {
        'label': '📊 Vertical Stack 2×1 (Dual Time-Series)',
        'rows': 2,
        'cols': 1,
        'shared': ['x'],
        'w_cm': 17.0,
        'h_cm': 12.0
    },
    'grid_2x2': {
        'label': '🔲 Matrix Grid 2×2 (4 Quadrants)',
        'rows': 2,
        'cols': 2,
        'shared': ['x', 'y'],
        'w_cm': 18.0,
        'h_cm': 14.0
    },
    'side_1x2': {
        'label': '↔️ Side-by-Side 1×2 (Dual Column)',
        'rows': 1,
        'cols': 2,
        'shared': ['y'],
        'w_cm': 18.0,
        'h_cm': 8.0
    },
    'custom': {
        'label': '⚙️ Custom Matrix Topology',
        'rows': 2,
        'cols': 2,
        'shared': [],
        'w_cm': 17.0,
        'h_cm': 12.0
    }
}

LETTERS = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)', '(h)', '(i)', '(j)', '(k)', '(l)', '(m)', '(n)', '(o)', '(p)']

def build_grid_navigator(
    rows: int,
    cols: int,
    cell_x: Dict[str, Any],
    cell_y: Dict[str, Any],
    cell_settings: Dict[str, Any],
    col_opts: List[Dict[str, str]],
    ts_col: str = None,
    use_lettering: bool = True
) -> Tuple[html.Div, dbc.Table]:
    """
    Builds the interactive visual grid matrix boxes with tooltips and the cell mapping table with academic lettering.
    """
    try:
        r, c = int(rows), int(cols)
    except Exception:
        r, c = 2, 2
        
    table_header = [
        html.Thead(html.Tr([
            html.Th("Panel", className="small text-center", style={"width": "12%"}),
            html.Th("X-Axis Variable", className="small", style={"width": "34%"}),
            html.Th("Y-Axes Variables", className="small", style={"width": "46%"}),
            html.Th("", style={"width": "8%"})
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
            letter = LETTERS[idx] if idx < len(LETTERS) and use_lettering else f"[{i+1},{j+1}]"
            
            assigned_y = cell_y.get(idx_str, [])
            box_class = "border border-subtle d-flex align-items-center justify-content-center m-1 shadow-sm bg-surface-elevated text-muted font-mono"
            if assigned_y:
                box_class = "border border-accent d-flex align-items-center justify-content-center m-1 shadow-sm bg-emerald text-white font-mono fw-bold"
                nav_tooltips.append(dbc.Tooltip(
                    f"{letter}: " + ", ".join(assigned_y),
                    target={'type': 'mp-nav-box', 'index': idx},
                    placement="top"
                ))
            
            nav_box = html.Div(
                letter.replace('(', '').replace(')', ''),
                id={'type': 'mp-nav-box', 'index': idx},
                className=box_class,
                style={'width': '36px', 'height': '36px', 'fontSize': '12px', 'cursor': 'pointer', 'borderRadius': '6px'}
            )
            nav_row.append(nav_box)
            
            idx_settings = cell_settings.get(idx_str, {})
            row = html.Tr([
                html.Td(
                    html.Span([
                        html.Strong(letter, className="text-emerald me-1"),
                        html.Span(f"[{i+1},{j+1}]", className="text-muted small")
                    ]),
                    className="small align-middle text-center font-mono"
                ),
                html.Td(dcc.Dropdown(
                    id={'type': 'mp-cell-x', 'index': idx},
                    options=col_opts,
                    value=cell_x.get(idx_str, ts_col),
                    className="small font-mono",
                    clearable=True
                )),
                html.Td(dcc.Dropdown(
                    id={'type': 'mp-cell-y', 'index': idx},
                    options=col_opts,
                    value=cell_y.get(idx_str, []),
                    multi=True,
                    className="small font-mono"
                )),
                html.Td([
                    dbc.Button(html.I(className="bi bi-gear-fill"), id={'type': 'mp-gear-btn', 'index': idx}, color="link", size="sm", className="text-secondary p-0"),
                    dbc.Popover([
                        dbc.PopoverHeader(f"Panel {letter} Settings"),
                        dbc.PopoverBody([
                            html.Label("Subplot Title / Descriptor", className="small fw-bold text-secondary mb-1"),
                            dbc.Input(id={'type': 'mp-cell-title', 'index': idx}, placeholder="e.g. Indoor Temp [°C]...", size="sm", className="mb-2 font-mono", value=idx_settings.get('title')),
                            
                            html.Label("Y-Axis Unit / Label", className="small fw-bold text-secondary mb-1"),
                            dbc.Input(id={'type': 'mp-cell-ylabel', 'index': idx}, placeholder="e.g. Temperature [°C]...", size="sm", className="mb-2 font-mono", value=idx_settings.get('ylabel')),
                            
                            html.Label("Subplot Chart Type", className="small fw-bold text-secondary mb-1"),
                            dcc.Dropdown(
                                id={'type': 'mp-cell-ctype', 'index': idx},
                                options=[
                                    {'label':'Inherit Global','value':'global'},
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
                                label="Show Panel Legend",
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
    config_table = dbc.Table(table_header + table_body, bordered=True, hover=True, responsive=True, size="sm", className="mb-0 bg-surface")
    
    return html.Div(nav_grid + nav_tooltips, className="w-100"), config_table
