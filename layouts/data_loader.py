# layouts/data_loader.py
import base64
import io
import pandas as pd
from dash import dcc, html, dash_table, callback, Input, Output, State
import dash_bootstrap_components as dbc
from utils.project_manager import load_projects, save_projects

# Layout della pagina di caricamento
layout = dbc.Container([
    dbc.Row(dbc.Col(html.H1("Project and Data Loader"), width=12), className="mt-4"),

    # Sezione Gestione Progetti
    dbc.Row([
        dbc.Col([
            dbc.Label("Select an Existing Project"),
            dcc.Dropdown(id='project-dropdown', placeholder="Select a project...")
        ], md=6),
        dbc.Col([
            dbc.Label("Or Create a New Project Name"),
            dbc.Input(id='project-name-input', type='text', placeholder='Enter new project name...')
        ], md=6),
    ], className="mt-4"),

    # Sezione Caricamento File e Impostazioni
    dbc.Row([
        dbc.Col([
            dbc.Label("Upload Data File"),
            dcc.Upload(
                id='upload-data',
                children=html.Div(['Drag and Drop or ', html.A('Select Files')]),
                style={
                    'width': '100%', 'height': '60px', 'lineHeight': '60px',
                    'borderWidth': '1px', 'borderStyle': 'dashed',
                    'borderRadius': '5px', 'textAlign': 'center', 'margin': '10px 0'
                },
                multiple=False
            ),
        ], md=12)
    ], className="mt-4"),

    dbc.Row([
        dbc.Col([
            dbc.Label("Column Separator"),
            dcc.Input(id='separator-input', value=',', type='text', style={'width': '100%'})
        ], md=6),
        dbc.Col([
            dbc.Label("Decimal Separator"),
            dcc.Input(id='decimal-input', value='.', type='text', style={'width': '100%'})
        ], md=6),
    ], className="mt-2"),

    # Sezione Anteprima e Azioni
    dbc.Row(dbc.Col(html.H4("Data Preview"), width=12), className="mt-5"),
    dbc.Row(dbc.Col(id='output-data-upload', children=[
        dash_table.DataTable(id='preview-table')
    ]), className="mt-2"),

    dbc.Row([
        dbc.Col([
            dbc.Button("Save Project Settings", id="save-project-btn", color="primary", className="me-2"),
            dbc.Button("Go to Plotter ->", id="goto-plotter-btn", color="success", href="/plot", disabled=True)
        ], className="mt-4 text-end"),
    ]),
    
    dbc.Row(dbc.Col(html.Div(id='save-status-output'), width=12), className="mt-2")
])

def register_data_loader_callbacks(app):
    
    # Callback per popolare il dropdown dei progetti all'avvio
    @app.callback(
        Output('project-dropdown', 'options'),
        Input('url', 'pathname') # Si attiva quando la pagina viene caricata
    )
    def update_project_dropdown(pathname):
        if pathname == '/':
            projects = load_projects()
            return [{'label': name, 'value': name} for name in projects.keys()]
        return []

    # Callback per caricare le impostazioni di un progetto selezionato
    @app.callback(
        [Output('project-name-input', 'value'),
         Output('separator-input', 'value'),
         Output('decimal-input', 'value')],
        Input('project-dropdown', 'value'),
        prevent_initial_call=True
    )
    def load_project_settings(project_name):
        if not project_name:
            return "", ",", "."
        projects = load_projects()
        project_config = projects.get(project_name, {})
        file_settings = project_config.get('file_settings', {})
        return (
            project_name,
            file_settings.get('separator', ','),
            file_settings.get('decimal', '.')
        )
    
    # Callback per caricare e visualizzare il file
    @app.callback(
        [Output('preview-table', 'data'),
         Output('preview-table', 'columns'),
         Output('goto-plotter-btn', 'disabled'),
         Output('session-store', 'data')], # Salva il DF nello store
        Input('upload-data', 'contents'),
        State('upload-data', 'filename'),
        State('separator-input', 'value'),
        State('decimal-input', 'value'),
        prevent_initial_call=True
    )
    def update_output(contents, filename, separator, decimal):
        if contents is None:
            return [], [], True, None

        content_type, content_string = contents.split(',')
        decoded = base64.b64decode(content_string)
        
        try:
            df = pd.read_csv(
                io.StringIO(decoded.decode('utf-8')),
                sep=separator,
                decimal=decimal
            )
            
            # Trova la prima colonna di tipo data/ora e impostala come indice
            # Questo è un presupposto importante per la pagina di plotting
            for col in df.columns:
                try:
                    df[col] = pd.to_datetime(df[col])
                    df.set_index(col, inplace=True)
                    break # Esci dopo aver trovato e impostato la prima colonna data
                except (ValueError, TypeError):
                    continue
            
            # Se nessuna colonna è una data, il plotter non funzionerà bene
            if not isinstance(df.index, pd.DatetimeIndex):
                 # Potresti mostrare un errore qui
                 pass

            preview_data = df.head().to_dict('records')
            columns = [{"name": i, "id": i} for i in df.head().columns]
            
            # Salva l'intero dataframe e il nome del file nello store di sessione
            session_data = {
                'dataframe': df.to_json(date_format='iso', orient='split'),
                'filename': filename
            }
            return preview_data, columns, False, session_data
        except Exception as e:
            print(e)
            # Qui potresti mostrare un messaggio di errore all'utente
            return [], [], True, None

    # Callback per salvare il progetto
    @app.callback(
        [Output('save-status-output', 'children'),
         Output('project-dropdown', 'options', allow_duplicate=True)], # Aggiorna la lista
        Input('save-project-btn', 'n_clicks'),
        [State('project-name-input', 'value'),
         State('session-store', 'data'),
         State('separator-input', 'value'),
         State('decimal-input', 'value'),
         State('project-config-store', 'data')], # Prende anche le config del grafico
        prevent_initial_call=True
    )
    def save_project(n_clicks, name, session_data, separator, decimal, plot_config):
        if not name:
            return dbc.Alert("Project name cannot be empty!", color="danger"), dash.no_update
        if not session_data or 'filename' not in session_data:
            return dbc.Alert("Please upload a file first!", color="warning"), dash.no_update

        projects = load_projects()
        
        # Se esiste già, mantieni le impostazioni del grafico se non sono state cambiate
        if name not in projects:
            projects[name] = {}
            
        projects[name]['file_settings'] = {
            'filename': session_data['filename'],
            'separator': separator,
            'decimal': decimal
        }
        
        # Unisci le impostazioni del grafico (se presenti)
        projects[name]['plot_settings'] = plot_config or projects[name].get('plot_settings', {})
        
        save_projects(projects)
        
        new_options = [{'label': pname, 'value': pname} for pname in projects.keys()]
        
        return dbc.Alert(f"Project '{name}' saved successfully!", color="success"), new_options