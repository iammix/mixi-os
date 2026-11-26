"""Hang three paintings above the record console in model/Minimal_Reacto_Room.blend.

Replaces the three framed album covers (the records now live in the rack) with dark-framed
paintings under the same picture lights, left to right:
  Millet, The Gleaners (1857) - Gyzis, The Secret School (1885-86) - Lytras, The Carols (1872).
Each painting and its frame are parented to an empty named "Painting <id>", which the website
uses to open the painting's pop-up (see src/components/room/paintings.ts). Images come from
public/paintings/ (public-domain scans from Wikimedia Commons) and are packed into the .blend.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend \
      --python scripts/build_paintings.py -- --save
then re-export the room with scripts/export_room.py.
"""
import os
import sys

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLLECTION = '04 Vinyl listening'
# The modelled album frames these replace (and the cover meshes inside them).
OLD = ['Framed print NAS', 'Framed print 2PAC', 'Framed print WU-TANG',
       'Illmatic framed cover', 'All Eyez On Me framed cover', '36 Chambers framed cover']

PAINTINGS = [  # id, image, centre x (under each picture light)
    ('gleaners', 'gleaners.jpg', 0.64),
    ('secret-school', 'secret-school.jpg', 1.18),
    ('kalanta', 'kalanta.jpg', 1.72),
]
WALL_Y = 1.868      # wall face behind the frames (the room is towards -y)
TOP_Z = 1.80        # top of every frame, just under the picture lights
ART_H = 0.30        # visible painting height
BORDER = 0.028      # frame moulding width
# Moulding profile: (offset out from the painting's edge, depth out from the wall).
PROFILE = [(-0.003, 0.007), (0.0, 0.009), (0.003, 0.012), (0.008, 0.019), (0.012, 0.016),
           (0.018, 0.024), (0.024, 0.02), (BORDER, 0.014), (BORDER, 0.0)]


def material(name, color, metallic, roughness, image=None):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if image:
        tex = next((n for n in nodes if n.type == 'TEX_IMAGE'), None) or nodes.new('ShaderNodeTexImage')
        tex.image = image
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def frame_mesh(name, x0, x1, z0, z1):
    """A moulded frame: the profile swept round the painting's rectangle, mitred at the corners."""
    verts, faces = [], []
    for off, depth in PROFILE:
        y = WALL_Y - depth
        for x, z in ((x0 - off, z0 - off), (x1 + off, z0 - off), (x1 + off, z1 + off), (x0 - off, z1 + off)):
            verts.append((x, y, z))
    for i in range(len(PROFILE) - 1):
        for j in range(4):
            a, b = i * 4 + j, i * 4 + (j + 1) % 4
            faces.append((a, b, b + 4, a + 4))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    return me


def canvas_mesh(name, x0, x1, z0, z1):
    me = bpy.data.meshes.new(name)
    y = WALL_Y - 0.005
    me.from_pydata([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name='UVMap')
    for loop, co in zip(me.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        uv.data[loop.index].uv = co
    return me


def main():
    for name in OLD + [f'Painting {p[0]}' for p in PAINTINGS] + [f'Painting {p[0]} {k}' for p in PAINTINGS for k in ('canvas', 'frame')]:
        obj = bpy.data.objects.get(name)
        if obj:
            data = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if data is not None and data.users == 0:
                bpy.data.meshes.remove(data)
    for mat in list(bpy.data.materials):
        if mat.users == 0 and mat.name.endswith('sleeve art'):
            bpy.data.materials.remove(mat)

    col = bpy.data.collections[COLLECTION]
    # Dark antique bronze, almost black, with a soft metallic sheen where the picture lights catch it.
    frame_mat = material('Dark bronze frame', (0.028, 0.02, 0.014, 1), 0.5, 0.45)
    for pid, file, cx in PAINTINGS:
        path = os.path.join(ROOT, 'public', 'paintings', file)
        image = bpy.data.images.load(path, check_existing=True)
        image.pack()
        width = ART_H * image.size[0] / image.size[1]
        x0, x1 = cx - width / 2, cx + width / 2
        z1 = TOP_Z - BORDER
        z0 = z1 - ART_H

        root = bpy.data.objects.new(f'Painting {pid}', None)
        col.objects.link(root)
        canvas = bpy.data.objects.new(f'Painting {pid} canvas', canvas_mesh(f'Painting {pid} canvas', x0, x1, z0, z1))
        canvas.data.materials.append(material(f'Painting {pid} oil', (1, 1, 1, 1), 0.0, 0.6, image))
        frame = bpy.data.objects.new(f'Painting {pid} frame', frame_mesh(f'Painting {pid} frame', x0, x1, z0, z1))
        frame.data.materials.append(frame_mat)
        for obj in (canvas, frame):
            col.objects.link(obj)
            obj.parent = root
            for poly in obj.data.polygons:
                poly.use_smooth = False
        print(f'PAINTING {pid}: {width:.3f} x {ART_H:.3f} m')

    if '--save' in sys.argv:
        bpy.ops.wm.save_mainfile()


main()
