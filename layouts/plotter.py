# layouts/plotter.py
import pandas as pd
import plotly.graph_objects as go
from dash import dcc, html, callback, Input, Output, State, ALL, ctx
import dash_bootstrap_components as dbc
from datetime import datetime, timedelta

# Layout della pagina del plotter
layout = dbc.Container([
    dbc.Row([
        dbc.Col(html.H1("Data Plotter"), md=10),
        dbc.Col(dcc.Link("<- Back to Data Loader", href="/"), md=2, className="text-end align-self-center")
    ], className="mt-4"),
    
    # Sezione Filtri e Controlli
    dbc.Row([
        # Filtro Temporale
        dbc.Col([
            dbc.Label("Time Window"),
            dcc.Dropdown(
                id='time-window-dropdown',
                options=[
                    {'label': 'Daily', 'value': '1D'}, {'label': '2 Days', 'value': '2D'},
                    {'label': 'Weekly', 'value': '7D'}, {'label': 'Monthly', 'value': '30D'},
                    {'label': 'Bimester', 'value': '60D'}, {'label': 'Quarter', 'value': '90D'},
                    {'label': '6 Months', 'value': '180D'}, {'label': 'Yearly', 'value': '365D'},
                    {'label': 'Personalized', 'value': 'custom'}
                ],
                value='30D'
            ),
            dcc.DatePickerRange(
                id='date-picker-range',
                style={'display': 'none'}, # Mostra solo in modalità 'Personalized'
                start_date=datetime.now().date() - timedelta(days=7),
                end_date=datetime.now().date()
            )
        ], md=4),
        # Opzioni Avanzate
        dbc.Col([
            dbc.Label("Advanced Options"),
            dbc.Checklist(
                options=[
                    {'label': 'Show Max/Min callouts', 'value': 'show_callouts'},
                    {'label': 'Plot Average line', 'value': 'show_mean'}
                ],
                value=[],
                id='advanced-options-checklist',
                inline=True
            )
        ], md=8, className="align-self-end"),
    ], className="mt-4"),

    # Contenitore per le configurazioni delle tracce
    html.Hr(),
    html.Div(id='plot-config-container'),
    dbc.Button("Add New Plot", id="add-trace-btn", color="secondary", className="mt-2"),
    html.Hr(),

    # Grafico
    dbc.Row(dbc.Col(dcc.Graph(id='main-graph'), width=12), className="mt-4"),
])

def create_trace_config_element(index, df_columns=[]):
    """Crea un set di controlli per una singola traccia."""
    return dbc.Card(
        dbc.CardBody([
            dbc.Row([
                dbc.Col(html.H5(f"Plot #{index+1}"), md=12),
                dbc.Col([
                    dbc.Label("Column"),
                    dcc.Dropdown(id={'type': 'column-selector', 'index': index}, options=df_columns)
                ], md=4),
                dbc.Col([
                    dbc.Label("Plot Type"),
                    dcc.Dropdown(id={'type': 'plot-type-selector', 'index': index}, options=[
                        {'label': 'Line', 'value': 'lines'},
                        {'label': 'Scatter', 'value': 'markers'},
                        {'label': 'Bar', 'value': 'bar'},
                        {'label': 'Area', 'value': 'area'},
                    ], value='lines')
                ], md=4),
                dbc.Col([
                    dbc.Label("Color"),
                    dcc.Input(id={'type': 'color-selector', 'index': index}, type='text', value='auto', placeholder="e.g., #FF5733 or blue")
                ], md=4)
            ])
        ]),
        className="mb-3"
    )

