"""
Bridge Cross-Section -> DXF generator
Mirrors the layout/geometry logic of CrossSectionCADWidget (OsdagBridge)
but draws a TRUE-TO-SCALE engineering cross-section (no visual exaggeration)
as a DXF file using ezdxf.

All coordinates are in millimetres (real-world scale), origin at the
bottom of the girder bottom flange, on the bridge centerline.

Author: generated for user request "make similar cad using dxf"
"""

import math
import ezdxf
from ezdxf.enums import TextEntityAlignment
from ezdxf.colors import rgb2int


# ----------------------------------------------------------------------
# 0. TRUE COLORS -- lifted directly from the QColor(...) constants in the
#    original CrossSectionCADWidget so the DXF matches the on-screen CAD.
# ----------------------------------------------------------------------

QT_COLORS = {
    'GIRDER':         (179, 180, 160),   # GIRDER_COLOR
    'STIFFENER':       (210, 210, 205),   # STIFFENER_COLOR
    'CROSS_BRACING':   (235, 236, 211),   # CROSS_BRACING_COLOR
    'CROSS_BRACING_EDGE': (106, 107, 95),  # CROSS_BRACING_COLOR.darker(220):
                                            # Qt's darker(f) = channel * 100 / f
    'RAILING':         (220, 220, 220),   # post body fill, from draw_rcc_railing:
                                           # painter.setBrush(QBrush(QColor(220, 220, 220)))
    'RAILING_BASE':    (225, 225, 225),   # base block uses self.concrete_brush (CONCRETE_COLOR)
    'RAILING_VOID':    (170, 170, 170),   # void fill: QBrush(QColor(170, 170, 170))
    'RAILING_VOID_EDGE': (130, 130, 130), # void border: QPen(QColor(130, 130, 130))
    'CRASH_BARRIER':   (220, 220, 220),   # BARRIER_COLOR
    'END_DIAPHRAGM':   (134, 134, 100),   # END_DIAPHRAGM_COLOR
    'DECK':            (225, 225, 225),   # CONCRETE_COLOR (deck slab + footpath + barrier fill)
    'FOOTPATH':        (225, 225, 225),   # CONCRETE_COLOR (same concrete brush as deck)
    'MEDIAN':          (221, 221, 221),   # MEDIAN_COLOR
    'BEARING':         (255, 0, 0),       # BEARING_COLOR
    # Not defined as named constants in the source, but used inline:
    'WEARING_COAT':    (80, 80, 80),       # asphalt wearing course - dark grey (typical convention)
    'OUTLINE':         (120, 120, 120),    # deck_outline_pen = QColor(120,120,120)
    'DIM_TEXT':        (255, 255, 255),    # white - visible on dark CAD viewer backgrounds
                                            # (source widget used black QColor(0,0,0), but that
                                            # assumed a white canvas; flipped here for dark theme)
    'CENTERLINE':      (255, 0, 0),        # standard CAD drafting convention, not in source
}


# ----------------------------------------------------------------------
# 1. PARAMETERS (mirrors self.params / self.girder / self.stiffener
#    defaults in the original Qt widget)
# ----------------------------------------------------------------------

params = {
    'span_length': 35000,
    'num_girders': 4,
    'girder_spacing': 2750,
    'cross_bracing_spacing': 3500,
    'carriageway_width': 10500,
    'skew_angle': 0,
    'deck_thickness': 200,
    'footpath_width': 1500,
    'footpath_thickness': 200,
    'crash_barrier_width': 525,    # must equal crash_barrier['bottom_width'] below -
                                    # mirrors source's _get_crash_barrier_rendered_width_mm(),
                                    # which reads the actual geometry footprint rather than
                                    # a separate generic KEY_CB_WIDTH default
    'railing_height': 1000,
    'footpath_config': 'bothside',       # 'bothside' | 'oneside (left)' | 'oneside (right)' | 'no'
    'deck_overhang': 1000,
    'railing_width': 375,
    'median_present': False,
    'median_width': 1200,
    'wearing_coat_thickness': 50,
}

girder = {
    'depth': 1500,                 # real plate-girder depth (mm) - structural, not the
                                    # 3x-exaggerated "visual" depth used on screen
    'top_flange_width': 450,
    'top_flange_thickness': 25,
    'bottom_flange_width': 450,
    'bottom_flange_thickness': 25,
    'web_thickness': 15,
}

