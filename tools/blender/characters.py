# Генератор персонажей-спрайтов для «Хамсина» (Blender 4.2, запускать в фоне).
#
#   blender -b human_base_meshes_bundle.blend --python tools/blender/characters.py -- \
#       --char hero --out build/sprites/hero [--preview] [--sets none,pistol,knife]
#
# Основа — CC0 «Human Base Meshes» от Blender Studio. Скрипт:
#   1) берёт реалистичное тело, ставит скелет и привязывает автоматическими весами;
#   2) «шьёт» одежду из копий тела (комбинезон, ботинки, волосы, борода) и
#      добавляет снаряжение (ремень, подсумки, кобура, головной убор, оружие);
#   3) задаёт позы покадрово (ходьба, бег, стрельба, удар, ранение, смерть);
#   4) рендерит каждый кадр в Cycles ортокамерой под углом игровой камеры
#      (изометрия 2:1, поворот 45°, наклон 30°) в 6 направлениях гексов,
#      с тенью от того же солнца, что и в игре.
# Кадры потом собирает в атлас tools/pack_sprites.py.

import bpy, bmesh, math, sys, os, json, random
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
    return default

CHAR = arg('--char', 'hero')
OUT = arg('--out', '/tmp/sprites')
PREVIEW = bool(arg('--preview', False))
PPU = 120.0                      # пикселей на метр в кадре (игра: 90 на 1080p)
FRAME_W, FRAME_H = 480, 400      # размер кадра; ноги — в точке FEET_PX
FEET_PX = (240, 290)
SAMPLES = int(arg('--samples', 32))

random.seed(7)

# ---------------------------------------------------------------- персонажи

CHARS = {
    'hero': dict(body='male', height=1.78, skin=(0.45, 0.28, 0.18), hair=(0.09, 0.06, 0.04), hair_style='short',
                 outfit='jumpsuit', cloth=(0.07, 0.11, 0.17), trim=(0.025, 0.03, 0.035), stripe=(0.75, 0.25, 0.03),
                 boots=(0.10, 0.07, 0.05), belt=True, holster=True, sets=['none', 'pistol', 'knife']),
    'heroine': dict(body='female', height=1.68, skin=(0.45, 0.28, 0.18), hair=(0.07, 0.045, 0.03), hair_style='bun',
                    outfit='jumpsuit', cloth=(0.07, 0.11, 0.17), trim=(0.025, 0.03, 0.035), stripe=(0.75, 0.25, 0.03),
                    boots=(0.10, 0.07, 0.05), belt=True, holster=True, sets=['none', 'pistol', 'knife']),
    'batya': dict(body='female', height=1.60, skin=(0.40, 0.24, 0.15), hair=(0.80, 0.78, 0.74), hair_style='short',
                  outfit='shirt', cloth=(0.30, 0.26, 0.16), pants=(0.13, 0.12, 0.08), trim=(0.22, 0.19, 0.12),
                  boots=(0.25, 0.17, 0.10), belt=True, hat='tembel', sets=['none', 'knife'], age=True),
    'shlomo': dict(body='male', height=1.82, skin=(0.26, 0.15, 0.09), hair=(0.03, 0.025, 0.02), hair_style='short',
                   beard=True, outfit='uniform', cloth=(0.09, 0.11, 0.045), pants=(0.08, 0.095, 0.04), trim=(0.05, 0.06, 0.03),
                   boots=(0.08, 0.06, 0.04), belt=True, vest=(0.11, 0.10, 0.055), hat='helmet', holster=True,
                   sets=['none', 'pistol'], bulk=1.06),
}
C = CHARS[CHAR]
SETS = (arg('--sets').split(',') if arg('--sets') else C['sets'])

# Суставы (координаты исходной модели, до масштабирования).
JOINTS = {
    'male': dict(H=1.684, hip=(0.09, 0.0, 0.90), knee=(0.12, -0.005, 0.48), ankle=(0.165, 0.035, 0.085), toe=(0.19, -0.11, 0.02),
                 pelvis=0.93, spine=1.05, chest=1.22, neck=1.41, head=1.50,
                 clav=(0.03, -0.01, 1.38), shoulder=(0.175, 0.0, 1.41), elbow=(0.262, 0.0, 1.14), wrist=(0.368, -0.055, 0.89), tip=(0.425, -0.112, 0.712)),
    'female': dict(H=1.641, hip=(0.085, 0.0, 0.86), knee=(0.115, 0.0, 0.46), ankle=(0.122, 0.03, 0.08), toe=(0.15, -0.10, 0.02),
                   pelvis=0.90, spine=1.02, chest=1.19, neck=1.37, head=1.46,
                   clav=(0.03, -0.01, 1.34), shoulder=(0.16, 0.0, 1.37), elbow=(0.215, 0.02, 1.10), wrist=(0.335, -0.02, 0.87), tip=(0.409, -0.074, 0.696)),
}
J = JOINTS[C['body']]
NECK_Z = J['neck']
# Насколько опустить руки из A-позы базовой модели (у женской они отведены сильнее).
ARM_DOWN = 26 if C['body'] == 'male' else 17

