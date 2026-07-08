"""
PSC Bridge Cross-Section -> DXF generator
Draws a TRUE-TO-SCALE engineering cross-section of a Prestressed Concrete (PSC) bridge.
Supports both PSC I-Girders (with flange tapers/fillets) and Rectangular Girders.
Generates a DXF file using ezdxf and provides an interactive tkinter GUI.

All coordinates are in millimetres (real-world scale).
"""

import math
import ezdxf
from ezdxf.enums import TextEntityAlignment

# ----------------------------------------------------------------------
# 0. COLORS
# ----------------------------------------------------------------------

QT_COLORS = {
    'GIRDER':         (200, 202, 205),   # Concrete light grey
    'DIAPHRAGM':       (180, 182, 185),   # Concrete medium-light grey
    'RAILING':         (220, 220, 220),
    'RAILING_BASE':    (225, 225, 225),
    'RAILING_VOID':    (170, 170, 170),
    'RAILING_VOID_EDGE': (130, 130, 130),
    'CRASH_BARRIER':   (220, 220, 220),
    'DECK':            (225, 225, 225),
    'FOOTPATH':        (225, 225, 225),
    'MEDIAN':          (221, 221, 221),
    'BEARING':         (90, 90, 90),      # Neoprene dark grey bearing pad
    'WEARING_COAT':    (80, 80, 80),      # Asphalt wearing course
    'OUTLINE':         (120, 120, 120),
    'DIM_TEXT':        (255, 255, 255),
    'CENTERLINE':      (255, 0, 0),
}

# ----------------------------------------------------------------------
# 1. PARAMETERS
# ----------------------------------------------------------------------

params = {
    'span_length': 30000,
    'num_girders': 4,
    'girder_spacing': 2500,
    'carriageway_width': 7500,
    'skew_angle': 0,
    'deck_thickness': 220,
    'footpath_width': 1500,
    'footpath_thickness': 200,
    'footpath_config': 'bothside',       # 'bothside' | 'oneside (left)' | 'oneside (right)' | 'no'
    'deck_overhang': 900,
    'railing_width': 375,
    'railing_height': 1000,
    'crash_barrier_width': 525,
    'median_present': False,
    'median_width': 1200,
    'wearing_coat_thickness': 50,
    'diaphragm_spacing': 6000,
}

girder = {
    'type': 'I-Girder',                  # 'I-Girder' | 'Rectangular'
    'depth': 1800,                       # total girder depth (mm)
    'top_flange_width': 600,             # b1 (mm)
    'top_flange_thickness': 150,         # t1 (mm)
    'top_flange_taper_height': 100,      # t2 (mm)
    'bottom_flange_width': 700,          # b2 (mm)
    'bottom_flange_thickness': 250,      # t3 (mm)
    'bottom_flange_taper_height': 150,   # t4 (mm)
    'web_thickness': 200,                # tw (mm)
}

bearing = {
    'present': True,
    'width': 400,
    'height': 80,
}

diaphragm = {
    'present': True,
    'thickness': 300,                    # (informative)
}

crash_barrier = {
    'total_height': 900,
    'bottom_width': 525,
    'base_vertical': 150,
    'mid_offset': 450,
}

railing = {
    'outer_width': 375,
    'height': 1000,
    'inner_spacing': 275,
    'base_thickness': 100,
}

# ----------------------------------------------------------------------
# 2. LAYOUT MATH
# ----------------------------------------------------------------------

def normalize_fp_config(fp_config):
    if not isinstance(fp_config, str):
        return 'none'
    cfg = fp_config.lower().strip()
    if cfg in ('both', 'bothside', 'bothsides'):
        return 'both'
    elif cfg in ('left', 'oneside (left)', 'oneside_left', 'leftside'):
        return 'left'
    elif cfg in ('right', 'oneside (right)', 'oneside_right', 'rightside'):
        return 'right'
    elif cfg in ('oneside', 'one side'):
        return 'left'
    else:
        return 'none'


def compute_deck_total_width(p):
    carriageway = p['carriageway_width']
    cb_w = p['crash_barrier_width']
    fp_w = p['footpath_width']
    fp_config = normalize_fp_config(p['footpath_config'])
    median_present = p['median_present']
    median_w = p['median_width']
    rail_w = p['railing_width']

    num_fp = {'both': 2, 'left': 1, 'right': 1, 'none': 0}.get(fp_config, 0)
    carriageway_total = carriageway * 2 if median_present else carriageway
    median = median_w if median_present else 0

    deck_total = (
        carriageway_total
        + median
        + 2 * cb_w
        + num_fp * (fp_w + rail_w)
    )
    return deck_total, num_fp


