"""Build the views outside the window of model/Minimal_Reacto_Room.blend: Thessaloniki (where I'm
from) and Rotterdam (where I live); the website shows one or the other and switches on a click.

The room is shown through an orthographic camera, so nothing gets smaller with distance and every
ray through the window slopes down at the same angle (about 26 degrees). Each view is therefore a
miniature diorama built in rings around the window: the further a ring is, the lower the part of
it you see through the glass.

Thessaloniki, bottom to top: the balcony rail with planters, the Nea Paralia promenade with the
White Tower and the Umbrellas, the Thermaic Gulf (the city curving away along the bay on the left,
the port on the right), Mount Olympus across the water, and the sky.

Rotterdam: a modern balcony, the quay, the Nieuwe Maas, and the Kop van Zuid skyline across the
river with the Erasmusbrug.

The website only draws the views through the window (a stencil mask), lights them by where the sun
is over each city, and now and then sends a cyclist along the promenade or a boat across the water.
Each view is parented to its own empty ("Window view Thessaloniki", "Window view Rotterdam"); the
shared mask is "Window view mask".

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend \
      --python scripts/build_window_view.py -- --save
then re-export the room with scripts/export_room.py.
"""
import math
import sys

import bpy
from mathutils import Vector

COLLECTION = '09 Window view'
ROOT = 'Window view Thessaloniki'
ROOT_RDAM = 'Window view Rotterdam'
MASK = 'Window view mask'

WALL_X = -2.24                # outside face of the wall
CENTER = Vector((WALL_X, 0.85))   # middle of the window, seen from above
WINDOW_Y = (0.22, 1.48)
WINDOW_Z = (1.0, 2.42)
PHI = (-12, 88)               # the arc of directions the camera can look through the window in (deg)

# Ring radii (metres from the window, horizontally) and heights.
# Thessaloniki, laid out so that through the middle of the window you see, bottom to top: the
# balcony rail, the Nea Paralia promenade with the White Tower, the Thermaic Gulf (with the city
# curving away along the bay on the left and the port on the right), Mount Olympus across the
# water, and the sky.
PROM_Z = 0.55
GULF_Z = 0.42
OLYMPUS_R = 3.0
SKY_R = 3.15
# Looking out from a high balcony on Nikis Avenue, as in the classic photos of the seafront: the
# shore runs away diagonally on the left (Nikis Avenue, the promenade and the sea wall, with the tall
# white apartment blocks along it), the White Tower stands on the promenade further along, the gulf
# opens up on the right, and Olympus rises across the water.
# The shoreline as (distance from the window, direction in degrees) points, near to far.
SHORE = [(0.6, 70), (1.0, 64), (1.8, 55.5), (2.4, 51), (3.05, 47)]
PROMENADE_W = 0.17      # paving between the sea wall and the road
ROAD_W = 0.13           # Nikis Avenue
BLOCKS_AT = 0.34        # where the apartment blocks' fronts are, inland from the sea wall
WHITE_TOWER_AT = 1.9    # how far along the shore (distance from the window)
UMBRELLAS_AT = 2.75


def seeded(seed):
    state = [seed]

    def rand():
        state[0] = (state[0] * 1103515245 + 12345) & 0x7FFFFFFF
        return state[0] / 0x7FFFFFFF
    return rand


rand = seeded(1923)   # the year the village was settled


def ring(r, phi_deg, z):
    a = math.radians(phi_deg)
    return Vector((CENTER.x - r * math.cos(a), CENTER.y + r * math.sin(a), z))


def facing(phi_deg):
    """Rotation about z that turns a local -y front towards the window."""
    return math.pi / 2 - math.radians(phi_deg)


def radial(phi_deg):
    """Rotation about z that lays local x along the direction away from the window."""
    return math.pi - math.radians(phi_deg)


def tangent(phi_deg):
    """Rotation about z that lays local x along the ring (left to right as seen)."""
    return math.pi / 2 - math.radians(phi_deg)


# ------------------------------------------------------------------ materials ----
MATS = {}