# ---------------------------------------------------------------- сцена

def clean_scene():
    keep = {f"GEO-body_{C['body']}_realistic"}
    for o in list(bpy.data.objects):
        if o.name in keep or (o.parent and o.parent.name in keep):
            continue
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections):
        if not c.objects and not c.children:
            bpy.data.collections.remove(c)

def body_obj():
    return bpy.data.objects[f"GEO-body_{C['body']}_realistic"]

def select_only(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o

def prep_body():
    b = body_obj()
    eyes = [o for o in bpy.data.objects if o.parent == b and o.type == 'MESH']
    for o in [o for o in bpy.data.objects if o.parent == b and o.type != 'MESH']:
        bpy.data.objects.remove(o, do_unlink=True)
    for o in [b] + eyes:
        o.hide_set(False); o.hide_viewport = False; o.hide_render = False
    # тело — в начало координат, глаза отцепляем с сохранением положения
    b.location = (0, 0, 0)
    bpy.context.view_layer.update()
    for e in eyes:
        mw = e.matrix_world.copy(); e.parent = None; e.matrix_world = mw
    select_only(b)
    for m in list(b.modifiers):
        if m.type == 'MULTIRES':
            m.levels = 1
            bpy.ops.object.modifier_apply(modifier=m.name)
        else:
            b.modifiers.remove(m)
    if C.get('bulk'):
        # Чуть массивнее: раздуваем по нормалям торс и конечности.
        bm = bmesh.new(); bm.from_mesh(b.data); bm.normal_update()
        for v in bm.verts:
            if v.co.z < J['head']:
                v.co += v.normal * 0.007
        bm.to_mesh(b.data); bm.free()
    return b, eyes

# ---------------------------------------------------------------- скелет

BONES = {}

def mirror(p, side):
    return Vector((p[0] * side, p[1], p[2]))

def build_armature():
    arm_data = bpy.data.armatures.new('rig')
    arm = bpy.data.objects.new('rig', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    select_only(arm)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones
    def bone(name, head, tail, parent=None, deform=True):
        b = eb.new(name)
        b.head = Vector(head); b.tail = Vector(tail)
        b.align_roll(Vector((0, 1, 0)))
        if parent: b.parent = eb[parent]; b.use_connect = False
        b.use_deform = deform
        return b
    bone('root', (0, 0, 0), (0, 0, 0.25), deform=False)
    bone('hips', (0, 0, J['pelvis']), (0, 0, J['spine']), 'root')
    bone('spine', (0, 0, J['spine']), (0, 0, J['chest']), 'hips')
    bone('chest', (0, 0, J['chest']), (0, -0.01, J['neck']), 'spine')
    bone('neck', (0, -0.01, J['neck']), (0, -0.03, J['head']), 'chest')
    bone('head', (0, -0.03, J['head']), (0, -0.05, J['H']), 'neck')
    for s, side in (('R', -1), ('L', 1)):
        bone(f'clav_{s}', mirror(J['clav'], side), mirror(J['shoulder'], side), 'chest')
        bone(f'uarm_{s}', mirror(J['shoulder'], side), mirror(J['elbow'], side), f'clav_{s}')
        bone(f'farm_{s}', mirror(J['elbow'], side), mirror(J['wrist'], side), f'uarm_{s}')
        bone(f'hand_{s}', mirror(J['wrist'], side), mirror(J['tip'], side), f'farm_{s}')
        bone(f'thigh_{s}', mirror(J['hip'], side), mirror(J['knee'], side), 'hips')
        bone(f'shin_{s}', mirror(J['knee'], side), mirror(J['ankle'], side), f'thigh_{s}')
        bone(f'foot_{s}', mirror(J['ankle'], side), mirror(J['toe'], side), f'shin_{s}')
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
    return arm

def skin(arm, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for o in objs:
        counts = {g.name: 0 for g in o.vertex_groups}
        for v in o.data.vertices:
            for g in v.groups:
                if g.weight > 0.3:
                    counts[o.vertex_groups[g.group].name] += 1
        empty = [b.name for b in arm.data.bones if b.use_deform and not counts.get(b.name)]
        if empty:
            print('Автовеса не сработали для', empty, '— считаю веса по расстоянию до костей')
            distance_weights(o, arm)

def distance_weights(o, arm):
    """Запасной вариант: вес вершины по расстоянию до отрезков костей (мягкий минимум)."""
    segs = []
    for b in arm.data.bones:
        if b.use_deform:
            segs.append((b.name, arm.matrix_world.inverted() @ (arm.matrix_world @ b.head_local), b.tail_local))
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    groups = {n: o.vertex_groups.new(name=n) for n, _, _ in segs}
    def dist(p, a, b):
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.dot(ab))))
        return (a + ab * t - p).length
    for v in o.data.vertices:
        ds = sorted((dist(v.co, a, b), n) for n, a, b in segs)
        d0 = ds[0][0]
        ws = [(math.exp(-(d - d0) / 0.02), n) for d, n in ds[:3] if d - d0 < 0.06]
        tot = sum(w for w, _ in ws)
        for w, n in ws:
            groups[n].add([v.index], w / tot, 'REPLACE')

