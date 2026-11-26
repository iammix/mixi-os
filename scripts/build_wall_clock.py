"""Hang a wall clock on the back wall of model/Minimal_Reacto_Room.blend, between the monitor and
the paintings.

A minimal clock: a thin oak rim around an off-white face with twelve black batons, black hour and
minute hands and an orange second hand. The hands are separate objects whose origins sit on the
clock's centre and which point at 12 when unrotated, so the website can turn them about the wall's
normal to show the time (see src/components/room/WallClock.tsx). Everything is parented to one
empty, "Wall clock", in "02 Workstation".

The back wall's face is at y = 1.87 (the room is towards -y); the paintings start at x = 0.41 and
the monitor ends at x = -0.65, z = 1.37.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend \
      --python scripts/build_wall_clock.py -- --save
then re-export the room with scripts/export_room.py.
"""
import math
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

COLLECTION = '02 Workstation'
ROOT_NAME = 'Wall clock'

WALL_Y = 1.87
CENTER = Vector((-0.12, WALL_Y, 1.80))
RADIUS = 0.15
RIM = 0.012
DEPTH = 0.035
FACE_Y = WALL_Y - DEPTH + 0.004          # the dial sits a little behind the rim's front edge
HAND_GAP = 0.003                         # each hand stands this far in front of the one behind


def material(name, color, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def obj(name, bm, mat, parent, col, origin=Vector()):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    o.location = origin
    col.objects.link(o)
    o.parent = parent
    return o


def disc_y(bm, radius, y0, y1, seg=96):
    """A cylinder along y (facing the room) centred on the clock."""
    m = Matrix.Translation(Vector((CENTER.x, (y0 + y1) / 2, CENTER.z))) @ Matrix.Rotation(math.pi / 2, 4, 'X')
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=radius, radius2=radius,
                          depth=abs(y1 - y0), matrix=m)


def ring_y(bm, r_in, r_out, y0, y1, seg=96):
    """A tube along y: the rim."""
    rings = []
    for y in (y0, y1):
        for r in (r_out, r_in):
            rings.append([bm.verts.new((CENTER.x + r * math.cos(2 * math.pi * k / seg), y,
                                        CENTER.z + r * math.sin(2 * math.pi * k / seg)))
                          for k in range(seg)])
    outer0, inner0, outer1, inner1 = rings
    for a, b in ((outer0, outer1), (inner1, inner0), (outer1, inner1), (inner0, outer0)):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))


def box(bm, centre, size, angle=0.0, about=None):
    """A box at `centre` (local to `about`, default the clock centre), turned clockwise by `angle`
    as seen from the room (about the y axis)."""
    geom = bmesh.ops.create_cube(bm, size=1.0)
    verts = geom['verts']
    bmesh.ops.scale(bm, vec=size, verts=verts)
    bmesh.ops.translate(bm, vec=centre, verts=verts)
    # Seen from the room (looking along +y), clockwise is a positive turn about +y.
    bmesh.ops.rotate(bm, cent=Vector(), matrix=Matrix.Rotation(angle, 3, 'Y'), verts=verts)
    bmesh.ops.translate(bm, vec=about if about is not None else CENTER, verts=verts)


def hand(name, length, tail, width, y, mat, root, col):
    """A hand pointing at 12, modelled around its own origin on the clock's centre."""
    bm = bmesh.new()
    box(bm, Vector((0, 0, (length - tail) / 2)), Vector((width, 0.002, length + tail)), about=Vector())
    return obj(name, bm, mat, root, col, origin=Vector((CENTER.x, y, CENTER.z)))


def clear_old():
    old = bpy.data.objects.get(ROOT_NAME)
    if not old:
        return
    for o in [old, *old.children_recursive]:
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if isinstance(data, bpy.types.Mesh) and data.users == 0:
            bpy.data.meshes.remove(data)


def main():
    clear_old()
    col = bpy.data.collections[COLLECTION]
    root = bpy.data.objects.new(ROOT_NAME, None)
    col.objects.link(root)

    oak = bpy.data.materials.get('Oak') or material('Clock oak', (0.45, 0.27, 0.14, 1), roughness=0.55)
    dial = material('Clock dial', (0.88, 0.86, 0.80, 1), roughness=0.7)
    black = material('Clock hands black', (0.015, 0.015, 0.015, 1), metallic=0.3, roughness=0.45)
    orange = material('Clock second hand', (0.85, 0.32, 0.08, 1), roughness=0.4)

    bm = bmesh.new()
    ring_y(bm, RADIUS - RIM, RADIUS, WALL_Y - DEPTH, WALL_Y)
    obj('Clock rim', bm, oak, root, col)

    bm = bmesh.new()
    disc_y(bm, RADIUS - RIM, FACE_Y, WALL_Y - 0.002)
    obj('Clock dial', bm, dial, root, col)

    # Twelve batons, the ones at 12, 3, 6 and 9 longer and bolder.
    bm = bmesh.new()
    for i in range(12):
        major = i % 3 == 0
        length = 0.026 if major else 0.016
        width = 0.007 if major else 0.004
        r = RADIUS - RIM - 0.012 - length / 2
        box(bm, Vector((0, FACE_Y - 0.001 - CENTER.y, r)), Vector((width, 0.002, length)), angle=i * math.pi / 6)
    obj('Clock batons', bm, black, root, col)

    front = FACE_Y - 0.002
    hand('Clock hour hand', 0.075, 0.015, 0.008, front - HAND_GAP, black, root, col)
    hand('Clock minute hand', 0.110, 0.018, 0.005, front - 2 * HAND_GAP, black, root, col)
    hand('Clock second hand', 0.118, 0.030, 0.0018, front - 3 * HAND_GAP, orange, root, col)

    bm = bmesh.new()
    m = Matrix.Translation(Vector((CENTER.x, front - 3.5 * HAND_GAP, CENTER.z))) @ Matrix.Rotation(math.pi / 2, 4, 'X')
    bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=0.006, radius2=0.006, depth=0.003, matrix=m)
    obj('Clock pivot cap', bm, orange, root, col)

    for o in root.children:
        for poly in o.data.polygons:
            poly.use_smooth = False

    if '--save' in sys.argv:
        bpy.ops.wm.save_mainfile()


main()
