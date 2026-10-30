import plotly.graph_objects as go
from plotly.subplots import make_subplots
import polars as pl
import datetime
from typing import Dict, List, Any, Optional

def _clean_series(series: pl.Series) -> pl.Series:
    """Converts string decimal numbers to float if necessary."""
    if series.dtype in [pl.Utf8, pl.String, pl.Object]:
        try:
            return series.str.replace(",", ".").cast(pl.Float64, strict=False)
        except Exception:
            pass
    return series

def _calc_aspect_dimensions(w_cm: float, h_cm: float, max_w: int = 1150, max_h: int = 680):
    try:
        w = float(w_cm)
        h = float(h_cm)
        if w <= 0 or h <= 0:
            w, h = 17.0, 9.5
    except Exception:
        w, h = 17.0, 9.5
        
    ratio = w / h
    if ratio <= 1.15:  # Square (1.0) or vertical tall
        calc_h = max_h
        calc_w = int(calc_h * ratio)
    else:  # Landscape / Wide
        calc_w = max_w
        calc_h = int(calc_w / ratio)
        if calc_h > max_h:
            calc_h = max_h
            calc_w = int(calc_h * ratio)
            
    return calc_w, calc_h

def build_single_chart_figure(
    df: pl.DataFrame,
    x: str,
    y: List[str],
    y2: List[str],
    y3: List[str],
    ctype: str = 'line',
    leg: str = 'top',
    font: str = 'Outfit',
    fs_glob: int = 12,
    fs_leg: int = 11,
    fs_tit: int = 13,
    fs_tick: int = 11,
    xl: str = '',
    yl: str = '',
    y2l: str = '',
    y3l: str = '',
    xmin: Optional[float] = None,
    xmax: Optional[float] = None,
    ymin: Optional[float] = None,
    ymax: Optional[float] = None,
    y2min: Optional[float] = None,
    y2max: Optional[float] = None,
    y3min: Optional[float] = None,
    y3max: Optional[float] = None,
    gx: List[str] = None,
    gy: List[str] = None,
    gy2: List[str] = None,
    gy3: List[str] = None,
    sx: List[str] = None,
    sy: List[str] = None,
    sy2: List[str] = None,
    sy3: List[str] = None,
    gaps: bool = False,
    sd: str = None,
    ed: str = None,
    ts_col: str = None,
    tc: Dict[str, Any] = None,
    w_cm: float = 17.0,
    h_cm: float = 9.5,
    extrema_mode: str = 'none',
    extrema_type: str = 'both',
    extrema_badge: str = 'full',
    thresh1_val: Optional[float] = None,
    thresh1_lbl: Optional[str] = None,
    thresh2_val: Optional[float] = None,
    thresh2_lbl: Optional[str] = None,
    band_min: Optional[float] = None,
    band_max: Optional[float] = None,
    band_lbl: Optional[str] = None,
    band_color: Optional[str] = None,
    stats_switches: Optional[List[str]] = None,
    event_start: Optional[str] = None,
    event_end: Optional[str] = None,
    event_label: Optional[str] = None
) -> go.Figure:
    """
    Constructs a publication-ready single chart figure in Velth Light theme with up to 3 Y axes.
    """
    if df is None or not x or not ctype:
        return go.Figure()
        
    y = y or []
    y2 = y2 or []
    y3 = y3 or []
    gx = gx or []
    gy = gy or []
    gy2 = gy2 or []
    gy3 = gy3 or []
    tc = tc or {}

    # Timeframe filtering
    is_time_x = False
    if ts_col and ts_col in df.columns and df[ts_col].dtype in [pl.Datetime, pl.Date]:
        if sd:
            df = df.filter(pl.col(ts_col) >= datetime.datetime.strptime(sd.split('T')[0], '%Y-%m-%d'))
        if ed:
            df = df.filter(pl.col(ts_col) < datetime.datetime.strptime(ed.split('T')[0], '%Y-%m-%d') + datetime.timedelta(days=1))
        if x == ts_col:
            is_time_x = True

    has_sec = len(y2) > 0
    has_tert = len(y3) > 0
    
    fig = go.Figure()
    if has_sec or has_tert:
        fig = make_subplots(specs=[[{"secondary_y": True}]])
    if has_tert:
        fig.update_layout(
            xaxis=dict(domain=[0, 0.92]),
            yaxis3=dict(overlaying='y', side='right', anchor='free', position=1.0, showgrid=bool(gy3))
        )

    def create_trace(col: str, ax: str):
        c = tc.get(col, {})
        ctype_actual = ctype if c.get('type', 'global') == 'global' else c.get('type')
        name = c.get('name') or col
        color = c.get('color')
        width = c.get('width', 2)
        style = c.get('style', 'solid')
        opac = c.get('opacity', 1.0)
        
        md = dict(color=color, opacity=opac) if color else dict(opacity=opac)
        ld = dict(color=color, width=width) if color else dict(width=width)
        if style != 'solid':
            ld['dash'] = style
        
        x_data = df[x].to_list()
        y_series = _clean_series(df[col])
        y_data = y_series.to_list()
        
        if ctype_actual == 'scatter':
            t = go.Scatter(x=x_data, y=y_data, mode='markers', name=name, marker=md)
        elif ctype_actual == 'bar':
            t = go.Bar(x=x_data, y=y_data, name=name, marker=md)
        elif ctype_actual == 'area':
            ld['width'] = 0
            t = go.Scatter(x=x_data, y=y_data, mode='lines', name=name, line=ld, fill='tozeroy', connectgaps=gaps, opacity=opac)
        elif ctype_actual == 'box':
            t = go.Box(
                x=x_data if not is_time_x else None,
                y=y_data,
                name=name,
                marker=md,
                boxpoints='all',
                jitter=0.25,
                pointpos=-1.6,
                boxmean=True
            )
        elif ctype_actual == 'violin':
            t = go.Violin(
                x=x_data if not is_time_x else None,
                y=y_data,
                name=name,
                box_visible=True,
                meanline_visible=True,
                points='all',
                jitter=0.25,
                line_color=color or '#059669',
                opacity=opac
            )
        elif ctype_actual == 'bar_error':
            # Compute Mean and Standard Deviation for error bar
            try:
                import numpy as np
                clean_nums = np.array([v for v in y_data if v is not None and not np.isnan(v)])
                if len(clean_nums) > 0:
                    mean_val = float(np.mean(clean_nums))
                    std_val = float(np.std(clean_nums))
                else:
                    mean_val, std_val = 0.0, 0.0
                t = go.Bar(
                    x=[name],
                    y=[mean_val],
                    error_y=dict(type='data', array=[std_val], visible=True, thickness=1.5, width=6),
                    name=f"{name} (μ±σ)",
                    marker=md
                )
            except Exception:
                t = go.Bar(x=x_data, y=y_data, name=name, marker=md)
        elif ctype_actual == 'histogram':
            t = go.Histogram(
                x=y_data,
                name=name,
                opacity=opac if opac < 1.0 else 0.75,
                marker=md,
                autobinx=True
            )
        else:
            t = go.Scatter(x=x_data, y=y_data, mode='lines', name=name, line=ld, connectgaps=gaps, opacity=opac)
        
        return t

    # Specialized Handler for Correlation Matrix Heatmap
    if ctype == 'correlation':
        num_cols = []
        target_cols = [c for c in ([x] + (y or []) + (y2 or []) + (y3 or [])) if c in df.columns]
        if len(target_cols) < 2:
            target_cols = [c for c in df.columns if df[c].dtype in [pl.Float64, pl.Float32, pl.Int64, pl.Int32, pl.Int16, pl.Int8]]
        
        # Calculate Pearson correlation matrix
        try:
            import numpy as np
            clean_sub = df.select(target_cols).drop_nulls()
            corr_matrix = []
            for col1 in target_cols:
                row = []
                s1 = _clean_series(clean_sub[col1]).to_numpy()
                for col2 in target_cols:
                    s2 = _clean_series(clean_sub[col2]).to_numpy()
                    if len(s1) > 1 and np.std(s1) > 0 and np.std(s2) > 0:
                        r_val = float(np.corrcoef(s1, s2)[0, 1])
                    else:
                        r_val = 1.0 if col1 == col2 else 0.0
                    row.append(r_val)
                corr_matrix.append(row)
            
            calc_w, calc_h = _calc_aspect_dimensions(w_cm, h_cm, max_w=1150, max_h=680)
            fig = go.Figure(data=go.Heatmap(
                z=corr_matrix,
                x=target_cols,
                y=target_cols,
                colorscale='RdBu',
                reversescale=True,
                zmin=-1, zmax=1,
                text=[[f"{v:.2f}" for v in row] for row in corr_matrix],
                texttemplate="%{text}",
                textfont={"size": 11, "family": font},
                colorbar=dict(title="r (Pearson)", len=0.8)
            ))
            fig.update_layout(
                width=calc_w, height=calc_h, autosize=False,
                paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='#ffffff',
                font=dict(family=font, size=fs_glob, color='#0f172a'),
                margin=dict(l=60, r=40, t=50, b=50),
                template='plotly_white'
            )
            return fig
        except Exception:
            pass

    # Specialized Handler for Radar / Spider Chart
    if ctype == 'radar':
        try:
            radar_cols = [c for c in ([x] + (y or [])) if c in df.columns]
            if len(radar_cols) >= 3:
                calc_w, calc_h = _calc_aspect_dimensions(w_cm, h_cm, max_w=1150, max_h=680)
                fig = go.Figure()
                
                # Take mean or normalized values for each radar dimension
                r_vals = []
                for rc in radar_cols:
                    s = _clean_series(df[rc]).drop_nulls()
                    r_vals.append(float(s.mean()) if len(s) > 0 else 0.0)
                    
                theta_labels = radar_cols + [radar_cols[0]]
                r_closed = r_vals + [r_vals[0]]
                
                fig.add_trace(go.Scatterpolar(
                    r=r_closed,
                    theta=theta_labels,
                    fill='toself',
                    name='Mean Profile',
                    line=dict(color='#059669', width=2),
                    fillcolor='rgba(5, 150, 105, 0.2)'
                ))
                
                fig.update_layout(
                    width=calc_w, height=calc_h, autosize=False,
                    polar=dict(
                        radialaxis=dict(visible=True, showgrid=True, gridcolor='#e2e8f0'),
                        angularaxis=dict(gridcolor='#e2e8f0')
                    ),
                    paper_bgcolor='rgba(0,0,0,0)',
                    font=dict(family=font, size=fs_glob, color='#0f172a'),
                    template='plotly_white'
                )
                return fig
        except Exception:
            pass
            
    traces_to_add = []
    for col in (y if isinstance(y, list) else [y]):
        if col in df.columns:
            traces_to_add.append({'trace': create_trace(col, 'y'), 'order': tc.get(col, {}).get('order', 1), 'ax': 'y'})
    for col in (y2 if isinstance(y2, list) else [y2]):
        if col in df.columns:
            traces_to_add.append({'trace': create_trace(col, 'y2'), 'order': tc.get(col, {}).get('order', 1), 'ax': 'y2'})
    for col in (y3 if isinstance(y3, list) else [y3]):
        if col in df.columns:
            traces_to_add.append({'trace': create_trace(col, 'y3'), 'order': tc.get(col, {}).get('order', 1), 'ax': 'y3'})
        
    traces_to_add.sort(key=lambda item: (item['order'] if item['order'] is not None else 0))
    
    for item in traces_to_add:
        if item['ax'] == 'y3':
            item['trace'].update(yaxis='y3')
            fig.add_trace(item['trace'])
        else:
            if has_sec or has_tert:
                fig.add_trace(item['trace'], secondary_y=(item['ax'] == 'y2'))
            else:
                fig.add_trace(item['trace'])

    ldict = {}
    if leg == 'none':
        ldict = dict(showlegend=False)
    elif leg == 'top':
        ldict = dict(legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="center", x=0.5))
    elif leg == 'bottom':
        ldict = dict(legend=dict(orientation="h", yanchor="top", y=-0.2, xanchor="center", x=0.5))

    # Calculate precise aspect ratio preview dimensions (Large Screen Multiplier)
    calc_w, calc_h = _calc_aspect_dimensions(w_cm, h_cm, max_w=1150, max_h=680)

    # Velth Scientific Light Layout
    fig.update_layout(
        width=calc_w,
        height=calc_h,
        autosize=False,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='#ffffff',
        margin=dict(l=20, r=(100 if has_tert else (60 if has_sec else 20)), t=40, b=20),
        template='plotly_white',
        font=dict(family=font, size=fs_glob, color='#0f172a'),
        xaxis_title=(xl if xl else x) if bool(sx) else None, 
        yaxis_title=(yl if yl else (y[0] if len(y)==1 else "Values")) if bool(sy) else None,
        hovermode="x unified",
        **ldict
    )
    
    if y2l and bool(sy2): fig.update_yaxes(title_text=y2l, secondary_y=True)
    if y3l and bool(sy3): 
        fig.update_layout(yaxis3=dict(title=y3l, side='right', overlaying='y', anchor='free', position=1.0, automargin=True))
    
    if leg != 'none' and fs_leg:
        fig.update_layout(legend=dict(font=dict(size=fs_leg)))
    
    grid_color = '#e2e8f0'
    zeroline_color = '#cbd5e1'
    
    fig.update_xaxes(
        title_font=dict(size=fs_tit), tickfont=dict(size=fs_tick), automargin=True,
        showgrid=bool(gx), gridcolor=grid_color, zerolinecolor=zeroline_color,
        range=[xmin, xmax] if xmin is not None and xmax is not None else None
    )
    if is_time_x:
        fig.update_xaxes(tickformat="%d/%m/%Y", automargin=True)
        
    yaxes_params = dict(
        showgrid=bool(gy), gridcolor=grid_color, zerolinecolor=zeroline_color,
        title_font=dict(size=fs_tit), tickfont=dict(size=fs_tick),
        range=[ymin, ymax] if ymin is not None and ymax is not None else None, automargin=True
    )
    if has_sec or has_tert:
        yaxes_params['secondary_y'] = False
    fig.update_yaxes(**yaxes_params)

    if has_sec or has_tert:
        fig.update_yaxes(
            showgrid=bool(gy2), gridcolor=grid_color,
            title_font=dict(size=fs_tit), tickfont=dict(size=fs_tick),
            range=[y2min, y2max] if y2min is not None and y2max is not None else None, secondary_y=True, automargin=True
        )
    
    # --- SMART LABELLING & SCIENTIFIC ANNOTATIONS ---
    # 1. Threshold Reference Lines
    if thresh1_val is not None:
        fig.add_hline(
            y=thresh1_val, line_dash="dash", line_color="#ef4444", line_width=1.5,
            annotation_text=f" {thresh1_lbl}" if thresh1_lbl else f" Limit ({thresh1_val})",
            annotation_position="top right", annotation_font_size=10, annotation_font_color="#ef4444"
        )
    if thresh2_val is not None:
        fig.add_hline(
            y=thresh2_val, line_dash="dot", line_color="#0284c7", line_width=1.5,
            annotation_text=f" {thresh2_lbl}" if thresh2_lbl else f" Limit ({thresh2_val})",
            annotation_position="bottom right", annotation_font_size=10, annotation_font_color="#0284c7"
        )

    # 2. Shaded Comfort / Target Band
    if band_min is not None and band_max is not None:
        try:
            b_min, b_max = float(band_min), float(band_max)
            if b_min < b_max:
                fig.add_hrect(
                    y0=b_min, y1=b_max,
                    fillcolor=band_color or "rgba(16, 185, 129, 0.12)", line_width=0,
                    annotation_text=f" {band_lbl}" if band_lbl else " Target Range",
                    annotation_position="top left", annotation_font_size=10, annotation_font_color="#059669"
                )
        except Exception:
            pass

    # 3. Event Shaded Time-Window Band
    if event_start and event_end and is_time_x:
        try:
            fig.add_vrect(
                x0=event_start, x1=event_end,
                fillcolor="rgba(100, 116, 139, 0.12)", line_width=1, line_dash="dot",
                line_color="rgba(100, 116, 139, 0.4)",
                annotation_text=f" {event_label}" if event_label else " Event",
                annotation_position="top left", annotation_font_size=10, annotation_font_color="#475569"
            )
        except Exception:
            pass

    # 4. Statistical Reference Lines & Linear Trendline (OLS)
    stats_switches = stats_switches or []
    if y and y[0] in df.columns:
        primary_col = y[0]
        y_ser = _clean_series(df[primary_col]).drop_nulls()
        if len(y_ser) > 0:
            if 'mean' in stats_switches:
                mean_v = y_ser.mean()
                if mean_v is not None:
                    fig.add_hline(
                        y=mean_v, line_dash="dashdot", line_color="#d97706", line_width=1.5,
                        annotation_text=f" μ = {mean_v:.2f}",
                        annotation_position="top left", annotation_font_size=10, annotation_font_color="#d97706"
                    )
            if 'median' in stats_switches:
                med_v = y_ser.median()
                if med_v is not None:
                    fig.add_hline(
                        y=med_v, line_dash="dot", line_color="#8b5cf6", line_width=1.5,
                        annotation_text=f" M = {med_v:.2f}",
                        annotation_position="bottom left", annotation_font_size=10, annotation_font_color="#8b5cf6"
                    )
            if 'trendline' in stats_switches and len(y_ser) > 2:
                try:
                    import numpy as np
                    clean_df = df.select([x, primary_col]).drop_nulls()
                    if len(clean_df) > 2:
                        y_vals = _clean_series(clean_df[primary_col]).to_numpy()
                        x_indices = np.arange(len(y_vals))
                        slope, intercept = np.polyfit(x_indices, y_vals, 1)
                        y_fit = slope * x_indices + intercept
                        ss_res = np.sum((y_vals - y_fit) ** 2)
                        ss_tot = np.sum((y_vals - np.mean(y_vals)) ** 2)
                        r2 = 1 - (ss_res / ss_tot) if ss_tot != 0 else 1.0
                        
                        fig.add_trace(go.Scatter(
                            x=clean_df[x].to_list(),
                            y=y_fit.tolist(),
                            mode='lines',
                            name=f'Trend (R²={r2:.3f})',
                            line=dict(color='#0f172a', width=1.5, dash='dot')
                        ))
                except Exception:
                    pass

    # 5. Peak & Valley Tracker (Global, Daily, Top 3)
    if extrema_mode in ['global', 'daily', 'top3'] and y and y[0] in df.columns:
        primary_col = y[0]
        sub_df = df.select([x, primary_col]).drop_nulls()
        if len(sub_df) > 0:
            sub_df = sub_df.with_columns(_clean_series(sub_df[primary_col]).alias('_val'))
            pts_to_mark = []
            
            if extrema_mode == 'global':
                if extrema_type in ['max', 'both']:
                    max_row = sub_df.sort('_val', descending=True).head(1)
                    if len(max_row) > 0:
                        pts_to_mark.append({'type': 'max', 'x': max_row[x][0], 'y': max_row['_val'][0]})
                if extrema_type in ['min', 'both']:
                    min_row = sub_df.sort('_val', descending=False).head(1)
                    if len(min_row) > 0:
                        pts_to_mark.append({'type': 'min', 'x': min_row[x][0], 'y': min_row['_val'][0]})
                        
            elif extrema_mode == 'top3':
                if extrema_type in ['max', 'both']:
                    for r_row in sub_df.sort('_val', descending=True).head(3).iter_rows(named=True):
                        pts_to_mark.append({'type': 'max', 'x': r_row[x], 'y': r_row['_val']})
                if extrema_type in ['min', 'both']:
                    for r_row in sub_df.sort('_val', descending=False).head(3).iter_rows(named=True):
                        pts_to_mark.append({'type': 'min', 'x': r_row[x], 'y': r_row['_val']})
                        
            elif extrema_mode == 'daily' and is_time_x:
                try:
                    daily_df = sub_df.with_columns(pl.col(x).dt.date().alias('_date'))
                    dates = daily_df['_date'].unique().to_list()
                    for d_val in dates:
                        day_subset = daily_df.filter(pl.col('_date') == d_val)
                        if len(day_subset) > 0:
                            if extrema_type in ['max', 'both']:
                                d_max = day_subset.sort('_val', descending=True).head(1)
                                pts_to_mark.append({'type': 'max', 'x': d_max[x][0], 'y': d_max['_val'][0]})
                            if extrema_type in ['min', 'both']:
                                d_min = day_subset.sort('_val', descending=False).head(1)
                                pts_to_mark.append({'type': 'min', 'x': d_min[x][0], 'y': d_min['_val'][0]})
                except Exception:
                    pass

            for pt in pts_to_mark:
                is_mx = pt['type'] == 'max'
                col_c = '#ef4444' if is_mx else '#0284c7'
                symbol = 'triangle-up' if is_mx else 'triangle-down'
                tag = 'Max' if is_mx else 'Min'
                val_str = f"{pt['y']:.2f}"
                
                txt = f"{tag}: {val_str}"
                if extrema_badge == 'marker_only':
                    txt = None
                elif extrema_badge == 'value_only':
                    txt = val_str
                
                if txt:
                    fig.add_annotation(
                        x=pt['x'], y=pt['y'],
                        text=txt,
                        showarrow=True,
                        arrowhead=2,
                        arrowsize=1,
                        arrowwidth=1.5,
                        arrowcolor=col_c,
                        ax=0,
                        ay=(-26 if is_mx else 26),
                        font=dict(size=9, color='#ffffff', family="JetBrains Mono, monospace"),
                        bgcolor=col_c,
                        bordercolor=col_c,
                        borderwidth=1,
                        borderpad=3,
                        opacity=0.95
                    )
                else:
                    fig.add_trace(go.Scatter(
                        x=[pt['x']], y=[pt['y']],
                        mode='markers',
                        marker=dict(size=9, symbol=symbol, color=col_c, line=dict(width=1, color='#ffffff')),
                        showlegend=False,
                        hoverinfo='text',
                        hovertext=f"{tag}: {val_str}"
                    ))
        
    return fig