def parent_to_bone(obj, arm, bone):
    mw = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    obj.matrix_world = mw

# ---------------------------------------------------------------- материалы

def principled(name, color, rough=0.8, metal=0.0, sss=0.0, bump=0.0, bump_scale=200.0, dust=0.0, attr=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; n = nt.nodes; l = nt.links
    bsdf = n['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if sss:
        bsdf.inputs['Subsurface Weight'].default_value = sss
        bsdf.inputs['Subsurface Radius'].default_value = (0.03, 0.012, 0.008)
    base = n.new('ShaderNodeRGB'); base.outputs[0].default_value = (*color, 1)
    col_out = base.outputs[0]
    # Краска по атрибуту вершин (полоса, нашивка, манжеты).
    if attr:
        ca = n.new('ShaderNodeVertexColor'); ca.layer_name = attr
        mix = n.new('ShaderNodeMix'); mix.data_type = 'RGBA'
        l.new(ca.outputs['Alpha'], mix.inputs['Factor'])
        l.new(col_out, mix.inputs[6]); l.new(ca.outputs['Color'], mix.inputs[7])
        col_out = mix.outputs[2]
    # Пыль и грязь: шум + затемнение в складках (AO).
    tc = n.new('ShaderNodeTexCoord')
    noise = n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 18; noise.inputs['Detail'].default_value = 6
    l.new(tc.outputs['Object'], noise.inputs['Vector'])
    ao = n.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = 0.06
    grime = n.new('ShaderNodeMix'); grime.data_type = 'RGBA'; grime.blend_type = 'MULTIPLY'
    grime.inputs['Factor'].default_value = 0.55
    l.new(col_out, grime.inputs[6]); l.new(ao.outputs['Color'], grime.inputs[7])
    out = grime.outputs[2]
    if dust:
        # Пыль: мелкий шум, сильнее у земли (по высоте в позе покоя ≈ координата объекта).
        noise.inputs['Scale'].default_value = 70
        dmix = n.new('ShaderNodeMix'); dmix.data_type = 'RGBA'
        ramp = n.new('ShaderNodeMapRange'); ramp.inputs['From Min'].default_value = 0.5; ramp.inputs['From Max'].default_value = 0.8
        ramp.inputs['To Max'].default_value = dust
        l.new(noise.outputs['Fac'], ramp.inputs['Value'])
        sep = n.new('ShaderNodeSeparateXYZ'); l.new(tc.outputs['Object'], sep.inputs[0])
        hz = n.new('ShaderNodeMapRange'); hz.inputs['From Min'].default_value = 0.7; hz.inputs['From Max'].default_value = 0.0
        hz.inputs['To Min'].default_value = 0.25
        l.new(sep.outputs['Z'], hz.inputs['Value'])
        mul = n.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
        l.new(ramp.outputs['Result'], mul.inputs[0]); l.new(hz.outputs['Result'], mul.inputs[1])
        l.new(mul.outputs[0], dmix.inputs['Factor'])
        l.new(out, dmix.inputs[6]); dmix.inputs[7].default_value = (0.62, 0.52, 0.38, 1)
        out = dmix.outputs[2]
    l.new(out, bsdf.inputs['Base Color'])
    if bump:
        bn = n.new('ShaderNodeBump'); bn.inputs['Strength'].default_value = bump
        bt = n.new('ShaderNodeTexNoise'); bt.inputs['Scale'].default_value = bump_scale; bt.inputs['Detail'].default_value = 4
        l.new(tc.outputs['Object'], bt.inputs['Vector'])
        l.new(bt.outputs['Fac'], bn.inputs['Height']); l.new(bn.outputs['Normal'], bsdf.inputs['Normal'])
    return m

def set_mat(o, m):
    o.data.materials.clear(); o.data.materials.append(m)

# ---------------------------------------------------------------- одежда

def dup(obj, name):
    o = obj.copy(); o.data = obj.data.copy(); o.name = name
    bpy.context.scene.collection.objects.link(o)
    return o

def keep_verts(o, pred):
    bm = bmesh.new(); bm.from_mesh(o.data)
    kill = [v for v in bm.verts if not pred(v.co)]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(o.data); bm.free()

def inflate(o, amount, noise=0.0, noise_size=0.04, solid=0.0):
    """Сдвиг по нормалям + складки + толщина; модификатор скелета — последним."""
    d = o.modifiers.new('inflate', 'DISPLACE'); d.strength = amount; d.mid_level = 0
    if noise:
        tex = bpy.data.textures.new(o.name + '_folds', 'CLOUDS'); tex.noise_scale = noise_size; tex.noise_depth = 2
        d2 = o.modifiers.new('folds', 'DISPLACE'); d2.texture = tex; d2.strength = noise; d2.texture_coords = 'OBJECT'
    if solid:
        s = o.modifiers.new('solid', 'SOLIDIFY'); s.thickness = solid; s.offset = 1
    sm = o.modifiers.new('smooth', 'CORRECTIVE_SMOOTH'); sm.iterations = 3; sm.factor = 0.5
    arm_mod = [m for m in o.modifiers if m.type == 'ARMATURE']
    for m in arm_mod:
        bpy.context.view_layer.objects.active = o
        with bpy.context.temp_override(object=o):
            bpy.ops.object.modifier_move_to_index(modifier=m.name, index=len(o.modifiers) - 1)

def is_hand(co):
    return abs(co.x) > J['wrist'][0] - 0.01 and co.z < J['wrist'][2] + 0.03

def paint(o, name, fn):
    """Атрибут цвета по вершинам: fn(co) -> (r,g,b,a)."""
    attr = o.data.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    for i, v in enumerate(o.data.vertices):
        attr.data[i].color = fn(v.co)

def make_outfit(body, arm):
    H = J['H']
    pieces = []
    top_z = NECK_Z + 0.015
    boot_z = 0.30 if C['outfit'] != 'shirt' else 0.22
    # Комбинезон / рубашка+брюки / форма: одна оболочка, цвета — атрибутом.
    suit = dup(body, 'outfit')
    sleeve_cut = None
    if C['outfit'] == 'shirt':
        sleeve_cut = J['elbow'][2] - 0.02   # закатанные рукава
    def keep(co):
        if co.z > top_z or co.z < boot_z - 0.06: return False
        if is_hand(co): return False
        if sleeve_cut is not None and abs(co.x) > J['shoulder'][0] + 0.02 and co.z < sleeve_cut and co.z > J['hip'][2] - 0.1 and abs(co.x) > 0.2:
            return False
        return True
    keep_verts(suit, keep)
    cloth = C['cloth']; trim = C['trim']; pants = C.get('pants', cloth)
    stripe = C.get('stripe')
    belt_z = J['pelvis'] + 0.06
    def suit_paint(co):
        if stripe and co.y < -0.04 and abs(co.x) < 0.028 and belt_z + 0.03 < co.z < NECK_Z - 0.02:
            return (*stripe, 1)
        # нашивка «7» на левом плече
        if stripe and (co - Vector((0.205 * (1 if C['body'] == 'male' else 0.92), -0.01, J['shoulder'][2] - 0.07))).length < 0.04:
            return (0.85, 0.75, 0.35, 1)
        if co.z > NECK_Z - 0.03:  # воротник
            return (*trim, 1)
        if C['outfit'] != 'jumpsuit' and co.z < belt_z - 0.02:
            return (*pants, 1)
        if abs(co.x) > J['wrist'][0] - 0.06 and co.z < J['wrist'][2] + 0.08:  # манжеты
            return (*trim, 1)
        if C['outfit'] == 'shirt' and abs(co.x) > 0.2 and abs(co.z - (J['elbow'][2] + 0.0)) < 0.03:
            return (*trim, 1)
        return (0, 0, 0, 0)
    paint(suit, 'paint', suit_paint)
    inflate(suit, 0.007, noise=0.006, noise_size=0.05, solid=0.004)
    set_mat(suit, principled('cloth', cloth, rough=0.9, bump=0.15, bump_scale=260, dust=0.35, attr='paint'))
    pieces.append(suit)

    # Ботинки (или сандалии у Батьи — тоже обувь, просто светлее).
    boots = dup(body, 'boots')
    keep_verts(boots, lambda co: co.z < boot_z)
    inflate(boots, 0.012, noise=0.0, solid=0.005)
    set_mat(boots, principled('boots', C['boots'], rough=0.45, bump=0.05, bump_scale=60, dust=0.12))
    pieces.append(boots)

    # Волосы.
    hair = dup(body, 'hair')
    head_c = Vector((0, -0.04, J['H'] - 0.11))
    def scalp(co):
        if co.z < J['H'] - 0.13: return False
        if co.y < -0.075 and co.z < J['H'] - 0.035: return False   # лицо и лоб
        if abs(co.x) > 0.055 and co.z < J['H'] - 0.09 and co.y < 0.0: return False  # виски и уши
        return True
    keep_verts(hair, scalp)
    inflate(hair, 0.009, noise=0.006, noise_size=0.012, solid=0.003)
    set_mat(hair, principled('hair', C['hair'], rough=0.6, bump=0.4, bump_scale=900))
    pieces.append(hair)
    if C.get('hair_style') == 'bun':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045, location=(0, 0.075, J['H'] - 0.07))
        bun = bpy.context.active_object; bun.name = 'bun'
        set_mat(bun, hair.data.materials[0]); parent_to_bone(bun, arm, 'head')

    if C.get('beard'):
        beard = dup(body, 'beard')
        keep_verts(beard, lambda co: co.y < -0.06 and J['head'] - 0.04 < co.z < J['head'] + 0.06 and abs(co.x) < 0.065)
        inflate(beard, 0.008, noise=0.006, noise_size=0.01, solid=0.004)
        set_mat(beard, hair.data.materials[0])
        pieces.append(beard)
    return pieces

def ring_at(body, z, pad, height, name):
    """Кольцо (ремень) по сечению тела на высоте z."""
    # Только торс: руки на этой высоте не должны раздувать обхват.
    lim = J['shoulder'][0] + 0.02
    vs = [v.co for v in body.data.vertices if abs(v.co.z - z) < 0.02 and abs(v.co.x) < lim]
    pts = []
    for i in range(48):
        a = 2 * math.pi * i / 48
        d = Vector((math.cos(a), math.sin(a), 0))
        r = max((Vector((v.x, v.y, 0)).dot(d) for v in vs), default=0.15)
        pts.append(d * (r + pad))
    bm = bmesh.new()
    lo = [bm.verts.new((p.x, p.y, z - height / 2)) for p in pts]
    hi = [bm.verts.new((p.x, p.y, z + height / 2)) for p in pts]
    for i in range(48):
        j = (i + 1) % 48
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    s = o.modifiers.new('solid', 'SOLIDIFY'); s.thickness = 0.008
    return o, pts

def box(name, size, loc, rot=(0, 0, 0), bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 2
    return o

def make_gear(body, arm):
    gear = []
    leather = principled('leather', (0.16, 0.10, 0.06), rough=0.5, bump=0.2, bump_scale=150, dust=0.2)
    metal = principled('metal', (0.55, 0.55, 0.52), rough=0.35, metal=1.0)
    if C.get('belt'):
        z = J['pelvis'] + 0.06
        belt, pts = ring_at(body, z, 0.012, 0.045, 'belt')
        set_mat(belt, leather); parent_to_bone(belt, arm, 'hips'); gear.append(belt)
        buckle = box('buckle', (0.05, 0.012, 0.04), (0, pts[36].y - 0.01 if False else min(p.y for p in pts) - 0.008, z))
        set_mat(buckle, metal); parent_to_bone(buckle, arm, 'hips')
        # подсумки по бокам и сзади
        for ang in (200, 235, 305, 340, 270):
            a = math.radians(ang)
            d = Vector((math.cos(a), math.sin(a), 0))
            r = max(p.dot(d) for p in pts)
            p = box('pouch', (0.07, 0.035, 0.07), (d.x * (r + 0.02), d.y * (r + 0.02), z - 0.025), (0, 0, a + math.pi / 2))
            set_mat(p, principled('pouch', C['trim'] if C['outfit'] != 'jumpsuit' else (0.22, 0.20, 0.15), rough=0.85, bump=0.2, dust=0.3))
            parent_to_bone(p, arm, 'hips')
    if C.get('holster'):
        hx = -(J['hip'][0] + 0.09)
        h = box('holster', (0.035, 0.09, 0.16), (hx, 0.0, J['hip'][2] - 0.10))
        set_mat(h, leather); parent_to_bone(h, arm, 'thigh_R')
    if C.get('vest'):
        vest = dup(body, 'vest')
        keep_verts(vest, lambda co: J['pelvis'] + 0.08 < co.z < NECK_Z - 0.05 and abs(co.x) < 0.17)
        inflate(vest, 0.03, noise=0.004, solid=0.012)
        set_mat(vest, principled('vest', C['vest'], rough=0.9, bump=0.2, dust=0.3))
        for i, x in enumerate((-0.09, -0.03, 0.03, 0.09)):
            p = box('mag', (0.05, 0.03, 0.09), (x, -0.16, J['chest'] + 0.02))
            set_mat(p, vest.data.materials[0]); parent_to_bone(p, arm, 'chest')
    if C.get('hat') == 'tembel':
        # Кова-тембель: мягкий конус с узкими полями.
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.135, radius2=0.075, depth=0.11, location=(0, -0.045, J['H'] - 0.015))
        hat = bpy.context.active_object; hat.name = 'hat'
        bev = hat.modifiers.new('bev', 'BEVEL'); bev.width = 0.02; bev.segments = 3
        sub = hat.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 2
        set_mat(hat, principled('tembel', (0.06, 0.13, 0.30), rough=0.95, bump=0.3, bump_scale=300, dust=0.4))
        parent_to_bone(hat, arm, 'head')
    if C.get('hat') == 'helmet':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.142, location=(0, -0.04, J['H'] - 0.07))
        hel = bpy.context.active_object; hel.name = 'helmet'
        bm = bmesh.new(); bm.from_mesh(hel.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.02], context='VERTS')
        bm.to_mesh(hel.data); bm.free()
        s = hel.modifiers.new('s', 'SOLIDIFY'); s.thickness = 0.01
        set_mat(hel, principled('helmet', (0.08, 0.09, 0.04), rough=0.7, bump=0.3, bump_scale=80, dust=0.4))
        parent_to_bone(hel, arm, 'head')
    return gear