def build_layout(p, g):
    """Compute all key x-coordinates (mm) for the cross-section, left to right."""
    total_deck_width, _ = compute_deck_total_width(p)

    fp_config = normalize_fp_config(p['footpath_config'])
    left_fp_w = p['footpath_width'] if fp_config in ('left', 'both') else 0
    right_fp_w = p['footpath_width'] if fp_config in ('right', 'both') else 0
    left_rail_present = fp_config in ('left', 'both')
    right_rail_present = fp_config in ('right', 'both')
    rail_w = p['railing_width']
    cb_w = p['crash_barrier_width']

    # Centerline at x = 0
    deck_left_x = -total_deck_width / 2.0
    deck_right_x = deck_left_x + total_deck_width

    left_rail_w = rail_w if left_rail_present else 0
    right_rail_w = rail_w if right_rail_present else 0

    left_fp_x = deck_left_x + left_rail_w
    left_barrier_x = left_fp_x + left_fp_w
    left_barrier_end_x = left_barrier_x + cb_w

    right_fp_x = deck_right_x - right_rail_w - right_fp_w
    right_barrier_end_x = right_fp_x
    right_barrier_x = right_barrier_end_x - cb_w

    carriageway_start_x = left_barrier_end_x
    carriageway_end_x = right_barrier_x

    median_present = p['median_present']
    median_w = p['median_width']
    if median_present:
        cw_full = p['carriageway_width']
        cw1_start_x = left_barrier_end_x
        cw1_end_x = cw1_start_x + cw_full
        median_start_x = cw1_end_x
        median_end_x = median_start_x + median_w
        cw2_start_x = median_end_x
        cw2_end_x = cw2_start_x + cw_full
        carriageway_start_x = cw1_start_x
        carriageway_end_x = cw2_end_x
    else:
        median_start_x = None
        median_end_x = None

    # Girder positions
    n = max(1, int(p['num_girders']))
    overhang = p['deck_overhang']
    if n > 1:
        first_girder_x = deck_left_x + overhang
        last_girder_x = deck_right_x - overhang
        spacing = (last_girder_x - first_girder_x) / (n - 1)
        girder_positions = [first_girder_x + i * spacing for i in range(n)]
    else:
        girder_positions = [0.0]

    return {
        'total_deck_width': total_deck_width,
        'deck_left_x': deck_left_x,
        'deck_right_x': deck_right_x,
        'left_fp_x': left_fp_x,
        'left_fp_w': left_fp_w,
        'left_barrier_x': left_barrier_x,
        'left_barrier_end_x': left_barrier_end_x,
        'right_fp_x': right_fp_x,
        'right_fp_w': right_fp_w,
        'right_barrier_x': right_barrier_x,
        'right_barrier_end_x': right_barrier_end_x,
        'carriageway_start_x': carriageway_start_x,
        'carriageway_end_x': carriageway_end_x,
        'median_start_x': median_start_x,
        'median_end_x': median_end_x,
        'median_present': median_present,
        'girder_positions': girder_positions,
        'left_rail_w': left_rail_w,
        'right_rail_w': right_rail_w,
        'cb_w': cb_w,
        'n_girders': n,
    }


def build_levels(p, g):
    girder_depth = g['depth']
    deck_thk = p['deck_thickness']
    fp_thk = p['footpath_thickness']
    wc_thk = p['wearing_coat_thickness']

    base_y = 0.0                          # bottom of girder bottom flange
    girder_top_y = base_y + girder_depth  # top of girder (= soffit datum for deck)
    deck_bottom_y = girder_top_y
    deck_top_y = deck_bottom_y + deck_thk
    wc_top_y = deck_top_y + wc_thk
    fp_bottom_y = deck_bottom_y
    fp_top_y = fp_bottom_y + fp_thk

    return {
        'base_y': base_y,
        'girder_top_y': girder_top_y,
        'deck_bottom_y': deck_bottom_y,
        'deck_top_y': deck_top_y,
        'wc_top_y': wc_top_y,
        'fp_bottom_y': fp_bottom_y,
        'fp_top_y': fp_top_y,
    }

# ----------------------------------------------------------------------
# 3. DXF DRAWING HELPERS
# ----------------------------------------------------------------------

def setup_doc():
    doc = ezdxf.new(dxfversion='R2010', setup=True)
    doc.units = ezdxf.units.MM

    layers = {
        'GIRDER':        {'rgb': QT_COLORS['GIRDER']},
        'DIAPHRAGM':     {'rgb': QT_COLORS['DIAPHRAGM']},
        'DECK':          {'rgb': QT_COLORS['DECK']},
        'FOOTPATH':      {'rgb': QT_COLORS['FOOTPATH']},
        'CRASH_BARRIER': {'rgb': QT_COLORS['CRASH_BARRIER']},
        'RAILING':       {'rgb': QT_COLORS['RAILING']},
        'RAILING_BASE':  {'rgb': QT_COLORS['RAILING_BASE']},
        'RAILING_VOID':  {'rgb': QT_COLORS['RAILING_VOID']},
        'MEDIAN':        {'rgb': QT_COLORS['MEDIAN']},
        'BEARING':       {'rgb': QT_COLORS['BEARING']},
        'WEARING_COAT':  {'rgb': QT_COLORS['WEARING_COAT']},
        'CENTERLINE':    {'rgb': QT_COLORS['CENTERLINE'], 'linetype': 'CENTER'},
        'DIMENSIONS':    {'rgb': QT_COLORS['DIM_TEXT']},
        'TEXT':          {'rgb': QT_COLORS['DIM_TEXT']},
        'OUTLINE':       {'rgb': QT_COLORS['OUTLINE']},
    }
    for name, attribs in layers.items():
        if name not in doc.layers:
            rgb = attribs.pop('rgb')
            layer = doc.layers.add(name=name, **attribs)
            layer.rgb = rgb

    return doc


def add_rect(msp, x, y, w, h, layer):
    pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': layer})


