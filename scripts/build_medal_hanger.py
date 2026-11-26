"""Hang a medal hanger on the left wall of model/Minimal_Reacto_Room.blend, above the tri bag.

A matte black steel bar with SWIM · BIKE · RUN cut through it, standing a little off the wall
on two stand-offs, with six hooks along its underside. The medals themselves aren't modelled:
the website hangs one for every finished race in src/components/room/races.ts from the empties
"Medal hook 00".."Medal hook 05" (left to right as seen from the room, i.e. along +y), each at
the point a ribbon hangs from. Everything is parented to one empty, "Medal hanger", in
"08 Triathlon gear".

The left wall's face is at x = -2.10; the room is open past y = -1.90 and the Reacto's rear
wheel ends at y = -1.39, so the bar fits between them, well above the bag (top at z 0.58).

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend \
      --python scripts/build_medal_hanger.py -- --save
then re-export the room with scripts/export_room.py.
"""
import math
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

COLLECTION = '08 Triathlon gear'
ROOT_NAME = 'Medal hanger'
BAR_NAME = 'Medal hanger bar'
HOOK_NAME = 'Medal hook {:02d}'
MATERIAL = 'Matte black steel'
TEXT = 'SWIM · BIKE · RUN'

WALL_X = -2.10
STANDOFF = 0.015            # gap between the wall and the back of the bar
THICK = 0.004
LENGTH = 0.44
HEIGHT = 0.06
CENTER_Y, CENTER_Z = -1.65, 1.38
TEXT_WIDTH = 0.36           # the lettering is scaled to this length
HOOKS = 6
HOOK_DROP = 0.022           # how far a hook reaches below the bar
HOOK_REACH = 0.012          # how far its tip turns out into the room

BACK_X = WALL_X + STANDOFF
FRONT_X = BACK_X + THICK
BOTTOM_Z = CENTER_Z - HEIGHT / 2


def material():
    mat = bpy.data.materials.get(MATERIAL) or bpy.data.materials.new(MATERIAL)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (0.02, 0.02, 0.022, 1)
    bsdf.inputs['Metallic'].default_value = 0.8
    bsdf.inputs['Roughness'].default_value = 0.6
    return mat


def box_mesh(name, lo, hi):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    size = Vector(hi) - Vector(lo)
    centre = (Vector(hi) + Vector(lo)) / 2
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centre) @ Matrix.Diagonal((*size, 1)), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def rod(bm, points, r=0.0015, seg=10):
    """A thin round rod along a polyline, as one tube in bm."""
    rings = []
    for i, p in enumerate(points):
        d = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        side = d.cross(Vector((1, 0, 0)))
        if side.length < 1e-6:
            side = d.cross(Vector((0, 1, 0)))
        side.normalize()
        up = d.cross(side)
        rings.append([bm.verts.new(p + (side * math.cos(t) + up * math.sin(t)) * r)
                      for t in (2 * math.pi * k / seg for k in range(seg))])
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])


def hook_y(i):
    margin = LENGTH / HOOKS / 2
    return CENTER_Y - LENGTH / 2 + margin + i * (LENGTH - 2 * margin) / (HOOKS - 1)


def lettering(col):
    """The text as a mesh standing through the bar, reading along +y and facing into the room."""
    curve = bpy.data.curves.new('Medal hanger text', 'FONT')
    curve.body = TEXT
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.extrude = 0.02
    obj = bpy.data.objects.new('Medal hanger text', curve)
    col.objects.link(obj)
    bpy.context.view_layer.update()
    width = obj.dimensions.x
    scale = TEXT_WIDTH / width
    obj.scale = (scale, scale, 1)
    # Text reads along local +x and faces +z: turn it to read along +y and face +x.
    obj.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    obj.location = ((BACK_X + FRONT_X) / 2, CENTER_Y, CENTER_Z)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    me.transform(obj.matrix_world)
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.curves.remove(curve)
    cutter = bpy.data.objects.new('Medal hanger cutter', me)
    col.objects.link(cutter)
    return cutter


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

    bar = bpy.data.objects.new(BAR_NAME, box_mesh(BAR_NAME,
                                                  (BACK_X, CENTER_Y - LENGTH / 2, BOTTOM_Z),
                                                  (FRONT_X, CENTER_Y + LENGTH / 2, CENTER_Z + HEIGHT / 2)))
    col.objects.link(bar)

    # Cut the lettering through the plate.
    cutter = lettering(col)
    cut = bar.modifiers.new('Lettering', 'BOOLEAN')
    cut.operation = 'DIFFERENCE'
    cut.solver = 'EXACT'
    cut.object = cutter
    bpy.context.view_layer.objects.active = bar
    bpy.ops.object.modifier_apply(modifier=cut.name)
    me = cutter.data
    bpy.data.objects.remove(cutter, do_unlink=True)
    bpy.data.meshes.remove(me)

    # Stand-offs near each end and the hooks, all added to the bar's mesh.
    bm = bmesh.new()
    bm.from_mesh(bar.data)
    for y in (CENTER_Y - LENGTH / 2 + 0.02, CENTER_Y + LENGTH / 2 - 0.02):
        for z in (CENTER_Z + HEIGHT / 2 - 0.008,):
            rod(bm, [Vector((WALL_X, y, z)), Vector((FRONT_X + 0.001, y, z))], r=0.004, seg=16)
    hooks = []
    for i in range(HOOKS):
        y = hook_y(i)
        top = Vector((FRONT_X - THICK / 2, y, BOTTOM_Z + 0.004))
        low = Vector((FRONT_X - THICK / 2, y, BOTTOM_Z - HOOK_DROP))
        bend = Vector((FRONT_X + HOOK_REACH * 0.6, y, BOTTOM_Z - HOOK_DROP - 0.003))
        tip = Vector((FRONT_X + HOOK_REACH, y, BOTTOM_Z - HOOK_DROP + 0.006))
        rod(bm, [top, low, bend, tip])
        # A ribbon loops over the bottom of the bend.
        hooks.append(Vector((FRONT_X + HOOK_REACH * 0.5, y, BOTTOM_Z - HOOK_DROP - 0.002)))
    bm.to_mesh(bar.data)
    bm.free()
    for poly in bar.data.polygons:
        poly.use_smooth = False
    bar.data.materials.clear()
    bar.data.materials.append(material())
    bar.parent = root

    for i, p in enumerate(hooks):
        hook = bpy.data.objects.new(HOOK_NAME.format(i), None)
        hook.empty_display_size = 0.01
        hook.location = p
        col.objects.link(hook)
        hook.parent = root
        print(f'{hook.name}: ({p.x:.3f}, {p.y:.3f}, {p.z:.3f})')

    if '--save' in sys.argv:
        bpy.ops.wm.save_mainfile()


main()