def mat(key, name, color, roughness=0.9, metallic=0.0, emission=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = 0.0
    m.diffuse_color = (*color, 1)
    if key == 'glass_rail':
        bsdf.inputs['Alpha'].default_value = 0.28
        m.surface_render_method = 'BLENDED'
    MATS[key] = m


def make_materials():
    mat('sky', 'View sky', (0.45, 0.66, 0.92), 1.0)
    mat('hills', 'View hills', (0.36, 0.45, 0.28))
    mat('wall', 'View white wall', (0.93, 0.91, 0.86))
    mat('wall2', 'View cream wall', (0.9, 0.82, 0.66))
    mat('roof2', 'View terracotta roof dark', (0.56, 0.25, 0.16))
    mat('flat', 'View flat roof', (0.8, 0.78, 0.74))
    mat('window', 'View lit window', (0.16, 0.17, 0.2), 0.4, emission=(1.0, 0.72, 0.38))
    mat('panel', 'View solar panel', (0.08, 0.12, 0.2), 0.3, 0.5)
    mat('tank', 'View solar tank', (0.82, 0.83, 0.85), 0.4, 0.6)
    mat('metal', 'View dark metal', (0.06, 0.06, 0.07), 0.5, 0.6)
    mat('trunk', 'View trunk', (0.3, 0.22, 0.15))
    mat('balcony', 'View balcony', (0.84, 0.82, 0.78))
    mat('pot', 'View clay pot', (0.62, 0.32, 0.2))
    mat('basil', 'View basil', (0.22, 0.5, 0.18))
    mat('geranium', 'View geranium', (0.86, 0.12, 0.16))
    mat('cyclist', 'View cyclist', (0.15, 0.3, 0.75))
    # Thessaloniki
    mat('sea', 'View gulf water', (0.12, 0.27, 0.38), 0.55, 0.0)
    mat('promenade', 'View promenade paving', (0.78, 0.74, 0.66))
    mat('white_tower', 'View white tower', (0.76, 0.71, 0.62), emission=(1.0, 0.82, 0.55))
    mat('olympus', 'View olympus', (0.5, 0.53, 0.64))
    mat('headland', 'View headland', (0.22, 0.27, 0.26))
    mat('snow', 'View snow', (0.84, 0.86, 0.92), 0.6)
    mat('asphalt', 'View asphalt', (0.3, 0.3, 0.31))
    mat('road_line', 'View road line', (0.85, 0.7, 0.2))
    mat('sea_wall', 'View sea wall', (0.66, 0.64, 0.6))
    mat('wood', 'View ship wood', (0.38, 0.22, 0.12))
    mat('person', 'View person', (0.2, 0.22, 0.28))
    mat('person2', 'View person light', (0.75, 0.5, 0.35))
    mat('awning_green', 'View awning green', (0.25, 0.5, 0.35))
    mat('awning_blue', 'View awning blue', (0.2, 0.4, 0.62))
    mat('awning_orange', 'View awning orange', (0.85, 0.5, 0.2))
    mat('crane', 'View port crane', (0.75, 0.2, 0.12), 0.5, 0.3)
    mat('container_a', 'View container blue', (0.15, 0.32, 0.55))
    mat('container_b', 'View container red', (0.62, 0.18, 0.12))
    mat('container_c', 'View container green', (0.2, 0.45, 0.3))
    mat('sail', 'View sail', (0.96, 0.96, 0.94))
    mat('umbrella', 'View cafe umbrella', (0.92, 0.88, 0.8))
    mat('car_red', 'View car red', (0.62, 0.12, 0.1), 0.4, 0.3)
    # Rotterdam
    mat('water', 'View river water', (0.16, 0.24, 0.3), 0.6, 0.0)
    mat('wake', 'View river wake', (0.55, 0.62, 0.66), 0.3)
    mat('quay', 'View quay paving', (0.5, 0.42, 0.38))
    mat('quay_edge', 'View quay edge', (0.32, 0.32, 0.33))
    mat('brick', 'View brick', (0.5, 0.28, 0.2))
    mat('brick2', 'View brick light', (0.64, 0.46, 0.34))
    mat('concrete', 'View concrete', (0.72, 0.72, 0.7))
    mat('glass_tower', 'View tower glass', (0.46, 0.55, 0.64), 0.2, 0.4)
    mat('glass_dark', 'View tower glass dark', (0.22, 0.26, 0.3), 0.2, 0.4)
    mat('kpn', 'View kpn grey', (0.35, 0.37, 0.4), 0.4, 0.2)
    mat('bridge', 'View bridge white', (0.94, 0.95, 0.96), 0.35, 0.1)
    mat('cable', 'View bridge cable', (0.85, 0.87, 0.9), 0.4, 0.2, emission=(0.75, 0.85, 1.0))
    mat('willems', 'View willemsbrug red', (0.75, 0.1, 0.08), 0.4)
    mat('copper', 'View copper roof', (0.38, 0.6, 0.52), 0.5, 0.2)
    mat('ship', 'View ship white', (0.95, 0.95, 0.95), 0.35)
    mat('hull', 'View ship hull', (0.1, 0.12, 0.16), 0.5)
    mat('funnel', 'View ship funnel', (0.12, 0.3, 0.6), 0.4)
    mat('taxi', 'View water taxi', (0.98, 0.78, 0.1), 0.4)
    mat('glass_rail', 'View balcony glass', (0.7, 0.82, 0.85), 0.05)
    mat('tulip_red', 'View tulip red', (0.85, 0.1, 0.12))
    mat('tulip_yellow', 'View tulip yellow', (0.95, 0.78, 0.1))
    mat('lamp', 'View street lamp', (0.15, 0.15, 0.16), 0.4, 0.6)
    mat('lamp_glow', 'View lamp glow', (0.9, 0.85, 0.7), 0.4, emission=(1.0, 0.78, 0.45))
    mat('tree', 'View city tree', (0.3, 0.42, 0.24))


# --------------------------------------------------------------------- meshes ----
class Builder:
    """Collects geometry per material, then becomes one object."""

    def __init__(self):
        self.chunks = {}

    def add(self, key, verts, faces):
        self.chunks.setdefault(key, []).append((verts, faces))

    def box(self, key, center, size, rot=0.0):
        cx, cy, cz = center
        sx, sy, sz = (s / 2 for s in size)
        c, s = math.cos(rot), math.sin(rot)
        verts = []
        for dz in (-sz, sz):
            for dx, dy in ((-sx, -sy), (sx, -sy), (sx, sy), (-sx, sy)):
                verts.append((cx + dx * c - dy * s, cy + dx * s + dy * c, cz + dz))
        faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        self.add(key, verts, faces)

    def gable(self, key, center, size, rot=0.0, overhang=0.012):
        """A pitched roof: ridge along local x, sitting on top of a box of `size` at `center`."""
        cx, cy, cz = center
        sx, sy, h = size[0] / 2 + overhang, size[1] / 2 + overhang, size[2]
        c, s = math.cos(rot), math.sin(rot)
        pts = [(-sx, -sy, 0), (sx, -sy, 0), (sx, sy, 0), (-sx, sy, 0), (-sx, 0, h), (sx, 0, h)]
        verts = [(cx + x * c - y * s, cy + x * s + y * c, cz + z) for x, y, z in pts]
        faces = [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]
        self.add(key, verts, faces)

    def quad(self, key, a, b, c, d):
        self.add(key, [a, b, c, d], [(0, 1, 2, 3)])

    def cone(self, key, base, radius, height, sides=8):
        verts = [(base[0] + radius * math.cos(2 * math.pi * i / sides), base[1] + radius * math.sin(2 * math.pi * i / sides), base[2])
                 for i in range(sides)] + [(base[0], base[1], base[2] + height)]
        faces = [(i, (i + 1) % sides, sides) for i in range(sides)] + [tuple(reversed(range(sides)))]
        self.add(key, verts, faces)

    def blob(self, key, center, radius, squash=0.8, sides=8, rings=5):
        verts, faces = [], []
        for r in range(1, rings):
            t = math.pi * r / rings
            for i in range(sides):
                a = 2 * math.pi * i / sides
                verts.append((center[0] + radius * math.sin(t) * math.cos(a), center[1] + radius * math.sin(t) * math.sin(a),
                              center[2] + radius * squash * math.cos(t)))
        top = len(verts)
        verts.append((center[0], center[1], center[2] + radius * squash))
        verts.append((center[0], center[1], center[2] - radius * squash))
        for i in range(sides):
            j = (i + 1) % sides
            faces.append((top, j, i))
            faces.append((top + 1, (rings - 2) * sides + i, (rings - 2) * sides + j))
        for r in range(rings - 2):
            for i in range(sides):
                j = (i + 1) % sides
                faces.append((r * sides + i, r * sides + j, (r + 1) * sides + j, (r + 1) * sides + i))
        self.add(key, verts, faces)

    def cylinder(self, key, center, radius, height, sides=10):
        verts = []
        for z in (0, height):
            for i in range(sides):
                a = 2 * math.pi * i / sides
                verts.append((center[0] + radius * math.cos(a), center[1] + radius * math.sin(a), center[2] + z))
        faces = [(i, (i + 1) % sides, sides + (i + 1) % sides, sides + i) for i in range(sides)]
        faces += [tuple(reversed(range(sides))), tuple(range(sides, 2 * sides))]
        self.add(key, verts, faces)

    def build(self, name, parent, col):
        verts, faces, mats = [], [], []
        keys = list(self.chunks)
        for mi, key in enumerate(keys):
            for v, f in self.chunks[key]:
                off = len(verts)
                verts.extend(v)
                faces.extend(tuple(i + off for i in face) for face in f)
                mats.extend([mi] * len(f))
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], faces)
        me.validate()
        for key in keys:
            me.materials.append(MATS[key])
        for poly, mi in zip(me.polygons, mats):
            poly.material_index = mi
            poly.use_smooth = False
        obj = bpy.data.objects.new(name, me)
        col.objects.link(obj)
        obj.parent = parent
        return obj


