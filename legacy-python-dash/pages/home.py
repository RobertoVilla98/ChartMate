import dash
from dash import html, dcc, Input, Output, State, callback, dash_table, ctx
import dash_bootstrap_components as dbc
import polars as pl
import os
import tkinter as tk
from tkinter import filedialog
from utils.storage import save_project, load_projects
from utils.data_handler import load_data_file, get_file_format

dash.register_page(__name__, path='/', name="Projects")

layout = html.Div([
    dbc.Row([
        # Left Column: Project Configuration
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    html.I(className="bi bi-sliders me-2 text-emerald"),
                    "Data Ingestion & Parameters"
                ]),
                dbc.CardBody([
                    html.Label("Dataset File Path", className="small fw-bold text-secondary mb-1"),
                    dbc.Row([
                        dbc.Col(dbc.Input(id='file-path', placeholder="Select CSV, Excel (.xlsx), Parquet (.parquet) or TSV...", type='text', className="mb-2 font-mono"), width=9),
                        dbc.Col(dbc.Button([html.I(className="bi bi-folder me-1"), "Browse"], id='browse-btn', outline=True, color="secondary", className="w-100"), width=3)
                    ]),
                    
                    html.Div(id='file-format-badge-container', className="mb-2"),
                    
                    dbc.Row([
                        dbc.Col([
                            html.Label("Col Separator", className="small fw-bold text-secondary mb-1"),
                            dbc.Input(id='csv-sep', value=',', type='text', className="mb-2 font-mono text-center"),
                        ], width=3, id='col-sep-col'),
                        dbc.Col([
                            html.Label("Dec Separator", className="small fw-bold text-secondary mb-1"),
                            dbc.Input(id='csv-decimal', value='.', type='text', className="mb-2 font-mono text-center"),
                        ], width=3, id='dec-sep-col'),
                        dbc.Col([
                            html.Label("Timestamp Column", className="small fw-bold text-secondary mb-1"),
                            dcc.Dropdown(id='csv-ts-col', placeholder="Auto or Select...", className="mb-2 small font-mono"),
                        ], width=6, id='ts-col-container'),
                    ]),
                    
                    html.Label("Timestamp Parsing Format", className="small fw-bold text-secondary mb-1"),
                    dbc.Input(id='csv-ts-format', placeholder="%Y-%m-%d %H:%M:%S (Leave empty to auto-detect)", type='text', className="mb-1 font-mono"),
                    dbc.FormText([
                        "Common formats: ",
                        html.Span("%Y-%m-%d %H:%M:%S", className="font-mono text-emerald me-2"),
                        html.Span("%d/%m/%Y", className="font-mono text-sky me-2"),
                        html.Span("%Y-%m-%d", className="font-mono text-amber")
                    ], color="muted", className="mb-3 d-block"),
                    
                    dbc.Button([
                        html.I(className="bi bi-table me-2"), "Preview & Verify Data"
                    ], id='preview-btn', color="primary", className="w-100 mt-2")
                ])
            ], className="mb-4")
        ], width=12, lg=5),
        
        # Right Column: Project Persistence & Selection
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    html.I(className="bi bi-save me-2 text-emerald"),
                    "Save / Register Project"
                ]),
                dbc.CardBody([
                    html.Label("Project Name", className="small fw-bold text-secondary mb-1"),
                    dbc.Row([
                        dbc.Col(dbc.Input(id='project-name', placeholder="e.g. Building_Sensors_A13", type='text', className="font-mono"), width=8),
                        dbc.Col(dbc.Button([html.I(className="bi bi-check-circle me-1"), "Save"], id='save-project-btn', color="success", className="w-100"), width=4)
                    ])
                ])
            ], className="mb-4"),
            
            dbc.Card([
                dbc.CardHeader([
                    html.I(className="bi bi-collection me-2 text-sky"),
                    "Registered Projects Library"
                ]),
                dbc.CardBody([
                    dcc.Dropdown(id='existing-projects-dropdown', placeholder="Select an existing project...", className="small"),
                    html.Div(id='project-details-container', className="mt-3")
                ])
            ])
        ], width=12, lg=7)
    ]),
    
    html.Hr(className="border-secondary my-4"),
    
    html.Div(id='data-preview-container'),
    
    # Overwrite Modal
    dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Overwrite Existing Project?")),
            dbc.ModalBody("A project with this name already exists in the library. Do you wish to overwrite its configuration?"),
            dbc.ModalFooter([
                dbc.Button("Cancel", id="cancel-overwrite", className="ms-auto", n_clicks=0, color="secondary"),
                dbc.Button("Confirm Overwrite", id="confirm-overwrite", color="danger", n_clicks=0),
            ]),
        ],
        id="overwrite-modal",
        is_open=False,
    ),
], className="py-2")

