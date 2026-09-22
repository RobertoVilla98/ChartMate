from dash import html

def render_chartmate_logo(size: int = 30):
    """
    Renders the stylized vector SVG logo of ChartMate:
    An L-shaped XY coordinate axis with a friendly little waving mate standing on the plot.
    """
    return html.Img(
        src="/assets/logo.svg",
        width=size,
        height=size,
        alt="ChartMate Logo",
        className="d-inline-block align-middle me-2",
        style={'display': 'inline-block'}
    )
