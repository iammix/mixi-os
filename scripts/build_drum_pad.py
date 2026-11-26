"""Put a small drum pad on the record console in model/Minimal_Reacto_Room.blend, between the
turntable and the right speaker.

A compact controller: a matte black body with a 2 x 2 grid of rubber pads at the front and, behind
them, two small knobs and a little display. Each pad is its own object with its own material
("Drum pad 1".."Drum pad 4": 1 front-left, 2 front-right, 3 back-left, 4 back-right, as seen from
the room) so the website can light them up while a loop plays (see
src/components/room/DrumPad.tsx). Everything is parented to one empty, "Drum pad", in
"04 Vinyl listening".

The console top is at z = 0.75; the turntable ends at x = 1.40 and the right speaker starts at
x = 1.585; the console's front edge is at y = 1.21 (the room is towards -y).

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend \
      --python scripts/build_drum_pad.py -- --save
then re-export the room with scripts/export_room.py.
"""
import sys

import bpy
import bmesh
from mathutils import Vector

COLLECTION = '04 Vinyl listening'
ROOT_NAME = 'Drum pad'

TOP_Z = 0.75
CENTER_X = 1.4925
Y0, Y1 = 1.235, 1.405         # front and back of the body
WIDTH = 0.15
BODY_H = 0.02
PAD = 0.052                   # each pad's side
GAP = 0.01
PAD_H = 0.005
FRONT_MARGIN = 0.012


def material(name, color, roughness=0.6, metallic=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return mat


def box(bm, lo, hi, bevel=0.0):
    geom = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=hi - lo, verts=geom['verts'])
    bmesh.ops.translate(bm, vec=(lo + hi) / 2, verts=geom['verts'])
    if bevel:
        edges = list({e for v in geom['verts'] for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=2, affect='EDGES')


def obj(name, bm, mat, parent, col):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    o.parent = parent
    return o


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

    body_mat = material('Drum pad body', (0.025, 0.025, 0.028, 1), roughness=0.55)
    knob_mat = material('Drum pad knob', (0.12, 0.12, 0.13, 1), roughness=0.35, metallic=0.6)
    screen_mat = material('Drum pad screen', (0.02, 0.05, 0.06, 1), roughness=0.2)

    x0, x1 = CENTER_X - WIDTH / 2, CENTER_X + WIDTH / 2
    bm = bmesh.new()
    box(bm, Vector((x0, Y0, TOP_Z)), Vector((x1, Y1, TOP_Z + BODY_H)), bevel=0.004)
    obj('Drum pad body', bm, body_mat, root, col)

    # The pads: 1 front-left, 2 front-right, 3 back-left, 4 back-right.
    top = TOP_Z + BODY_H
    for i, (col_i, row_i) in enumerate(((0, 0), (1, 0), (0, 1), (1, 1)), start=1):
        cx = CENTER_X + (col_i - 0.5) * (PAD + GAP)
        cy = Y0 + FRONT_MARGIN + PAD / 2 + row_i * (PAD + GAP)
        bm = bmesh.new()
        box(bm, Vector((cx - PAD / 2, cy - PAD / 2, top - 0.001)), Vector((cx + PAD / 2, cy + PAD / 2, top + PAD_H)), bevel=0.003)
        obj(f'Drum pad {i}', bm, material(f'Drum pad {i}', (0.16, 0.16, 0.17, 1), roughness=0.85), root, col)

    # Two knobs and a small display along the back.
    back_y = Y0 + FRONT_MARGIN + 2 * PAD + GAP + (Y1 - (Y0 + FRONT_MARGIN + 2 * PAD + GAP)) / 2
    bm = bmesh.new()
    for kx in (x0 + 0.02, x0 + 0.045):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.0075, radius2=0.0065, depth=0.01,
                              matrix=__import__('mathutils').Matrix.Translation((kx, back_y, top + 0.005)))
    obj('Drum pad knobs', bm, knob_mat, root, col)
    bm = bmesh.new()
    box(bm, Vector((x1 - 0.065, back_y - 0.007, top - 0.001)), Vector((x1 - 0.015, back_y + 0.007, top + 0.0015)))
    obj('Drum pad screen', bm, screen_mat, root, col)

    for o in root.children:
        for poly in o.data.polygons:
            poly.use_smooth = False

    if '--save' in sys.argv:
        bpy.ops.wm.save_mainfile()


main()
