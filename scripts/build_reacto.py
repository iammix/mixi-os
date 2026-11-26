"""Rebuild the Merida Reacto hanging on the wall of model/Minimal_Reacto_Room.blend.

Replaces everything in the "03 MERIDA REACTO" collection with a procedurally modelled
Reacto (aero frame, deep carbon wheels, 2x12 disc drivetrain, integrated cockpit) on a
two-arm wall hanger, all parented to one empty, "Merida Reacto bike", that the website
uses to make the bike clickable. It also fills "08 Triathlon gear": a tri backpack standing on
the floor behind the rear wheel with swim goggles and a swim cap hanging off it, running
shoes beside it, and a helmet hanging off the saddle.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/Minimal_Reacto_Room.blend \
      --python scripts/build_reacto.py -- --save
then re-export the room with scripts/export_room.py.

Bike coordinates: u runs front-to-back (world +Y is forward), v is height (world Z) and
w is sideways (world X, + is the drive side, facing into the room).
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

COLLECTION = '03 MERIDA REACTO'
ROOT_NAME = 'Merida Reacto bike'
X0 = -1.87          # bike centre plane (the wall is at x = -2.10)

# Paint: Merida's Gunmetal Grey (as on the 2025 Reacto 8000), metallic under a clear coat.
FRAME_COLOR = (0.16, 0.165, 0.172, 1)


def P(u, v, w=0.0):
    return Vector((X0 + w, u, v))


# ---------------------------------------------------------------- geometry ----
FA = (-0.063, 0.84)            # front axle
RA = (-1.053, 0.84)            # rear axle
BB = (-0.647, 0.772)           # bottom bracket
# Merida's size M geometry: stack 557, reach 395, head and seat angles 73.5, head tube 140,
# chainstay 408, wheelbase 990 (mm).
STEER = Vector((0.2840, -0.9588))  # steering axis, pointing down (73.5 deg head angle)
HTT = Vector(BB) + Vector((0.395, 0.557))  # head tube top (reach, stack)
HTB = HTT + STEER * 0.14        # head tube bottom
TT_FRONT, TT_REAR = (-0.262, 1.308), (-0.79, 1.262)
SEAT_DIR = Vector((-0.284, 0.959))  # 73.5 deg seat angle
SC = Vector(BB) + SEAT_DIR * 0.50   # seat cluster

TYRE_R = 0.3385


def tt_height(u):
    (u0, v0), (u1, v1) = TT_REAR, TT_FRONT
    return v0 + (u - u0) / (u1 - u0) * (v1 - v0)


# ------------------------------------------------------------ mesh helpers ----
def catmull(points, samples):
    """Catmull-Rom through points; returns (positions, fractions) with `samples` points."""
    pts = [Vector(p) for p in points]
    if len(pts) == 2:
        return [pts[0].lerp(pts[1], i / (samples - 1)) for i in range(samples)]
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    segs = len(pts) - 1
    for i in range(samples):
        t = i / (samples - 1) * segs
        k = min(int(t), segs - 1)
        f = t - k
        p0, p1, p2, p3 = ext[k], ext[k + 1], ext[k + 2], ext[k + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f))
    return out


def airfoil(n, trunc=0.75):
    """Truncated NACA section, chord in [-0.5, 0.5] (leading edge at +0.5), width in [-0.5, 0.5]."""
    def yt(x):
        return 0.2969 * math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4
    half = n // 2
    xs = [trunc * (1 - math.cos(math.pi * i / (half - 1))) / 2 for i in range(half)]
    ymax = max(yt(x) for x in xs)
    top = [(0.5 - x / trunc, 0.5 * yt(x) / ymax) for x in reversed(xs)]
    bot = [(0.5 - x / trunc, -0.5 * yt(x) / ymax) for x in xs]
    return top + bot


def superellipse(n, e=2.0):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        c, s = math.cos(a), math.sin(a)
        pts.append((0.5 * math.copysign(abs(c) ** (2 / e), c), 0.5 * math.copysign(abs(s) ** (2 / e), s)))
    return pts


def dome_section(n, e=2.0):
    """Flat-bottomed arch: chord runs from the flat base (-0.5) to the crown (+0.5)."""
    arch = n - 4
    pts = []
    for i in range(arch):
        t = math.pi * i / (arch - 1)
        c, s = math.cos(t), math.sin(t)
        pts.append((-0.5 + abs(s) ** (2 / e), 0.5 * math.copysign(abs(c) ** (2 / e), c)))
    pts += [(-0.5, -0.5 + k / 5) for k in range(1, 5)]
    return pts


def lerp_params(params, f):
    """params: list of dicts at evenly spaced control fractions; linear blend."""
    if len(params) == 1:
        return params[0]
    t = f * (len(params) - 1)
    k = min(int(t), len(params) - 2)
    g = t - k
    a, b = params[k], params[k + 1]
    return {key: a[key] + (b[key] - a[key]) * g for key in a}


def loft(path, params, hint, profile='airfoil', n=24, samples=24, trunc=0.75, caps=True):
    """Sweep a section along a 3D path.

    path: world points; params: dicts with depth/width (and e for superellipse) blended along
    the path; hint: world vector the section's chord (leading edge) should face.
    """
    pts = catmull(path, samples)
    hint = Vector(hint).normalized()
    verts, faces = [], []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        chord = (hint - t * hint.dot(t)).normalized()
        lat = t.cross(chord).normalized()
        prm = lerp_params(params, i / (len(pts) - 1))
        if profile == 'airfoil':
            sec = airfoil(n, trunc)
        elif profile == 'dome':
            sec = dome_section(n, prm.get('e', 2.0))
        else:
            sec = superellipse(n, prm.get('e', 2.0))
        for a, b in sec:
            verts.append(p + chord * a * prm['depth'] + lat * b * prm['width'])
    for i in range(len(pts) - 1):
        for j in range(n):
            a, b = i * n + j, i * n + (j + 1) % n
            faces.append((a, b, b + n, a + n))
    if caps:
        faces.append(tuple(reversed(range(n))))
        faces.append(tuple(range((len(pts) - 1) * n, len(pts) * n)))
    return verts, faces


def revolve(profile, center, segments=64):
    """Revolve a closed (r, w) profile around the w axis through `center` (u, v)."""
    verts, faces = [], []
    m = len(profile)
    for s in range(segments):
        a = 2 * math.pi * s / segments
        for r, w in profile:
            verts.append(P(center[0] + r * math.cos(a), center[1] + r * math.sin(a), w))
    for s in range(segments):
        for j in range(m):
            a = s * m + j
            b = s * m + (j + 1) % m
            c = ((s + 1) % segments) * m + (j + 1) % m
            d = ((s + 1) % segments) * m + j
            faces.append((a, b, c, d))
    return verts, faces


def disc(center, w0, w1, r_out, r_in=0.0, teeth=0, tooth=0.0, segments=48):
    """A flat ring (or solid disc) on the w axis; `teeth` adds a serrated outer edge."""
    n = teeth * 2 if teeth else segments
    outer = [r_out - (tooth if (teeth and i % 2) else 0) for i in range(n)]
    verts, faces = [], []
    for w in (w0, w1):
        for i in range(n):
            a = 2 * math.pi * i / n
            verts.append(P(center[0] + outer[i] * math.cos(a), center[1] + outer[i] * math.sin(a), w))
    if r_in > 0:
        for w in (w0, w1):
            for i in range(n):
                a = 2 * math.pi * i / n
                verts.append(P(center[0] + r_in * math.cos(a), center[1] + r_in * math.sin(a), w))
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i))                  # outer wall
            faces.append((2 * n + j, 2 * n + i, 3 * n + i, 3 * n + j))  # inner wall
            faces.append((j, i, 2 * n + i, 2 * n + j))          # face w0
            faces.append((n + i, n + j, 3 * n + j, 3 * n + i))  # face w1
    else:
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i))
        faces.append(tuple(reversed(range(n))))
        faces.append(tuple(range(n, 2 * n)))
    return verts, faces


def rod(a, b, r, sides=6, rb=None):
    """A prism between two world points."""
    a, b = Vector(a), Vector(b)
    t = (b - a).normalized()
    ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
    x = t.cross(ref).normalized()
    y = t.cross(x)
    rb = r if rb is None else rb
    verts = []
    for p, rr in ((a, r), (b, rb)):
        for i in range(sides):
            ang = 2 * math.pi * i / sides
            verts.append(p + (x * math.cos(ang) + y * math.sin(ang)) * rr)
    faces = [(i, (i + 1) % sides, sides + (i + 1) % sides, sides + i) for i in range(sides)]
    faces += [tuple(reversed(range(sides))), tuple(range(sides, 2 * sides))]
    return verts, faces


def flat_rod(a, b, wide, thin, lat):
    """A bladed spoke: rectangle section, wide side along `lat`-ish."""
    a, b = Vector(a), Vector(b)
    t = (b - a).normalized()
    x = (Vector(lat) - t * Vector(lat).dot(t)).normalized()
    y = t.cross(x)
    verts = []
    for p in (a, b):
        for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
            verts.append(p + x * sx * wide / 2 + y * sy * thin / 2)
    faces = [(i, (i + 1) % 4, 4 + (i + 1) % 4, 4 + i) for i in range(4)]
    return verts, faces


class Part:
    """Collects geometry per material, then becomes one multi-material object."""

    def __init__(self, name):
        self.name = name
        self.chunks = {}

    def add(self, mat, geo):
        self.chunks.setdefault(mat, []).append(geo)
        return self

    def build(self, parent, collection, smooth_angle=35):
        verts, faces, mats = [], [], []
        mat_list = list(self.chunks)
        for mi, mat in enumerate(mat_list):
            for v, f in self.chunks[mat]:
                off = len(verts)
                verts.extend(v)
                faces.extend(tuple(i + off for i in face) for face in f)
                mats.extend([mi] * len(f))
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([tuple(v) for v in verts], [], faces)
        me.validate()
        for mat in mat_list:
            me.materials.append(MATS[mat])
        for poly, mi in zip(me.polygons, mats):
            poly.material_index = mi
        obj = bpy.data.objects.new(self.name, me)
        collection.objects.link(obj)
        obj.parent = parent
        finish(obj, smooth_angle)
        return obj


def finish(obj, smooth_angle=35):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(smooth_angle))


# --------------------------------------------------------------- materials ----
def principled(name, color, metallic=0.0, roughness=0.5, coat=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None) or nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Coat Roughness'].default_value = 0.08
    mat.diffuse_color = color
    return mat


MATS = {}


def make_materials():
    MATS['paint'] = principled('Reacto gunmetal grey', FRAME_COLOR, 0.8, 0.3, coat=1.0)
    MATS['logo'] = principled('Reacto logo silver', (0.62, 0.63, 0.65, 1), 0.85, 0.25, coat=1.0)
    MATS['gloss_black'] = principled('Reacto gloss black', (0.012, 0.012, 0.014, 1), 0.2, 0.22, coat=1.0)
    MATS['carbon'] = principled('Reacto matte carbon', (0.018, 0.019, 0.021, 1), 0.2, 0.42)
    MATS['rubber'] = principled('Reacto tyre rubber', (0.012, 0.012, 0.013, 1), 0.0, 0.75)
    MATS['tape'] = principled('Reacto bar tape', (0.02, 0.02, 0.022, 1), 0.0, 0.62)
    MATS['black'] = principled('Reacto anodized black', (0.02, 0.021, 0.024, 1), 0.6, 0.35)
    MATS['silver'] = principled('Reacto steel', (0.42, 0.43, 0.45, 1), 1.0, 0.3)
    MATS['chain'] = principled('Reacto chain', (0.2, 0.205, 0.21, 1), 0.9, 0.45)
    MATS['grey'] = principled('Reacto shimano grey', (0.09, 0.095, 0.1, 1), 0.85, 0.3)
    MATS['mount'] = principled('Reacto hanger', (0.03, 0.03, 0.032, 1), 0.5, 0.4)


# ------------------------------------------------------------------- parts ----
def build_frame(col, root):
    part = Part('Reacto frame')
    up, fwd = (0, 0, 1), (0, 1, 0)

    # Head tube: deep aero section around the steerer.
    part.add('paint', loft([P(*(HTT + STEER * -0.005)), P(*HTB)],
                           [dict(depth=0.074, width=0.044), dict(depth=0.086, width=0.046)],
                           fwd, trunc=0.78, samples=8))
    # Down tube: deep truncated airfoil, widening into the bottom bracket.
    part.add('paint', loft([P(-0.232, 1.24), P(-0.43, 1.02), P(-0.615, 0.81)],
                           [dict(depth=0.088, width=0.042), dict(depth=0.074, width=0.044),
                            dict(depth=0.07, width=0.06)],
                           (0, 1, -1), trunc=0.72, samples=24))
    # Top tube: slopes slightly down to the seat cluster.
    part.add('paint', loft([P(*TT_FRONT), P(-0.53, 1.286), P(*TT_REAR)],
                           [dict(depth=0.044, width=0.034), dict(depth=0.034, width=0.03),
                            dict(depth=0.036, width=0.028)],
                           up, trunc=0.9, samples=20))
    # Seat tube: curves forward to hug the rear wheel.
    st = [P(*BB), P(-0.648, 0.86), P(-0.668, 0.97), P(-0.712, 1.08), P(-0.752, 1.17),
          P(*(SC + SEAT_DIR * 0.01)), P(*(SC + SEAT_DIR * 0.04))]
    part.add('paint', loft(st, [dict(depth=0.066, width=0.05), dict(depth=0.058, width=0.038),
                                dict(depth=0.056, width=0.034), dict(depth=0.054, width=0.032)],
                           fwd, trunc=0.74, samples=28))
    # Bottom bracket shell.
    part.add('paint', loft([P(*BB, -0.043), P(*BB, 0.043)], [dict(depth=0.05, width=0.05, e=2.4)],
                           fwd, profile='super', samples=2))
    for side in (-1, 1):
        # Dropped seat stays, meeting the seat tube well below the top tube.
        part.add('paint', loft([P(-0.712, 1.09, side * 0.012), P(-0.84, 1.0, side * 0.034),
                                P(RA[0] + 0.012, RA[1] + 0.012, side * 0.07)],
                               [dict(depth=0.026, width=0.016), dict(depth=0.02, width=0.013)],
                               (0, -0.3, 1), trunc=0.85, samples=16))
        # Chain stays: drive side deeper (asymmetric).
        deep = 0.036 if side > 0 else 0.03
        part.add('paint', loft([P(BB[0] - 0.02, BB[1] + 0.004, side * 0.03),
                                P(-0.85, 0.81, side * 0.058), P(RA[0] + 0.01, RA[1] - 0.004, side * 0.071)],
                               [dict(depth=deep, width=0.022, e=2.3), dict(depth=0.02, width=0.014, e=2.3)],
                               up, profile='super', samples=16))
        # Rear dropout.
        part.add('paint', loft([P(*RA, side * 0.064), P(*RA, side * 0.078)],
                               [dict(depth=0.034, width=0.034, e=2.2)], up, profile='super', samples=2))

    obj = part.build(root, col)
    fuse(obj, voxel=0.0022, ratio=0.12)
    return obj


def build_fork(col, root):
    part = Part('Reacto fork')
    fwd = (0, 1, 0)
    crown = HTB + STEER * 0.0
    part.add('paint', loft([P(crown.x - 0.002, crown.y - 0.01, -0.054), P(crown.x - 0.002, crown.y - 0.01, 0.054)],
                           [dict(depth=0.072, width=0.034)], fwd, trunc=0.78, samples=10))
    for side in (-1, 1):
        part.add('paint', loft([P(crown.x, crown.y - 0.01, side * 0.042), P(-0.163, 1.05, side * 0.049),
                                P(-0.11, 0.93, side * 0.054), P(FA[0] - 0.004, FA[1] + 0.006, side * 0.056)],
                               [dict(depth=0.052, width=0.022), dict(depth=0.04, width=0.019),
                                dict(depth=0.03, width=0.016)], fwd, trunc=0.8, samples=20))
        part.add('paint', loft([P(*FA, side * 0.05), P(*FA, side * 0.062)],
                               [dict(depth=0.03, width=0.03, e=2.2)], (0, 0, 1), profile='super', samples=2))
    obj = part.build(root, col)
    fuse(obj, voxel=0.0018, ratio=0.2)
    return obj


def fuse(obj, voxel, ratio):
    """Voxel-remesh overlapping tubes into one smooth monocoque, then lighten it."""
    for mod_type, settings in (
        ('REMESH', dict(mode='VOXEL', voxel_size=voxel, adaptivity=0.0, use_smooth_shade=True)),
        ('CORRECTIVE_SMOOTH', dict(iterations=6, factor=0.5, use_only_smooth=True, scale=1.0)),
        ('DECIMATE', dict(decimate_type='COLLAPSE', ratio=ratio)),
    ):
        mod = obj.modifiers.new(mod_type.lower(), mod_type)
        for k, v in settings.items():
            setattr(mod, k, v)
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.selected_objects:
        o.select_set(False)
    obj.select_set(True)
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    finish(obj, smooth_angle=60)


def build_wheel(col, root, name, axle, rear):
    part = Part(name)
    # Deep carbon rim (60 mm, like the Reacto 8000's Reynolds AR 60) with a rounded, wide (28 mm) toroidal section.
    rim = [(0.3115, 0.0115), (0.3061, 0.0135), (0.2917, 0.0142), (0.2761, 0.0136), (0.2617, 0.0112), (0.2539, 0.0072), (0.2515, 0.0), (0.2539, -0.0072), (0.2617, -0.0112), (0.2761, -0.0136), (0.2917, -0.0142), (0.3061, -0.0135), (0.3115, -0.0115), (0.3103, 0.0)]
    part.add('carbon', revolve(rim, axle, 96))
    # 28 mm tyre.
    tyre = [(0.3247 + 0.0138 * math.cos(a), 0.0139 * math.sin(a))
            for a in [2 * math.pi * i / 20 for i in range(20)]]
    part.add('rubber', revolve(tyre, axle, 96))
    # Hub.
    if rear:
        part.add('black', revolve([(0.0, -0.071), (0.012, -0.071), (0.012, 0.071), (0.0, 0.071)], axle, 24))
        part.add('black', revolve([(0.0, -0.055), (0.017, -0.055), (0.017, 0.018), (0.0, 0.018)], axle, 24))
        flanges = (-0.036, 0.018)
    else:
        part.add('black', revolve([(0.0, -0.05), (0.012, -0.05), (0.012, 0.05), (0.0, 0.05)], axle, 24))
        part.add('black', revolve([(0.0, -0.036), (0.016, -0.036), (0.016, 0.036), (0.0, 0.036)], axle, 24))
        flanges = (-0.032, 0.032)
    for fw in flanges:
        part.add('black', disc(axle, fw - 0.002, fw + 0.002, 0.026, segments=24))
    # 24 bladed spokes, two-cross at the rear, radial at the front.
    n = 24
    for i in range(n):
        a_rim = 2 * math.pi * i / n
        side = 1 if i % 2 else -1
        fw = flanges[1] if side > 0 else flanges[0]
        cross = (0.52 if (i // 2) % 2 else -0.52) if rear else 0.0
        a_hub = a_rim + cross
        hub = P(axle[0] + 0.024 * math.cos(a_hub), axle[1] + 0.024 * math.sin(a_hub), fw)
        nip = P(axle[0] + 0.252 * math.cos(a_rim), axle[1] + 0.252 * math.sin(a_rim), side * 0.003)
        # Blades face the direction of travel: wide side tangential, in the wheel plane.
        part.add('black', flat_rod(hub, nip, 0.0024, 0.0009, (0, -math.sin(a_rim), math.cos(a_rim))))
    # Disc rotor on the left (non-drive) side, centre-lock spider.
    r_out = 0.070 if rear else 0.080
    rw = -0.052 if rear else -0.045
    part.add('silver', disc(axle, rw - 0.0009, rw + 0.0009, r_out, r_out - 0.016, segments=48))
    part.add('black', disc(axle, rw - 0.0016, rw + 0.0016, 0.03, 0.012, segments=24))
    for k in range(6):
        a = 2 * math.pi * k / 6
        part.add('black', rod(P(axle[0] + 0.026 * math.cos(a), axle[1] + 0.026 * math.sin(a), rw),
                              P(axle[0] + (r_out - 0.012) * math.cos(a + 0.25), axle[1] + (r_out - 0.012) * math.sin(a + 0.25), rw),
                              0.0035, 4))
    # Thru-axle ends.
    for s in (-1, 1):
        ww = (0.078 if rear else 0.062) * s
        part.add('black', disc(axle, ww, ww + s * 0.006, 0.01, segments=16))
    if rear:
        build_cassette(part, axle)
    return part.build(root, col, smooth_angle=40)


COGS = [11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 27, 30]
CHAIN_COG = 6   # chain sits on the 17T


def cog_radius(t):
    return 0.0127 / (2 * math.sin(math.pi / t))


def cog_w(i):
    return 0.0625 - i * 0.0036


def build_cassette(part, axle):
    for i, t in enumerate(COGS):
        w = cog_w(i)
        part.add('silver' if i < 7 else 'grey',
                 disc(axle, w - 0.0009, w + 0.0009, cog_radius(t) + 0.0025, 0.014, teeth=t, tooth=0.0022))


def tangent(c1, r1, s1, c2, r2, s2):
    """Belt tangent between circles; s = +1 counter-clockwise travel, -1 clockwise."""
    c1, c2 = Vector(c1), Vector(c2)
    d = c2 - c1
    D = d.length
    phi = math.atan2(d.y, d.x)
    best = None
    for internal in (False, True):
        k = (r1 + r2) / D if internal else (r1 - r2) / D
        if abs(k) > 1:
            continue
        for sign in (-1, 1):
            a1 = phi + sign * math.acos(k)
            a2 = a1 + math.pi if internal else a1
            p1 = c1 + r1 * Vector((math.cos(a1), math.sin(a1)))
            p2 = c2 + r2 * Vector((math.cos(a2), math.sin(a2)))
            t = (p2 - p1).normalized()
            v1 = s1 * Vector((-math.sin(a1), math.cos(a1)))
            v2 = s2 * Vector((-math.sin(a2), math.cos(a2)))
            score = t.dot(v1) + t.dot(v2)
            if best is None or score > best[0]:
                best = (score, a1, a2)
    return best[1], best[2]


def arc(c, r, a0, a1, s, step=0.12):
    """Points along a circle from a0 to a1 travelling in direction s."""
    span = (a1 - a0) * s % (2 * math.pi)
    n = max(2, int(span / step) + 1)
    return [Vector(c) + r * Vector((math.cos(a0 + s * span * i / (n - 1)), math.sin(a0 + s * span * i / (n - 1))))
            for i in range(n)]


def build_drivetrain(col, root):
    part = Part('Reacto drivetrain')
    ring_big, ring_small = cog_radius(52), cog_radius(36)
    # Chainrings and 4-arm spider.
    part.add('grey', disc(BB, 0.0475, 0.0515, ring_big + 0.0025, ring_big - 0.016, teeth=52, tooth=0.0022))
    part.add('grey', disc(BB, 0.0395, 0.0425, ring_small + 0.0025, ring_small - 0.012, teeth=36, tooth=0.0022))
    for k in range(4):
        a = math.radians(-20 + 90 * k + (12 if k % 2 else 0))
        part.add('black', loft([P(*BB, 0.056), P(BB[0] + (ring_big - 0.012) * math.cos(a),
                                                  BB[1] + (ring_big - 0.012) * math.sin(a), 0.051)],
                               [dict(depth=0.022, width=0.008, e=2.5), dict(depth=0.014, width=0.006, e=2.5)],
                               (0, 0, 1), profile='super', n=12, samples=4))
    # Crank arms (172.5 mm): drive arm back along the chain stay, left arm forward.
    crank_dir = Vector((-0.985, -0.17)).normalized()
    for side, d in ((1, crank_dir), (-1, -crank_dir)):
        w0 = side * 0.062
        end = Vector(BB) + d * 0.1725
        part.add('black', loft([P(*BB, w0), P(*(Vector(BB) + d * 0.09), w0 + side * 0.006), P(*end, w0 + side * 0.012)],
                               [dict(depth=0.036, width=0.016, e=2.6), dict(depth=0.024, width=0.013, e=2.6),
                                dict(depth=0.024, width=0.013, e=2.6)],
                               (0, -d.y, d.x), profile='super', n=16, samples=10))
        # Pedal (road, carbon body) on its spindle.
        pw = w0 + side * 0.012
        part.add('silver', rod(P(*end, pw), P(*end, pw + side * 0.055), 0.0055, 8))
        part.add('carbon', loft([P(end.x - 0.045, end.y, pw + side * 0.038), P(end.x + 0.035, end.y + 0.002, pw + side * 0.038)],
                                [dict(depth=0.016, width=0.05, e=3.0), dict(depth=0.02, width=0.07, e=3.0),
                                 dict(depth=0.014, width=0.04, e=3.0)],
                                (0, 0, 1), profile='super', n=16, samples=8))
    part.add('black', disc(BB, -0.062, 0.062, 0.012, segments=16))   # spindle

    # Chain: 52T ring -> 17T cog -> derailleur pulleys -> back to the ring (drive side view).
    cog_r = cog_radius(COGS[CHAIN_COG])
    upper = (RA[0] - 0.004, RA[1] - 0.062)
    lower = (RA[0] + 0.042, RA[1] - 0.118)
    pr = 0.0235
    circles = [(BB, ring_big, -1), (RA, cog_r, -1), (upper, pr, 1), (lower, pr, -1)]
    tans = [tangent(c1, r1, s1, c2, r2, s2)
            for (c1, r1, s1), (c2, r2, s2) in zip(circles, circles[1:] + circles[:1])]
    pts = []
    for i, (c, r, s) in enumerate(circles):
        arrive = tans[i - 1][1]
        leave = tans[i][0]
        pts += arc(c, r, arrive, leave, s)
    chain_w = (0.0495 + cog_w(CHAIN_COG)) / 2
    chain = [P(p.x, p.y, 0) for p in pts]
    for i in range(len(chain)):
        a, b = chain[i], chain[(i + 1) % len(chain)]
        if (b - a).length < 1e-5:
            continue
        off = Vector((chain_w, 0, 0))
        part.add('chain', flat_rod(a + off, b + off, 0.0072, 0.0058, (b - a).cross(Vector((1, 0, 0)))))
    # Rear derailleur: pulleys, cage, parallelogram body hanging off the hanger.
    for c in (upper, lower):
        part.add('black', disc(c, chain_w - 0.003, chain_w + 0.003, pr + 0.002, teeth=11, tooth=0.003))
    cage_w = chain_w + 0.0075
    part.add('grey', loft([P(upper[0] - 0.006, upper[1] + 0.018, cage_w), P(lower[0] + 0.004, lower[1] - 0.022, cage_w)],
                          [dict(depth=0.006, width=0.04, e=3)], (1, 0, 0), profile='super', n=16, samples=2))
    part.add('grey', loft([P(RA[0] - 0.006, RA[1] - 0.012, 0.079), P(RA[0] - 0.03, RA[1] - 0.035, 0.08),
                           P(upper[0] - 0.02, upper[1] + 0.006, chain_w + 0.016)],
                          [dict(depth=0.026, width=0.016, e=3), dict(depth=0.032, width=0.022, e=3),
                           dict(depth=0.02, width=0.014, e=3)], (0, 0, 1), profile='super', n=16, samples=10))
    # Front derailleur (Di2) on the seat tube above the big ring.
    # Cage outer plate follows the big ring; the motor body sits against the seat tube.
    fd_arc = [Vector(BB) + Vector((math.cos(math.radians(a)), math.sin(math.radians(a)))) * (ring_big + 0.012)
              for a in (112, 100, 88)]
    part.add('grey', loft([P(*p, 0.056) for p in fd_arc], [dict(depth=0.016, width=0.003, e=3)],
                          (0, 0, 1), profile='super', n=12, samples=6))
    body = Vector(BB) + Vector((-0.012, ring_big + 0.026))
    part.add('grey', loft([P(*body, 0.018), P(*body, 0.054)],
                          [dict(depth=0.024, width=0.026, e=3), dict(depth=0.02, width=0.022, e=3)],
                          (0, 0, 1), profile='super', n=12, samples=3))
    return part.build(root, col, smooth_angle=40)


def build_brakes(col, root):
    part = Part('Reacto brakes')
    for axle, r_out, rw, ang in ((FA, 0.080, -0.045, 162), (RA, 0.070, -0.052, 22)):
        a = math.radians(ang)
        c = Vector(axle) + (r_out - 0.006) * Vector((math.cos(a), math.sin(a)))
        t = Vector((-math.sin(a), math.cos(a)))
        part.add('grey', loft([P(*(c - t * 0.028), rw), P(*(c + t * 0.028), rw)],
                              [dict(depth=0.03, width=0.028, e=3.2)],
                              (0, math.cos(a), math.sin(a)),
                              profile='super', n=16, samples=4))
    return part.build(root, col)


def build_cockpit(col, root):
    part = Part('Reacto cockpit')
    up = (0, 0, 1)
    st = HTT - STEER * 0.034           # stem centre on the steering axis
    se = Vector((-0.168, 1.36))        # bar clamp centre
    # Spacer + aero top cap continuing the head tube shape.
    part.add('carbon', loft([P(*(HTT + STEER * 0.004)), P(*(st - STEER * 0.012))],
                            [dict(depth=0.066, width=0.042), dict(depth=0.06, width=0.04)],
                            (0, 1, 0), trunc=0.8, samples=4))
    # One-piece aero bar/stem: stem...
    part.add('carbon', loft([P(st.x - 0.01, st.y), P(*((st + se) / 2), 0), P(*se)],
                            [dict(depth=0.046, width=0.036, e=2.6), dict(depth=0.038, width=0.032, e=2.6)],
                            up, profile='super', n=20, samples=10))
    # ...flat wing tops sweeping into round bars at the corners.
    part.add('carbon', loft([P(se.x + 0.004, se.y, -0.165), P(se.x - 0.008, se.y, 0), P(se.x + 0.004, se.y, 0.165)],
                            [dict(depth=0.026, width=0.024, e=2.0), dict(depth=0.046, width=0.014, e=2.6),
                             dict(depth=0.026, width=0.024, e=2.0)],
                            (0, 1, 0.05), profile='super', n=20, samples=24))
    for s in (-1, 1):
        path = [P(se.x + 0.004, se.y, s * 0.165), P(-0.14, 1.358, s * 0.182), P(-0.1, 1.35, s * 0.19),
                P(-0.072, 1.328, s * 0.194), P(-0.062, 1.29, s * 0.198), P(-0.078, 1.252, s * 0.2),
                P(-0.118, 1.238, s * 0.203), P(-0.172, 1.242, s * 0.205)]
        part.add('tape', loft(path, [dict(depth=0.025, width=0.025, e=2.0)], (0, 0.3, 1), profile='super',
                              n=14, samples=36))
        # STI hood and lever blade.
        part.add('rubber', loft([P(-0.118, 1.362, s * 0.19), P(-0.085, 1.37, s * 0.192), P(-0.055, 1.38, s * 0.194),
                                 P(-0.04, 1.392, s * 0.194)],
                                [dict(depth=0.03, width=0.026, e=2.4), dict(depth=0.036, width=0.03, e=2.4),
                                 dict(depth=0.032, width=0.026, e=2.4), dict(depth=0.014, width=0.016, e=2.4)],
                                up, profile='super', n=16, samples=12))
        part.add('grey', loft([P(-0.046, 1.37, s * 0.194), P(-0.04, 1.33, s * 0.194), P(-0.05, 1.285, s * 0.196),
                               P(-0.068, 1.252, s * 0.198)],
                              [dict(depth=0.014, width=0.008, e=2.4), dict(depth=0.01, width=0.007, e=2.4)],
                              (0, 1, 0), profile='super', n=12, samples=14))
    return part.build(root, col, smooth_angle=50)


def build_seat(col, root):
    part = Part('Reacto seatpost and saddle')
    top = SC + SEAT_DIR * 0.2
    part.add('gloss_black', loft([P(*(SC + SEAT_DIR * 0.02)), P(*top)], [dict(depth=0.05, width=0.026)],
                            (0, 1, 0), trunc=0.7, samples=6))
    part.add('black', loft([P(top.x - 0.025, top.y + 0.005, 0), P(top.x + 0.025, top.y + 0.007, 0)],
                           [dict(depth=0.014, width=0.03, e=3)], (0, 0, 1), profile='super', n=12, samples=3))
    # Saddle shell: short-nose race saddle with a centre cut-out look from the side.
    cu = top.x - 0.012
    rail_v = top.y + 0.014
    shell = [P(cu + 0.135, rail_v + 0.026), P(cu + 0.07, rail_v + 0.03), P(cu, rail_v + 0.03),
             P(cu - 0.07, rail_v + 0.032), P(cu - 0.118, rail_v + 0.036), P(cu - 0.134, rail_v + 0.033)]
    part.add('tape', loft(shell, [dict(depth=0.016, width=0.034, e=3), dict(depth=0.02, width=0.05, e=3),
                                  dict(depth=0.024, width=0.1, e=3), dict(depth=0.026, width=0.14, e=3.4),
                                  dict(depth=0.024, width=0.142, e=3.4), dict(depth=0.012, width=0.12, e=3)],
                          (0, 0, 1), profile='super', n=24, samples=26))
    for s in (-1, 1):
        part.add('black', loft([P(cu + 0.12, rail_v + 0.02, s * 0.012), P(cu + 0.05, rail_v - 0.002, s * 0.022),
                                P(cu - 0.06, rail_v - 0.002, s * 0.028), P(cu - 0.11, rail_v + 0.022, s * 0.04)],
                               [dict(depth=0.007, width=0.007, e=2)], (0, 0, 1), profile='super', n=8, samples=12))
    return part.build(root, col, smooth_angle=50)


def build_mount(col, root):
    part = Part('Reacto wall hanger')
    wall = -2.10 - X0
    for u in (-0.70, -0.38):
        under = tt_height(u) - 0.021
        v = under - 0.012
        part.add('mount', loft([P(u, v - 0.06, wall + 0.006), P(u, v + 0.04, wall + 0.006)],
                               [dict(depth=0.012, width=0.06, e=4)], (1, 0, 0), profile='super', n=16, samples=2))
        part.add('mount', loft([P(u, v, wall + 0.01), P(u, v, 0.038), P(u, v + 0.028, 0.05)],
                               [dict(depth=0.018, width=0.018, e=2)], (0, 0, 1), profile='super', n=12, samples=14))
        part.add('rubber', loft([P(u, v, -0.032), P(u, v, 0.032)], [dict(depth=0.024, width=0.024, e=2)],
                                (0, 0, 1), profile='super', n=14, samples=2))
    return part.build(root, col, smooth_angle=50)


# ------------------------------------------------------------------ decals ----
# Lettering as on the 2025 Reacto 8000: a big silver MERIDA in heavy italic along the down tube
# (reading up from the bottom bracket on the drive side) and a small REACTO on the seat stays,
# on both sides, each reading left to right from its own side. Merida's logotype is a heavy,
# wide italic; Arial Black sheared to the same slant is the closest system font.
LOGO_FONT = '/System/Library/Fonts/Supplemental/Arial Black.ttf'

DECALS = [
    # text, size, centre (u, v), reading direction on the drive side (u, v), lateral offset at centre
    ('MERIDA', 0.097, (-0.412, 1.036), Vector((0.383, 0.43)), 0.034),
    ('REACTO', 0.022, (-0.83, 1.006), Vector((0.36, 0.27)), 0.042),
]


def text_mesh(body, size):
    curve = bpy.data.curves.new('decal', 'FONT')
    curve.body = body
    curve.size = size
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.shear = 0.24
    if os.path.exists(LOGO_FONT):
        curve.font = bpy.data.fonts.load(LOGO_FONT, check_existing=True)
    tmp = bpy.data.objects.new('decal', curve)
    bpy.context.scene.collection.objects.link(tmp)
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(curve)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=2, use_grid_fill=True)
    bm.to_mesh(me)
    bm.free()
    return me


def build_decals(col, root, frame):
    objs = []
    for body, size, (cu, cv), d, off in DECALS:
        for side in (-1, 1):
            me = text_mesh(body, size)
            d2 = d.normalized() * side
            x = Vector((0, d2.x, d2.y))         # reading direction
            normal = Vector((side, 0, 0))       # out of the frame on this side
            y = normal.cross(x)                 # letter tops
            origin = P(cu, cv, side * off)
            for vtx in me.vertices:
                co = vtx.co.copy()
                vtx.co = origin + x * co.x + y * co.y
            me.materials.append(MATS['logo'])
            obj = bpy.data.objects.new('decal', me)
            col.objects.link(obj)
            wrap = obj.modifiers.new('wrap', 'SHRINKWRAP')
            wrap.target = frame
            wrap.wrap_method = 'NEAREST_SURFACEPOINT'
            wrap.wrap_mode = 'OUTSIDE_SURFACE'
            wrap.offset = 0.0006
            objs.append(obj)
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.modifier_apply(modifier='wrap')
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = objs[0]
    obj.name = obj.data.name = 'Reacto decals'
    obj.parent = root
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


# ----------------------------------------------------------- triathlon gear ----
GEAR_COLLECTION = '08 Triathlon gear'
GEAR_ROOT = 'Triathlon gear'
WALL_W = -2.10 - X0     # the wall, in bike w
FLOOR_V = 0.021


def W(u, v, w):
    """A direction in bike coordinates, as a world vector."""
    return Vector((w, u, v))


def xform(geo, origin, x, y, z):
    """Place geometry modelled in a local frame (x, y, z axes given as world vectors)."""
    verts, faces = geo
    return [origin + x * p[0] + y * p[1] + z * p[2] for p in verts], faces


def dome(front, back, side, height, rings=10, segs=32, scale=1.0):
    """Half-ellipsoid opening down: x forward (radius `front`/`back`), y sideways, z up."""
    verts, faces = [], []
    for i in range(1, rings + 1):
        phi = (math.pi / 2) * i / rings
        for j in range(segs):
            t = 2 * math.pi * j / segs
            c = math.cos(t)
            rx = front if c >= 0 else back
            verts.append(Vector((rx * math.sin(phi) * c, side * math.sin(phi) * math.sin(t),
                                 height * math.cos(phi))) * scale)
    verts.append(Vector((0, 0, height * scale)))
    pole = len(verts) - 1
    for j in range(segs):
        faces.append((pole, j, (j + 1) % segs))
    for i in range(rings - 1):
        for j in range(segs):
            a, b = i * segs + j, i * segs + (j + 1) % segs
            faces.append((a, a + segs, b + segs, b))
    return verts, faces


def flipped(geo):
    verts, faces = geo
    return verts, [tuple(reversed(f)) for f in faces]


def make_gear_materials():
    MATS['bag'] = principled('Tri bag fabric', (0.025, 0.026, 0.03, 1), 0.0, 0.8)
    MATS['bag_accent'] = principled('Tri bag accent', (0.6, 0.03, 0.03, 1), 0.0, 0.6)
    MATS['zip'] = principled('Tri bag zip', (0.5, 0.5, 0.52, 1), 1.0, 0.35)
    MATS['lens'] = principled('Goggle mirror lens', (0.08, 0.32, 0.85, 1), 1.0, 0.08)
    MATS['goggle'] = principled('Goggle frame', (0.015, 0.015, 0.02, 1), 0.0, 0.4)
    MATS['cap'] = principled('Swim cap silicone', (0.95, 0.32, 0.03, 1), 0.0, 0.35)
    MATS['helmet'] = principled('Helmet shell', (0.82, 0.83, 0.84, 1), 0.0, 0.25, coat=0.6)
    MATS['helmet_in'] = principled('Helmet liner', (0.02, 0.02, 0.022, 1), 0.0, 0.85)
    MATS['nimbus_upper'] = principled('Nimbus indigo knit', (0.04, 0.05, 0.17, 1), 0.0, 0.75)
    MATS['nimbus_midsole'] = principled('Nimbus cream midsole', (0.84, 0.73, 0.47, 1), 0.0, 0.6)
    MATS['nimbus_stripe'] = principled('Nimbus denim blue', (0.03, 0.1, 0.33, 1), 0.1, 0.5)
    MATS['nimbus_navy'] = principled('Nimbus navy', (0.012, 0.016, 0.045, 1), 0.0, 0.65)
    MATS['sole'] = principled('Running shoe sole', (0.85, 0.85, 0.83, 1), 0.0, 0.55)
    MATS['lace'] = principled('Running shoe lace', (0.03, 0.03, 0.035, 1), 0.0, 0.7)


def build_bag(part, u, bottom, w):
    """Tri transition backpack standing on the floor, its back against the wall."""
    top = bottom + 0.46
    part.add('bag', loft([P(u, bottom, w), P(u, bottom + 0.02, w), P(u, bottom + 0.22, w), P(u, top - 0.06, w),
                          P(u, top - 0.01, w), P(u, top, w)],
                         [dict(depth=0.24, width=0.12, e=2.6), dict(depth=0.27, width=0.15, e=3.6),
                          dict(depth=0.29, width=0.16, e=3.6), dict(depth=0.26, width=0.14, e=3.2),
                          dict(depth=0.2, width=0.1, e=2.6), dict(depth=0.1, width=0.04, e=2)],
                         (0, 1, 0), profile='super', n=32, samples=24))
    # Front pocket in red with a zip around it.
    pw = w + 0.08
    part.add('bag_accent', loft([P(u, bottom + 0.05, pw - 0.02), P(u, bottom + 0.06, pw), P(u, bottom + 0.2, pw + 0.004),
                                 P(u, bottom + 0.27, pw - 0.004), P(u, bottom + 0.28, pw - 0.025)],
                                [dict(depth=0.18, width=0.02, e=3), dict(depth=0.22, width=0.035, e=3.2),
                                 dict(depth=0.22, width=0.04, e=3.2), dict(depth=0.2, width=0.03, e=3),
                                 dict(depth=0.16, width=0.01, e=3)],
                                (0, 1, 0), profile='super', n=28, samples=16))
    part.add('zip', loft([P(u - 0.1, bottom + 0.255, pw + 0.006), P(u, bottom + 0.262, pw + 0.01),
                          P(u + 0.1, bottom + 0.255, pw + 0.006)],
                         [dict(depth=0.004, width=0.004, e=2)], (0, 0, 1), profile='super', n=6, samples=10))
    # Reflective strip across the top of the bag.
    part.add('sole', loft([P(u - 0.1, top - 0.1, w + 0.07), P(u, top - 0.1, w + 0.074), P(u + 0.1, top - 0.1, w + 0.07)],
                          [dict(depth=0.014, width=0.003, e=3)], (0, 0, 1), profile='super', n=8, samples=10))
    # Top grab handle looped over the hook.
    part.add('bag', loft([P(u - 0.045, top - 0.01, w + 0.01), P(u - 0.03, top + 0.06, w + 0.03),
                          P(u, top + 0.085, w + 0.04), P(u + 0.03, top + 0.06, w + 0.03),
                          P(u + 0.045, top - 0.01, w + 0.01)],
                         [dict(depth=0.026, width=0.006, e=2.5)], (0, 0, -1), profile='super', n=10, samples=20))
    # Shoulder strap peeking out at the side.
    for s in (-1, 1):
        back = w - 0.073
        part.add('bag', loft([P(u + s * 0.05, top - 0.04, back), P(u + s * 0.14, top - 0.2, back),
                              P(u + s * 0.15, bottom + 0.08, back + 0.008)],
                             [dict(depth=0.05, width=0.012, e=3)], (0, 1, 0), profile='super', n=10, samples=12))


def build_goggles(part, u, hook_v, hook_w, face_w, lens_v):
    """Swim goggles hung by their strap over the hook, lenses resting on the bag."""
    for s in (-1, 1):
        part.add('goggle', loft([P(u + s * 0.006, hook_v + 0.008, hook_w), P(u + s * 0.04, hook_v - 0.08, face_w - 0.02),
                                 P(u + s * 0.068, lens_v + 0.01, face_w)],
                                [dict(depth=0.012, width=0.0025, e=3)], (0, 1, 0), profile='super', n=8, samples=14))
        lu = u + s * 0.036
        part.add('goggle', loft([P(lu, lens_v, face_w - 0.004), P(lu, lens_v, face_w + 0.006)],
                                [dict(depth=0.036, width=0.05, e=2.4)], (0, 0, 1), profile='super', n=20, samples=2))
        part.add('lens', loft([P(lu, lens_v, face_w + 0.004), P(lu, lens_v, face_w + 0.011)],
                              [dict(depth=0.03, width=0.044, e=2.4), dict(depth=0.024, width=0.036, e=2.4)],
                              (0, 0, 1), profile='super', n=20, samples=3))
    part.add('goggle', rod(P(u - 0.012, lens_v + 0.004, face_w + 0.005), P(u + 0.012, lens_v + 0.004, face_w + 0.005), 0.003, 6))


def build_swim_cap(part, u, hook_v, hook_w, axis):
    """Silicone swim cap hanging by its rim from (u, hook_v, hook_w); `axis` points rim -> crown."""
    axis = axis.normalized()
    up = (W(0, 1, 0) - axis * W(0, 1, 0).dot(axis)).normalized()
    side = up.cross(axis)
    r = 0.09
    rim_centre = P(u, hook_v - 0.004, hook_w) - up * r
    geo = dome(r, r, 0.085, 0.105, rings=10, segs=32)
    part.add('cap', xform(geo, rim_centre, up, side, axis))
    part.add('cap', xform(flipped(dome(r, r, 0.085, 0.105, rings=10, segs=32, scale=0.97)), rim_centre, up, side, axis))


def build_helmet(part):
    """Road helmet hanging from the back of the saddle by its straps, dome facing the room."""
    up = W(0, -0.6, 0.8).normalized()
    front = W(1, 0, 0)
    side = up.cross(front)
    origin = P(-1.06, 1.32, 0.09)
    shell = dict(front=0.12, back=0.15, side=0.1, height=0.14, rings=12, segs=40)
    part.add('helmet', xform(dome(**shell), origin, front, side, up))
    part.add('helmet_in', xform(flipped(dome(**shell, scale=0.9)), origin, front, side, up))
    # Rim band joining shell and liner.
    segs = shell['segs']
    outer = [p for p in dome(**shell)[0][(shell['rings'] - 1) * segs:shell['rings'] * segs]]
    verts = outer + [p * 0.9 for p in outer]
    faces = [(j, (j + 1) % segs, segs + (j + 1) % segs, segs + j) for j in range(segs)]
    part.add('helmet_in', xform((verts, faces), origin, front, side, up))
    # Vents: dark channels running front to back over the crown.
    def on_shell(x, y, lift=1.012):
        rx = shell['front'] if x >= 0 else shell['back']
        z = shell['height'] * math.sqrt(max(0.0, 1 - (x / rx) ** 2 - (y / shell['side']) ** 2))
        return origin + front * x * lift + side * y * lift + up * z * lift

    for y0 in (-0.062, -0.03, 0.0, 0.03, 0.062):
        reach = 0.75 - abs(y0) * 3
        pts = [on_shell(s * (shell['front'] if s > 0 else shell['back']) * reach, y0)
               for s in [k / 7 * 2 - 1 for k in range(8)]]
        part.add('helmet_in', loft(pts, [dict(depth=0.012, width=0.004, e=2), dict(depth=0.016, width=0.005, e=2),
                                         dict(depth=0.012, width=0.004, e=2)],
                                   up, profile='super', n=8, samples=20))
    # Straps up to a buckle wrapped round the saddle's tail.
    buckle = P(-0.985, 1.462, 0.0)
    for s in (-1, 1):
        ear = origin + side * s * 0.092 + up * 0.01
        part.add('lace', loft([ear, ear.lerp(buckle, 0.5) + W(0, -0.02, 0.0), buckle + W(0, 0, s * 0.012)],
                              [dict(depth=0.016, width=0.002, e=3)], W(1, 0, 0), profile='super', n=8, samples=12))
    part.add('lace', loft([P(-0.985, 1.49, 0.02), P(-0.985, 1.49, -0.02)], [dict(depth=0.012, width=0.03, e=2.2)],
                          (0, 1, 0), profile='super', n=10, samples=4))


# ASICS Gel-Nimbus 27, "Indigo Fog / Denim Blue" (pushed a touch bluer): indigo knit upper,
# tall cream FF Blast+ midsole with a rocker toe, denim-blue tiger stripes, navy collar,
# laces and heel pull-loop, thin blue outsole edge.
NIMBUS_MIDSOLE = [  # fraction heel->toe, bottom z, top z, width
    (0.0, 0.014, 0.05, 0.072), (0.06, 0.0, 0.053, 0.088), (0.35, 0.0, 0.048, 0.08),
    (0.6, 0.0, 0.041, 0.098), (0.82, 0.005, 0.037, 0.095), (0.94, 0.015, 0.035, 0.075),
    (1.0, 0.027, 0.035, 0.04),
]


def midsole_top(f):
    for (f0, _, t0, _), (f1, _, t1, _) in zip(NIMBUS_MIDSOLE, NIMBUS_MIDSOLE[1:]):
        if f <= f1:
            return t0 + (t1 - t0) * (f - f0) / (f1 - f0)
    return NIMBUS_MIDSOLE[-1][2]


def build_shoe(part, stripes, heel, toe_dir, mirror):
    """One Gel-Nimbus on the floor: x heel->toe, y towards its outside, z up."""
    x = toe_dir.normalized()
    z = W(0, 1, 0)
    y = z.cross(x) * (1 if mirror else -1)
    L = 0.29

    def at(f, zz, yy=0.0):
        return Vector((f * L, yy, zz))

    def place(geo):
        return xform(geo, heel, x, y, z)

    # Midsole, with a thin blue outsole layer showing as a line along the bottom edge.
    mid = [at(f, (b + t) / 2) for f, b, t, _ in NIMBUS_MIDSOLE]
    prm = [dict(depth=t - b, width=w, e=3.2) for _, b, t, w in NIMBUS_MIDSOLE]
    part.add('nimbus_midsole', place(loft(mid, prm, Vector((0, 0, 1)), profile='super', n=28, samples=30)))
    out = [at(f, b + 0.0025) for f, b, _, _ in NIMBUS_MIDSOLE]
    part.add('nimbus_stripe', place(loft(out, [dict(depth=0.005, width=w + 0.003, e=3.2) for *_, w in NIMBUS_MIDSOLE],
                                         Vector((0, 0, 1)), profile='super', n=28, samples=30)))
    # Knit upper sitting in the midsole.
    stations = [(0.015, 0.06, 0.06), (0.07, 0.066, 0.068), (0.3, 0.06, 0.072), (0.55, 0.043, 0.082),
                (0.78, 0.03, 0.078), (0.9, 0.022, 0.066), (0.97, 0.012, 0.04), (0.995, 0.004, 0.016)]
    upper = [at(f, midsole_top(f) - 0.004 + d / 2) for f, d, _ in stations]
    part.add('nimbus_upper', place(loft(upper, [dict(depth=d, width=w, e=2.6) for _, d, w in stations],
                                        Vector((0, 0, 1)), profile='dome', n=40, samples=44)))
    crown = lambda f: midsole_top(f) - 0.004 + (0.066 if f < 0.2 else 0.06)  # noqa: E731
    # Navy padded collar round the opening, and the heel pull-loop.
    part.add('nimbus_navy', place(loft([at(0.06, crown(0.06) - 0.001), at(0.15, crown(0.15) - 0.002), at(0.25, crown(0.25) - 0.006)],
                                       [dict(depth=0.044, width=0.006, e=2.2), dict(depth=0.05, width=0.007, e=2.2),
                                        dict(depth=0.036, width=0.006, e=2.2)],
                                       Vector((0, 1, 0)), profile='super', n=18, samples=10)))
    part.add('nimbus_navy', place(loft([at(0.035, crown(0.0) - 0.01), at(-0.004, crown(0.0) + 0.004),
                                        at(0.0, crown(0.0) + 0.026), at(0.03, crown(0.0) + 0.016)],
                                       [dict(depth=0.014, width=0.004, e=2.4)], Vector((0, 1, 0)),
                                       profile='super', n=8, samples=12)))
    # Navy laces across the instep.
    for k in range(5):
        f = 0.33 + k * 0.065
        hz = midsole_top(f) - 0.004 + (0.06 + (0.043 - 0.06) * (f - 0.3) / 0.25) + 0.001
        part.add('nimbus_navy', place(rod(at(f, hz, -0.022), at(f + 0.012, hz, 0.022), 0.0026, 6)))
    # ASICS stripes on both sides, snapped onto the upper afterwards.
    for side in (-1, 1):
        yy = side * 0.05
        for a0, a1 in (((0.40, 0.05), (0.68, 0.088)), ((0.46, 0.047), (0.74, 0.084)),
                       ((0.6, 0.05), (0.47, 0.09))):
            p0 = at(a0[0], a0[1], yy)
            p1 = at(a1[0], a1[1], yy)
            stripes.add('nimbus_stripe', place(loft([p0, p0.lerp(p1, 0.5) + Vector((0, side * 0.004, 0)), p1],
                                                    [dict(depth=0.011, width=0.002, e=2.5)],
                                                    Vector((0, 0, 1)), profile='super', n=8, samples=12)))


def snap_onto(obj, target, offset=0.0012):
    """Shrinkwrap obj onto target's surface and join it into target."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.to_mesh(obj.data)
    bm.free()
    sw = obj.modifiers.new('wrap', 'SHRINKWRAP')
    sw.target = target
    sw.wrap_method = 'NEAREST_SURFACEPOINT'
    sw.wrap_mode = 'OUTSIDE_SURFACE'
    sw.offset = offset
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier='wrap')
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()
    return target