stiffener = {
    'width': 150,
    'height': None,    # computed below
}

crash_barrier = {
    # IRC:5 RCC ("New Jersey" / High-Containment style) barrier profile -
    # ported from the source widget's draw_crash_barrier() RCC branch.
    # Reference shape constants below match the comment in the source:
    # "Reference shape is High Containment (bottom_width=525 mm)."
    'total_height': 900,      # TOTAL_HEIGHT (mm)
    'bottom_width': 525,      # BOTTOM_WIDTH (mm) - reference value from source comment
    'base_vertical': 150,     # BASE_VERTICAL (mm) - height of the vertical base portion
    'mid_offset': 450,        # MID_OFFSET (mm) - height at which the outer wall kinks inward
}

railing = {
    # RCC railing, ported from draw_rcc_railing() defaults in the source:
    # self.params.get('railing_width', 375) / self.params.get('railing_height', 1000)
    'outer_width': 375,       # OUTER_WIDTH_MM - matches params['railing_width']
    'height': 1000,           # RAILING_HEIGHT_MM - matches params['railing_height']
    'inner_spacing': 275,     # INNER_SPACING_MM - default for RCC, per source
    'base_thickness': 100,    # BASE_THICKNESS_MM - default for RCC, per source
}


# ----------------------------------------------------------------------
# 2. LAYOUT MATH  (ported 1:1 in spirit from compute_deck_total_width()
#    and draw_cross_section() in the source widget, but using REAL mm,
#    scale = 1.0, no girder_visual_scale exaggeration)
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
        return 'left'  # default to left for layout
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
    """Compute all key x-coordinates (mm) for the cross-section, left to right.
    Returns a dict of named coordinates."""

    total_deck_width, _ = compute_deck_total_width(p)

    fp_config = normalize_fp_config(p['footpath_config'])
    left_fp_w = p['footpath_width'] if fp_config in ('left', 'both') else 0
    right_fp_w = p['footpath_width'] if fp_config in ('right', 'both') else 0
    left_rail_present = fp_config in ('left', 'both')
    right_rail_present = fp_config in ('right', 'both')
    rail_w = p['railing_width']
    cb_w = p['crash_barrier_width']

    # Centerline at x = 0 -> deck runs from -W/2 to +W/2
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


# ----------------------------------------------------------------------
# 3. VERTICAL REFERENCE LEVELS (mm)
# ----------------------------------------------------------------------

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
    cb_top_y = deck_top_y + p['crash_barrier']['height'] if False else None  # unused placeholder

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
# 4. DXF DRAWING HELPERS
# ----------------------------------------------------------------------

def draw_cross_bracing(msp, x1, x2, y_bottom_left, y_top_left, y_bottom_right, y_top_right,
                        leg_size, thickness, layer='CROSS_BRACING'):
    """Draw a single diagonal cross-brace as an equal-angle (L) section,
    e.g. ISA 16x16x3 (leg_size=16, thickness=3), shown in elevation.

    Each brace is drawn as:
      - a rectangle of length L (the brace span) and width = leg_size (16) -
        this is the visible leg's full footprint, drawn from one long edge
        to the other (NOT offset from a centerline).
      - a second line, offset INWARD from one long edge by `thickness` (3) -
        representing the inner face of that leg (its wall thickness).

    Draws both diagonals of the X for the bay between x1 (left girder edge)
    and x2 (right girder edge):
      - "\\" brace (back):  from (x1, y_top_left) to (x2, y_bottom_right)
      - "/" brace (front): from (x1, y_bottom_left) to (x2, y_top_right)
    Only the front brace gets the inner-face line, since the back brace's
    inner face would be hidden behind it.
    """
    dx = x2 - x1

    def member(xa, ya, xb, yb, draw_inner_face=False):
        dyl = yb - ya
        length = math.hypot(dx, dyl)
        if length <= 0:
            return
        perp_x = -dyl / length
        perp_y = dx / length

        # Rectangle spans the full leg_size width, from one long edge to the
        # other - the centerline (xa,ya)-(xb,yb) is one of the OUTER edges,
        # not the middle. Outer edge = the (xa,ya)-(xb,yb) line itself.
        off_x = perp_x * leg_size
        off_y = perp_y * leg_size
        p1 = (xa, ya)
        p2 = (xb, yb)
        p3 = (xb + off_x, yb + off_y)
        p4 = (xa + off_x, ya + off_y)
        add_polygon(msp, [p1, p2, p3, p4], layer)
        msp.add_line(p1, p2, dxfattribs={'layer': 'CROSS_BRACING_EDGE'})
        msp.add_line(p4, p3, dxfattribs={'layer': 'CROSS_BRACING_EDGE'})

        if draw_inner_face:
            # Inner face line: offset INWARD from the (p1,p2) outer edge by
            # `thickness`, running parallel to it (same length, same span -
            # no axial inset needed since it's offset from an edge that
            # already sits exactly on the brace's true connection line).
            in_off_x = perp_x * thickness
            in_off_y = perp_y * thickness
            inner_p1 = (xa + in_off_x, ya + in_off_y)
            inner_p2 = (xb + in_off_x, yb + in_off_y)
            msp.add_line(inner_p1, inner_p2, dxfattribs={'layer': 'CROSS_BRACING_EDGE'})

    # "\" diagonal (back brace): no inner-face line (hidden behind front brace)
    member(x1, y_top_left, x2, y_bottom_right, draw_inner_face=False)
    # "/" diagonal (front brace): add inner-face line
    member(x1, y_bottom_left, x2, y_top_right, draw_inner_face=True)