def add_polygon(msp, points, layer):
    msp.add_lwpolyline(points, close=True, dxfattribs={'layer': layer})


def draw_psc_girder(msp, x_center, base_y, g, layer='GIRDER'):
    """Draw a true-scale PSC girder centered at x_center, sitting on base_y."""
    g_type = g.get('type', 'I-Girder')
    D = g['depth']

    if g_type == 'Rectangular':
        b = g['top_flange_width']  # Use top_flange_width as width for rectangular girder
        add_rect(msp, x_center - b / 2, base_y, b, D, layer)
    else:
        # I-Girder with fillets/tapers
        b1 = g['top_flange_width']
        t1 = g['top_flange_thickness']
        t2 = g['top_flange_taper_height']
        b2 = g['bottom_flange_width']
        t3 = g['bottom_flange_thickness']
        t4 = g['bottom_flange_taper_height']
        tw = g['web_thickness']

        # Coordinates of the right half of the I-girder relative to (x_center, base_y)
        pts_right = [
            (0, 0),
            (b2 / 2, 0),
            (b2 / 2, t3),
            (tw / 2, t3 + t4),
            (tw / 2, D - t1 - t2),
            (b1 / 2, D - t1),
            (b1 / 2, D),
            (0, D)
        ]

        # Generate full polygon by mirroring right side
        pts = []
        for x, y in pts_right[:-1]:
            pts.append((x_center + x, base_y + y))
        pts.append((x_center, base_y + D))
        for x, y in reversed(pts_right[:-1]):
            pts.append((x_center - x, base_y + y))

        add_polygon(msp, pts, layer)


def draw_bearing(msp, x_center, base_y, brg, layer='BEARING'):
    """Draw elastomeric/neoprene bearing pad under the girder."""
    bw = brg['width']
    bh = brg['height']
    add_rect(msp, x_center - bw / 2, base_y - bh, bw, bh, layer)


def draw_crash_barrier(msp, x_edge, y_base, cb, side='left', layer='CRASH_BARRIER'):
    TOTAL_HEIGHT = cb['total_height']
    BOTTOM_WIDTH = cb['bottom_width']
    BASE_VERTICAL = cb['base_vertical']
    MID_OFFSET = cb['mid_offset']

    h = TOTAL_HEIGHT
    bottom_w = BOTTOM_WIDTH
    base_v = BASE_VERTICAL

    y_bottom = y_base
    y_base_top = y_base + base_v
    y_mid = y_base + MID_OFFSET
    y_top = y_base + h

    shape_scale = BOTTOM_WIDTH / 525.0
    right_at_mid = 300 * shape_scale
    left_at_top = 50 * shape_scale
    right_at_top = 225 * shape_scale

    if side == 'left':
        x0 = x_edge
        pts = [
            (x0, y_bottom),
            (x0 + bottom_w, y_bottom),
            (x0 + bottom_w, y_base_top),
            (x0 + right_at_mid, y_mid),
            (x0 + right_at_top, y_top),
            (x0 + left_at_top, y_top),
            (x0, y_base_top),
        ]
    else:
        x0 = x_edge
        pts = [
            (x0 - bottom_w, y_bottom),
            (x0, y_bottom),
            (x0, y_base_top),
            (x0 - left_at_top, y_top),
            (x0 - right_at_top, y_top),
            (x0 - right_at_mid, y_mid),
            (x0 - bottom_w, y_base_top),
        ]

    add_polygon(msp, pts, layer)


def draw_railing(msp, x_start, y_base, rl, layer='RAILING', void_layer='RAILING_VOID',
                  base_layer='RAILING_BASE'):
    OUTER_WIDTH_MM = rl['outer_width']
    RAILING_HEIGHT_MM = rl['height']
    INNER_SPACING_MM = rl.get('inner_spacing', 275)
    BASE_THICKNESS_MM = rl.get('base_thickness', 100)

    wall_t = (OUTER_WIDTH_MM - INNER_SPACING_MM) / 2

    outer_w = OUTER_WIDTH_MM
    inner_w = INNER_SPACING_MM
    base_h = BASE_THICKNESS_MM
    post_h = RAILING_HEIGHT_MM - base_h

    rect_x = x_start
    base_bottom_y = y_base
    base_top_y = y_base + base_h
    post_top_y = y_base + RAILING_HEIGHT_MM

    # 1. Concrete base block
    add_rect(msp, rect_x, base_bottom_y, outer_w, base_h, base_layer)

    # 2. Post body
    add_rect(msp, rect_x, base_top_y, outer_w, post_h, layer)

    # 3. Voids
    inner_x = rect_x + wall_t
    inner_top_margin = post_h * 0.03
    inner_bottom_margin = post_h * 0.03
    inner_height = post_h - inner_top_margin - inner_bottom_margin

    n_voids = 3
    void_w = inner_w * 0.7
    void_h = void_w

    if inner_w > 0 and inner_height > 0:
        void_spacing = (inner_height - n_voids * void_h) / (n_voids + 1)
        for i in range(n_voids):
            v_y = base_top_y + inner_top_margin + (i + 1) * void_spacing + i * void_h
            v_x = inner_x + (inner_w - void_w) / 2
            add_rect(msp, v_x, v_y, void_w, void_h, void_layer)

    return rect_x, base_bottom_y, rect_x + outer_w, post_top_y


