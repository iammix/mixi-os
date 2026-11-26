"""Build the view of Nea Redestos (Νέα Ραιδεστός) outside the window of model/Minimal_Reacto_Room.blend.

The room is shown through an orthographic camera, so nothing gets smaller with distance and every
ray through the window slopes down at the same angle (about 26 degrees). The view is therefore a
miniature diorama built in rings around the window: the further a ring is, the lower the part of
it you see through the glass. From the bottom of the window to the top that gives: the balcony
rail with planters, the village roofs and church, the fields of the Anthemountas valley, the hills,
the mountains in the haze, and the sky. The website only draws it through the window (a stencil
mask), sets the sky and light by the time of day in Greece, and rides a cyclist along the road.

Everything is parented to the empty "Window view Nea Redestos"; the mask is "Window view mask".

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
ROOT = 'Window view Nea Redestos'
MASK = 'Window view mask'

WALL_X = -2.24                # outside face of the wall
CENTER = Vector((WALL_X, 0.85))   # middle of the window, seen from above
WINDOW_Y = (0.22, 1.48)
WINDOW_Z = (1.0, 2.42)
PHI = (-12, 88)               # the arc of directions the camera can look through the window in (deg)

# Ring radii (metres from the window, horizontally) and heights.
# Laid out so that, through the middle of the window, the rail takes the bottom ~15%, the village
# roofs the next ~30%, the fields ~15%, the hills and mountains ~15%, and the sky the rest.
VILLAGE_R = (0.72, 2.05)
VILLAGE_Z = 0.55
FIELDS_R = (2.05, 2.78)
FIELDS_Z = 0.52
ROAD_R = 2.4
HILLS_R = 2.82
MOUNTAIN_R = 2.98
SKY_R = 3.15


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
    return math.radians(phi_deg) - math.pi / 2


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
    MATS[key] = m


def make_materials():
    mat('sky', 'View sky', (0.45, 0.66, 0.92), 1.0)
    mat('mountain', 'View mountain haze', (0.42, 0.5, 0.62))
    mat('hills', 'View hills', (0.36, 0.45, 0.28))
    mat('wheat', 'View field wheat', (0.78, 0.66, 0.36))
    mat('green', 'View field green', (0.42, 0.56, 0.26))
    mat('young', 'View field young', (0.55, 0.66, 0.3))
    mat('ploughed', 'View field ploughed', (0.5, 0.38, 0.26))
    mat('ground', 'View village ground', (0.74, 0.68, 0.56))
    mat('road', 'View road', (0.42, 0.42, 0.42))
    mat('wall', 'View white wall', (0.93, 0.91, 0.86))
    mat('wall2', 'View cream wall', (0.9, 0.82, 0.66))
    mat('roof', 'View terracotta roof', (0.66, 0.3, 0.18))
    mat('roof2', 'View terracotta roof dark', (0.56, 0.25, 0.16))
    mat('flat', 'View flat roof', (0.8, 0.78, 0.74))
    mat('window', 'View lit window', (0.16, 0.17, 0.2), 0.4, emission=(1.0, 0.72, 0.38))
    mat('shutter', 'View shutters', (0.2, 0.42, 0.5))
    mat('panel', 'View solar panel', (0.08, 0.12, 0.2), 0.3, 0.5)
    mat('tank', 'View solar tank', (0.82, 0.83, 0.85), 0.4, 0.6)
    mat('metal', 'View dark metal', (0.06, 0.06, 0.07), 0.5, 0.6)
    mat('cypress', 'View cypress', (0.1, 0.22, 0.12))
    mat('olive', 'View olive tree', (0.36, 0.44, 0.3))
    mat('trunk', 'View trunk', (0.3, 0.22, 0.15))
    mat('balcony', 'View balcony', (0.84, 0.82, 0.78))
    mat('pot', 'View clay pot', (0.62, 0.32, 0.2))
    mat('basil', 'View basil', (0.22, 0.5, 0.18))
    mat('geranium', 'View geranium', (0.86, 0.12, 0.16))
    mat('cyclist', 'View cyclist', (0.15, 0.3, 0.75))


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


# ------------------------------------------------------------------- the view ----
def build_backdrop(root, col):
    b = Builder()
    # Sky: a tall curved backdrop behind everything.
    arc_band(b, 'sky', SKY_R, SKY_R, -1.0, 3.2, phi=(PHI[0] - 6, PHI[1] + 1))
    # Mountains in the haze (the hills around the valley; Chortiatis rises to the north).
    arc_band(b, 'mountain', MOUNTAIN_R, MOUNTAIN_R, 0.2, 0.0, profile=ridge(7, 0.72, 0.9))
    # Nearer, greener hills closing the valley.
    arc_band(b, 'hills', HILLS_R - 0.1, HILLS_R, FIELDS_Z, 0.0, profile=ridge(11, 0.62, 0.55))
    return b.build('View backdrop', root, col)


def build_fields(root, col):
    b = Builder()
    kinds = ['wheat', 'green', 'young', 'ploughed', 'green', 'wheat']
    rings_r = [FIELDS_R[0] + (FIELDS_R[1] - FIELDS_R[0]) * k / 6 for k in range(7)]
    for k in range(6):
        p = PHI[0]
        while p < PHI[1]:
            step = 5 + rand() * 9
            q = min(PHI[1], p + step)
            r0, r1 = rings_r[k], rings_r[k + 1]
            b.quad(kinds[int(rand() * len(kinds))], ring(r0, p, FIELDS_Z), ring(r0, q, FIELDS_Z), ring(r1, q, FIELDS_Z), ring(r1, p, FIELDS_Z))
            # A row of olive trees along some field edges.
            if rand() < 0.3:
                for t in range(4):
                    pt = ring(r0 + (r1 - r0) * (t + 0.5) / 4, p, FIELDS_Z)
                    b.blob('olive', (pt.x, pt.y, FIELDS_Z + 0.018), 0.022)
            p = q
    # The road through the valley the cyclist rides along.
    arc_band(b, 'road', ROAD_R - 0.014, ROAD_R + 0.014, FIELDS_Z + 0.002, FIELDS_Z + 0.002, steps=80)
    # Village ground, sloping gently down to the fields.
    arc_band(b, 'ground', VILLAGE_R[0] - 0.3, VILLAGE_R[1], VILLAGE_Z, VILLAGE_Z, steps=60)
    arc_band(b, 'ground', VILLAGE_R[1], FIELDS_R[0] + 0.04, VILLAGE_Z, FIELDS_Z, steps=60)
    return b.build('View fields', root, col)


def house(b, r, phi):
    w = 0.15 + rand() * 0.12
    d = 0.13 + rand() * 0.08
    h = 0.1 + rand() * 0.06
    if rand() < 0.35:
        h += 0.08   # a second storey
    rot = facing(phi) + (rand() - 0.5) * 0.25
    base = ring(r, phi, VILLAGE_Z)
    wall = 'wall' if rand() < 0.65 else 'wall2'
    b.box(wall, (base.x, base.y, VILLAGE_Z + h / 2), (w, d, h), rot)
    c, s = math.cos(rot), math.sin(rot)

    def local(x, y, z):
        return Vector((base.x + x * c - y * s, base.y + x * s + y * c, z))
    if rand() < 0.62:
        b.gable('roof' if rand() < 0.6 else 'roof2', (base.x, base.y, VILLAGE_Z + h), (w, d, 0.045 + rand() * 0.02), rot)
    else:
        # Flat roof with a solar water heater, very Greek.
        b.box('flat', (base.x, base.y, VILLAGE_Z + h + 0.004), (w + 0.01, d + 0.01, 0.008), rot)
        tx, ty = (rand() - 0.5) * w * 0.4, (rand() - 0.5) * d * 0.3
        p = local(tx, ty, VILLAGE_Z + h + 0.008)
        b.box('panel', (p.x, p.y, p.z + 0.02), (0.05, 0.012, 0.04), rot)
        q = local(tx, ty + 0.02, 0)
        b.box('tank', (q.x, q.y, p.z + 0.045), (0.055, 0.016, 0.016), rot)
    # Windows and shutters on the front (towards the camera).
    floors = 2 if h > 0.16 else 1
    for f in range(floors):
        for k in range(2 if w < 0.18 else 3):
            x = (k + 0.5) / (2 if w < 0.18 else 3) * w - w / 2
            z = VILLAGE_Z + 0.035 + f * 0.08
            a, b2 = local(x - 0.012, -d / 2 - 0.001, z), local(x + 0.012, -d / 2 - 0.001, z)
            key = 'window' if rand() < 0.75 else 'shutter'
            b.quad(key, a, b2, b2 + Vector((0, 0, 0.032)), a + Vector((0, 0, 0.032)))


def church(b, r, phi):
    rot = facing(phi)
    base = ring(r, phi, VILLAGE_Z)
    c, s = math.cos(rot), math.sin(rot)

    def local(x, y):
        return (base.x + x * c - y * s, base.y + x * s + y * c)
    # Nave with a tiled roof and a small apse.
    b.box('wall', (base.x, base.y, VILLAGE_Z + 0.09), (0.3, 0.15, 0.18), rot)
    b.gable('roof', (base.x, base.y, VILLAGE_Z + 0.18), (0.3, 0.15, 0.06), rot)
    # Bell tower at the front corner.
    tx, ty = local(-0.12, -0.1)
    b.box('wall', (tx, ty, VILLAGE_Z + 0.2), (0.075, 0.075, 0.4), rot)
    for k in (-1, 1):
        ax, ay = local(-0.12 + k * 0.0, -0.1 - 0.038)
        b.quad('metal', (ax - 0.016 * c, ay - 0.016 * s, VILLAGE_Z + 0.31), (ax + 0.016 * c, ay + 0.016 * s, VILLAGE_Z + 0.31),
               (ax + 0.016 * c, ay + 0.016 * s, VILLAGE_Z + 0.36), (ax - 0.016 * c, ay - 0.016 * s, VILLAGE_Z + 0.36))
    b.cone('roof', (tx, ty, VILLAGE_Z + 0.4), 0.055, 0.07, sides=4)
    b.box('metal', (tx, ty, VILLAGE_Z + 0.5), (0.006, 0.006, 0.05), rot)
    b.box('metal', (tx, ty, VILLAGE_Z + 0.51), (0.026, 0.006, 0.006), rot)
    # Cypresses beside it.
    for dx in (0.2, 0.25, -0.24):
        cx, cy = local(dx, 0.05)
        b.cone('cypress', (cx, cy, VILLAGE_Z), 0.026, 0.26 + rand() * 0.06, sides=7)


def build_village(root, col):
    b = Builder()
    church_phi = 50
    taken = []
    for _ in range(140):
        r = VILLAGE_R[0] + 0.08 + rand() * (VILLAGE_R[1] - VILLAGE_R[0] - 0.16)
        phi = PHI[0] + rand() * (PHI[1] - PHI[0])
        pos = ring(r, phi, 0)
        near_church = (pos - ring(1.3, church_phi, 0)).length < 0.34
        if near_church or any((pos - t).length < 0.2 for t in taken):
            continue
        taken.append(pos)
        house(b, r, phi)
    church(b, 1.3, church_phi)
    # Olive trees and the odd cypress between the houses.
    for _ in range(70):
        r = VILLAGE_R[0] + rand() * (VILLAGE_R[1] - VILLAGE_R[0])
        phi = PHI[0] + rand() * (PHI[1] - PHI[0])
        pos = ring(r, phi, VILLAGE_Z)
        if any((pos.to_2d() - t.to_2d()).length < 0.12 for t in taken):
            continue
        if rand() < 0.2:
            b.cone('cypress', (pos.x, pos.y, VILLAGE_Z), 0.02, 0.18, sides=7)
        else:
            b.cylinder('trunk', (pos.x, pos.y, VILLAGE_Z), 0.006, 0.03, sides=5)
            b.blob('olive', (pos.x, pos.y, VILLAGE_Z + 0.055), 0.04)
    return b.build('View village', root, col)


def build_balcony(root, col):
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
    for py in (0.55, 1.35, 2.15, 2.75):
        b.box('pot', (x_rail - 0.0, py, top + 0.05), (0.1, 0.36, 0.08))
        for k in range(7):
            fy = py - 0.15 + k * 0.05
            key = 'geranium' if (k + int(py * 10)) % 3 else 'basil'
            b.blob('basil', (x_rail, fy, top + 0.11), 0.035, 0.7)
            if key == 'geranium':
                b.blob('geranium', (x_rail - 0.01 + (rand() - 0.5) * 0.04, fy + (rand() - 0.5) * 0.03, top + 0.14 + rand() * 0.02), 0.014, 1.0, 6, 4)
    # A pot of basil on the outside window sill.
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
    p = ring(ROAD_R, PHI[0], FIELDS_Z + 0.014)
    obj.location = p
    return obj


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
    build_backdrop(root, col)
    build_fields(root, col)
    build_village(root, col)
    build_balcony(root, col)
    build_cyclist(root, col)
    build_mask(col)
    # The Rotterdam photo stays (the website switches between the two views).
    print('WINDOW VIEW built:', len(col.all_objects), 'objects')
    if '--save' in sys.argv:
        bpy.ops.wm.save_mainfile()


main()