def setup_doc():
    doc = ezdxf.new(dxfversion='R2010', setup=True)
    doc.units = ezdxf.units.MM

    # layer -> (aci fallback index, rgb true color)
    layers = {
        'GIRDER':        {'rgb': QT_COLORS['GIRDER']},
        'STIFFENER':     {'rgb': QT_COLORS['STIFFENER']},
        'CROSS_BRACING': {'rgb': QT_COLORS['CROSS_BRACING']},
        'CROSS_BRACING_EDGE': {'rgb': QT_COLORS['CROSS_BRACING_EDGE']},
        'DECK':          {'rgb': QT_COLORS['DECK']},
        'FOOTPATH':      {'rgb': QT_COLORS['FOOTPATH']},
        'CRASH_BARRIER': {'rgb': QT_COLORS['CRASH_BARRIER']},
        'RAILING':       {'rgb': QT_COLORS['RAILING']},
        'RAILING_BASE':  {'rgb': QT_COLORS['RAILING_BASE']},
        'RAILING_VOID':  {'rgb': QT_COLORS['RAILING_VOID']},
        'MEDIAN':        {'rgb': QT_COLORS['MEDIAN']},
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
            layer.rgb = rgb  # sets both true_color and a matching ACI approximation

    return doc


def add_rect(msp, x, y, w, h, layer):
    """Rectangle as a closed LWPOLYLINE, x,y = bottom-left corner."""
    pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': layer})


def add_polygon(msp, points, layer):
    msp.add_lwpolyline(points, close=True, dxfattribs={'layer': layer})


def draw_i_girder(msp, x_center, base_y, g, layer='GIRDER'):
    """Draw a true-scale I-section girder centered at x_center, sitting on base_y."""
    d = g['depth']
    bf_top = g['top_flange_width']
    tf_top = g['top_flange_thickness']
    bf_bot = g['bottom_flange_width']
    tf_bot = g['bottom_flange_thickness']
    tw = g['web_thickness']

    # bottom flange
    add_rect(msp, x_center - bf_bot / 2, base_y, bf_bot, tf_bot, layer)
    # web
    web_h = d - tf_top - tf_bot
    add_rect(msp, x_center - tw / 2, base_y + tf_bot, tw, web_h, layer)
    # top flange
    add_rect(msp, x_center - bf_top / 2, base_y + d - tf_top, bf_top, tf_top, layer)


def draw_stiffeners(msp, x_center, base_y, g, st, layer='STIFFENER'):
    """Pair of rectangular vertical stiffeners either side of the web,
    spanning the web height between flanges (simplified, no chamfer,
    true scale)."""
    tw = g['web_thickness']
    tf_top = g['top_flange_thickness']
    tf_bot = g['bottom_flange_thickness']
    stiff_w = st['width']

    stiff_bottom_y = base_y + tf_bot
    stiff_top_y = base_y + g['depth'] - tf_top
    stiff_h = stiff_top_y - stiff_bottom_y

    # left stiffener
    add_rect(msp, x_center - tw / 2 - stiff_w, stiff_bottom_y, stiff_w, stiff_h, layer)
    # right stiffener
    add_rect(msp, x_center + tw / 2, stiff_bottom_y, stiff_w, stiff_h, layer)


def draw_crash_barrier(msp, x_edge, y_base, cb, side='left', layer='CRASH_BARRIER'):
    """Draw the IRC-5 RCC crash-barrier profile, ported 1:1 from the source
    widget's draw_crash_barrier() RCC branch (CrashBarrierGeometry "rcc" type).

    Profile shape (New-Jersey / high-containment style):
      - vertical base wall from y_bottom up to y_base_top
      - outer wall kinks inward at y_mid (the characteristic "kerb kick")
      - outer + inner walls both lean inward further up to y_top
      - inner wall is a straight vertical face (traffic-side)

    x_edge = the deck-edge-side x of the barrier footprint (outer edge of deck).
    side='left'  -> barrier footprint extends to the RIGHT of x_edge (inboard)
    side='right' -> barrier footprint extends to the LEFT of x_edge (inboard)
    """
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

    # Reference shape is High Containment (bottom_width = 525 mm).
    # All offsets scale proportionally to the actual bottom_width, exactly
    # as in the source: shape_scale = BOTTOM_WIDTH / 525.0
    shape_scale = BOTTOM_WIDTH / 525.0
    right_at_mid = 300 * shape_scale   # outer wall x-offset at the kink (inflection)
    left_at_top = 50 * shape_scale     # inner wall x-offset at top (lean)
    right_at_top = 225 * shape_scale   # outer wall x-offset at top

    if side == 'left':
        x0 = x_edge
        pts = [
            (x0, y_bottom),                       # BL
            (x0 + bottom_w, y_bottom),             # BR
            (x0 + bottom_w, y_base_top),           # R1 (outer, vertical base)
            (x0 + right_at_mid, y_mid),            # R2 (outer wall kink)
            (x0 + right_at_top, y_top),            # TR (outer wall top)
            (x0 + left_at_top, y_top),             # TL (inner wall top, leans in)
            (x0, y_base_top),                      # L1 (inner, vertical base)
        ]
    else:
        # x_edge is the RIGHT edge of this barrier (mirrored profile)
        x0 = x_edge
        pts = [
            (x0 - bottom_w, y_bottom),             # BL
            (x0, y_bottom),                        # BR
            (x0, y_base_top),                       # R1 (inner, vertical base)
            (x0 - left_at_top, y_top),              # TR (inner wall top, leans in)
            (x0 - right_at_top, y_top),             # TL (outer wall top)
            (x0 - right_at_mid, y_mid),             # L2 (outer wall kink)
            (x0 - bottom_w, y_base_top),            # L1 (outer, vertical base)
        ]

    add_polygon(msp, pts, layer)


def draw_railing(msp, x_start, y_base, rl, layer='RAILING', void_layer='RAILING_VOID',
                  base_layer='RAILING_BASE'):
    """Draw the standard RCC railing, ported 1:1 from the source widget's
    draw_rcc_railing(): a concrete base block, a tall post above it, and
    3 evenly-spaced square voids (perforations) running up the post's
    height - NOT a simple post-with-horizontal-rails schematic.

    x_start = the outer (left) edge of the railing footprint (mm).
    y_base  = the bottom of the railing footprint (sits on the footpath top).
    """
    OUTER_WIDTH_MM = rl['outer_width']      # total railing width (mm) - 'railing_width' param
    RAILING_HEIGHT_MM = rl['height']        # total railing height (mm)
    INNER_SPACING_MM = rl.get('inner_spacing', 275)   # default for RCC, per source
    BASE_THICKNESS_MM = rl.get('base_thickness', 100)  # default for RCC, per source

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

    # 2. Post body (full outer width, from top of base to top of railing)
    add_rect(msp, rect_x, base_top_y, outer_w, post_h, layer)

    # 3. Three evenly-spaced square voids inside the post
    inner_x = rect_x + wall_t
    inner_top_margin = post_h * 0.03
    inner_bottom_margin = post_h * 0.03
    inner_height = post_h - inner_top_margin - inner_bottom_margin

    n_voids = 3
    void_w = inner_w * 0.7
    void_h = void_w  # squares

    if inner_w > 0 and inner_height > 0:
        void_spacing = (inner_height - n_voids * void_h) / (n_voids + 1)
        for i in range(n_voids):
            v_y = base_top_y + inner_top_margin + (i + 1) * void_spacing + i * void_h
            v_x = inner_x + (inner_w - void_w) / 2
            add_rect(msp, v_x, v_y, void_w, void_h, void_layer)

    return rect_x, base_bottom_y, rect_x + outer_w, post_top_y


def draw_median(msp, start_x, end_x, y_base, p, layer='MEDIAN'):
    """Simple raised-kerb median block, true scale."""
    w = end_x - start_x
    h = 250  # typical raised-kerb median height (mm) - adjust if needed
    add_rect(msp, start_x, y_base, w, h, layer)


DIM_OVERRIDE = {
    'dimtxt': 120,    # text height
    'dimasz': 80,     # arrow size
    'dimexe': 40,     # extension line extension
    'dimexo': 20,     # extension line offset
    'dimlfac': 1.0,   # length factor: override EZDXF setup default of 100
                       # (meant for 1:100 paper scale) so reported lengths match mm
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


# ----------------------------------------------------------------------
# 5. MAIN BUILD
# ----------------------------------------------------------------------

def build_drawing(p=params, g=girder, st=stiffener, cb=crash_barrier, rl=railing,
                   out_path='/mnt/user-data/outputs/bridge_cross_section.dxf'):

    # derive stiffener height (matches source widget's formula, used only for info)
    st['height'] = g['depth'] - g['top_flange_thickness'] - g['bottom_flange_thickness']

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
    msp.add_line((0, base_y - 500), (0, deck_top_y + 3000),
                 dxfattribs={'layer': 'CENTERLINE'})

    # ---- Deck slab (main slab, full width, between deck_bottom_y/deck_top_y) ----
    add_rect(msp, deck_left_x, deck_bottom_y, layout['total_deck_width'],
             deck_top_y - deck_bottom_y, layer='DECK')

    # ---- Wearing coat on top of carriageway region(s) ----
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

    # ---- Railing (on footpath outer edge, if present) ----
    # Matches source: railing_x = deck_left_x (left) / deck_right_x - outer_width (right)
    if fp_config in ('left', 'both') and layout['left_rail_w'] > 0:
        draw_railing(msp, deck_left_x, fp_top_y, rl)
    if fp_config in ('right', 'both') and layout['right_rail_w'] > 0:
        draw_railing(msp, deck_right_x - rl['outer_width'], fp_top_y, rl)

    # ---- Median ----
    if layout['median_present']:
        draw_median(msp, layout['median_start_x'], layout['median_end_x'], deck_top_y, p)

    # ---- Girders + stiffeners ----
    for gx in layout['girder_positions']:
        draw_i_girder(msp, gx, base_y, g)
        draw_stiffeners(msp, gx, base_y, g, st)

    # ---- Cross bracing (filled diagonal strips between adjacent girders,
    #      ported from source's perpendicular-offset polygon construction) ----
    n = layout['n_girders']
    positions = layout['girder_positions']
    if n > 1:
        brace_top_y = base_y + g['depth'] - g['top_flange_thickness']
        brace_bottom_y = base_y + g['bottom_flange_thickness']
        brace_leg_size = 16   # mm - ISA 16x16x3 equal angle: leg size
        brace_thickness = 3   # mm - ISA 16x16x3 equal angle: wall thickness
        for i in range(n - 1):
            x1 = positions[i] + g['web_thickness'] / 2
            x2 = positions[i + 1] - g['web_thickness'] / 2
            draw_cross_bracing(
                msp, x1, x2,
                y_bottom_left=brace_bottom_y, y_top_left=brace_top_y,
                y_bottom_right=brace_bottom_y, y_top_right=brace_top_y,
                leg_size=brace_leg_size, thickness=brace_thickness,
            )

    # ---- Outline / ground line under girders for clarity (soffit reference) ----
    msp.add_line((deck_left_x, base_y), (deck_right_x, base_y),
                 dxfattribs={'layer': 'OUTLINE', 'linetype': 'DASHED'})

    # ---- Dimensions ----
    right_x = deck_right_x   # shorthand for right-side vertical dim column

    # -- Horizontal above deck (stacked rows) --

    # Row 1: overall deck width
    dim_y1 = deck_top_y + 2800
    add_dim_horizontal(msp, deck_left_x, deck_right_x, dim_y1)

    # Row 2: carriageway width
    dim_y2 = deck_top_y + 2200
    add_dim_horizontal(msp, layout['carriageway_start_x'], layout['carriageway_end_x'], dim_y2)

    # Row 3: left & right deck overhang (deck edge -> first/last girder)
    dim_y3 = deck_top_y + 1600
    add_dim_horizontal(msp, deck_left_x, positions[0], dim_y3)
    add_dim_horizontal(msp, positions[-1], deck_right_x, dim_y3)

    # Row 4: crash barrier width (left and right)
    dim_y4 = deck_top_y + 1000
    add_dim_horizontal(msp, layout['left_barrier_x'], layout['left_barrier_end_x'], dim_y4)
    add_dim_horizontal(msp, layout['right_barrier_x'], layout['right_barrier_end_x'], dim_y4)

    # Row 5: footpath widths (when present)
    dim_y5 = deck_top_y + 400
    if layout['left_fp_w'] > 0:
        add_dim_horizontal(msp, layout['left_fp_x'],
                           layout['left_fp_x'] + layout['left_fp_w'], dim_y5)
    if layout['right_fp_w'] > 0:
        add_dim_horizontal(msp, layout['right_fp_x'],
                           layout['right_fp_x'] + layout['right_fp_w'], dim_y5)

    # -- Horizontal below soffit: girder spacings --
    dim_gs = base_y - 800
    for i in range(n - 1):
        add_dim_horizontal(msp, positions[i], positions[i + 1], dim_gs)

    # -- Horizontal at first girder: flange & web widths --
    gx0 = positions[0]
    flange_dim_y = base_y - 1600
    add_dim_horizontal(msp,
                       gx0 - g['bottom_flange_width'] / 2,
                       gx0 + g['bottom_flange_width'] / 2,
                       flange_dim_y)
    add_dim_horizontal(msp,
                       gx0 - g['web_thickness'] / 2,
                       gx0 + g['web_thickness'] / 2,
                       flange_dim_y - 500)

    # -- Vertical left column: structural depths --
    left_dim_x = deck_left_x - 1200
    add_dim_vertical(msp, base_y, base_y + g['depth'], left_dim_x)
    add_dim_vertical(msp, deck_bottom_y, deck_top_y, left_dim_x, offset=-500)
    add_dim_vertical(msp, deck_top_y, wc_top_y, left_dim_x, offset=-1000)
    if layout['left_fp_w'] > 0:
        add_dim_vertical(msp, fp_bottom_y, fp_top_y, left_dim_x, offset=-1500)

    # -- Vertical right column: girder flange & web heights --
    right_dim_x = right_x + 800
    add_dim_vertical(msp, base_y,
                     base_y + g['bottom_flange_thickness'], right_dim_x)
    web_bot = base_y + g['bottom_flange_thickness']
    web_top = base_y + g['depth'] - g['top_flange_thickness']
    add_dim_vertical(msp, web_bot, web_top, right_dim_x, offset=500)
    add_dim_vertical(msp, web_top, base_y + g['depth'], right_dim_x, offset=1000)

    # -- Vertical: crash barrier height (off left barrier) --
    cb_x_ref = layout['left_barrier_x'] + layout['cb_w'] + 300
    add_dim_vertical(msp, deck_top_y,
                     deck_top_y + crash_barrier['total_height'], cb_x_ref)

    # ---- Labels ----
    add_label(msp, 0, deck_top_y + 3300, "BRIDGE CROSS-SECTION (TRUE SCALE)", height=300)
    add_label(msp, 0, deck_top_y + 2900,
              f"Span = {p['span_length']} mm | Girders = {n} | "
              f"Carriageway = {p['carriageway_width']} mm",
              height=150)

    for gx in positions:
        add_label(msp, gx, base_y - 1300, f"GIRDER\nD={g['depth']}", height=100)

    # ---- Save ----
    doc.saveas(out_path)
    return out_path, layout, levels


if __name__ == '__main__':
    import tkinter as tk
    from tkinter import ttk, filedialog, messagebox
    import copy, threading

    # ── field definitions: (label, dict_name, key, type) ──────────────────
    FIELDS = [
        # Bridge / Deck
        ("── Bridge ──", None, None, None),
        ("Span Length (mm)",            "params", "span_length",             int),
        ("Num Girders",                 "params", "num_girders",              int),
        ("Girder Spacing (mm)",         "params", "girder_spacing",           int),
        ("Cross Bracing Spacing (mm)",  "params", "cross_bracing_spacing",    int),
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
        ("── Girder ──", None, None, None),
        ("Girder Depth (mm)",           "girder", "depth",                   int),
        ("Top Flange Width (mm)",       "girder", "top_flange_width",        int),
        ("Top Flange Thickness (mm)",   "girder", "top_flange_thickness",    int),
        ("Bot Flange Width (mm)",       "girder", "bottom_flange_width",     int),
        ("Bot Flange Thickness (mm)",   "girder", "bottom_flange_thickness", int),
        ("Web Thickness (mm)",          "girder", "web_thickness",           int),
        # Stiffener
        ("── Stiffener ──", None, None, None),
        ("Stiffener Width (mm)",        "stiffener","width",                 int),
    ]

    FP_OPTIONS = ["bothside", "oneside (left)", "oneside (right)", "no"]

    class BridgeGUI(tk.Tk):
        def __init__(self):
            super().__init__()
            self.title("Bridge Cross-Section DXF Generator")
            self.resizable(True, True)
            self._build_ui()

        def _build_ui(self):
            # ── top frame: scrollable canvas ──────────────────────────────
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

            # mouse-wheel scroll
            def _on_mousewheel(e):
                canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
            canvas.bind_all("<MouseWheel>", _on_mousewheel)

            self._vars = {}     # (dict_name, key) -> tk Variable

            for label, dict_name, key, typ in FIELDS:
                if dict_name is None:          # section header
                    tk.Label(inner, text=label, font=("Helvetica", 9, "bold"),
                             fg="#555").grid(row=len(self._vars) + len([f for f in FIELDS if f[1] is None and FIELDS.index(f) <= FIELDS.index((label, dict_name, key, typ))]),
                                             column=0, columnspan=2, sticky="w", padx=4, pady=(10, 2))
                    continue

                src = {"params": params, "girder": girder,
                       "stiffener": stiffener, "crash_barrier": crash_barrier,
                       "railing": railing}[dict_name]
                default = src[key]
                row = inner.grid_size()[1]       # next available row

                tk.Label(inner, text=label, anchor="w").grid(
                    row=row, column=0, sticky="w", padx=6, pady=2)

                if typ is bool:
                    var = tk.BooleanVar(value=default)
                    ttk.Checkbutton(inner, variable=var).grid(
                        row=row, column=1, sticky="w", padx=6)
                elif key == "footpath_config":
                    var = tk.StringVar(value=default)
                    ttk.Combobox(inner, textvariable=var, values=FP_OPTIONS,
                                 width=10, state="readonly").grid(
                        row=row, column=1, sticky="ew", padx=6)
                else:
                    var = tk.StringVar(value=str(default))
                    ttk.Entry(inner, textvariable=var, width=14).grid(
                        row=row, column=1, sticky="ew", padx=6)

                self._vars[(dict_name, key)] = (var, typ)

            inner.columnconfigure(1, weight=1)

            # ── bottom bar ────────────────────────────────────────────────
            bar = tk.Frame(self, bd=1, relief="groove")
            bar.pack(fill="x", padx=10, pady=6)

            tk.Label(bar, text="Output .dxf:").pack(side="left", padx=(4, 2))
            self._out_var = tk.StringVar(value="bridge_cross_section.dxf")
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
            """Read vars back into fresh copies of the dicts."""
            p  = copy.deepcopy(params)
            g  = copy.deepcopy(girder)
            st = copy.deepcopy(stiffener)
            cb = copy.deepcopy(crash_barrier)
            rl = copy.deepcopy(railing)
            srcs = {"params": p, "girder": g,
                    "stiffener": st, "crash_barrier": cb, "railing": rl}
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
            return p, g, st, cb, rl

        def _generate(self):
            try:
                p, g, st, cb, rl = self._collect()
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
                    saved, layout, _ = build_drawing(p=p, g=g, st=st, cb=cb, rl=rl,
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