LETTERS_LIST = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)', '(h)', '(i)', '(j)', '(k)', '(l)', '(m)', '(n)', '(o)', '(p)']

def build_multiplot_figure(
    df: pl.DataFrame,
    mode: str,
    rows: int,
    cols: int,
    shared: List[str],
    ctype: str,
    c_x_map: Dict[int, str],
    c_y_map: Dict[int, List[str]],
    c_t_map: Dict[int, str],
    c_c_map: Dict[int, str],
    c_l_map: Dict[int, bool],
    uniform_y: List[str],
    palette: str,
    px: List[str],
    py: List[str],
    w_cm: float = 17.0,
    h_cm: float = 9.5,
    c_ylabel_map: Dict[int, str] = None,
    use_lettering: bool = True
) -> go.Figure:
    """
    Constructs an academic journal-ready multiplot matrix figure with dynamic spacing, auto-lettering, and clean typography.
    """
    if df is None:
        return go.Figure()
        
    share_x = 'x' in (shared or [])
    share_y = 'y' in (shared or [])
    c_ylabel_map = c_ylabel_map or {}
    fig = None

    if mode == 'A':
        try:
            r, c = int(rows), int(cols)
        except Exception:
            return go.Figure()
            
        # Compute smart dynamic spacing to avoid title/axis collisions
        v_space = max(0.06, min(0.14, 0.28 / r)) if r > 1 else 0.0
        h_space = max(0.05, min(0.12, 0.22 / c)) if c > 1 else 0.0

        titles = []
        for i in range(r):
            for j in range(c):
                idx = i * c + j
                letter = LETTERS_LIST[idx] if idx < len(LETTERS_LIST) and use_lettering else f"[{i+1},{j+1}]"
                custom_title = c_t_map.get(idx)
                if custom_title:
                    titles.append(f"<b>{letter}</b> {custom_title}")
                else:
                    y_s = c_y_map.get(idx, [])
                    titles.append(f"<b>{letter}</b> {', '.join(y_s)}" if y_s else f"<b>{letter}</b> Panel [{i+1},{j+1}]")
                
        fig = make_subplots(
            rows=r, cols=c,
            shared_xaxes=share_x,
            shared_yaxes=share_y,
            vertical_spacing=v_space,
            horizontal_spacing=h_space,
            subplot_titles=titles
        )
        
        for i in range(r):
            for j in range(c):
                idx = i * c + j
                x_col = c_x_map.get(idx)
                y_cols = c_y_map.get(idx, [])
                if not x_col or not y_cols:
                    continue
                if x_col not in df.columns:
                    continue
                
                x_data = df[x_col].to_list()
                is_time = df[x_col].dtype in [pl.Datetime, pl.Date]
                
                cell_ctype = c_c_map.get(idx, 'global')
                eff_ctype = ctype if cell_ctype == 'global' else cell_ctype
                show_leg = c_l_map.get(idx, True)
                
                for y_col in y_cols:
                    if y_col not in df.columns:
                        continue
                    y_series = _clean_series(df[y_col])
                    y_data = y_series.to_list()
                    
                    if eff_ctype == 'scatter':
                        t = go.Scatter(x=x_data, y=y_data, mode='markers', name=y_col)
                    elif eff_ctype == 'bar':
                        t = go.Bar(x=x_data, y=y_data, name=y_col)
                    elif eff_ctype == 'area':
                        t = go.Scatter(x=x_data, y=y_data, mode='lines', fill='tozeroy', name=y_col)
                    else:
                        t = go.Scatter(x=x_data, y=y_data, mode='lines', name=y_col)
                    
                    t.showlegend = show_leg
                    fig.add_trace(t, row=i+1, col=j+1)
                
                # Panel Y-Axis Label
                ylabel = c_ylabel_map.get(idx)
                if ylabel:
                    fig.update_yaxes(title_text=ylabel, title_font=dict(size=11, family="Outfit, sans-serif"), row=i+1, col=j+1)
                
                # If shared X, hide intermediate X tick labels
                if share_x and i < r - 1:
                    fig.update_xaxes(showticklabels=False, row=i+1, col=j+1)
                elif is_time:
                    fig.update_xaxes(tickformat="%d/%m/%Y", row=i+1, col=j+1)
                    
    elif mode == 'B':
        px = px or []
        py = py or []
        if not px or not py:
            return go.Figure()
        
        r, c = len(py), len(px)
        v_space = max(0.06, min(0.14, 0.28 / r)) if r > 1 else 0.0
        h_space = max(0.05, min(0.12, 0.22 / c)) if c > 1 else 0.0

        titles = []
        for i, y_col in enumerate(py):
            for j, x_col in enumerate(px):
                idx = i * c + j
                letter = LETTERS_LIST[idx] if idx < len(LETTERS_LIST) and use_lettering else f"[{i+1},{j+1}]"
                titles.append(f"<b>{letter}</b> {y_col} vs {x_col}")
                
        fig = make_subplots(
            rows=r, cols=c,
            shared_xaxes=share_x,
            shared_yaxes=share_y,
            vertical_spacing=v_space,
            horizontal_spacing=h_space,
            subplot_titles=titles
        )
        
        for i, y_col in enumerate(py):
            for j, x_col in enumerate(px):
                if x_col not in df.columns or y_col not in df.columns:
                    continue
                
                x_data = df[x_col].to_list()
                y_series = _clean_series(df[y_col])
                y_data = y_series.to_list()
                is_time = df[x_col].dtype in [pl.Datetime, pl.Date]
                
                if ctype == 'scatter':
                    t = go.Scatter(x=x_data, y=y_data, mode='markers', name=f"{y_col}-{x_col}")
                elif ctype == 'bar':
                    t = go.Bar(x=x_data, y=y_data, name=f"{y_col}-{x_col}")
                elif ctype == 'area':
                    t = go.Scatter(x=x_data, y=y_data, mode='lines', fill='tozeroy', name=f"{y_col}-{x_col}")
                else:
                    t = go.Scatter(x=x_data, y=y_data, mode='lines', name=f"{y_col}-{x_col}")
                
                fig.add_trace(t, row=i+1, col=j+1)
                if is_time:
                    fig.update_xaxes(tickformat="%d/%m/%Y", row=i+1, col=j+1)

    if fig:
        if 'uniform' in (uniform_y or []):
            all_y_min = float('inf')
            all_y_max = float('-inf')
            cols_to_check = []
            if mode == 'A':
                for y_s in c_y_map.values():
                    cols_to_check.extend(y_s)
            else:
                cols_to_check = py
            
            for y_col in set(cols_to_check):
                if y_col in df.columns:
                    y_series = _clean_series(df[y_col])
                    ymin, ymax = y_series.min(), y_series.max()
                    if ymin is not None and ymin < all_y_min:
                        all_y_min = ymin
                    if ymax is not None and ymax > all_y_max:
                        all_y_max = ymax
            
            if all_y_min != float('inf'):
                fig.update_yaxes(range=[all_y_min, all_y_max])

        template = "plotly_white" if palette in ['plotly_white', 'plotly', 'plotly_dark'] else palette
        calc_w, calc_h = _calc_aspect_dimensions(w_cm, h_cm, max_w=1200, max_h=750)
        
        # Style subplot titles annotations nicely
        for ann in fig['layout']['annotations']:
            ann['font'] = dict(family="Outfit, sans-serif", size=12, color='#0f172a')
            ann['xanchor'] = 'center'
            
        fig.update_layout(
            width=calc_w,
            height=calc_h,
            autosize=False,
            template=template,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='#ffffff',
            font=dict(family="Outfit, sans-serif", color='#0f172a'),
            margin=dict(l=60, r=30, t=55, b=45),
            hovermode="x unified",
            legend=dict(orientation="h", yanchor="bottom", y=1.03, xanchor="center", x=0.5, font=dict(size=10))
        )
        grid_color = '#e2e8f0'
        fig.update_xaxes(automargin=True, gridcolor=grid_color, tickfont=dict(size=10))
        fig.update_yaxes(automargin=True, gridcolor=grid_color, tickfont=dict(size=10))
        
    return fig or go.Figure()