def arc_band(b, key, r0, r1, z0, z1, phi=PHI, steps=60, profile=None):
    """A ring band from r0 to r1; heights z0 (inner) to z1 (outer) or a vertical band if r0 == r1."""
    verts, faces = [], []
    for i in range(steps + 1):
        p = phi[0] + (phi[1] - phi[0]) * i / steps
        top = z1 + (profile(p) if profile else 0)
        verts.append(tuple(ring(r0, p, z0)))
        verts.append(tuple(ring(r1, p, top)))
    for i in range(steps):
        a = i * 2
        faces.append((a, a + 2, a + 3, a + 1))
    b.add(key, verts, faces)


def ridge(seed, base, scale):
    """A smooth hilltop profile over the arc of directions."""
    r = seeded(seed)
    waves = [(r() * 0.08 + 0.03, r() * 2 * math.pi, 1 + r() * 4) for _ in range(5)]

    def f(p):
        t = math.radians(p) * 3
        return base + scale * sum(a * math.sin(k * t + ph) for a, ph, k in waves)
    return f


# ------------------------------------------------------------- Thessaloniki ----
def olympus_profile(p):
    """Mount Olympus across the gulf: a broad massif with its highest peaks near the middle."""
    # A broad massif rising to a summit ridge left of centre, a long shoulder to the right, and a
    # separate cone further right, all softened by haze.
    # (Across the gulf to the right of the seafront.)
    massif = 0.22 * math.exp(-((p - 57) / 5.5) ** 2) + 0.05 * math.exp(-((p - 56) / 1.1) ** 2)
    shoulder = 0.12 * math.exp(-((p - 63) / 4.5) ** 2)
    cone = 0.1 * math.exp(-((p - 70) / 2) ** 2)
    rolling = 0.015 * math.sin(math.radians(p) * 23) + 0.01 * math.sin(math.radians(p) * 51 + 1)
    return GULF_Z + 0.06 + 0.08 * math.exp(-((p - 60) / 25) ** 2) + massif + shoulder + cone + rolling


# Snow lies on everything above this height, reaching further down on the higher peaks.
SNOWLINE = GULF_Z + 0.25


def build_thess_backdrop(root, col):
    b = Builder()
    arc_band(b, 'sky', SKY_R, SKY_R, -1.0, 3.2, phi=(PHI[0] - 6, PHI[1] + 1))
    # Olympus, snow-covered along its high ridge.
    arc_band(b, 'olympus', OLYMPUS_R, OLYMPUS_R, GULF_Z - 0.02, 0.0, steps=120, profile=olympus_profile)
    snow_r = OLYMPUS_R - 0.004
    steps = 240
    verts, faces = [], []
    for i in range(steps + 1):
        p = PHI[0] + (PHI[1] - PHI[0]) * i / steps
        top = olympus_profile(p)
        # A ragged lower edge: deeper on the high peaks, wavering between ridges and gullies.
        ragged = 0.012 * math.sin(math.radians(p) * 75) + 0.007 * math.sin(math.radians(p) * 190 + 2)
        bottom = SNOWLINE - 0.05 * max(0.0, (top - SNOWLINE) / 0.2) + ragged
        bottom = min(bottom, top)
        verts.append(tuple(ring(snow_r, p, bottom)))
        verts.append(tuple(ring(snow_r, p, top)))
    for i in range(steps):
        faces.append((i * 2, i * 2 + 2, i * 2 + 3, i * 2 + 1))
    b.add('snow', verts, faces)
    # Snow running down the gullies below the snowline on the higher slopes.
    for k in range(34):
        p = PHI[0] + 4 + k * (PHI[1] - PHI[0] - 8) / 33 + (rand() - 0.5) * 1.5
        top = olympus_profile(p)
        if top < SNOWLINE + 0.02:
            continue
        start = min(top, SNOWLINE - 0.01)
        length = 0.025 + rand() * 0.06 * min(1.0, (top - SNOWLINE) / 0.12)
        half = 0.25 + rand() * 0.3
        b.add('snow', [tuple(ring(snow_r - 0.001, p - half, start)), tuple(ring(snow_r - 0.001, p + half, start)),
                       tuple(ring(snow_r - 0.001, p + (rand() - 0.5) * 0.3, start - length))], [(0, 1, 2)])
    # The low Pieria coast at the foot of the mountain, and a dark headland out on the water.
    arc_band(b, 'hills', OLYMPUS_R - 0.06, OLYMPUS_R - 0.01, GULF_Z, GULF_Z + 0.02, steps=60)
    arc_band(b, 'headland', 2.86, 2.93, GULF_Z, GULF_Z + 0.022, phi=(62, 74), steps=20,
             profile=lambda p: -0.02 * abs(p - 68) / 6)
    return b.build('View thessaloniki backdrop', root, col)


def shore_phi(r):
    """Direction (degrees) of the shoreline at distance r from the window."""
    for (r0, p0), (r1, p1) in zip(SHORE, SHORE[1:]):
        if r <= r1:
            return p0 + (p1 - p0) * (r - r0) / (r1 - r0)
    return SHORE[-1][1]


def shore_frame(r):
    """The sea wall's position at distance r, the direction along the shore (away from the window),
    and the normal pointing out to sea."""
    s0 = ring(r, shore_phi(r), 0).to_2d()
    s1 = ring(r + 0.01, shore_phi(r + 0.01), 0).to_2d()
    along = (s1 - s0).normalized()
    normal = Vector((along.y, -along.x))
    # Out to sea is towards larger phi (to the right as seen).
    seaward = (ring(r, shore_phi(r) + 1, 0).to_2d() - s0)
    if normal.dot(seaward) < 0:
        normal = -normal
    return s0, along, normal


def on_shore(r, inland, z):
    """A point at distance r along the shore, `inland` metres back from the sea wall."""
    s0, _, n = shore_frame(r)
    p = s0 - n * inland
    return Vector((p.x, p.y, z))


def facing_sea(r):
    """Rotation about z that turns a local -y front out to sea."""
    _, _, n = shore_frame(r)
    return math.atan2(n.x, -n.y)


def shore_strip(b, key, inland0, inland1, z, r0=0.55, r1=3.1, steps=50):
    """A strip parallel to the shore between two distances inland."""
    for i in range(steps):
        ra = r0 + (r1 - r0) * i / steps
        rb = r0 + (r1 - r0) * (i + 1) / steps
        b.quad(key, on_shore(ra, inland1, z), on_shore(rb, inland1, z), on_shore(rb, inland0, z), on_shore(ra, inland0, z))