def draw_median(msp, start_x, end_x, y_base, p, layer='MEDIAN'):
    w = end_x - start_x
    h = 250
    add_rect(msp, start_x, y_base, w, h, layer)


DIM_OVERRIDE = {
    'dimtxt': 120,
    'dimasz': 80,
    'dimexe': 40,
    'dimexo': 20,
    'dimlfac': 1.0,
}


def add_dim_horizontal(msp, x1, x2, y, text=None, offset=0, layer='DIMENSIONS'):
    dim = msp.add_linear_dim(
        base=(min(x1, x2), y + offset),
        p1=(x1, y),
        p2=(x2, y),
        dimstyle='EZDXF',
        override=DIM_OVERRIDE,
        dxfattribs={'layer': layer},
    )
    dim.render()


def add_dim_vertical(msp, y1, y2, x, offset=0, layer='DIMENSIONS'):
    dim = msp.add_linear_dim(
        base=(x + offset, min(y1, y2)),
        p1=(x, y1),
        p2=(x, y2),
        angle=90,
        dimstyle='EZDXF',
        override=DIM_OVERRIDE,
        dxfattribs={'layer': layer},
    )
    dim.render()


def add_label(msp, x, y, text, height=180, layer='TEXT', align=TextEntityAlignment.MIDDLE_CENTER):
    txt = msp.add_text(text, dxfattribs={'layer': layer, 'height': height})
    txt.set_placement((x, y), align=align)

def draw_longitudinal_section(msp, x_start, base_y, p, g, brg, dia, cb, rl):
    """Draw a true-scale longitudinal section (elevation) of the bridge span."""
    L = p['span_length']
    D = g['depth']
    t_deck = p['deck_thickness']
    t_wc = p['wearing_coat_thickness']
    brg_offset = 500.0  # mm offset from girder ends to bearing center
    
    x_end = x_start + L
    
    # Verticals
    deck_bottom_y = base_y + D
    deck_top_y = deck_bottom_y + t_deck
    wc_top_y = deck_top_y + t_wc
    
    # 1. Girder elevation outline
    add_rect(msp, x_start, base_y, L, D, layer='GIRDER')
    
    # 2. Girder internal flange lines (for I-Girder)
    if g.get('type', 'I-Girder') == 'I-Girder':
        t1 = g['top_flange_thickness']
        t2 = g['top_flange_taper_height']
        t3 = g['bottom_flange_thickness']
        t4 = g['bottom_flange_taper_height']
        
        # Draw top flange lines
        msp.add_line((x_start, base_y + D - t1), (x_end, base_y + D - t1), dxfattribs={'layer': 'OUTLINE'})
        msp.add_line((x_start, base_y + D - t1 - t2), (x_end, base_y + D - t1 - t2), dxfattribs={'layer': 'OUTLINE', 'linetype': 'DASHED'})
        
        # Draw bottom flange lines
        msp.add_line((x_start, base_y + t3), (x_end, base_y + t3), dxfattribs={'layer': 'OUTLINE'})
        msp.add_line((x_start, base_y + t3 + t4), (x_end, base_y + t3 + t4), dxfattribs={'layer': 'OUTLINE', 'linetype': 'DASHED'})
        
    # 3. Deck slab
    add_rect(msp, x_start, deck_bottom_y, L, t_deck, layer='DECK')
    
    # 4. Wearing coat
    add_rect(msp, x_start, deck_top_y, L, t_wc, layer='WEARING_COAT')
    
    # 5. Railing / Crash barrier on top
    h_cb = cb['total_height']
    # Draw simple outline of railing and barrier in elevation
    add_rect(msp, x_start, deck_top_y, L, h_cb, layer='CRASH_BARRIER')
    add_rect(msp, x_start, deck_top_y + h_cb, L, rl['height'] - h_cb if rl['height'] > h_cb else 200, layer='RAILING')
    
    # 6. Bearings
    if brg['present']:
        bh = brg['height']
        bw = brg['width']
        # Left bearing
        add_rect(msp, x_start + brg_offset - bw/2, base_y - bh, bw, bh, layer='BEARING')
        # Right bearing
        add_rect(msp, x_end - brg_offset - bw/2, base_y - bh, bw, bh, layer='BEARING')
        
    # 7. Diaphragms in elevation
    if dia['present']:
        span_effective = L - 2 * brg_offset
        num_spaces = max(1, int(round(span_effective / p['diaphragm_spacing'])))
        actual_spacing = span_effective / num_spaces
        
        dia_w = dia['thickness']
        
        # Vertical limits for diaphragm
        if g['type'] == 'I-Girder':
            dia_y_min = base_y + g['bottom_flange_thickness'] + g['bottom_flange_taper_height']
            dia_y_max = base_y + g['depth'] - g['top_flange_thickness'] - g['top_flange_taper_height']
        else:
            dia_y_min = base_y
            dia_y_max = base_y + g['depth']
        dia_h = dia_y_max - dia_y_min
        
        # Draw diaphragms at bearing lines and intermediates
        for i in range(num_spaces + 1):
            dia_x = x_start + brg_offset + i * actual_spacing
            add_rect(msp, dia_x - dia_w/2, dia_y_min, dia_w, dia_h, layer='DIAPHRAGM')
            
    # 8. Outline (Pier cap reference level below bearings)
    outline_y = base_y - brg['height'] if brg['present'] else base_y
    msp.add_line((x_start - 1000, outline_y), (x_end + 1000, outline_y),
                 dxfattribs={'layer': 'OUTLINE', 'linetype': 'DASHED'})
                 
    # 9. Dimensions
    # Horizontal span dimension
    dim_y = deck_top_y + 1600
    add_dim_horizontal(msp, x_start, x_end, dim_y, offset=500)
    # Bearing center-to-center
    add_dim_horizontal(msp, x_start + brg_offset, x_end - brg_offset, dim_y, offset=1200)
    # Diaphragm spacing
    if dia['present'] and num_spaces > 1:
        dim_dia_y = base_y - 1200
        for i in range(num_spaces):
            x1 = x_start + brg_offset + i * actual_spacing
            x2 = x1 + actual_spacing
            add_dim_horizontal(msp, x1, x2, dim_dia_y)
            
    # Vertical dimension column
    dim_x = x_end + 1200
    add_dim_vertical(msp, base_y, base_y + D, dim_x)
    add_dim_vertical(msp, deck_bottom_y, deck_top_y, dim_x, offset=500)
    add_dim_vertical(msp, deck_top_y, wc_top_y, dim_x, offset=1000)
    if brg['present']:
        add_dim_vertical(msp, base_y - brg['height'], base_y, dim_x, offset=1500)
        
    # Labels
    add_label(msp, x_start + L/2, deck_top_y + 2500, "LONGITUDINAL SECTION (ELEVATION)", height=300)
    add_label(msp, x_start + brg_offset, base_y - brg['height'] - 800, "LEFT SUPPORT", height=120)
    add_label(msp, x_end - brg_offset, base_y - brg['height'] - 800, "RIGHT SUPPORT", height=120)


