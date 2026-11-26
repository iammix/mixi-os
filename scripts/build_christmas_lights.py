"""Hang a string of Christmas lights round the window on the left wall of
model/Minimal_Reacto_Room.blend.

A dark green wire runs up one side of the window, across the top in shallow swags between hooks
and down the other side, with small bulbs along it in turn: red, green, blue, amber, warm white.
All the bulbs of one colour are one object with their own material ("Christmas lights red",
...), so the website can light and twinkle each colour (see
src/components/room/ChristmasLights.tsx); it also shows the lights only over Christmas. Everything
is parented to one empty, "Christmas lights", in "01 Architecture".

The left wall's face is at x = -2.10 and faces +x; the window opening runs from y = 0.20 to 1.50
and from z = 0.96 to 2.46.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend \
      --python scripts/build_christmas_lights.py -- --save
then re-export the room with scripts/export_room.py.
"""
import math
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

COLLECTION = '01 Architecture'
ROOT_NAME = 'Christmas lights'

WIRE_X = -2.088            # just off the wall
Y0, Y1 = 0.13, 1.57        # either side of the window, a little outside the frame
BOTTOM_Z, TOP_Z = 1.05, 2.53
SWAGS = 6                  # across the top, between hooks
SAG = 0.05
WIRE_R = 0.0025
SPACING = 0.085            # between bulbs along the wire
COLOURS = [
    ('red', (0.9, 0.05, 0.04, 1)),
    ('green', (0.05, 0.75, 0.12, 1)),
    ('blue', (0.08, 0.25, 0.95, 1)),
    ('amber', (1.0, 0.55, 0.05, 1)),
    ('white', (1.0, 0.85, 0.6, 1)),
]


def material(name, color, roughness=0.4):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def path():
    """Points along the wire: up the near side, across the top in swags, down the far side."""
    pts = []
    steps = 30
    for i in range(steps + 1):
        pts.append(Vector((WIRE_X, Y0, BOTTOM_Z + (TOP_Z - BOTTOM_Z) * i / steps)))
    per = 24
    for s in range(SWAGS):
        for i in range(1, per + 1):
            t = i / per
            y = Y0 + (Y1 - Y0) * (s + t) / SWAGS
            pts.append(Vector((WIRE_X, y, TOP_Z - SAG * math.sin(math.pi * t))))
    for i in range(1, steps + 1):
        pts.append(Vector((WIRE_X, Y1, TOP_Z - (TOP_Z - BOTTOM_Z) * i / steps)))
    return pts


def along(pts, spacing):
    """Evenly spaced points along a polyline, with the direction of the wire at each."""
    out = []
    travelled = spacing / 2
    for a, b in zip(pts, pts[1:]):
        seg = (b - a).length
        while travelled <= seg:
            out.append((a + (b - a) * (travelled / seg), (b - a).normalized()))
            travelled += spacing
        travelled -= seg
    return out


def tube(bm, pts, radius, segments=6):
    rings = []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        side = d.cross(Vector((1, 0, 0))).normalized()
        up = d.cross(side)
        rings.append([bm.verts.new(p + radius * (math.cos(2 * math.pi * k / segments) * side + math.sin(2 * math.pi * k / segments) * up))
                      for k in range(segments)])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(segments):
            bm.faces.new((r0[k], r0[(k + 1) % segments], r1[(k + 1) % segments], r1[k]))


def bulb(bm, at, direction):
    """A small pointed bulb standing off the wire, out from the wall and tipped down a little."""
    out = Vector((1, 0, -0.35)).normalized()
    geom = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=1.0)
    verts = geom['verts']
    bmesh.ops.scale(bm, vec=(0.0095, 0.0095, 0.018), verts=verts)
    rot = Vector((0, 0, 1)).rotation_difference(out).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(at + out * 0.016) @ rot, verts=verts)
    return verts


def clear_old():
    old = bpy.data.objects.get(ROOT_NAME)
    if not old:
        return
    for o in [old, *old.children_recursive]:
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if isinstance(data, bpy.types.Mesh) and data.users == 0:
            bpy.data.meshes.remove(data)


def obj(name, bm, mat, root, col, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    for poly in me.polygons:
        poly.use_smooth = smooth
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    o.parent = root
    return o


def main():
    clear_old()
    col = bpy.data.collections[COLLECTION]
    root = bpy.data.objects.new(ROOT_NAME, None)
    col.objects.link(root)

    pts = path()
    bm = bmesh.new()
    tube(bm, pts, WIRE_R)
    obj('Christmas lights wire', bm, material('Christmas lights wire', (0.02, 0.06, 0.03, 1), 0.6), root, col)

    groups = [bmesh.new() for _ in COLOURS]
    for i, (at, direction) in enumerate(along(pts, SPACING)):
        bulb(groups[i % len(COLOURS)], at, direction)
    for (name, color), bm in zip(COLOURS, groups):
        obj(f'Christmas lights {name}', bm, material(f'Christmas lights {name}', color, 0.25), root, col)

    if '--save' in sys.argv:
        bpy.ops.wm.save_mainfile()


main()
