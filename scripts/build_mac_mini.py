"""Replace the compact desktop computer on the desk in model/Minimal_Reacto_Room.blend
with a Mac mini (the 2024 M4 design: 12.7 x 12.7 x 5 cm, rounded aluminium body standing on
a dark circular foot, two USB-C ports, a headphone jack and a status light on the front).

It sits a little further left and forward than the old computer did, fully on the desk top
(the old one overhung the back edge and floated above it), turned slightly towards the camera.
All parts are parented to one empty, "Mac mini".

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend \
      --python scripts/build_mac_mini.py -- --save
then re-export the room with scripts/export_room.py.
"""
import math
import sys

import bpy

COLLECTION = '02 Workstation'
OLD = ['Compact desktop computer']
ROOT_NAME = 'Mac mini'

DESK_TOP = 0.781
CENTER = (-0.46, 1.635)      # world x, y on the desk (the wall is towards +y)
TURN = math.radians(10)      # front (-y) turned a little towards the hero camera

HALF = 0.0635                # half the 127 mm footprint
CORNER = 0.018               # plan-view corner radius
FOOT_GAP = 0.004             # the body floats this far above the desk on its foot
HEIGHT = 0.050
FILLET = 0.0025              # rounding of the top and bottom edges
FOOT_R = 0.052
FRONT_Y = -HALF


def material(name, color, metallic, roughness, emission=None):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = emission
        bsdf.inputs['Emission Strength'].default_value = 3.0
    return mat


def rounded_square(half, radius, z, seg=10):
    """Counter-clockwise outline of a rounded square centred on the origin."""
    pts = []
    for cx, cy, a0 in [(1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)]:
        ox, oy = cx * (half - radius), cy * (half - radius)
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((ox + radius * math.cos(a), oy + radius * math.sin(a), z))
    return pts


def body_mesh():
    """Rounded-square slab with filleted top and bottom edges."""
    rings = []
    steps = 5
    for i in range(steps + 1):  # bottom fillet
        a = math.radians(-90 + 90 * i / steps)
        rings.append((FOOT_GAP + FILLET + FILLET * math.sin(a), FILLET * (1 - math.cos(a))))
    for i in range(steps + 1):  # top fillet
        a = math.radians(90 * i / steps)
        rings.append((FOOT_GAP + HEIGHT - FILLET + FILLET * math.sin(a), FILLET * (1 - math.cos(a))))
    verts, faces = [], []
    n = None
    for z, inset in rings:
        ring = rounded_square(HALF - inset, CORNER - inset, z)
        n = len(ring)
        verts.extend(ring)
    for r in range(len(rings) - 1):
        a, b = r * n, (r + 1) * n
        for i in range(n):
            j = (i + 1) % n
            faces.append((a + i, a + j, b + j, b + i))
    faces.append(tuple(reversed(range(n))))                       # bottom cap
    faces.append(tuple(range((len(rings) - 1) * n, len(rings) * n)))  # top cap
    return verts, faces


def disc(cx, cz, r, y, seg=20):
    """Disc in the front plane (facing -y)."""
    return [(cx + r * math.cos(2 * math.pi * i / seg), y, cz + r * math.sin(2 * math.pi * i / seg))
            for i in range(seg)]


def stadium(cx, cz, w, h, y, seg=8):
    """Rounded slot (a USB-C port) in the front plane."""
    r = h / 2
    pts = []
    for side, a0 in [(1, -90), (-1, 90)]:
        ox = cx + side * (w / 2 - r)
        for i in range(seg + 1):
            a = math.radians(a0 + 180 * i / seg)
            pts.append((ox + r * math.cos(a), y, cz + r * math.sin(a)))
    return pts


def front_poly(pts):
    """Face winding so the polygon faces -y."""
    return list(reversed(pts))


def make_object(name, verts, faces, mat, parent, col, smooth_angle=40):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(smooth_angle))
    obj = bpy.data.objects.new(name, me)
    col.objects.link(obj)
    obj.parent = parent
    return obj


def polys(shapes):
    verts, faces = [], []
    for pts in shapes:
        off = len(verts)
        verts.extend(pts)
        faces.append(tuple(range(off, off + len(pts))))
    return verts, faces


def clear_old(col):
    names = OLD + [ROOT_NAME] + [o.name for o in col.all_objects if o.name.startswith('Mac mini')]
    for name in set(names):
        obj = bpy.data.objects.get(name)
        if obj:
            data = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if isinstance(data, bpy.types.Mesh) and data.users == 0:
                bpy.data.meshes.remove(data)


def main():
    col = bpy.data.collections[COLLECTION]
    clear_old(col)

    silver = material('Mac mini silver aluminum', (0.80, 0.81, 0.82, 1), 1.0, 0.33)
    port = material('Mac mini port black', (0.006, 0.006, 0.007, 1), 0.0, 0.6)
    foot = material('Mac mini foot', (0.02, 0.02, 0.022, 1), 0.0, 0.7)
    led = material('Mac mini status light', (1, 1, 1, 1), 0.0, 0.4, emission=(1, 1, 1, 1))

    root = bpy.data.objects.new(ROOT_NAME, None)
    col.objects.link(root)
    root.location = (CENTER[0], CENTER[1], DESK_TOP)
    root.rotation_euler = (0, 0, TURN)

    make_object('Mac mini body', *body_mesh(), silver, root, col)

    # Dark foot the body floats on, set well in from the edges.
    ring_bottom = disc(0, 0, FOOT_R, 0)
    foot_verts = [(x, z, 0.0) for x, _, z in ring_bottom] + [(x, z, FOOT_GAP + 0.0005) for x, _, z in ring_bottom]
    n = len(ring_bottom)
    foot_faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    foot_faces += [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    make_object('Mac mini foot', foot_verts, foot_faces, foot, root, col)

    # Front ports, a hair proud of the aluminium so they don't z-fight.
    y = FRONT_Y - 0.0003
    zc = FOOT_GAP + HEIGHT / 2
    ports = [
        front_poly(stadium(-0.040, zc, 0.0084, 0.0026, y)),
        front_poly(stadium(-0.028, zc, 0.0084, 0.0026, y)),
        front_poly(disc(-0.017, zc, 0.00175, y)),
    ]
    make_object('Mac mini front ports', *polys(ports), port, root, col)
    make_object('Mac mini status light', *polys([front_poly(disc(0.045, zc, 0.0007, y, seg=12))]), led, root, col)

    print(f'MAC MINI built: {len([o for o in col.objects if o.name.startswith("Mac mini")])} objects')
    if '--save' in sys.argv:
        bpy.ops.wm.save_mainfile()


main()
