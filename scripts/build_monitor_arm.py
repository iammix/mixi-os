"""Mount the monitor in model/Minimal_Reacto_Room.blend on a desk-clamp monitor arm.

Removes the monitor's foot stand ("Monitor support" and "Monitor base") and adds a single
monitor arm in satin black: a C-clamp on the back edge of the desk behind the monitor, a pole,
a two-segment arm folded behind the screen and a tilt head on a VESA plate on the monitor's
back. The monitor itself doesn't move. Everything is one mesh, "Monitor arm".

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend \
      --python scripts/build_monitor_arm.py -- --save
then re-export the room with scripts/export_room.py.
"""
import math
import sys

import bpy
from mathutils import Vector

COLLECTION = '02 Workstation'
OLD = ['Monitor support', 'Monitor base']
NAME = 'Monitor arm'
MATERIAL = 'Satin black anodized'

DESK_TOP, DESK_BOTTOM, DESK_BACK = 0.781, 0.729, 1.745
MONITOR_BACK = 1.641                 # y of the bezel's back face
MONITOR_CENTER = (-1.03, 1.15)       # x, z of the monitor's centre

POLE = (-0.78, 1.71)                 # x, y of the pole, just in from the desk's back edge
POLE_TOP = 1.10
ELBOW = Vector((-1.22, 1.78, POLE_TOP))
HEAD = Vector((MONITOR_CENTER[0], 1.705, MONITOR_CENTER[1]))


def box(lo, hi):
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return v, f


def cylinder(p0, p1, r, seg=24):
    p0, p1 = Vector(p0), Vector(p1)
    axis = (p1 - p0).normalized()
    side = axis.orthogonal().normalized()
    up = axis.cross(side)
    ring = [side * math.cos(2 * math.pi * i / seg) * r + up * math.sin(2 * math.pi * i / seg) * r
            for i in range(seg)]
    v = [tuple(p0 + d) for d in ring] + [tuple(p1 + d) for d in ring]
    f = [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
    f += [tuple(reversed(range(seg))), tuple(range(seg, 2 * seg))]
    return v, f


def parts():
    px, py = POLE
    pole_base = Vector((px, py, DESK_TOP + 0.012))
    pole_top = Vector((px, py, POLE_TOP))
    yield box((px - 0.04, 1.66, DESK_TOP), (px + 0.04, DESK_BACK + 0.012, DESK_TOP + 0.012))   # clamp top
    yield box((px - 0.04, DESK_BACK, DESK_BOTTOM - 0.013), (px + 0.04, DESK_BACK + 0.012, DESK_TOP))  # clamp back
    yield box((px - 0.04, 1.69, DESK_BOTTOM - 0.013), (px + 0.04, DESK_BACK, DESK_BOTTOM))     # clamp jaw
    yield cylinder((px, 1.722, DESK_BOTTOM - 0.013), (px, 1.722, DESK_BOTTOM - 0.04), 0.012)   # clamp screw
    yield cylinder(pole_base, pole_top - Vector((0, 0, 0.015)), 0.017)                          # pole
    yield cylinder(pole_top - Vector((0, 0, 0.04)), pole_top - Vector((0, 0, 0.015)), 0.022)    # height collar
    yield cylinder(pole_top - Vector((0, 0, 0.015)), pole_top + Vector((0, 0, 0.015)), 0.024)   # shoulder joint
    yield cylinder(pole_top, ELBOW, 0.015)                                                      # lower arm
    yield cylinder(ELBOW - Vector((0, 0, 0.015)), ELBOW + Vector((0, 0, 0.015)), 0.022)         # elbow joint
    yield cylinder(ELBOW, HEAD, 0.014)                                                          # forearm
    yield cylinder(HEAD - Vector((0, 0, 0.025)), HEAD + Vector((0, 0, 0.025)), 0.018)           # swivel
    yield cylinder(HEAD, (HEAD.x, MONITOR_BACK + 0.006, HEAD.z), 0.014)                         # tilt neck
    cx, cz = MONITOR_CENTER
    yield box((cx - 0.05, MONITOR_BACK, cz - 0.05), (cx + 0.05, MONITOR_BACK + 0.006, cz + 0.05))  # VESA plate


def main():
    col = bpy.data.collections[COLLECTION]
    for name in OLD + [NAME]:
        obj = bpy.data.objects.get(name)
        if obj:
            data = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if data and data.users == 0:
                bpy.data.meshes.remove(data)

    verts, faces = [], []
    for v, f in parts():
        off = len(verts)
        verts.extend(v)
        faces.extend(tuple(i + off for i in face) for face in f)
    me = bpy.data.meshes.new(NAME)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.materials.append(bpy.data.materials[MATERIAL])
    for p in me.polygons:
        p.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(40))
    obj = bpy.data.objects.new(NAME, me)
    col.objects.link(obj)

    print(f'MONITOR ARM built: {len(me.polygons)} faces')
    if '--save' in sys.argv:
        bpy.ops.wm.save_mainfile()


main()