def polykatoikia(b, pos, rot, w, d, floors):
    """A Thessaloniki apartment block: white or cream, a balcony slab on every floor, awnings."""
    h = 0.03 + floors * 0.028
    key = ('wall', 'wall2', 'concrete', 'wall')[int(rand() * 4)]
    b.box(key, (pos.x, pos.y, PROM_Z + h / 2), (w, d, h), rot)
    c, s = math.cos(rot), math.sin(rot)

    def front(x, y, z):
        return Vector((pos.x + x * c - y * s, pos.y + x * s + y * c, z))
    awning = ('awning_green', 'awning_blue', 'awning_orange', 'awning_green')[int(rand() * 4)]
    for f in range(floors):
        z = PROM_Z + 0.03 + f * 0.028
        b.quad('window', front(-w * 0.44, -d / 2 - 0.0012, z + 0.006), front(w * 0.44, -d / 2 - 0.0012, z + 0.006),
               front(w * 0.44, -d / 2 - 0.0012, z + 0.018), front(-w * 0.44, -d / 2 - 0.0012, z + 0.018))
        slab = front(0, -d / 2 - 0.008, 0)
        b.box('balcony', (slab.x, slab.y, z), (w * 0.98, 0.016, 0.003), rot)
        rail = front(0, -d / 2 - 0.016, 0)
        b.box('wall', (rail.x, rail.y, z + 0.006), (w * 0.98, 0.0015, 0.01), rot)
        if rand() < 0.55:
            aw = front(0, -d / 2 - 0.009, 0)
            b.box(awning, (aw.x, aw.y, z + 0.024), (w * 0.92, 0.018, 0.002), rot)
    b.box('flat', (pos.x, pos.y, PROM_Z + h + 0.003), (w + 0.006, d + 0.006, 0.006), rot)
    if rand() < 0.5:
        t = front((rand() - 0.5) * w * 0.4, 0, 0)
        b.box('panel', (t.x, t.y, PROM_Z + h + 0.02), (0.04, 0.01, 0.03), rot)
        b.box('tank', (t.x, t.y, PROM_Z + h + 0.035), (0.045, 0.014, 0.014), rot)


def white_tower(b):
    """The White Tower on the promenade: beige stone, crenellated, a smaller turret on top."""
    q = on_shore(WHITE_TOWER_AT, PROMENADE_W * 0.45, PROM_Z)
    R, H = 0.1, 0.3
    b.cylinder('white_tower', (q.x, q.y, PROM_Z), R, H, sides=28)
    b.cylinder('white_tower', (q.x, q.y, PROM_Z + H), 0.046, 0.06, sides=18)
    for k in range(18):
        a = 2 * math.pi * k / 18
        b.box('white_tower', (q.x + (R - 0.006) * math.cos(a), q.y + (R - 0.006) * math.sin(a), PROM_Z + H + 0.01), (0.018, 0.018, 0.02), a)
    for k in range(7):
        a = 2 * math.pi * k / 7
        b.box('white_tower', (q.x + 0.043 * math.cos(a), q.y + 0.043 * math.sin(a), PROM_Z + H + 0.066), (0.011, 0.011, 0.013), a)
    towards = math.atan2(CENTER.y - q.y, CENTER.x - q.x)
    for k in range(10):
        a = towards - 0.9 + k * 0.2
        z = PROM_Z + 0.04 + k * 0.025
        b.box('metal', (q.x + (R + 0.0005) * math.cos(a), q.y + (R + 0.0005) * math.sin(a), z), (0.004, 0.009, 0.016), a)
    b.box('metal', (q.x, q.y, PROM_Z + H + 0.12), (0.003, 0.003, 0.07))
    b.box('awning_blue', (q.x + 0.012, q.y, PROM_Z + H + 0.14), (0.022, 0.002, 0.014))
    # The little park of trees behind it, on the land side.
    for k in range(9):
        t = on_shore(WHITE_TOWER_AT - 0.2 + k * 0.05, PROMENADE_W + 0.02 + (k % 2) * 0.06, PROM_Z)
        b.cylinder('trunk', (t.x, t.y, PROM_Z), 0.005, 0.04, sides=5)
        b.blob('tree', (t.x, t.y, PROM_Z + 0.07), 0.045 + rand() * 0.015, 0.85)


def umbrellas(b):
    """Zongolopoulos' Umbrellas, further along the seafront at the water's edge."""
    for k in range(12):
        q = on_shore(UMBRELLAS_AT + (rand() - 0.5) * 0.12, -0.02 + (rand() - 0.5) * 0.04, GULF_Z)
        h = 0.18 + rand() * 0.22
        b.box('metal', (q.x, q.y, GULF_Z + h / 2), (0.003, 0.003, h))
        b.cone('umbrella', (q.x, q.y, GULF_Z + h - 0.004), 0.028, 0.011, sides=10)


def seafront(b):
    """Nikis Avenue and the promenade along the shore, the land behind, and the sea wall."""
    shore_strip(b, 'promenade', 0.0, PROMENADE_W, PROM_Z + 0.001)
    shore_strip(b, 'sea_wall', 0.0, 0.02, PROM_Z + 0.004)
    shore_strip(b, 'asphalt', PROMENADE_W, PROMENADE_W + ROAD_W, PROM_Z + 0.001)
    shore_strip(b, 'road_line', PROMENADE_W + ROAD_W / 2 - 0.002, PROMENADE_W + ROAD_W / 2 + 0.002, PROM_Z + 0.002)
    shore_strip(b, 'promenade', PROMENADE_W + ROAD_W, 1.6, PROM_Z)
    # The sea wall's face.
    for i in range(50):
        ra, rb = 0.55 + 2.55 * i / 50, 0.55 + 2.55 * (i + 1) / 50
        b.quad('sea_wall', on_shore(ra, 0, GULF_Z - 0.02), on_shore(rb, 0, GULF_Z - 0.02), on_shore(rb, 0, PROM_Z + 0.004), on_shore(ra, 0, PROM_Z + 0.004))
    # Lamp posts and bollards along the promenade; people out walking; cars on the avenue.
    r = 0.62
    while r < 3.05:
        lp = on_shore(r, 0.04, PROM_Z)
        b.box('lamp', (lp.x, lp.y, PROM_Z + 0.06), (0.004, 0.004, 0.12))
        b.box('lamp_glow', (lp.x, lp.y, PROM_Z + 0.122), (0.014, 0.014, 0.008))
        bo = on_shore(r + 0.06, PROMENADE_W - 0.01, PROM_Z)
        b.cylinder('metal', (bo.x, bo.y, PROM_Z), 0.004, 0.014, sides=6)
        r += 0.17
    for _ in range(34):
        r = 0.62 + rand() * 2.4
        if abs(r - WHITE_TOWER_AT) < 0.16:
            continue
        q = on_shore(r, 0.03 + rand() * (PROMENADE_W - 0.05), PROM_Z)
        b.box('person' if rand() < 0.6 else 'person2', (q.x, q.y, PROM_Z + 0.012), (0.008, 0.006, 0.024))
        b.blob('person2', (q.x, q.y, PROM_Z + 0.029), 0.0045, 1.0, 6, 4)
    cars = ('car_red', 'concrete', 'metal', 'car_red', 'wall', 'awning_blue')
    r = 0.6
    while r < 3.0:
        r += 0.08 + rand() * 0.14
        _, along, _ = shore_frame(r)
        c = on_shore(r, PROMENADE_W + (0.035 if rand() < 0.5 else 0.095), PROM_Z)
        key = cars[int(rand() * len(cars))]
        rot = math.atan2(along.y, along.x)
        b.box(key, (c.x, c.y, PROM_Z + 0.011), (0.055, 0.026, 0.02), rot)
        b.box(key, (c.x, c.y, PROM_Z + 0.026), (0.03, 0.022, 0.012), rot)