# ---------------------------------------------------------------- оружие

WEAPONS = {}

def make_weapons(arm):
    gunmetal = principled('gun', (0.06, 0.06, 0.065), rough=0.35, metal=0.8)
    grip = principled('grip', (0.20, 0.12, 0.06), rough=0.6)
    # Положение в руке в позе покоя: кисть указывает вниз; ствол — вперёд (−Y).
    w = Vector(J['wrist']); t = Vector(J['tip'])
    w.x *= -1; t.x *= -1
    palm = w.lerp(t, 0.42)
    parts = []
    parts.append(box('slide', (0.03, 0.19, 0.035), palm + Vector((0, -0.05, 0.02))))
    parts[-1].data.materials.append(gunmetal)
    parts.append(box('frame', (0.028, 0.15, 0.02), palm + Vector((0, -0.04, -0.005))))
    parts[-1].data.materials.append(gunmetal)
    g = box('grip', (0.03, 0.045, 0.10), palm + Vector((0, 0.03, -0.04)), (math.radians(-15), 0, 0))
    g.data.materials.append(grip); parts.append(g)
    flash = None
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=palm + Vector((0, -0.19, 0.02)))
    flash = bpy.context.active_object; flash.name = 'flash'; flash.scale = (0.7, 1.6, 0.7)
    fm = bpy.data.materials.new('flash'); fm.use_nodes = True
    em = fm.node_tree.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (1.0, 0.55, 0.15, 1); em.inputs['Strength'].default_value = 6
    fm.node_tree.links.new(em.outputs[0], fm.node_tree.nodes['Material Output'].inputs['Surface'])
    flash.data.materials.append(fm)
    for p in parts + [flash]:
        parent_to_bone(p, arm, 'hand_R')
    WEAPONS['pistol'] = parts
    WEAPONS['flash'] = [flash]
    # Нож: клинок вниз-вперёд из кулака.
    blade = box('blade', (0.008, 0.04, 0.22), palm + Vector((0, -0.03, -0.14)), bevel=0.002)
    blade.data.materials.append(principled('steel', (0.7, 0.7, 0.7), rough=0.25, metal=1.0))
    handle = box('handle', (0.025, 0.03, 0.10), palm + Vector((0, -0.01, 0.0)))
    handle.data.materials.append(principled('kgrip', (0.18, 0.20, 0.12), rough=0.8))
    for p in (blade, handle):
        parent_to_bone(p, arm, 'hand_R')
    WEAPONS['knife'] = [blade, handle]