# ----------------------------------------------------------------------
# 4. MAIN BUILD DRAWING
# ----------------------------------------------------------------------

def build_drawing(p=params, g=girder, brg=bearing, dia=diaphragm, cb=crash_barrier, rl=railing,
                   out_path='bridge_cross_section_psc.dxf'):

    layout = build_layout(p, g)
    levels = build_levels(p, g)

    doc = setup_doc()
    msp = doc.modelspace()

    base_y = levels['base_y']
    deck_top_y = levels['deck_top_y']
    deck_bottom_y = levels['deck_bottom_y']
    fp_top_y = levels['fp_top_y']
    fp_bottom_y = levels['fp_bottom_y']
    wc_top_y = levels['wc_top_y']

    deck_left_x = layout['deck_left_x']
    deck_right_x = layout['deck_right_x']

    # ---- Centerline ----
    msp.add_line((0, base_y - 1000), (0, deck_top_y + 3000),
                 dxfattribs={'layer': 'CENTERLINE'})

    # ---- Diaphragms (concrete diaphragms between adjacent webs) ----
    if dia['present'] and layout['n_girders'] > 1:
        # Compute vertical limits for diaphragm connecting the webs
        if g['type'] == 'I-Girder':
            dia_y_min = base_y + g['bottom_flange_thickness'] + g['bottom_flange_taper_height']
            dia_y_max = base_y + g['depth'] - g['top_flange_thickness'] - g['top_flange_taper_height']
        else:
            dia_y_min = base_y
            dia_y_max = base_y + g['depth']
        
        dia_h = dia_y_max - dia_y_min
        positions = layout['girder_positions']
        web_t = g['web_thickness'] if g['type'] == 'I-Girder' else g['top_flange_width']

        for i in range(layout['n_girders'] - 1):
            x1 = positions[i] + web_t / 2
            x2 = positions[i + 1] - web_t / 2
            if x2 > x1:
                add_rect(msp, x1, dia_y_min, x2 - x1, dia_h, layer='DIAPHRAGM')

    # ---- Deck slab ----
    add_rect(msp, deck_left_x, deck_bottom_y, layout['total_deck_width'],
             deck_top_y - deck_bottom_y, layer='DECK')

    # ---- Wearing coat ----
    cw_start = layout['carriageway_start_x']
    cw_end = layout['carriageway_end_x']
    if layout['median_present']:
        add_rect(msp, cw_start, deck_top_y, layout['median_start_x'] - cw_start,
                 wc_top_y - deck_top_y, layer='WEARING_COAT')
        add_rect(msp, layout['median_end_x'], deck_top_y, cw_end - layout['median_end_x'],
                 wc_top_y - deck_top_y, layer='WEARING_COAT')
    else:
        add_rect(msp, cw_start, deck_top_y, cw_end - cw_start,
                 wc_top_y - deck_top_y, layer='WEARING_COAT')

    # ---- Footpaths ----
    fp_config = normalize_fp_config(p['footpath_config'])
    if fp_config in ('left', 'both') and layout['left_fp_w'] > 0:
        add_rect(msp, layout['left_fp_x'], fp_bottom_y, layout['left_fp_w'],
                 fp_top_y - fp_bottom_y, layer='FOOTPATH')
    if fp_config in ('right', 'both') and layout['right_fp_w'] > 0:
        add_rect(msp, layout['right_fp_x'], fp_bottom_y, layout['right_fp_w'],
                 fp_top_y - fp_bottom_y, layer='FOOTPATH')

    # ---- Crash barriers ----
    draw_crash_barrier(msp, layout['left_barrier_x'], deck_top_y, cb, side='left')
    draw_crash_barrier(msp, layout['right_barrier_end_x'], deck_top_y, cb, side='right')

    # ---- Railings ----
    if fp_config in ('left', 'both') and layout['left_rail_w'] > 0:
        draw_railing(msp, deck_left_x, fp_top_y, rl)
    if fp_config in ('right', 'both') and layout['right_rail_w'] > 0:
        draw_railing(msp, deck_right_x - rl['outer_width'], fp_top_y, rl)

    # ---- Median ----
    if layout['median_present']:
        draw_median(msp, layout['median_start_x'], layout['median_end_x'], deck_top_y, p)

    # ---- Girders + Bearings ----
    for gx in layout['girder_positions']:
        draw_psc_girder(msp, gx, base_y, g)
        if brg['present']:
            draw_bearing(msp, gx, base_y, brg)

    # ---- Outline (Pier cap reference level below bearings) ----
    outline_y = base_y - brg['height'] if brg['present'] else base_y
    msp.add_line((deck_left_x, outline_y), (deck_right_x, outline_y),
                 dxfattribs={'layer': 'OUTLINE', 'linetype': 'DASHED'})

    # ---- Dimensions ----
    right_x = deck_right_x

    # Horizontal above deck
    dim_y1 = deck_top_y + 2800
    add_dim_horizontal(msp, deck_left_x, deck_right_x, dim_y1)

    dim_y2 = deck_top_y + 2200
    add_dim_horizontal(msp, layout['carriageway_start_x'], layout['carriageway_end_x'], dim_y2)

    dim_y3 = deck_top_y + 1600
    add_dim_horizontal(msp, deck_left_x, layout['girder_positions'][0], dim_y3)
    add_dim_horizontal(msp, layout['girder_positions'][-1], deck_right_x, dim_y3)

    dim_y4 = deck_top_y + 1000
    add_dim_horizontal(msp, layout['left_barrier_x'], layout['left_barrier_end_x'], dim_y4)
    add_dim_horizontal(msp, layout['right_barrier_x'], layout['right_barrier_end_x'], dim_y4)

    dim_y5 = deck_top_y + 400
    if layout['left_fp_w'] > 0:
        add_dim_horizontal(msp, layout['left_fp_x'], layout['left_fp_x'] + layout['left_fp_w'], dim_y5)
    if layout['right_fp_w'] > 0:
        add_dim_horizontal(msp, layout['right_fp_x'], layout['right_fp_x'] + layout['right_fp_w'], dim_y5)

    # Girder spacing below soffit
    dim_gs = base_y - 1200
    for i in range(layout['n_girders'] - 1):
        add_dim_horizontal(msp, layout['girder_positions'][i], layout['girder_positions'][i + 1], dim_gs)

    # Flange / Girder width
    gx0 = layout['girder_positions'][0]
    flange_dim_y = base_y - 2000
    if g['type'] == 'I-Girder':
        add_dim_horizontal(msp, gx0 - g['bottom_flange_width'] / 2, gx0 + g['bottom_flange_width'] / 2, flange_dim_y)
        add_dim_horizontal(msp, gx0 - g['web_thickness'] / 2, gx0 + g['web_thickness'] / 2, flange_dim_y - 500)
    else:
        add_dim_horizontal(msp, gx0 - g['top_flange_width'] / 2, gx0 + g['top_flange_width'] / 2, flange_dim_y)

    # Vertical left column
    left_dim_x = deck_left_x - 1200
    add_dim_vertical(msp, base_y, base_y + g['depth'], left_dim_x)
    add_dim_vertical(msp, deck_bottom_y, deck_top_y, left_dim_x, offset=-500)
    add_dim_vertical(msp, deck_top_y, wc_top_y, left_dim_x, offset=-1000)
    if layout['left_fp_w'] > 0:
        add_dim_vertical(msp, fp_bottom_y, fp_top_y, left_dim_x, offset=-1500)

    # Vertical right column: girder heights
    right_dim_x = right_x + 800
    if g['type'] == 'I-Girder':
        add_dim_vertical(msp, base_y, base_y + g['bottom_flange_thickness'], right_dim_x)
        web_bot = base_y + g['bottom_flange_thickness']
        web_top = base_y + g['depth'] - g['top_flange_thickness']
        add_dim_vertical(msp, web_bot, web_top, right_dim_x, offset=500)
        add_dim_vertical(msp, web_top, base_y + g['depth'], right_dim_x, offset=1000)
    else:
        add_dim_vertical(msp, base_y, base_y + g['depth'], right_dim_x)

    if brg['present']:
        add_dim_vertical(msp, base_y - brg['height'], base_y, right_dim_x, offset=1500)

    # Labels
    add_label(msp, 0, deck_top_y + 3300, f"PSC BRIDGE CROSS-SECTION ({g['type'].upper()})", height=300)
    add_label(msp, 0, deck_top_y + 2900,
              f"Span = {p['span_length']} mm | Girders = {layout['n_girders']} | "
              f"Carriageway = {p['carriageway_width']} mm",
              height=150)

    for gx in layout['girder_positions']:
        add_label(msp, gx, base_y - 800 if brg['present'] else base_y - 500, f"PSC GIRDER\nD={g['depth']}", height=100)

    # ---- Longitudinal Section ----
    long_x_start = layout['total_deck_width'] / 2 + 5000
    draw_longitudinal_section(msp, long_x_start, base_y, p, g, brg, dia, cb, rl)

    # Save
    doc.saveas(out_path)
    return out_path, layout, levels


