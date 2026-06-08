import dash
from dash import html, dcc, Input, Output, State
import dash_bootstrap_components as dbc
#import pywebview
import threading
import sys
import os
import webbrowser

# Determine the base path (useful for when the app is compiled with PyInstaller)
if getattr(sys, 'frozen', False):
    base_path = sys._MEIPASS
else:
    base_path = os.path.dirname(os.path.abspath(__file__))

assets_path = os.path.join(base_path, 'assets')
pages_path = os.path.join(base_path, 'pages')

# Initialize the Dash app
app = dash.Dash(
    __name__, 
    use_pages=True, 
    pages_folder=pages_path if os.path.exists(pages_path) else 'pages',
    assets_folder=assets_path if os.path.exists(assets_path) else 'assets',
    external_stylesheets=[dbc.themes.BOOTSTRAP],
    suppress_callback_exceptions=True
)

app.layout = html.Div([
    dbc.NavbarSimple(
        children=[
            dbc.NavItem(dbc.NavLink("Home", href="/")),
            dbc.NavItem(dbc.NavLink("Canvas", href="/canvas")),
            dbc.NavItem(dbc.NavLink("Multi Plot", href="/multi-plot")),
        ],
        brand_href="/",
        color="dark",
        dark=True,
        className="mb-4"
    ),
    dbc.Container(dash.page_container, fluid=True, className="p-4")
])

if __name__ == '__main__':
    print("ChartMate starting... Server will start and open shortly.")
    
    # Open the default browser (e.g. Chrome) after 1.25 seconds to give the server time to start
    threading.Timer(1.25, lambda: webbrowser.open("http://127.0.0.1:8050/")).start()
    
    # Run the Dash server normally in the main thread
    app.run(debug=True, port=8050, use_reloader=False)