def show_weapon(kind, flash=False):
    for k in ('pistol', 'knife'):
        for p in WEAPONS[k]:
            p.hide_render = k != kind
    for p in WEAPONS['flash']:
        p.hide_render = not flash

# ---------------------------------------------------------------- позы

def reset_pose(arm):
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)

def rot(arm, bone, x=0, y=0, z=0):
    pb = arm.pose.bones[bone]
    pb.rotation_euler = (math.radians(x), math.radians(y), math.radians(z))

def base_pose(arm, k=1.0):
    """Из A-позы — руки вдоль тела."""
    rot(arm, 'uarm_R', 0, 0, -ARM_DOWN * k); rot(arm, 'uarm_L', 0, 0, ARM_DOWN * k)
    rot(arm, 'farm_R', -8, 0, 0); rot(arm, 'farm_L', -8, 0, 0)

def pose(arm, anim, t, weapon):
    """t ∈ [0,1). Знаки осей откалиброваны пробным рендером (см. --preview)."""
    reset_pose(arm)
    s = math.sin(2 * math.pi * t); c = math.cos(2 * math.pi * t)
    hips = arm.pose.bones['hips']
    base_pose(arm)
    if weapon == 'pistol':
        rot(arm, 'farm_R', -30, 0, 0); rot(arm, 'hand_R', 10, 0, 0)
    if anim == 'idle':
        return
    if anim in ('walk', 'run'):
        run = anim == 'run'
        A = 36 if run else 24
        rot(arm, 'thigh_R', A * s - (10 if run else 2), 0, 0)
        rot(arm, 'thigh_L', -A * s - (10 if run else 2), 0, 0)
        kr = max(0, -s) * (70 if run else 40) + (15 if run else 5)
        kl = max(0, s) * (70 if run else 40) + (15 if run else 5)
        rot(arm, 'shin_R', kr, 0, 0); rot(arm, 'shin_L', kl, 0, 0)
        rot(arm, 'foot_R', -kr * 0.25, 0, 0); rot(arm, 'foot_L', -kl * 0.25, 0, 0)
        armA = 40 if run else 18
        ar = -armA * s; al = armA * s
        if weapon == 'pistol':
            ar *= 0.4
        rot(arm, 'uarm_R', ar, 0, -ARM_DOWN + (8 if run else 0)); rot(arm, 'uarm_L', al, 0, ARM_DOWN - (8 if run else 0))
        rot(arm, 'farm_R', -(75 if run else (30 if weapon == 'pistol' else 15)), 0, 0)
        rot(arm, 'farm_L', -(75 if run else 15), 0, 0)
        rot(arm, 'spine', -(12 if run else 3), 6 * s, 0)
        rot(arm, 'chest', 0, -8 * s if run else -4 * s, 0)
        hips.location = (0, 0, (0.03 if run else 0.015) * abs(c) - (0.04 if run else 0.01))
        hips.rotation_euler = (0, math.radians(5 * s), 0)
        return
    if anim == 'attack':
        k = math.sin(min(1, t * 1.6) * math.pi / 2) if t < 0.8 else (1 - (t - 0.8) / 0.2)
        if weapon == 'pistol':
            # Прицел: рука вперёд, кисть выпрямлена, левая поддерживает.
            rec = 12 if 0.33 <= t < 0.5 else 0
            rot(arm, 'uarm_R', -62 * k - rec * k, 0, -ARM_DOWN + 20 * k)
            rot(arm, 'farm_R', -10 * k - 20 * (1 - k), 0, 0)
            rot(arm, 'hand_R', 55 * k + 10 * (1 - k), 0, 0)
            rot(arm, 'uarm_L', -55 * k, 0, ARM_DOWN - 38 * k)
            rot(arm, 'farm_L', -40 * k, 0, 0)
            rot(arm, 'chest', 0, 0, 12 * k)
            rot(arm, 'head', 0, 0, -6 * k)
        else:
            # Удар/взмах ножом: замах назад, затем выпад вперёд.
            wind = math.sin(min(1, t / 0.35) * math.pi / 2)
            strike = max(0.0, min(1.0, (t - 0.35) / 0.25))
            back = 1 - max(0.0, min(1.0, (t - 0.75) / 0.25))
            ang = (40 * wind - 120 * strike) * back
            rot(arm, 'uarm_R', ang, 0, -ARM_DOWN + 15 * strike * back)
            rot(arm, 'farm_R', -60 * wind * (1 - strike) - 10, 0, 0)
            rot(arm, 'chest', 0, 0, (-15 * wind + 30 * strike) * back)
            rot(arm, 'thigh_L', -20 * strike * back, 0, 0)
            rot(arm, 'shin_L', 15 * strike * back, 0, 0)
        return
    if anim == 'hit':
        k = math.sin(t * math.pi)
        rot(arm, 'spine', 14 * k, 0, 0); rot(arm, 'chest', 10 * k, 0, 0); rot(arm, 'head', 18 * k, 0, 0)
        rot(arm, 'uarm_R', 20 * k, 0, -ARM_DOWN - 15 * k); rot(arm, 'uarm_L', 20 * k, 0, ARM_DOWN + 15 * k)
        hips.location = (0, 0.03 * k, 0)
        return
    if anim == 'death':
        k = min(1.0, t * 1.15)
        e = k * k * (3 - 2 * k)
        root = arm.pose.bones['root']
        # Колени подгибаются, тело падает назад.
        rot(arm, 'thigh_R', -35 * math.sin(k * math.pi) - 5 * e, 0, 0)
        rot(arm, 'thigh_L', -25 * math.sin(k * math.pi) - 15 * e, 0, 0)
        rot(arm, 'shin_R', 60 * math.sin(k * math.pi) + 5 * e, 0, 0)
        rot(arm, 'shin_L', 50 * math.sin(k * math.pi) + 25 * e, 0, 0)
        root.rotation_euler = (math.radians(86 * e), 0, 0)
        root.location = (0, 0.06 * e, -0.02 + 0.13 * e)
        rot(arm, 'uarm_R', -40 * math.sin(k * math.pi) - 20 * e, 0, -ARM_DOWN - 50 * e)
        rot(arm, 'uarm_L', -30 * math.sin(k * math.pi) - 10 * e, 0, ARM_DOWN + 60 * e)
        rot(arm, 'farm_R', -30 * e, 0, 0); rot(arm, 'farm_L', -50 * e, 0, 0)
        rot(arm, 'head', 25 * e, 15 * e, 0)
        return