def nikis_blocks(b):
    """The wall of tall white apartment blocks along Nikis Avenue, facing the sea, with lower
    rows behind them."""
    for row, (inland, floors) in enumerate(((BLOCKS_AT, (7, 9)), (BLOCKS_AT + 0.2, (5, 8)), (BLOCKS_AT + 0.4, (4, 7)))):
        r = 0.55
        while r < 3.1:
            w = 0.14 + rand() * 0.06
            mid = r + w / 2
            pos = on_shore(mid, inland + 0.05, 0)
            polykatoikia(b, pos, facing_sea(mid), w * 0.97, 0.1, floors[0] + int(rand() * (floors[1] - floors[0] + 1)))
            r += w


def pirate_ship(b):
    """One of the wooden tourist ships moored by the White Tower."""
    q = on_shore(WHITE_TOWER_AT + 0.12, -0.05, GULF_Z)
    _, along, _ = shore_frame(WHITE_TOWER_AT)
    rot = math.atan2(along.y, along.x)
    b.box('wood', (q.x, q.y, GULF_Z + 0.014), (0.16, 0.04, 0.028), rot)
    b.box('wood', (q.x, q.y, GULF_Z + 0.032), (0.05, 0.034, 0.012), rot)
    for dx in (-0.045, 0.02):
        m = Vector((q.x + dx * math.cos(rot), q.y + dx * math.sin(rot), 0))
        b.box('trunk', (m.x, m.y, GULF_Z + 0.08), (0.003, 0.003, 0.11))
        b.box('sail', (m.x, m.y, GULF_Z + 0.09), (0.035, 0.002, 0.04), rot)


def gulf(b):
    arc_band(b, 'sea', 0.3, 3.0, GULF_Z, GULF_Z, steps=80)
    for r, p0, p1 in ((1.4, 66, 80), (2.1, 60, 70), (1.8, 72, 84), (2.6, 56, 64)):
        arc_band(b, 'wake', r - 0.003, r + 0.003, GULF_Z + 0.001, GULF_Z + 0.001, phi=(p0, p1), steps=10)
    # Sailing boats at anchor and a ship waiting out in the gulf.
    for r, p in ((1.5, 70), (1.75, 66), (1.65, 76), (2.2, 63)):
        q = ring(r, p, GULF_Z)
        b.box('ship', (q.x, q.y, GULF_Z + 0.008), (0.05, 0.016, 0.012), tangent(p))
        b.box('metal', (q.x, q.y, GULF_Z + 0.05), (0.002, 0.002, 0.08))
    q = ring(2.7, 60, GULF_Z)
    b.box('hull', (q.x, q.y, GULF_Z + 0.014), (0.26, 0.04, 0.026), tangent(60))
    b.box('ship', (q.x, q.y, GULF_Z + 0.036), (0.06, 0.034, 0.03), tangent(60))


def build_sailboat(root, col):
    b = Builder()
    b.box('ship', (0, 0, 0.008), (0.05, 0.016, 0.012))
    b.box('metal', (0.004, 0, 0.05), (0.002, 0.002, 0.08))
    b.add('sail', [(0.006, 0, 0.018), (0.006, 0, 0.085), (0.034, 0, 0.018)], [(0, 1, 2), (2, 1, 0)])
    obj = b.build('View sailboat', root, col)
    obj.location = ring(2.2, 60, GULF_Z)
    return obj


def path_marker(name, pos, root, col):
    """An empty marking where something on the website travels between."""
    e = bpy.data.objects.new(name, None)
    e.location = pos
    col.objects.link(e)
    e.parent = root


def build_thessaloniki(root, col):
    build_thess_backdrop(root, col)
    b = Builder()
    gulf(b)
    seafront(b)
    umbrellas(b)
    pirate_ship(b)
    b.build('View thessaloniki seafront', root, col)
    b = Builder()
    nikis_blocks(b)
    white_tower(b)
    b.build('View thessaloniki city', root, col)
    # The rail only, so nothing on the balcony hides the view.
    build_balcony(root, col, planters=(-0.2, 2.9), sill_pot=False)
    build_cyclist(root, col)
    # The cyclist rides along the promenade, from near the window to beyond the White Tower.
    path_marker('View cyclist from', on_shore(0.7, PROMENADE_W * 0.6, PROM_Z + 0.014), root, col)
    path_marker('View cyclist to', on_shore(2.9, PROMENADE_W * 0.6, PROM_Z + 0.014), root, col)
    build_sailboat(root, col)


def build_balcony(root, col, planters=(0.55, 1.35, 2.15, 2.75), sill_pot=True):
    """The balcony right outside the window: rail with planters, a basil pot on the outer sill."""
    b = Builder()
    x_rail = WALL_X - 0.42
    y0, y1 = -0.6, 3.2
    # Only the rail shows through the window, so there's no need for the balcony floor.
    top = 0.8
    b.box('metal', (x_rail, (y0 + y1) / 2, top), (0.03, y1 - y0, 0.025))
    b.box('metal', (x_rail, (y0 + y1) / 2, 0.2), (0.02, y1 - y0, 0.02))
    y = y0
    while y < y1:
        b.box('metal', (x_rail, y, (top + 0.2) / 2), (0.012, 0.012, top - 0.2))
        y += 0.1
    # Planters hanging on the rail, with geraniums and basil.
    for py in planters:
        b.box('pot', (x_rail - 0.0, py, top + 0.05), (0.1, 0.36, 0.08))
        for k in range(7):
            fy = py - 0.15 + k * 0.05
            key = 'geranium' if (k + int(py * 10)) % 3 else 'basil'
            b.blob('basil', (x_rail, fy, top + 0.11), 0.035, 0.7)
            if key == 'geranium':
                b.blob('geranium', (x_rail - 0.01 + (rand() - 0.5) * 0.04, fy + (rand() - 0.5) * 0.03, top + 0.14 + rand() * 0.02), 0.014, 1.0, 6, 4)
    # A pot of basil on the outside window sill.
    if sill_pot:
        b.cylinder('pot', (WALL_X - 0.07, 1.25, 0.96), 0.05, 0.08)
        b.blob('basil', (WALL_X - 0.07, 1.25, 1.08), 0.07, 0.75)
    return b.build('View balcony', root, col)


