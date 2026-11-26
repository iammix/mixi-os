"""Hang a cork training board on the left wall of model/Minimal_Reacto_Room.blend, above the bike.

A thin oak frame around a cork panel. The panel ("Training board cork") is one quad whose UVs run
0..1 across it, left to right and bottom to top as seen from the room; the website draws the
week's training and the next race onto it (see src/components/room/TrainingBoard.tsx), so the
cork colour here is only what shows before that. Everything is parented to one empty,
"Training board", in "08 Triathlon gear".

The left wall's face is at x = -2.10 and faces +x; seen from the room, +y is to the right. The
Reacto hangs between y = -1.39 and 0.28 up to z = 1.51 and the window starts at y = 0.20, so the
board sits over the bike's middle, well under the 2.8 m ceiling.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend \
      --python scripts/build_training_board.py -- --save
then re-export the room with scripts/export_room.py.
"""
import sys

import bpy
import bmesh
from mathutils import Vector

COLLECTION = '08 Triathlon gear'
ROOT_NAME = 'Training board'
CORK_NAME = 'Training board cork'

WALL_X = -2.10
Y0, Y1 = -1.17, -0.33          # 0.84 m wide...
Z0, Z1 = 1.70, 2.26            # ...by 0.56 m tall: 3:2, like the 1536 x 1024 texture
FRAME = 0.025                  # width of the oak frame
FRAME_DEPTH = 0.022            # how far the frame stands off the wall
CORK_X = WALL_X + 0.014        # the cork sits a little behind the frame's front edge


def material(name, color, roughness=0.6):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def obj(name, bm, mat, parent, col):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    o.parent = parent
    return o


def box(bm, lo, hi):
    geom = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=hi - lo, verts=geom['verts'])
    bmesh.ops.translate(bm, vec=(lo + hi) / 2, verts=geom['verts'])


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

    oak = bpy.data.materials.get('Oak') or material('Training board oak', (0.45, 0.27, 0.14, 1), 0.55)
    cork = material(CORK_NAME, (0.62, 0.43, 0.26, 1), 0.9)

    # The frame: top and bottom run the full width, the sides fit between them.
    bm = bmesh.new()
    back, front = WALL_X, WALL_X + FRAME_DEPTH
    box(bm, Vector((back, Y0, Z1 - FRAME)), Vector((front, Y1, Z1)))
    box(bm, Vector((back, Y0, Z0)), Vector((front, Y1, Z0 + FRAME)))
    box(bm, Vector((back, Y0, Z0 + FRAME)), Vector((front, Y0 + FRAME, Z1 - FRAME)))
    box(bm, Vector((back, Y1 - FRAME, Z0 + FRAME)), Vector((front, Y1, Z1 - FRAME)))
    obj('Training board frame', bm, oak, root, col)

    # A backing behind the cork so nothing shows through from the side.
    bm = bmesh.new()
    box(bm, Vector((back, Y0 + FRAME, Z0 + FRAME)), Vector((CORK_X - 0.001, Y1 - FRAME, Z1 - FRAME)))
    obj('Training board backing', bm, oak, root, col)

    # The cork: one quad facing +x, counter-clockwise as seen from the room, UVs 0..1 across it.
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    ya, yb, za, zb = Y0 + FRAME, Y1 - FRAME, Z0 + FRAME, Z1 - FRAME
    corners = [(ya, za, 0, 0), (yb, za, 1, 0), (yb, zb, 1, 1), (ya, zb, 0, 1)]
    face = bm.faces.new([bm.verts.new((CORK_X, y, z)) for y, z, _, _ in corners])
    for loop, (_, _, u, v) in zip(face.loops, corners):
        loop[uv].uv = (u, v)
    obj(CORK_NAME, bm, cork, root, col)

    for o in root.children:
        for poly in o.data.polygons:
            poly.use_smooth = False

    if '--save' in sys.argv:
        bpy.ops.wm.save_mainfile()


main()
