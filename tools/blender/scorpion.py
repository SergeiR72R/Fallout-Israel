# Гигантский скорпион для «Хамсина»: процедурная модель + покадровые позы + рендер спрайтов.
#   blender -b --factory-startup --python tools/blender/scorpion.py -- --out DIR [--big] [--preview]
# Камера, солнце и формат кадров — как в characters.py.

import bpy, bmesh, math, sys, os, json
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
    return default

OUT = arg('--out', '/tmp/scorpion')
BIG = bool(arg('--big', False))
PREVIEW = bool(arg('--preview', False))
SAMPLES = int(arg('--samples', 24))
PPU = 120.0
FRAME_W, FRAME_H = 480, 400
FEET_PX = (240, 250)
SIZE = 1.75 if BIG else 1.25
SHELL = (0.075, 0.032, 0.012) if BIG else (0.16, 0.085, 0.028)
DARK = (0.07, 0.04, 0.02)

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

# ---------------------------------------------------------------- материалы

def chitin(name, color, gloss=0.35):
    m = bpy.data.materials.new(name); m.use_nodes = True
    n = m.node_tree.nodes; l = m.node_tree.links
    b = n['Principled BSDF']
    b.inputs['Roughness'].default_value = gloss
    b.inputs['Coat Weight'].default_value = 0.4
    tc = n.new('ShaderNodeTexCoord')
    noise = n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 40; noise.inputs['Detail'].default_value = 8
    l.new(tc.outputs['Object'], noise.inputs['Vector'])
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*[c * 0.55 for c in color], 1)
    ramp.color_ramp.elements[1].color = (*color, 1)
    l.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    ao = n.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = 0.05
    mix = n.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 0.7
    l.new(ramp.outputs['Color'], mix.inputs[6]); l.new(ao.outputs['Color'], mix.inputs[7])
    l.new(mix.outputs[2], b.inputs['Base Color'])
    bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35
    bt = n.new('ShaderNodeTexVoronoi'); bt.inputs['Scale'].default_value = 120
    l.new(tc.outputs['Object'], bt.inputs['Vector'])
    l.new(bt.outputs['Distance'], bump.inputs['Height']); l.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

M_SHELL = chitin('shell', SHELL)
M_DARK = chitin('dark', DARK, gloss=0.2)
M_EYE = chitin('eye', (0.01, 0.01, 0.01), gloss=0.05)

# ---------------------------------------------------------------- геометрия

def link(o, parent=None):
    if o.name not in bpy.context.scene.collection.objects:
        pass
    if parent:
        o.parent = parent
    return o

def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.rotation_mode = 'XYZ'
    if parent: e.parent = parent
    return e