def build_cyclist(root, col):
    """A tiny cyclist the website rides along the road (built at the road's start, facing along it)."""
    b = Builder()
    for dx in (-0.018, 0.018):
        b.cylinder('metal', (dx, -0.002, 0.0), 0.012, 0.004, sides=10)
    b.box('cyclist', (0.0, 0.0, 0.03), (0.012, 0.008, 0.03))
    b.blob('wall', (0.004, 0.0, 0.05), 0.007, 1.0, 6, 4)
    b.box('metal', (0.0, 0.0, 0.014), (0.036, 0.004, 0.004))
    obj = b.build('View cyclist', root, col)
    obj.location = on_shore(0.7, PROMENADE_W * 0.6, PROM_Z + 0.014)
    return obj


# ------------------------------------------------------------------ Rotterdam ----
# Looking south across the Nieuwe Maas from the north bank: the quay below, the river, and the
# Kop van Zuid skyline on the far bank, east (left) to west (right).
QUAY_R = (0.72, 1.28)
QUAY_Z = 0.55
RIVER_R = (1.28, 2.62)
RIVER_Z = 0.42
BANK_R = (2.62, 3.02)
BANK_Z = 0.46
TAXI_R = 1.95
# Through the window, the far bank is a narrow slice (about phi 45-61 from the middle of the room,
# wider as you look around), so the landmarks are packed into it, east (left) to west (right).
# Where each bridge lands on the far bank.
ERASMUS_PHI = 49
WILLEMS_PHI = 41
LANDMARKS = {'maastoren': (46.5, 2.82), 'kpn': (52, 2.74), 'derotterdam': (55.4, 2.8), 'montevideo': (58.6, 2.78),
             'neworleans': (60.6, 2.85), 'hotelnewyork': (63.2, 2.7), 'euromast': (69, 2.94)}
SHIP_PHI = 65


def windows_on(b, base, rot, w, d, z0, z1, step=0.024, fill=0.82):
    """Rows of office windows across the front (towards the window) of a block."""
    c, s = math.cos(rot), math.sin(rot)
    z = z0 + step * 0.6
    while z + 0.008 < z1:
        a = Vector((base.x + (-w * fill / 2) * c - (-d / 2 - 0.0012) * s, base.y + (-w * fill / 2) * s + (-d / 2 - 0.0012) * c, z))
        e = Vector((base.x + (w * fill / 2) * c - (-d / 2 - 0.0012) * s, base.y + (w * fill / 2) * s + (-d / 2 - 0.0012) * c, z))
        b.quad('window', a, e, e + Vector((0, 0, 0.009)), a + Vector((0, 0, 0.009)))
        z += step


def block(b, key, phi, r, w, d, z0, h, lit=True, dx=0.0):
    rot = facing(phi)
    base = ring(r, phi, 0)
    base = Vector((base.x + dx * math.cos(rot), base.y + dx * math.sin(rot), 0))
    b.box(key, (base.x, base.y, z0 + h / 2), (w, d, h), rot)
    if lit:
        windows_on(b, base, rot, w, d, z0, z0 + h)
    return base, rot


def cable(b, key, a, e, t=0.0016):
    """A thin straight cable between two points."""
    a, e = Vector(a), Vector(e)
    d = (e - a).normalized()
    side = d.cross(Vector((0, 0, 1)))
    if side.length < 1e-6:
        side = Vector((1, 0, 0))
    side = side.normalized() * t / 2
    b.quad(key, a - side, a + side, e + side, e - side)


def radial_point(phi, r, z, lateral=0.0):
    p = ring(r, phi, z)
    rot = facing(phi)
    return Vector((p.x + lateral * math.cos(rot), p.y + lateral * math.sin(rot), z))


def span(a, e, t, z, lateral=0.0):
    """A point a fraction t along the bridge from a to e (horizontal), at height z, offset sideways."""
    p = a.lerp(e, t)
    d = (e - a).to_2d().normalized()
    return Vector((p.x - d.y * lateral, p.y + d.x * lateral, z))


def bridge_deck(b, key, a, e, z, width, thickness=0.02):
    d = (e - a).to_2d()
    mid = (a + e) / 2
    b.box(key, (mid.x, mid.y, z), (d.length, width, thickness), math.atan2(d.y, d.x))


def erasmusbrug(b):
    """The Erasmusbrug, seen from the side as it crosses the river: the white deck from the north quay
    (right) to Kop van Zuid (left), the bent pylon near the south end and its fan of cables."""
    a = ring(QUAY_R[1] - 0.04, 74, 0)
    e = ring(BANK_R[0] + 0.06, ERASMUS_PHI, 0)
    deck_z = 0.6
    bridge_deck(b, 'bridge', a, e, deck_z, 0.07)
    for t in (0.2, 0.4, 0.6, 0.86):
        q = span(a, e, t, RIVER_Z)
        b.box('concrete', (q.x, q.y, (RIVER_Z + deck_z) / 2), (0.03, 0.05, deck_z - RIVER_Z), math.atan2((e - a).y, (e - a).x))
    # The pylon: two legs rising from the deck, leaning back towards the south bank, bending at the knee.
    foot, knee, head = 0.8, 0.86, 0.83
    for side in (-0.03, 0.03):
        cable(b, 'bridge', span(a, e, foot, deck_z, side), span(a, e, knee, deck_z + 0.26, side * 0.35), 0.022)
    k = span(a, e, knee, deck_z + 0.26)
    h = span(a, e, head, deck_z + 0.47)
    cable(b, 'bridge', k, h, 0.024)
    b.box('bridge', (k.x, k.y, k.z), (0.024, 0.024, 0.024))
    # Cables fanning down over the main span to the north, and the backstays to the south.
    for i in range(16):
        t = i / 15
        top = span(a, e, head, deck_z + 0.46 - 0.18 * t)
        for side in (-0.032, 0.032):
            cable(b, 'cable', top, span(a, e, 0.2 + 0.55 * t, deck_z + 0.01, side))
    for i in range(3):
        top = span(a, e, head, deck_z + 0.46 - 0.04 * i)
        for side in (-0.032, 0.032):
            cable(b, 'cable', top, span(a, e, 0.93 + 0.025 * i, deck_z + 0.01, side))


