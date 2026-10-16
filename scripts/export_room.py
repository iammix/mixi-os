"""Export model/Minimal_Reacto_Room.blend to public/models/room.glb for the website.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend \
      --python scripts/export_room.py -- public/models/room.glb

glTF can't carry procedural nodes, so a few materials are baked/adjusted first.
"""
import sys

import bpy
import numpy as np

out = sys.argv[sys.argv.index('--') + 1]
MAX_TEXTURE = 1024


def apply_hue_sat_to_images():
    """Bake each Hue/Saturation node's saturation into the image that feeds it."""
    done = set()
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type != 'HUE_SAT' or not node.inputs['Color'].is_linked:
                continue
            src = node.inputs['Color'].links[0].from_node
            if src.type != 'TEX_IMAGE' or not src.image or src.image.name in done:
                continue
            img = src.image
            sat = node.inputs['Saturation'].default_value
            px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
            grey = px[:, :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
            px[:, :3] = grey[:, None] + (px[:, :3] - grey[:, None]) * sat
            img.pixels[:] = np.clip(px, 0, 1).ravel()
            done.add(img.name)


def bake_base_color(obj_name, size=1024):
    """Bake a procedural base colour into an image texture."""
    obj = bpy.data.objects.get(obj_name)
    if not obj or not obj.data.materials:
        return
    if not obj.data.uv_layers:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project()
        bpy.ops.object.mode_set(mode='OBJECT')

    mat = obj.data.materials[0]
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    img = bpy.data.images.new(f'{obj_name} baked', size, size)
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = img
    nodes.active = tex

    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 4
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='DIFFUSE')

    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    for link in list(bsdf.inputs['Base Color'].links):
        links.remove(link)
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    img.pack()


apply_hue_sat_to_images()
bake_base_color('Wool rug')

for img in bpy.data.images:
    if img.size[0] > MAX_TEXTURE:
        img.scale(MAX_TEXTURE, max(1, int(img.size[1] * MAX_TEXTURE / img.size[0])))

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    export_cameras=True,
    export_lights=False,
    export_apply=True,
    export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_image_format='WEBP',
    export_image_quality=85,
)