def register_plotter_callbacks(app):
    
    # Mostra/Nascondi il DatePicker per il range personalizzato
    @app.callback(
        Output('date-picker-range', 'style'),
        Input('time-window-dropdown', 'value')
    )
    def toggle_date_picker(window_value):
        return {'display': 'block'} if window_value == 'custom' else {'display': 'none'}

    # Aggiungi dinamicamente i controlli per una nuova traccia
    @app.callback(
        Output('plot-config-container', 'children'),
        Input('add-trace-btn', 'n_clicks'),
        State('plot-config-container', 'children'),
        State('session-store', 'data')
    )
    def add_trace_controls(n_clicks, existing_children, session_data):
        if n_clicks is None:
            return [] # Non aggiungere niente all'inizio
        
        if session_data:
            df = pd.read_json(session_data['dataframe'], orient='split')
            df_columns = [{'label': col, 'value': col} for col in df.columns]
        else:
            df_columns = []

        new_child = create_trace_config_element(n_clicks, df_columns)
        
        if existing_children is None:
            existing_children = []
            
        return existing_children + [new_child]

    # Callback principale per aggiornare il grafico
    @app.callback(
        [Output('main-graph', 'figure'),
         Output('project-config-store', 'data')],
        [Input({'type': 'column-selector', 'index': ALL}, 'value'),
         Input({'type': 'plot-type-selector', 'index': ALL}, 'value'),
         Input({'type': 'color-selector', 'index': ALL}, 'value'),
         Input('time-window-dropdown', 'value'),
         Input('date-picker-range', 'start_date'),
         Input('date-picker-range', 'end_date'),
         Input('advanced-options-checklist', 'value'),
         Input('session-store', 'data')]
    )
    def update_graph(columns, plot_types, colors, time_window, start_date, end_date, adv_options, session_data):
        if not session_data or not any(columns):
            return go.Figure(), {}

        df = pd.read_json(session_data['dataframe'], orient='split')
        
        # Filtro temporale
        if time_window != 'custom':
            end_dt = df.index.max()
            start_dt = end_dt - pd.to_timedelta(time_window)
            filtered_df = df[(df.index >= start_dt) & (df.index <= end_dt)]
        else:
            filtered_df = df[(df.index >= start_date) & (df.index <= end_date)]

        fig = go.Figure()
        plot_configs = []

        for i, col in enumerate(columns):
            if not col:
                continue

            plot_type = plot_types[i]
            color = colors[i]
            
            trace_args = {'x': filtered_df.index, 'y': filtered_df[col], 'name': col}
            
            if color != 'auto':
                if plot_type == 'bar':
                    trace_args['marker_color'] = color
                else:
                    trace_args['line'] = {'color': color}

            if plot_type == 'bar':
                fig.add_trace(go.Bar(**trace_args))
            elif plot_type == 'area':
                trace_args['fill'] = 'tozeroy'
                fig.add_trace(go.Scatter(**trace_args))
            else: # line or scatter
                trace_args['mode'] = plot_type
                fig.add_trace(go.Scatter(**trace_args))

            # Opzioni avanzate per questa traccia
            if 'show_mean' in adv_options:
                mean_val = filtered_df[col].mean()
                fig.add_hline(y=mean_val, line_dash="dot", 
                              annotation_text=f"Avg {col}: {mean_val:.2f}", 
                              annotation_position="bottom right")

            if 'show_callouts' in adv_options:
                max_val = filtered_df[col].max()
                min_val = filtered_df[col].min()
                max_idx = filtered_df[col].idxmax()
                min_idx = filtered_df[col].idxmin()
                fig.add_annotation(x=max_idx, y=max_val, text=f"Max: {max_val:.2f}", showarrow=True, arrowhead=1)
                fig.add_annotation(x=min_idx, y=min_val, text=f"Min: {min_val:.2f}", showarrow=True, arrowhead=1)
            
            # Salva la configurazione di questa traccia
            plot_configs.append({
                'column': col,
                'type': plot_type,
                'color': color
            })
            
        fig.update_layout(title="Time Series Analysis", xaxis_title="Date", yaxis_title="Value",
                          transition_duration=500, template="plotly_white")
        
        # Salva tutta la configurazione del grafico per il progetto
        project_plot_config = {
            'time_window': time_window,
            'start_date': start_date,
            'end_date': end_date,
            'advanced_options': adv_options,
            'traces': plot_configs
        }

        return fig, project_plot_config