def willemsbrug(b):
    """The red Willemsbrug, further east (left): two red pylon frames and their cables."""
    a = ring(QUAY_R[1] - 0.04, 28, 0)
    e = ring(BANK_R[0] + 0.06, WILLEMS_PHI, 0)
    deck_z = 0.58
    bridge_deck(b, 'quay_edge', a, e, deck_z, 0.06, 0.018)
    for t in (0.42, 0.72):
        for side in (-0.034, 0.034):
            q = span(a, e, t, deck_z + 0.11, side)
            b.box('willems', (q.x, q.y, q.z), (0.012, 0.012, 0.22))
        cable(b, 'willems', span(a, e, t, deck_z + 0.215, -0.034), span(a, e, t, deck_z + 0.215, 0.034), 0.012)
        for k in range(4):
            for sgn in (-1, 1):
                for side in (-0.034, 0.034):
                    cable(b, 'willems', span(a, e, t, deck_z + 0.2, side), span(a, e, t + sgn * (0.04 + k * 0.035), deck_z + 0.01, side), 0.0014)


def skyline(b):
    L = LANDMARKS
    # Maastoren: the tallest, slim, with a stepped top.
    phi, r = L['maastoren']
    base, rot = block(b, 'glass_tower', phi, r, 0.085, 0.07, BANK_Z, 0.5)
    b.box('concrete', (base.x, base.y, BANK_Z + 0.53), (0.055, 0.05, 0.06), rot)
    # KPN tower: grey, with its leaning front and a mast.
    phi, r = L['kpn']
    base, rot = block(b, 'kpn', phi, r, 0.1, 0.08, BANK_Z, 0.41)
    c, s = math.cos(rot), math.sin(rot)
    front = lambda x, y, z: Vector((base.x + x * c - y * s, base.y + x * s + y * c, z))  # noqa: E731
    b.quad('glass_dark', front(-0.05, -0.04, BANK_Z + 0.05), front(0.05, -0.04, BANK_Z + 0.05),
           front(0.05, -0.075, BANK_Z + 0.41), front(-0.05, -0.075, BANK_Z + 0.41))
    for k in range(9):
        z = BANK_Z + 0.08 + k * 0.035
        y = -0.04 - 0.035 * (z - BANK_Z - 0.05) / 0.36 - 0.002
        b.quad('window', front(-0.035, y, z), front(0.035, y, z), front(0.035, y, z + 0.01), front(-0.035, y, z + 0.01))
    m = front(0, 0, 0)
    b.box('metal', (m.x, m.y, BANK_Z + 0.47), (0.005, 0.005, 0.12), rot)
    # De Rotterdam: three towers of stacked, shifted blocks.
    phi, r = L['derotterdam']
    for i, dphi in enumerate((-1.25, 0, 1.25)):
        p = phi + dphi
        block(b, 'glass_tower', p, r, 0.07, 0.065, BANK_Z, 0.22 + 0.01 * i)
        block(b, 'glass_tower', p, r + 0.01, 0.07, 0.06, BANK_Z + 0.22 + 0.01 * i, 0.2 + 0.015 * (i % 2), dx=0.012 * (1 - i))
    # Montevideo: white below, red-brown above.
    phi, r = L['montevideo']
    base, rot = block(b, 'concrete', phi, r, 0.07, 0.07, BANK_Z, 0.26)
    block(b, 'brick2', phi, r, 0.07, 0.07, BANK_Z + 0.26, 0.17)
    # New Orleans: a dark, rounded tower.
    phi, r = L['neworleans']
    q = ring(r, phi, 0)
    b.cylinder('glass_dark', (q.x, q.y, BANK_Z), 0.042, 0.46, sides=12)
    windows_on(b, q, facing(phi), 0.07, 0.084, BANK_Z, BANK_Z + 0.46)
    # Hotel New York: the old brick headquarters with green copper turrets, at the tip of the pier.
    phi, r = L['hotelnewyork']
    base, rot = block(b, 'brick', phi, r, 0.17, 0.07, BANK_Z, 0.1)
    b.box('roof2', (base.x, base.y, BANK_Z + 0.105), (0.17, 0.07, 0.01), rot)
    for dx in (-0.05, 0.05):
        t = Vector((base.x + dx * math.cos(rot), base.y + dx * math.sin(rot), 0))
        b.box('brick', (t.x, t.y, BANK_Z + 0.13), (0.03, 0.03, 0.05), rot)
        b.cone('copper', (t.x, t.y, BANK_Z + 0.155), 0.022, 0.04, sides=4)
    # The cruise terminal ship moored beside it.
    p = SHIP_PHI
    hull = ring(2.56, p, RIVER_Z)
    b.box('hull', (hull.x, hull.y, RIVER_Z + 0.016), (0.38, 0.055, 0.032), tangent(p))
    b.box('ship', (hull.x, hull.y, RIVER_Z + 0.045), (0.33, 0.048, 0.028), tangent(p))
    b.box('ship', (hull.x, hull.y, RIVER_Z + 0.07), (0.25, 0.04, 0.024), tangent(p))
    f = ring(2.56, p + 1.2, RIVER_Z)
    b.box('funnel', (f.x, f.y, RIVER_Z + 0.095), (0.03, 0.022, 0.03), tangent(p))
    windows_on(b, hull, facing(p), 0.33, 0.05, RIVER_Z + 0.034, RIVER_Z + 0.08, step=0.012, fill=0.9)
    # The Euromast, away to the west.
    phi, r = L['euromast']
    q = ring(r, phi, 0)
    b.cylinder('concrete', (q.x, q.y, BANK_Z), 0.016, 0.38, sides=10)
    b.cylinder('concrete', (q.x, q.y, BANK_Z + 0.24), 0.042, 0.025, sides=12)
    b.cylinder('metal', (q.x, q.y, BANK_Z + 0.38), 0.006, 0.16, sides=6)
    b.cylinder('willems', (q.x, q.y, BANK_Z + 0.52), 0.005, 0.03, sides=6)
    # Everything else along the far bank: lower offices, apartments and warehouses.
    p = PHI[0]
    while p < PHI[1]:
        width_deg = 1.1 + rand() * 1.6
        mid = p + width_deg / 2
        clear_of = all(abs(mid - lp) > 1.0 for lp, _ in L.values())
        if clear_of:
            # A row on the waterfront, and a taller row behind it.
            for r, hmin, hmax in ((2.7 + rand() * 0.04, 0.04, 0.12), (2.92 + rand() * 0.04, 0.1, 0.26)):
                h = hmin + rand() * (hmax - hmin)
                w = math.radians(width_deg) * r * 0.85
                key = ('brick', 'brick2', 'concrete', 'glass_tower', 'brick', 'glass_dark')[int(rand() * 6)]
                block(b, key, mid, r, w, 0.06 + rand() * 0.04, BANK_Z, h)
        t = ring(2.655, p, BANK_Z)
        b.blob('tree', (t.x, t.y, BANK_Z + 0.03), 0.022, 0.9)
        p += width_deg