def blob(name, size, loc, parent, mat=M_SHELL, subdiv=2, segs=(1, 1, 1)):
    """Скруглённая коробка (кубик + сглаживание)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    o = bpy.context.active_object; o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    bev = o.modifiers.new('bev', 'BEVEL'); bev.width = min(size) * 0.35; bev.segments = 3
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = subdiv; sub.render_levels = subdiv
    o.data.materials.append(mat)
    o.parent = parent; o.location = loc
    bpy.ops.object.shade_smooth()
    return o

def capsule(name, start, end, r0, r1, parent, mat=M_SHELL):
    """Сегмент ноги от start до end (в координатах родителя), ось — от начала."""
    d = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r0, radius2=r1, depth=d.length, location=(0, 0, d.length / 2))
    o = bpy.context.active_object; o.name = name
    bpy.ops.object.transform_apply(location=True)
    bev = o.modifiers.new('bev', 'BEVEL'); bev.width = min(r0, r1) * 0.6; bev.segments = 2
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    piv = empty(name + '_j', start, parent)
    o.parent = piv
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    return piv, o

root = empty('root', (0, 0, 0))
root.scale = (SIZE, SIZE, SIZE)
hull = empty('hull', (0, 0, 0.2), root)

# Головогрудь и брюшко (вперёд — −Y).
blob('prosoma', (0.26, 0.24, 0.09), (0, -0.16, 0.02), hull)
for i in range(7):
    w = 0.30 - 0.010 * i - (0.04 if i > 4 else 0)
    blob(f'tergite{i}', (w, 0.11, 0.07 - 0.003 * i), (0, -0.03 + 0.066 * i, 0.035 + 0.01 * math.sin(i / 6 * math.pi) - 0.004 * i), hull)
blob('belly', (0.24, 0.48, 0.05), (0, 0.10, -0.03), hull, mat=M_DARK)
for sx in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.016, location=(0, 0, 0))
    e = bpy.context.active_object; e.data.materials.append(M_EYE); e.parent = hull; e.location = (sx * 0.035, -0.25, 0.075)

# Ноги: 4 пары, три сегмента, суставы — пустышки.
LEGS = []
for side in (-1, 1):
    for k in range(4):
        y = -0.12 + 0.085 * k
        base = empty(f'leg{side}{k}', (side * 0.12, y, 0.0), hull)
        base.rotation_euler = (0, 0, side * (0.35 - 0.25 * k))
        j1, s1 = capsule(f'femur{side}{k}', (0, 0, 0), (side * 0.22, 0.0, 0.08), 0.024, 0.02, base, M_SHELL)
        knee = empty(f'knee{side}{k}', (side * 0.22, 0.0, 0.08), base)
        j2, s2 = capsule(f'tibia{side}{k}', (0, 0, 0), (side * 0.20, 0.0, -0.17), 0.019, 0.011, knee, M_SHELL)
        foot = empty(f'foot{side}{k}', (side * 0.20, 0.0, -0.17), knee)
        capsule(f'tarsus{side}{k}', (0, 0, 0), (side * 0.06, 0.0, -0.06), 0.009, 0.004, foot, M_DARK)
        LEGS.append(dict(side=side, k=k, base=base, knee=knee, foot=foot))

# Клешни (педипальпы).
CLAWS = []
for side in (-1, 1):
    sh = empty(f'palp{side}', (side * 0.10, -0.26, 0.03), hull)
    capsule(f'hum{side}', (0, 0, 0), (side * 0.16, -0.10, 0.05), 0.026, 0.022, sh)
    el = empty(f'elbow{side}', (side * 0.16, -0.10, 0.05), sh)
    capsule(f'pat{side}', (0, 0, 0), (-side * 0.02, -0.16, 0.0), 0.026, 0.03, el)
    hand = empty(f'chela{side}', (-side * 0.02, -0.16, 0.0), el)
    blob(f'hand{side}', (0.14, 0.22, 0.10), (0, -0.09, 0), hand)
    fix = empty(f'fixf{side}', (side * 0.03, -0.19, 0), hand)
    capsule(f'fixed{side}', (0, 0, 0), (side * 0.01, -0.16, 0), 0.03, 0.006, fix, M_DARK)
    mov = empty(f'movf{side}', (-side * 0.035, -0.18, 0), hand)
    capsule(f'moving{side}', (0, 0, 0), (-side * 0.015, -0.15, 0), 0.027, 0.005, mov, M_DARK)
    CLAWS.append(dict(side=side, sh=sh, el=el, mov=mov))

# Хвост: пять сегментов + тельсон с жалом.
TAIL = []
parent = empty('tail0', (0, 0.43, 0.05), hull)
for i in range(5):
    seg = parent
    L = 0.10 - 0.004 * i
    blob(f'meta{i}', (0.085 - 0.004 * i, L * 1.1, 0.08 - 0.003 * i), (0, L / 2, 0), seg)
    TAIL.append(seg)
    parent = empty(f'tail{i + 1}', (0, L, 0), seg)
tel = parent
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(0, 0, 0))
bulb = bpy.context.active_object; bulb.scale = (0.9, 1.3, 0.9); bulb.parent = tel; bulb.location = (0, 0.05, 0)
bulb.data.materials.append(chitin('telson', tuple(c * 1.4 for c in SHELL), gloss=0.2)); bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.022, radius2=0.0, depth=0.12, location=(0, 0, 0))
sting = bpy.context.active_object; sting.parent = tel; sting.location = (0, 0.12, -0.03); sting.rotation_euler = (math.radians(-120), 0, 0)
sting.data.materials.append(M_EYE); bpy.ops.object.shade_smooth()
TAIL.append(tel)
TAIL_REST = [0.0, 0.55, 0.55, 0.55, 0.6, 0.7]

# ---------------------------------------------------------------- позы

def pose(anim, t):
    for i, seg in enumerate(TAIL):
        seg.rotation_euler = (TAIL_REST[i], 0, 0)
    hull.location = (0, 0, 0.2); hull.rotation_euler = (0, 0, 0)
    for L in LEGS:
        L['base'].rotation_euler = (0, 0, L['side'] * (0.35 - 0.25 * L['k']))
        L['knee'].rotation_euler = (0, 0, 0); L['foot'].rotation_euler = (0, 0, 0)
    for c in CLAWS:
        c['sh'].rotation_euler = (0, 0, 0); c['el'].rotation_euler = (0, 0, 0); c['mov'].rotation_euler = (0, 0, 0)
    s = math.sin(2 * math.pi * t)
    if anim == 'walk':
        for L in LEGS:
            ph = 2 * math.pi * t + (0 if (L['k'] + (L['side'] > 0)) % 2 else math.pi)
            L['base'].rotation_euler.z += 0.32 * math.sin(ph)
            L['base'].rotation_euler.y = L['side'] * -0.25 * max(0.0, math.cos(ph))
        hull.location.z = 0.2 + 0.012 * abs(math.cos(2 * math.pi * t))
        for i, seg in enumerate(TAIL):
            seg.rotation_euler.z = 0.05 * math.sin(2 * math.pi * t + i * 0.6)
        for c in CLAWS:
            c['sh'].rotation_euler.z = c['side'] * 0.08 * s
    elif anim == 'attack':
        wind = math.sin(min(1.0, t / 0.35) * math.pi / 2)
        strike = max(0.0, min(1.0, (t - 0.35) / 0.25))
        back = 1 - max(0.0, min(1.0, (t - 0.75) / 0.25))
        for i, seg in enumerate(TAIL):
            seg.rotation_euler.x = TAIL_REST[i] + (0.12 * wind + (0.35 if i > 0 else 0.5) * strike) * back
        hull.rotation_euler.x = (-0.06 * wind + 0.08 * strike) * back
        for c in CLAWS:
            c['el'].rotation_euler.z = c['side'] * 0.4 * strike * back
            c['mov'].rotation_euler.z = -c['side'] * 0.5 * (1 - strike) * back
    elif anim == 'hit':
        k = math.sin(t * math.pi)
        hull.location.z = 0.2 + 0.05 * k; hull.rotation_euler.x = 0.15 * k
        for c in CLAWS:
            c['sh'].rotation_euler.z = c['side'] * -0.3 * k
    elif anim == 'death':
        e = min(1.0, t * 1.2); e = e * e * (3 - 2 * e)
        hull.location.z = 0.2 - 0.13 * e
        hull.rotation_euler.y = 0.35 * e
        for L in LEGS:
            L['knee'].rotation_euler.y = L['side'] * 0.9 * e
            L['base'].rotation_euler.y = L['side'] * -0.4 * e
        for i, seg in enumerate(TAIL):
            seg.rotation_euler.x = TAIL_REST[i] * (1 - 0.85 * e) + (0.25 if i == 0 else 0)
        for c in CLAWS:
            c['sh'].rotation_euler.z = c['side'] * 0.5 * e

ANIMS = {'idle': 1, 'walk': 8, 'attack': 6, 'hit': 4, 'death': 8}

# ---------------------------------------------------------------- рендер (как у людей)

def hex_dir_angles():
    yaw = math.pi / 4
    out = []
    for q, r in ((1, -1), (1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1)):
        u = 1.5 * q; v = math.sqrt(3) * (r + q / 2)
        x = u * math.cos(yaw) + v * math.sin(yaw); z = -u * math.sin(yaw) + v * math.cos(yaw)
        out.append(math.atan2(x, z))
    return out

sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True; sc.cycles.use_adaptive_sampling = True; sc.cycles.max_bounces = 4
sc.render.film_transparent = True
sc.render.resolution_x = FRAME_W; sc.render.resolution_y = FRAME_H
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'Medium High Contrast'; sc.view_settings.exposure = -0.15
pitch = math.pi / 6; yaw = math.pi / 4
d3 = Vector((math.sin(yaw) * math.cos(pitch), math.sin(pitch), math.cos(yaw) * math.cos(pitch)))
db = Vector((d3.x, -d3.z, d3.y))
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.data.ortho_scale = FRAME_W / PPU
cam.data.shift_y = (FEET_PX[1] - FRAME_H / 2) / FRAME_W
cam.location = db * 30; cam.rotation_euler = (-db).to_track_quat('-Z', 'Y').to_euler(); cam.data.clip_end = 100
sc.camera = cam
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sd3 = Vector((22, -40, -6)).normalized(); sdb = Vector((sd3.x, -sd3.z, sd3.y))
sun.rotation_euler = sdb.to_track_quat('-Z', 'Y').to_euler()
sun.data.energy = 4.2; sun.data.angle = math.radians(3); sun.data.color = (1.0, 0.92, 0.80)
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.55, 0.52, 0.48, 1); bg.inputs['Strength'].default_value = 0.9
bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
bpy.context.active_object.is_shadow_catcher = True

os.makedirs(OUT, exist_ok=True)
dirs = hex_dir_angles()
meta = {'char': 'scorpion', 'ppu': PPU, 'frame': [FRAME_W, FRAME_H], 'feet': list(FEET_PX), 'dirs': dirs,
        'height': 0.75 * SIZE, 'anims': {f'none/{a}': n for a, n in ANIMS.items()}}
jobs = [(a, d, f, n) for a, n in ANIMS.items() for d in range(6) for f in range(n)]
if PREVIEW:
    jobs = [j for j in jobs if j[1] in (1, 4) and j[2] in (0, 3, j[3] - 1)]
for i, (anim, di, f, n) in enumerate(jobs):
    root.rotation_euler = (0, 0, dirs[di])
    pose(anim, f / n if anim == 'walk' else f / max(1, n - 1))
    bpy.context.view_layer.update()
    sc.render.filepath = os.path.join(OUT, f'none_{anim}_{di}_{f}.png')
    bpy.ops.render.render(write_still=True)
    print(f'[{i + 1}/{len(jobs)}] {anim} d{di} f{f}', flush=True)
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