def build_gear():
    col = bpy.data.collections.get(GEAR_COLLECTION)
    if not col:
        col = bpy.data.collections.new(GEAR_COLLECTION)
        bpy.context.scene.collection.children.link(col)
    clear_old(col)
    make_gear_materials()
    root = bpy.data.objects.new(GEAR_ROOT, None)
    col.objects.link(root)

    # The bag stands on the floor in the corner behind the rear wheel, clear of the skirting.
    bag_u, bag_w = -1.72, WALL_W + 0.115
    bag_top = FLOOR_V + 0.46

    bag = Part('Triathlon bag')
    build_bag(bag, bag_u, FLOOR_V, bag_w)
    bag.build(root, col, smooth_angle=50)

    # Goggles hang from the top grab handle down the front of the bag.
    goggles = Part('Swim goggles')
    build_goggles(goggles, bag_u, bag_top + 0.09, bag_w + 0.04, bag_w + 0.087, bag_top - 0.11)
    goggles.build(root, col, smooth_angle=50)

    # Swim cap hangs off the side of the bag facing the bike.
    cap = Part('Swim cap')
    build_swim_cap(cap, bag_u + 0.15, bag_top - 0.03, bag_w + 0.02, W(0.95, -0.3, 0.12))
    cap.build(root, col, smooth_angle=60)

    helmet = Part('Bike helmet')
    build_helmet(helmet)
    helmet.build(root, col, smooth_angle=60)

    shoes = Part('Running shoes')
    stripes = Part('Shoe stripes')
    build_shoe(shoes, stripes, P(-1.29, FLOOR_V, WALL_W + 0.05), W(-0.12, 0, 1), mirror=False)
    build_shoe(shoes, stripes, P(-1.42, FLOOR_V, WALL_W + 0.06), W(-0.3, 0, 1), mirror=True)
    snap_onto(stripes.build(root, col), shoes.build(root, col, smooth_angle=50))
    return col