def build_map_figure(
    df: pl.DataFrame,
    lat_col: str,
    lon_col: str,
    val_col: Optional[str] = None,
    hover_col: Optional[str] = None,
    size_col: Optional[str] = None,
    map_type: str = 'satellite',
    viz_mode: str = 'scatter',
    palette: str = 'Viridis',
    point_size: int = 10,
    point_opacity: float = 0.85,
    w_cm: float = 17.0,
    h_cm: float = 11.0,
    custom_zoom: Optional[int] = None,
    custom_lat: Optional[float] = None,
    custom_lon: Optional[float] = None
) -> go.Figure:
    """
    Constructs high-resolution publication-ready geospatial/satellite maps.
    Supports ESRI World Imagery Satellite tiles, OpenStreetMap, CartoDB Positron, OpenTopoMap.
    Supports Bubble Scatter, Density Heatmaps, and GPS Routes/Tracks.
    """
    if df is None or not lat_col or not lon_col or lat_col not in df.columns or lon_col not in df.columns:
        return go.Figure()
        
    import numpy as np
    
    # Filter valid non-null coordinates
    cols_to_select = [lat_col, lon_col]
    if val_col and val_col in df.columns: cols_to_select.append(val_col)
    if hover_col and hover_col in df.columns: cols_to_select.append(hover_col)
    if size_col and size_col in df.columns: cols_to_select.append(size_col)
    
    clean_sub = df.select(cols_to_select).drop_nulls()
    if len(clean_sub) == 0:
        return go.Figure()
        
    lat_vals = _clean_series(clean_sub[lat_col]).to_numpy()
    lon_vals = _clean_series(clean_sub[lon_col]).to_numpy()
    
    # Calculate Auto Center & Zoom
    min_lat, max_lat = float(np.min(lat_vals)), float(np.max(lat_vals))
    min_lon, max_lon = float(np.min(lon_vals)), float(np.max(lon_vals))
    
    center_lat = custom_lat if custom_lat is not None else (min_lat + max_lat) / 2.0
    center_lon = custom_lon if custom_lon is not None else (min_lon + max_lon) / 2.0
    
    if custom_zoom is not None:
        zoom_level = custom_zoom
    else:
        max_delta = max(max_lat - min_lat, max_lon - min_lon)
        if max_delta <= 0.02: zoom_level = 14
        elif max_delta <= 0.08: zoom_level = 12
        elif max_delta <= 0.3: zoom_level = 10
        elif max_delta <= 1.2: zoom_level = 8
        elif max_delta <= 5.0: zoom_level = 6
        elif max_delta <= 15.0: zoom_level = 4
        else: zoom_level = 2
        
    # Value & Color mapping
    color_vals = _clean_series(clean_sub[val_col]).to_list() if val_col and val_col in clean_sub.columns else '#059669'
    
    # Size scaling
    if size_col and size_col in clean_sub.columns:
        raw_sizes = _clean_series(clean_sub[size_col]).to_numpy()
        min_s, max_s = np.min(raw_sizes), np.max(raw_sizes)
        if max_s > min_s:
            marker_sizes = (raw_sizes - min_s) / (max_s - min_s) * (point_size * 2.5 - point_size * 0.5) + point_size * 0.5
        else:
            marker_sizes = np.full_like(raw_sizes, point_size)
    else:
        marker_sizes = point_size
        
    # Hover text
    if hover_col and hover_col in clean_sub.columns:
        hover_raw = clean_sub[hover_col].to_list()
        if val_col and val_col in clean_sub.columns:
            hover_text = [f"<b>{h}</b><br>{val_col}: {v:.2f}<br>Lat: {lt:.4f}, Lon: {ln:.4f}" for h, v, lt, ln in zip(hover_raw, color_vals, lat_vals, lon_vals)]
        else:
            hover_text = [f"<b>{h}</b><br>Lat: {lt:.4f}, Lon: {ln:.4f}" for h, lt, ln in zip(hover_raw, lat_vals, lon_vals)]
    elif val_col and val_col in clean_sub.columns:
        hover_text = [f"{val_col}: {v:.2f}<br>Lat: {lt:.4f}, Lon: {ln:.4f}" for v, lt, ln in zip(color_vals, lat_vals, lon_vals)]
    else:
        hover_text = [f"Lat: {lt:.4f}, Lon: {ln:.4f}" for lt, ln in zip(lat_vals, lon_vals)]
        
    fig = go.Figure()
    
    # Traces according to viz_mode
    if viz_mode == 'density':
        fig.add_trace(go.Densitymapbox(
            lat=lat_vals,
            lon=lon_vals,
            z=color_vals if isinstance(color_vals, list) else None,
            radius=int(point_size * 2),
            colorscale=palette,
            opacity=point_opacity,
            hoverinfo='text',
            hovertext=hover_text,
            colorbar=dict(title=val_col or 'Density', len=0.75, thickness=12) if val_col else None
        ))
    elif viz_mode == 'track':
        # Track line
        fig.add_trace(go.Scattermapbox(
            lat=lat_vals,
            lon=lon_vals,
            mode='lines',
            line=dict(width=3, color='#0284c7'),
            hoverinfo='none',
            showlegend=False
        ))
        # Waypoints
        fig.add_trace(go.Scattermapbox(
            lat=lat_vals,
            lon=lon_vals,
            mode='markers',
            marker=dict(
                size=marker_sizes,
                color=color_vals,
                colorscale=palette,
                showscale=bool(val_col and isinstance(color_vals, list)),
                colorbar=dict(title=val_col, len=0.75, thickness=12) if val_col else None,
                opacity=point_opacity
            ),
            hoverinfo='text',
            hovertext=hover_text,
            showlegend=False
        ))
    else: # Default: Scatter Bubble
        fig.add_trace(go.Scattermapbox(
            lat=lat_vals,
            lon=lon_vals,
            mode='markers',
            marker=dict(
                size=marker_sizes,
                color=color_vals,
                colorscale=palette,
                showscale=bool(val_col and isinstance(color_vals, list)),
                colorbar=dict(title=val_col, len=0.75, thickness=12) if val_col else None,
                opacity=point_opacity
            ),
            hoverinfo='text',
            hovertext=hover_text,
            showlegend=False
        ))
        
    # Map Tile Providers
    if map_type == 'satellite':
        mapbox_cfg = dict(
            style="white-bg",
            layers=[
                dict(
                    below='traces',
                    sourcetype="raster",
                    source=["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"]
                )
            ]
        )
    elif map_type == 'topo':
        mapbox_cfg = dict(
            style="white-bg",
            layers=[
                dict(
                    below='traces',
                    sourcetype="raster",
                    source=["https://a.tile.opentopomap.org/{z}/{x}/{y}.png"]
                )
            ]
        )
    elif map_type == 'darkmatter':
        mapbox_cfg = dict(style="carto-darkmatter")
    elif map_type == 'positron':
        mapbox_cfg = dict(style="carto-positron")
    else: # Default OSM
        mapbox_cfg = dict(style="open-street-map")
        
    mapbox_cfg.update(
        center=dict(lat=center_lat, lon=center_lon),
        zoom=zoom_level
    )
    
    calc_w, calc_h = _calc_aspect_dimensions(w_cm, h_cm, max_w=1200, max_h=750)
    
    fig.update_layout(
        width=calc_w,
        height=calc_h,
        autosize=False,
        mapbox=mapbox_cfg,
        margin=dict(l=0, r=0, t=0, b=0),
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(family="Outfit, sans-serif", color='#0f172a')
    )
    
    return fig

