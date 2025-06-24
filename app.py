# app.py
import dash
from dash import dcc, html, Input, Output
import dash_bootstrap_components as dbc

# Importa layout e registrazioni dei callback
from layouts import data_loader, plotter

# Inizializza l'app Dash
# Usiamo un tema Bootstrap per un aspetto più gradevole
app = dash.Dash(__name__, external_stylesheets=[dbc.themes.BOOTSTRAP], suppress_callback_exceptions=True)
app.title = "Data Visualizer"

# Definisce il layout principale dell'applicazione
app.layout = html.Div([
    # dcc.Store è un componente che memorizza dati JSON nel browser dell'utente.
    # È il modo in cui condividiamo i dati tra le pagine/callback.
    
    # Store per la sessione corrente (contiene il DataFrame caricato)
    dcc.Store(id='session-store', storage_type='session'), # 'session' pulisce i dati alla chiusura della scheda
    
    # Store per la configurazione del grafico corrente
    dcc.Store(id='project-config-store', storage_type='session'),

    # Componente per gestire l'URL della pagina
    dcc.Location(id='url', refresh=False),

    # Contenitore dove verranno renderizzate le diverse pagine
    html.Div(id='page-content')
])

# Registra i callback definiti nei file di layout
data_loader.register_data_loader_callbacks(app)
plotter.register_plotter_callbacks(app)

# Callback per il routing: mostra la pagina corretta in base all'URL
@app.callback(
    Output('page-content', 'children'),
    Input('url', 'pathname')
)
def display_page(pathname):
    if pathname == '/plot':
        return plotter.layout
    else:
        # La pagina di default è il data loader
        return data_loader.layout

# Esegui il server di sviluppo
if __name__ == '__main__':
    app.run(debug=True)