# -------------------------------------------------------------------- main ----
def clear_old(col):
    old = list(col.all_objects)
    data = {o.data for o in old if o.data}
    for o in old:
        bpy.data.objects.remove(o, do_unlink=True)
    for d in data:
        if d.users == 0:
            if isinstance(d, bpy.types.Mesh):
                bpy.data.meshes.remove(d)
            elif isinstance(d, bpy.types.Curve):
                bpy.data.curves.remove(d)


def main():
    col = bpy.data.collections[COLLECTION]
    clear_old(col)
    make_materials()
    root = bpy.data.objects.new(ROOT_NAME, None)
    col.objects.link(root)
    frame = build_frame(col, root)
    build_fork(col, root)
    build_wheel(col, root, 'Reacto front wheel', FA, rear=False)
    build_wheel(col, root, 'Reacto rear wheel', RA, rear=True)
    build_drivetrain(col, root)
    build_brakes(col, root)
    build_cockpit(col, root)
    build_seat(col, root)
    build_mount(col, root)
    build_decals(col, root, frame)
    gear = build_gear()
    tris = 0
    for o in list(col.all_objects) + list(gear.all_objects):
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            tris += len(o.data.loop_triangles)
    print(f'REACTO built: {len(col.all_objects)} objects, {tris} triangles')
    if '--save' in sys.argv:
        bpy.ops.wm.save_mainfile()


main()