def quay(b):
    """The north bank below the balcony: trees, lamp posts, benches and parked bikes."""
    arc_band(b, 'quay', QUAY_R[0] - 0.3, QUAY_R[1], QUAY_Z, QUAY_Z, steps=60)
    arc_band(b, 'quay_edge', QUAY_R[1], QUAY_R[1], RIVER_Z - 0.02, QUAY_Z, steps=60)
    p = PHI[0] + 2
    while p < PHI[1]:
        t = ring(0.98, p, QUAY_Z)
        b.cylinder('trunk', (t.x, t.y, QUAY_Z), 0.006, 0.07, sides=5)
        b.blob('tree', (t.x, t.y, QUAY_Z + 0.1), 0.05, 0.85)
        lp = ring(1.2, p + 3.5, QUAY_Z)
        b.box('lamp', (lp.x, lp.y, QUAY_Z + 0.06), (0.004, 0.004, 0.12))
        b.box('lamp_glow', (lp.x, lp.y, QUAY_Z + 0.122), (0.014, 0.014, 0.008))
        if rand() < 0.5:
            for k in range(3):
                bk = ring(1.1, p + 1.5 + k * 0.9, QUAY_Z)
                for dx in (-0.012, 0.012):
                    w = Vector((bk.x + dx * math.cos(radial(p)), bk.y + dx * math.sin(radial(p)), QUAY_Z + 0.012))
                    b.cylinder('metal', (w.x, w.y, w.z - 0.002), 0.01, 0.003, sides=8)
                b.box(('cyclist', 'car_red', 'metal')[k], (bk.x, bk.y, QUAY_Z + 0.02), (0.028, 0.003, 0.003), radial(p))
        p += 7.5
    # The river, with a few wakes.
    arc_band(b, 'water', RIVER_R[0], RIVER_R[1], RIVER_Z, RIVER_Z, steps=60)
    for r, p0, p1 in ((1.6, 10, 26), (2.1, 52, 70), (1.8, 75, 86), (2.35, 18, 30)):
        arc_band(b, 'wake', r - 0.004, r + 0.004, RIVER_Z + 0.001, RIVER_Z + 0.001, phi=(p0, p1), steps=10)
    # A barge moored on the near side.
    bp = 62
    bg = ring(1.36, bp, RIVER_Z)
    b.box('hull', (bg.x, bg.y, RIVER_Z + 0.012), (0.3, 0.05, 0.024), tangent(bp))
    c = ring(1.36, bp + 4, RIVER_Z)
    b.box('ship', (c.x, c.y, RIVER_Z + 0.035), (0.04, 0.035, 0.025), tangent(bp))
    # The far bank's edge.
    arc_band(b, 'quay_edge', BANK_R[0], BANK_R[0], RIVER_Z - 0.02, BANK_Z, steps=60)
    arc_band(b, 'quay', BANK_R[0], BANK_R[1], BANK_Z, BANK_Z, steps=60)


def rotterdam_balcony(b):
    """A modern balcony: glass balustrade, black handrail, a planter of tulips."""
    x = WALL_X - 0.42
    y0, y1 = -0.6, 3.2
    top = 0.8
    b.box('glass_rail', (x, (y0 + y1) / 2, (0.22 + top) / 2), (0.01, y1 - y0, top - 0.22))
    b.box('metal', (x, (y0 + y1) / 2, top), (0.03, y1 - y0, 0.02))
    for py in (0.75, 1.65, 2.55):
        b.box('concrete', (x, py, top + 0.045), (0.09, 0.42, 0.07))
        for k in range(9):
            fy = py - 0.18 + k * 0.045
            b.box('basil', (x, fy, top + 0.1), (0.004, 0.004, 0.06))
            b.blob('tulip_red' if k % 2 else 'tulip_yellow', (x, fy, top + 0.14), 0.014, 1.3, 6, 4)


def build_water_taxi(root, col):
    b = Builder()
    b.box('taxi', (0, 0, 0.008), (0.06, 0.022, 0.014))
    b.box('ship', (-0.006, 0, 0.02), (0.026, 0.016, 0.012))
    obj = b.build('View water taxi', root, col)
    obj.location = ring(TAXI_R, PHI[0], RIVER_Z)
    return obj


def build_rotterdam(root, col):
    b = Builder()
    arc_band(b, 'sky', SKY_R, SKY_R, -1.0, 3.2, phi=(PHI[0] - 6, PHI[1] + 1))
    b.build('View rotterdam sky', root, col)
    b = Builder()
    quay(b)
    b.build('View rotterdam river', root, col)
    b = Builder()
    skyline(b)
    erasmusbrug(b)
    willemsbrug(b)
    b.build('View rotterdam skyline', root, col)
    b = Builder()
    rotterdam_balcony(b)
    b.build('View rotterdam balcony', root, col)
    build_water_taxi(root, col)



def build_mask(col):
    """The window opening; the website draws the view only where this is seen."""
    x = -2.215
    me = bpy.data.meshes.new(MASK)
    me.from_pydata([(x, WINDOW_Y[0], WINDOW_Z[0]), (x, WINDOW_Y[1], WINDOW_Z[0]), (x, WINDOW_Y[1], WINDOW_Z[1]), (x, WINDOW_Y[0], WINDOW_Z[1])],
                   [], [(0, 1, 2, 3), (3, 2, 1, 0)])
    me.materials.append(bpy.data.materials.get('Window view mask') or bpy.data.materials.new('Window view mask'))
    obj = bpy.data.objects.new(MASK, me)
    col.objects.link(obj)
    return obj


def clear(col):
    for o in list(col.all_objects):
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if data is not None and getattr(data, 'users', 1) == 0 and isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)


def main():
    col = bpy.data.collections.get(COLLECTION)
    if not col:
        col = bpy.data.collections.new(COLLECTION)
        bpy.context.scene.collection.children.link(col)
    clear(col)
    make_materials()
    root = bpy.data.objects.new(ROOT, None)
    col.objects.link(root)
    build_thessaloniki(root, col)
    rdam = bpy.data.objects.new(ROOT_RDAM, None)
    col.objects.link(rdam)
    build_rotterdam(rdam, col)
    build_mask(col)
    # The 3D Rotterdam replaces the old photo of it.
    photo = bpy.data.objects.get('View through window')
    if photo:
        mats = list(photo.data.materials)
        bpy.data.objects.remove(photo, do_unlink=True)
        for m in mats:
            if m and m.users == 0:
                for n in m.node_tree.nodes:
                    if getattr(n, 'image', None) and n.image.users <= 1:
                        bpy.data.images.remove(n.image)
                bpy.data.materials.remove(m)
    print('WINDOW VIEW built:', len(col.all_objects), 'objects')
    if '--save' in sys.argv:
        bpy.ops.wm.save_mainfile()


main()