ANIMS = {  # кадров
    'idle': 1, 'walk': 8, 'run': 8, 'attack': 6, 'hit': 4, 'death': 10,
}
SET_ANIMS = {
    'none': ['idle', 'walk', 'run', 'attack', 'hit', 'death'],
    'pistol': ['idle', 'walk', 'run', 'attack'],
    'knife': ['idle', 'walk', 'run', 'attack'],
}

# ---------------------------------------------------------------- направления и рендер

def hex_dir_angles():
    """Мировые углы шести направлений гексов (как Rig.faceTo в игре: atan2(dx, dz))."""
    yaw = math.pi / 4
    out = []
    for q, r in ((1, -1), (1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1)):
        u = 1.5 * q; v = math.sqrt(3) * (r + q / 2)
        x = u * math.cos(yaw) + v * math.sin(yaw)
        z = -u * math.sin(yaw) + v * math.cos(yaw)
        out.append(math.atan2(x, z))
    return out

def setup_render():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.max_bounces = 4
    sc.render.film_transparent = True
    sc.render.resolution_x = FRAME_W; sc.render.resolution_y = FRAME_H
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'Medium High Contrast'
    sc.view_settings.exposure = -0.15
    # Камера игры: из three.js (x, y, z) в Blender (x, −z, y).
    pitch = math.pi / 6; yaw = math.pi / 4
    d3 = Vector((math.sin(yaw) * math.cos(pitch), math.sin(pitch), math.cos(yaw) * math.cos(pitch)))
    db = Vector((d3.x, -d3.z, d3.y))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = FRAME_W / PPU
    cam.data.shift_y = (FEET_PX[1] - FRAME_H / 2) / FRAME_W
    cam.data.shift_x = -(FEET_PX[0] - FRAME_W / 2) / FRAME_W
    cam.location = db * 30
    cam.rotation_euler = (-db).to_track_quat('-Z', 'Y').to_euler()
    cam.data.clip_end = 100
    sc.camera = cam
    # Солнце игры: из точки (−22, 40, 6) относительно цели.
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sc.collection.objects.link(sun)
    sd3 = Vector((22, -40, -6)).normalized()
    sdb = Vector((sd3.x, -sd3.z, sd3.y))
    sun.rotation_euler = sdb.to_track_quat('-Z', 'Y').to_euler()
    sun.data.energy = 4.2; sun.data.angle = math.radians(3); sun.data.color = (1.0, 0.92, 0.80)
    world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.55, 0.52, 0.48, 1); bg.inputs['Strength'].default_value = 0.9
    # Пол-ловушка для тени.
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    floor = bpy.context.active_object; floor.name = 'shadow'
    floor.is_shadow_catcher = True
    return cam