@callback(
    Output('file-path', 'value'),
    Input('browse-btn', 'n_clicks'),
    prevent_initial_call=True
)
def browse_file(n_clicks):
    if n_clicks:
        root = tk.Tk()
        root.attributes('-topmost', True)
        root.withdraw()
        file_path = filedialog.askopenfilename(
            title="Select Dataset File (CSV, Excel, Parquet, TSV)",
            filetypes=[
                ("All Supported Files (*.csv;*.xlsx;*.xls;*.parquet;*.tsv;*.txt)", "*.csv;*.xlsx;*.xls;*.parquet;*.tsv;*.txt"),
                ("CSV Files (*.csv)", "*.csv"),
                ("Excel Spreadsheets (*.xlsx;*.xls)", "*.xlsx;*.xls"),
                ("Parquet Binary (*.parquet)", "*.parquet"),
                ("TSV / Delimited (*.tsv;*.txt)", "*.tsv;*.txt"),
                ("All Files (*.*)", "*.*")
            ]
        )
        root.destroy()
        return file_path if file_path else dash.no_update
    return dash.no_update

@callback(
    Output('file-format-badge-container', 'children'),
    Input('file-path', 'value')
)
def update_file_badge(path):
    if not path:
        return ""
    fmt = get_file_format(path)
    if fmt == "parquet":
        return html.Span([html.I(className="bi bi-filetype-parquet me-1"), "PARQUET BINARY (Fast Columnar)"], className="velth-badge velth-badge-emerald")
    elif fmt == "excel":
        return html.Span([html.I(className="bi bi-filetype-xlsx me-1"), "EXCEL SPREADSHEET"], className="velth-badge velth-badge-sky")
    elif fmt == "tsv":
        return html.Span([html.I(className="bi bi-file-earmark-spreadsheet me-1"), "TSV (Tab-Separated)"], className="velth-badge velth-badge-amber")
    return html.Span([html.I(className="bi bi-filetype-csv me-1"), "CSV TEXT DATA"], className="velth-badge velth-badge-emerald")

@callback(
    Output('data-preview-container', 'children'),
    Output('csv-ts-col', 'options'),
    Input('preview-btn', 'n_clicks'),
    State('file-path', 'value'),
    State('csv-sep', 'value'),
    State('csv-decimal', 'value'),
    State('csv-ts-col', 'value'),
    State('csv-ts-format', 'value'),
    prevent_initial_call=True
)
def preview_data(n_clicks, path, sep, decimal, ts_col, ts_format):
    if not path:
        return dbc.Alert("Please select or enter a valid file path.", color="warning", className="rounded-3"), dash.no_update
    
    if not os.path.exists(path):
        return dbc.Alert(f"File not found: {path}", color="danger", className="rounded-3"), dash.no_update
    
    df = load_data_file(path, sep=sep, decimal=decimal, timestamp_col=ts_col, timestamp_format=ts_format)
    if df is not None:
        opts = [{'label': i, 'value': i} for i in df.columns]
        num_rows, num_cols = df.shape
        fmt = get_file_format(path).upper()
        
        return dbc.Card([
            dbc.CardHeader([
                html.Div([
                    html.Span([html.I(className="bi bi-file-earmark-bar-graph me-2 text-emerald"), f"{os.path.basename(path)}"]),
                    html.Span(f"{fmt} • {num_rows:,} rows × {num_cols} columns", className="velth-badge velth-badge-emerald ms-3")
                ], className="d-flex align-items-center justify-content-between w-100")
            ]),
            dbc.CardBody([
                dash_table.DataTable(
                    data=df.head(10).to_dicts(),
                    columns=[{'name': i, 'id': i} for i in df.columns],
                    page_size=10,
                    style_table={'overflowX': 'auto'},
                    style_header={
                        'backgroundColor': '#f8fafc',
                        'color': '#334155',
                        'fontWeight': '600',
                        'fontFamily': 'JetBrains Mono, monospace',
                        'border': '1px solid #e2e8f0'
                    },
                    style_cell={
                        'backgroundColor': '#ffffff',
                        'color': '#0f172a',
                        'fontFamily': 'JetBrains Mono, monospace',
                        'fontSize': '12px',
                        'border': '1px solid #e2e8f0',
                        'padding': '8px 12px'
                    }
                )
            ])
        ], className="mb-4"), opts
        
    return dbc.Alert("Error loading dataset. Please check separator, decimal symbol, or file integrity.", color="danger", className="rounded-3"), dash.no_update

@callback(
    Output('existing-projects-dropdown', 'options'),
    Input('existing-projects-dropdown', 'id')
)
def load_dropdown_options(_):
    projects = load_projects()
    return [{'label': k, 'value': k} for k in projects.keys()]

