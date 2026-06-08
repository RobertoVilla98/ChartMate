import dash
from dash import html, dcc, Input, Output, State, callback, dash_table, ctx
import dash_bootstrap_components as dbc
import polars as pl
import os
import tkinter as tk
from tkinter import filedialog
from utils.storage import save_project, load_projects
from utils.data_handler import load_csv_data, get_data_preview

dash.register_page(__name__, path='/')

layout = html.Div([
    dbc.Row([
        dbc.Col([
            dbc.Card([
                dbc.CardHeader("Configure Project"),
                dbc.CardBody([
                    dbc.Label("Absolute File Path"),
                    dbc.Row([
                        dbc.Col(dbc.Input(id='file-path', placeholder="C:/paths/to/your/file.csv", type='text', className="mb-2"), width=9),
                        dbc.Col(dbc.Button("Browse...", id='browse-btn', outline=True, color="secondary", className="w-100"), width=3)
                    ]),
                    
                    dbc.Row([
                        dbc.Col([
                            dbc.Label("Col Sep"),
                            dbc.Input(id='csv-sep', value=',', type='text', className="mb-2"),
                        ], width=3),
                        dbc.Col([
                            dbc.Label("Dec Sep"),
                            dbc.Input(id='csv-decimal', value='.', type='text', className="mb-2"),
                        ], width=3),
                        dbc.Col([
                            dbc.Label("Timestamp Col"),
                            dcc.Dropdown(id='csv-ts-col', placeholder="Optional", className="mb-2"),
                        ], width=6),
                    ]),
                    
                    dbc.Label("Timestamp Format"),
                    dbc.Input(id='csv-ts-format', placeholder="%Y-%m-%d %H:%M:%S", type='text', className="mb-1"),
                    dbc.FormText([
                        "Common formats (leave empty to auto-detect):",
                        html.Ul([
                            html.Li(["%Y-%m-%d for Year-Month-Day (e.g. 2023-01-31)"]),
                            html.Li(["%d/%m/%Y for Day/Month/Year (e.g. 31/01/2023)"]),
                            html.Li(["%H:%M:%S for Hour:Minute:Second (e.g. 14:30:00)"])
                        ], className="mb-0")
                    ], color="secondary", className="mb-3"),
                    
                    dbc.Button("Preview Data", id='preview-btn', color="info", className="w-100 mb-2")
                ])
            ], className="mb-4")
        ], width=5),
        
        dbc.Col([
            dbc.Card([
                dbc.CardHeader("Save Project"),
                dbc.CardBody([
                    dbc.Label("Project Name"),
                    dbc.Row([
                        dbc.Col(dbc.Input(id='project-name', placeholder="Project Alpha", type='text'), width=8),
                        dbc.Col(dbc.Button("Save Project", id='save-project-btn', color="primary", className="w-100"), width=4)
                    ])
                ])
            ], className="mb-4"),
            
            dbc.Card([
                dbc.CardHeader("Existing Projects"),
                dbc.CardBody([
                    dcc.Dropdown(id='existing-projects-dropdown', placeholder="Select a project..."),
                    html.Div(id='project-details-container', className="mt-3")
                ])
            ])
        ], width=7)
    ]),
    
    html.Hr(),
    
    html.Div(id='data-preview-container'),
    
    dbc.Modal(
        [
            dbc.ModalHeader(dbc.ModalTitle("Overwrite Project?")),
            dbc.ModalBody("A project with this name already exists. Do you want to overwrite it?"),
            dbc.ModalFooter([
                dbc.Button("Cancel", id="cancel-overwrite", className="ms-auto", n_clicks=0),
                dbc.Button("Overwrite", id="confirm-overwrite", color="danger", n_clicks=0),
            ]),
        ],
        id="overwrite-modal",
        is_open=False,
    ),
])

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
            title="Select CSV file",
            filetypes=[("CSV Files", "*.csv"), ("All Files", "*.*")]
        )
        root.destroy()
        return file_path if file_path else dash.no_update
    return dash.no_update

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
        return dbc.Alert("Please enter a file path.", color="warning"), dash.no_update
    
    if not os.path.exists(path):
        return dbc.Alert(f"File not found: {path}", color="danger"), dash.no_update
    
    df = load_csv_data(path, sep=sep, decimal=decimal, timestamp_col=ts_col, timestamp_format=ts_format)
    if df is not None:
        opts = [{'label': i, 'value': i} for i in df.columns]
        return html.Div([
            html.H5(f"Preview: {os.path.basename(path)}"),
            dash_table.DataTable(
                data=df.head(10).to_dicts(),
                columns=[{'name': i, 'id': i} for i in df.columns],
                page_size=10,
                style_table={'overflowX': 'auto'},
                style_header={'backgroundColor': '#343a40', 'color': 'white'}
            )
        ]), opts
    return dbc.Alert("Error loading data. Check separator or file format.", color="danger"), dash.no_update

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
        return "Select a project to view its details."
    
    projects = load_projects()
    if project_name not in projects:
        return "Project not found."
    
    info = projects[project_name]
    return dbc.Card([
        dbc.CardBody([
            html.H5(project_name, className="card-title"),
            html.H6(info['file_path'], className="card-subtitle mb-2 text-muted"),
            html.Ul([
                html.Li(f"Separator: '{info.get('sep', ',')}'"),
                html.Li(f"Decimal: '{info.get('decimal', '.')}'"),
                html.Li(f"Timestamp Column: {info.get('timestamp_col', 'None')}"),
                html.Li(f"Timestamp Format: {info.get('timestamp_format', 'None')}"),
                html.Li(f"Canvases: {len(info.get('canvases', {}))}")
            ])
        ])
    ])

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