def build():
    clean_scene()
    body, eyes = prep_body()
    set_mat(body, principled('skin', C['skin'], rough=0.55, sss=0.15, bump=0.05, bump_scale=600))
    for e in eyes:
        set_mat(e, principled('eye', (0.05, 0.04, 0.035), rough=0.1))
    arm = build_armature()
    skin(arm, [body])
    for e in eyes:
        parent_to_bone(e, arm, 'head')
    make_outfit(body, arm)
    make_gear(body, arm)
    make_weapons(arm)
    k = C['height'] / J['H']
    arm.scale = (k, k, k)
    return arm

def render_all(arm):
    cam = setup_render()
    sc = bpy.context.scene
    os.makedirs(OUT, exist_ok=True)
    dirs = hex_dir_angles()
    meta = {'char': CHAR, 'ppu': PPU, 'frame': [FRAME_W, FRAME_H], 'feet': list(FEET_PX), 'dirs': dirs,
            'height': C['height'], 'anims': {}}
    jobs = []
    for wset in SETS:
        for anim in SET_ANIMS[wset]:
            n = ANIMS[anim]
            meta['anims'][f'{wset}/{anim}'] = n
            for di in range(6):
                for f in range(n):
                    jobs.append((wset, anim, di, f, n))
    if arg('--only'):
        only = set(arg('--only').split(','))
        jobs = [j for j in jobs if f'{j[0]}_{j[1]}_{j[2]}_{j[3]}' in only]
    elif PREVIEW:
        jobs = [j for j in jobs if j[2] in (1, 4) and (j[3] == 0 or j[1] in ('attack', 'death') and j[3] in (2, j[4] - 1) or j[1] == 'walk' and j[3] == 2)]
    for i, (wset, anim, di, f, n) in enumerate(jobs):
        arm.rotation_euler = (0, 0, dirs[di])
        show_weapon(wset if wset != 'none' else None, flash=(wset == 'pistol' and anim == 'attack' and f == 2))
        pose(arm, anim, f / n if anim not in ('attack', 'hit', 'death') else f / max(1, n - 1), wset)
        bpy.context.view_layer.update()
        sc.render.filepath = os.path.join(OUT, f'{wset}_{anim}_{di}_{f}.png')
        bpy.ops.render.render(write_still=True)
        print(f'[{i + 1}/{len(jobs)}] {wset} {anim} d{di} f{f}', flush=True)
    with open(os.path.join(OUT, 'meta.json'), 'w') as fh:
        json.dump(meta, fh, indent=1)
    if arg('--save'):
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f'{CHAR}.blend'))

arm = build()
render_all(arm)