@callback(
    Output('file-path', 'value', allow_duplicate=True),
    Output('csv-sep', 'value', allow_duplicate=True),
    Output('csv-decimal', 'value', allow_duplicate=True),
    Output('csv-ts-col', 'value', allow_duplicate=True),
    Output('csv-ts-format', 'value', allow_duplicate=True),
    Output('project-name', 'value', allow_duplicate=True),
    Input('existing-projects-dropdown', 'value'),
    prevent_initial_call=True
)
def populate_from_existing(project_name):
    if not project_name:
        return dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update
        
    projects = load_projects()
    if project_name not in projects:
        return dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update, dash.no_update
        
    info = projects[project_name]
    return (
        info.get('file_path', ''),
        info.get('sep', ','),
        info.get('decimal', '.'),
        info.get('timestamp_col', ''),
        info.get('timestamp_format', ''),
        project_name
    )

@callback(
    Output('project-details-container', 'children'),
    Input('existing-projects-dropdown', 'value')
)
def show_project_details(project_name):
    if not project_name:
        return html.Div("Select a project to inspect its configuration and saved views.", className="text-muted small")
    
    projects = load_projects()
    if project_name not in projects:
        return html.Div("Project not found in library.", className="text-danger small")
    
    info = projects[project_name]
    fp = info.get('file_path', '')
    fmt = get_file_format(fp).upper()
    exists = os.path.exists(fp) if fp else False
    num_canvases = len(info.get('canvases', {}))
    num_multiplots = len(info.get('multiplots', {}))
    
    return dbc.Card([
        dbc.CardBody([
            html.Div([
                html.H5(project_name, className="mb-0 fw-bold text-dark font-sans"),
                html.Span(fmt, className="velth-badge velth-badge-emerald")
            ], className="d-flex justify-content-between align-items-center mb-2"),
            
            html.Div([
                html.I(className=f"bi {'bi-check-circle text-emerald' if exists else 'bi-exclamation-triangle text-amber'} me-1"),
                html.Span(fp, className="font-mono small text-secondary", style={'wordBreak': 'break-all'})
            ], className="mb-3 p-2 rounded bg-surface-elevated border border-subtle"),
            
            dbc.Row([
                dbc.Col([
                    html.Div("Separators", className="text-muted small"),
                    html.Div(f"Col: '{info.get('sep', ',')}' | Dec: '{info.get('decimal', '.')}'", className="font-mono small fw-bold text-dark")
                ], width=6),
                dbc.Col([
                    html.Div("Timestamp", className="text-muted small"),
                    html.Div(f"{info.get('timestamp_col') or 'None'}", className="font-mono small fw-bold text-dark")
                ], width=6),
            ], className="mb-2"),
            
            html.Hr(className="border-subtle my-2"),
            
            html.Div([
                html.Span([html.I(className="bi bi-graph-up me-1 text-emerald"), f"{num_canvases} Canvas(es)"], className="me-3 font-mono small text-secondary fw-semibold"),
                html.Span([html.I(className="bi bi-grid-1x2 me-1 text-sky"), f"{num_multiplots} MultiPlot(s)"], className="font-mono small text-secondary fw-semibold"),
            ], className="d-flex")
        ])
    ], className="border-subtle")

@callback(
    Output("overwrite-modal", "is_open"),
    Output('existing-projects-dropdown', 'options', allow_duplicate=True),
    Output('existing-projects-dropdown', 'value', allow_duplicate=True),
    Output('save-project-btn', 'color'),
    Input("save-project-btn", "n_clicks"),
    Input("confirm-overwrite", "n_clicks"),
    Input("cancel-overwrite", "n_clicks"),
    State("overwrite-modal", "is_open"),
    State('project-name', 'value'),
    State('file-path', 'value'),
    State('csv-sep', 'value'),
    State('csv-decimal', 'value'),
    State('csv-ts-col', 'value'),
    State('csv-ts-format', 'value'),
    prevent_initial_call=True
)
def handle_project_saving(save_clicks, confirm_clicks, cancel_clicks, is_open, project_name, path, sep, decimal, ts_col, ts_format):
    if not project_name or not path:
        return is_open, dash.no_update, dash.no_update, "primary"
        
    projects = load_projects()
    triggered_id = ctx.triggered_id
    
    if triggered_id == "save-project-btn":
        if project_name in projects:
            return True, dash.no_update, dash.no_update, "primary"
        else:
            save_project(project_name, path, sep=sep, decimal=decimal, timestamp_col=ts_col, timestamp_format=ts_format)
            updated_projects = load_projects()
            options = [{'label': k, 'value': k} for k in updated_projects.keys()]
            return is_open, options, project_name, "success"
            
    elif triggered_id == "confirm-overwrite":
        save_project(project_name, path, sep=sep, decimal=decimal, timestamp_col=ts_col, timestamp_format=ts_format)
        updated_projects = load_projects()
        options = [{'label': k, 'value': k} for k in updated_projects.keys()]
        return False, options, project_name, "success"
        
    elif triggered_id == "cancel-overwrite":
        return False, dash.no_update, dash.no_update, "primary"
        
    return is_open, dash.no_update, dash.no_update, "primary"
