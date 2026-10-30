import dash
from dash import html, dcc
import dash_bootstrap_components as dbc
import threading
import sys
import os
import webbrowser

# Determine base path for PyInstaller or dev mode
if getattr(sys, 'frozen', False):
    base_path = sys._MEIPASS
else:
    base_path = os.path.dirname(os.path.abspath(__file__))

assets_path = os.path.join(base_path, 'assets')
pages_path = os.path.join(base_path, 'pages')

# Initialize the Dash app with Bootstrap & custom Velth theme
app = dash.Dash(
    __name__, 
    use_pages=True, 
    pages_folder=pages_path if os.path.exists(pages_path) else 'pages',
    assets_folder=assets_path if os.path.exists(assets_path) else 'assets',
    external_stylesheets=[
        dbc.themes.BOOTSTRAP,
        "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
    ],
    suppress_callback_exceptions=True,
    title="ChartMate — Scientific Data Visualization"
)

from components.logo import render_chartmate_logo

# Main Application Layout with Velth-Inspired Header
app.layout = html.Div([
    html.Header([
        dbc.Container([
            dbc.Row([
                dbc.Col([
                    html.A([
                        render_chartmate_logo(size=28),
                        html.Span("CHARTMATE", className="fw-bold tracking-tight ms-2 text-dark font-sans", style={'fontSize': '1.15rem'})
                    ], href="/", className="velth-brand-badge")
                ], xs=12, md=4, className="d-flex align-items-center mb-2 mb-md-0"),
                
                dbc.Col([
                    dbc.Nav([
                        dbc.NavItem(dbc.NavLink([
                            html.I(className="bi bi-folder2-open me-1"), "Projects"
                        ], href="/", active="exact", className="nav-link")),
                        dbc.NavItem(dbc.NavLink([
                            html.I(className="bi bi-graph-up me-1"), "Canvas (Single)"
                        ], href="/canvas", active="exact", className="nav-link")),
                        dbc.NavItem(dbc.NavLink([
                            html.I(className="bi bi-grid-1x2 me-1"), "Multi Plot"
                        ], href="/multi-plot", active="exact", className="nav-link")),
                        dbc.NavItem(dbc.NavLink([
                            html.I(className="bi bi-globe-americas me-1"), "Maps (GIS)"
                        ], href="/maps", active="exact", className="nav-link")),
                    ], className="justify-content-center justify-content-md-end gap-2", pills=True)
                ], xs=12, md=8, className="d-flex align-items-center justify-content-md-end")
            ], className="align-items-center")
        ], fluid=True, className="py-2 px-4")
    ], className="velth-navbar sticky-top mb-4"),
    
    dbc.Container(dash.page_container, fluid=True, className="px-4 pb-5")
], className="min-vh-100")

if __name__ == '__main__':
    print("ChartMate starting in Velth Dark Modern Theme...")
    print("Opening browser at http://127.0.0.1:8050/")
    
    # Open default browser
    threading.Timer(1.25, lambda: webbrowser.open("http://127.0.0.1:8050/")).start()
    
    # Run the Dash server
    app.run(debug=True, port=8050, use_reloader=False)