# ----------------------------------------------------------------------
# 5. TKINTER GUI
# ----------------------------------------------------------------------

if __name__ == '__main__':
    import tkinter as tk
    from tkinter import ttk, filedialog, messagebox
    import copy, threading

    # ── field definitions: (label, dict_name, key, type)
    FIELDS = [
        # Bridge / Deck
        ("── Bridge ──", None, None, None),
        ("Span Length (mm)",            "params", "span_length",             int),
        ("Num Girders",                 "params", "num_girders",              int),
        ("Girder Spacing (mm)",         "params", "girder_spacing",           int),
        ("Carriageway Width (mm)",      "params", "carriageway_width",        int),
        ("Skew Angle (°)",              "params", "skew_angle",               float),
        ("Deck Thickness (mm)",         "params", "deck_thickness",           int),
        ("Deck Overhang (mm)",          "params", "deck_overhang",            int),
        ("Wearing Coat Thickness (mm)", "params", "wearing_coat_thickness",   int),
        # Footpath
        ("── Footpath ──", None, None, None),
        ("Footpath Width (mm)",         "params", "footpath_width",           int),
        ("Footpath Thickness (mm)",     "params", "footpath_thickness",       int),
        ("Footpath Config",             "params", "footpath_config",          str),   # combo
        # Railing
        ("── Railing ──", None, None, None),
        ("Railing Width (mm)",          "params", "railing_width",            int),
        ("Railing Height (mm)",         "params", "railing_height",           int),
        ("Railing Inner Spacing (mm)",  "railing","inner_spacing",            int),
        ("Railing Base Thickness (mm)", "railing","base_thickness",           int),
        # Crash barrier
        ("── Crash Barrier ──", None, None, None),
        ("CB Width (mm)",               "params",       "crash_barrier_width",  int),
        ("CB Total Height (mm)",        "crash_barrier","total_height",         int),
        ("CB Bottom Width (mm)",        "crash_barrier","bottom_width",         int),
        ("CB Base Vertical (mm)",       "crash_barrier","base_vertical",        int),
        ("CB Mid Offset (mm)",          "crash_barrier","mid_offset",           int),
        # Median
        ("── Median ──", None, None, None),
        ("Median Present",              "params", "median_present",           bool),  # check
        ("Median Width (mm)",           "params", "median_width",             int),
        # Girder
        ("── PSC Girder ──", None, None, None),
        ("Girder Type",                 "girder", "type",                     str),   # combo
        ("Girder Depth (mm)",           "girder", "depth",                    int),
        ("Top Flange Width (mm)",       "girder", "top_flange_width",         int),
        ("Top Flange Thickness (mm)",   "girder", "top_flange_thickness",     int),
        ("Top Flange Taper Ht (mm)",    "girder", "top_flange_taper_height",  int),
        ("Bot Flange Width (mm)",       "girder", "bottom_flange_width",      int),
        ("Bot Flange Thickness (mm)",   "girder", "bottom_flange_thickness",  int),
        ("Bot Flange Taper Ht (mm)",    "girder", "bottom_flange_taper_height", int),
        ("Web Thickness (mm)",          "girder", "web_thickness",            int),
        # Bearing
        ("── Bearing ──", None, None, None),
        ("Bearing Present",             "bearing","present",                  bool),
        ("Bearing Width (mm)",          "bearing","width",                    int),
        ("Bearing Height (mm)",         "bearing","height",                   int),
        # Diaphragm
        ("── Diaphragm ──", None, None, None),
        ("Diaphragm Present",           "diaphragm","present",                bool),
        ("Diaphragm Thickness (mm)",    "diaphragm","thickness",              int),
        ("Diaphragm Spacing (mm)",      "params",   "diaphragm_spacing",      int),
    ]

    FP_OPTIONS = ["bothside", "oneside (left)", "oneside (right)", "no"]
    GIRDER_TYPES = ["I-Girder", "Rectangular"]

    class BridgeGUI(tk.Tk):
        def __init__(self):
            super().__init__()
            self.title("PSC Bridge Cross-Section DXF Generator")
            self.resizable(True, True)
            self._build_ui()

        def _build_ui(self):
            top = tk.Frame(self)
            top.pack(fill="both", expand=True, padx=10, pady=8)

            canvas = tk.Canvas(top, highlightthickness=0)
            vsb = ttk.Scrollbar(top, orient="vertical", command=canvas.yview)
            canvas.configure(yscrollcommand=vsb.set)
            vsb.pack(side="right", fill="y")
            canvas.pack(side="left", fill="both", expand=True)

            inner = tk.Frame(canvas)
            win_id = canvas.create_window((0, 0), window=inner, anchor="nw")

            def _on_inner_configure(e):
                canvas.configure(scrollregion=canvas.bbox("all"))
            def _on_canvas_configure(e):
                canvas.itemconfig(win_id, width=e.width)
            inner.bind("<Configure>", _on_inner_configure)
            canvas.bind("<Configure>", _on_canvas_configure)

            def _on_mousewheel(e):
                canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
            canvas.bind_all("<MouseWheel>", _on_mousewheel)

            self._vars = {}

            for label, dict_name, key, typ in FIELDS:
                if dict_name is None:
                    # Determine unique index for correct grid placement
                    tk.Label(inner, text=label, font=("Helvetica", 9, "bold"),
                             fg="#555").grid(row=len(self._vars) + len([f for f in FIELDS if f[1] is None and FIELDS.index(f) <= FIELDS.index((label, dict_name, key, typ))]),
                                             column=0, columnspan=2, sticky="w", padx=4, pady=(10, 2))
                    continue

                src = {"params": params, "girder": girder, "bearing": bearing,
                       "diaphragm": diaphragm, "crash_barrier": crash_barrier,
                       "railing": railing}[dict_name]
                default = src[key]
                row = inner.grid_size()[1]

                tk.Label(inner, text=label, anchor="w").grid(
                    row=row, column=0, sticky="w", padx=6, pady=2)

                if typ is bool:
                    var = tk.BooleanVar(value=default)
                    ttk.Checkbutton(inner, variable=var).grid(
                        row=row, column=1, sticky="w", padx=6)
                elif key == "footpath_config":
                    var = tk.StringVar(value=default)
                    ttk.Combobox(inner, textvariable=var, values=FP_OPTIONS,
                                 width=12, state="readonly").grid(
                        row=row, column=1, sticky="ew", padx=6)
                elif key == "type":
                    var = tk.StringVar(value=default)
                    ttk.Combobox(inner, textvariable=var, values=GIRDER_TYPES,
                                 width=12, state="readonly").grid(
                        row=row, column=1, sticky="ew", padx=6)
                else:
                    var = tk.StringVar(value=str(default))
                    ttk.Entry(inner, textvariable=var, width=14).grid(
                        row=row, column=1, sticky="ew", padx=6)

                self._vars[(dict_name, key)] = (var, typ)

            inner.columnconfigure(1, weight=1)

            # Bottom bar
            bar = tk.Frame(self, bd=1, relief="groove")
            bar.pack(fill="x", padx=10, pady=6)

            tk.Label(bar, text="Output .dxf:").pack(side="left", padx=(4, 2))
            self._out_var = tk.StringVar(value="bridge_cross_section_psc.dxf")
            ttk.Entry(bar, textvariable=self._out_var, width=34).pack(side="left", padx=2)
            ttk.Button(bar, text="Browse…", command=self._browse).pack(side="left", padx=4)

            self._status = tk.StringVar(value="Ready.")
            tk.Label(bar, textvariable=self._status, fg="#336699",
                     anchor="w").pack(side="left", padx=10)

            ttk.Button(bar, text="Generate DXF", command=self._generate).pack(
                side="right", padx=6)

        def _browse(self):
            path = filedialog.asksaveasfilename(
                defaultextension=".dxf",
                filetypes=[("DXF files", "*.dxf"), ("All files", "*.*")],
                initialfile=self._out_var.get(),
            )
            if path:
                self._out_var.set(path)

        def _collect(self):
            p  = copy.deepcopy(params)
            g  = copy.deepcopy(girder)
            brg = copy.deepcopy(bearing)
            dia = copy.deepcopy(diaphragm)
            cb = copy.deepcopy(crash_barrier)
            rl = copy.deepcopy(railing)
            srcs = {"params": p, "girder": g, "bearing": brg, "diaphragm": dia,
                    "crash_barrier": cb, "railing": rl}
            errors = []
            for (dict_name, key), (var, typ) in self._vars.items():
                raw = var.get()
                try:
                    if typ is bool:
                        srcs[dict_name][key] = bool(raw)
                    elif typ is int:
                        srcs[dict_name][key] = int(raw)
                    elif typ is float:
                        srcs[dict_name][key] = float(raw)
                    else:
                        srcs[dict_name][key] = raw
                except ValueError:
                    errors.append(f"{dict_name}[{key}]: invalid value '{raw}'")
            if errors:
                raise ValueError("\n".join(errors))
            return p, g, brg, dia, cb, rl

        def _generate(self):
            try:
                p, g, brg, dia, cb, rl = self._collect()
            except ValueError as e:
                messagebox.showerror("Input Error", str(e))
                return

            out = self._out_var.get().strip()
            if not out:
                messagebox.showerror("Input Error", "Please specify an output file.")
                return

            self._status.set("Generating…")
            self.update_idletasks()

            def _run():
                try:
                    saved, layout, _ = build_drawing(p=p, g=g, brg=brg, dia=dia, cb=cb, rl=rl,
                                                     out_path=out)
                    msg = (f"Saved: {saved}\n"
                           f"Deck width: {layout['total_deck_width']:.0f} mm | "
                           f"Girders: {layout['n_girders']}")
                    self.after(0, lambda: self._status.set(msg))
                    self.after(0, lambda: messagebox.showinfo("Done", msg))
                except Exception as exc:
                    err = str(exc)
                    self.after(0, lambda: self._status.set(f"Error: {err}"))
                    self.after(0, lambda: messagebox.showerror("Generation Error", err))

            threading.Thread(target=_run, daemon=True).start()

    BridgeGUI().mainloop()
