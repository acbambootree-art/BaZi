# Blender light bake for 歇腳廟.
#   blender -b --factory-startup -P bake.py -- <static.glb> <outdir> <sky.hdr> <samples> <res>
# Bakes light-only (direct + indirect diffuse, no albedo) lightmaps for every object tagged role=bake,
# into two atlases ("hall" = inside the main hall, "out" = everything else), then exports those
# objects with a second UV set (LM) and an extras tag saying which atlas they use.
# Set BAKE_CPU=1 to skip the GPU (Metal needs to run outside a sandbox to cache its shaders).
import bpy, sys, math, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT, HDR = argv[0], argv[1], argv[2]
SAMPLES, RES = int(argv[3]), int(argv[4])
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
scene = bpy.context.scene

def three_to_blender(x, y, z):
    return Vector((x, -z, y))

# ---------- render settings ----------
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    if os.environ.get('BAKE_CPU'): raise RuntimeError('CPU requested')
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices: d.use = True
    scene.cycles.device = 'GPU'
except Exception as e:
    print('GPU unavailable, using CPU:', e)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 4

# ---------- world: the same sunset HDRI the site uses ----------
world = bpy.data.worlds.new('sky'); scene.world = world
world.use_nodes = True
nt = world.node_tree; nt.nodes.clear()
env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(HDR)
bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = 1.0
out = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(env.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

# ---------- lights matching scene.js ----------
def add_light(kind, name, pos, energy, color, size=0.3):
    data = bpy.data.lights.new(name, kind); data.energy = energy; data.color = color
    if kind == 'POINT': data.shadow_soft_size = size
    obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj)
    obj.location = pos
    return obj
sun = add_light('SUN', 'sun', three_to_blender(-35, 45, 30), 2.4, (1.0, 0.94, 0.86))
sun.data.angle = math.radians(3)
d = -sun.location.normalized(); sun.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
F = 1.2
for name, p, e, c in [
    ('altar', (0, F + 11, -25), 2400, (1.0, 0.7, 0.4)),
    ('dome', (0, F + 13.5, -17), 2200, (1.0, 0.8, 0.55)),
    ('sideL', (-9, F + 8, -15), 1300, (1.0, 0.62, 0.35)),
    ('sideR', (9, F + 8, -15), 1300, (1.0, 0.62, 0.35)),
    ('porch', (0, 10, -3), 1300, (1.0, 0.5, 0.3)),
    ('burner', (0, 3.5, 8), 250, (1.0, 0.55, 0.25)),
]:
    add_light('POINT', name, three_to_blender(*p), e, c, 0.6)

# ---------- roles ----------
targets, emitters = [], []
for o in scene.objects:
    if o.type != 'MESH': continue
    role = o.get('role') or (o.parent.get('role') if o.parent else None)
    if role == 'bake': targets.append(o)
    elif role == 'emit': emitters.append(o)
print('targets', len(targets), 'emitters', len(emitters))

# emitters really emit in the bake (unlit glTF materials don't light anything by default)
for o in emitters:
    for slot in o.material_slots:
        m = slot.material
        if not m or not m.node_tree: continue
        nodes, links = m.node_tree.nodes, m.node_tree.links
        bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
        outn = next((n for n in nodes if n.type == 'OUTPUT_MATERIAL'), None)
        if bsdf:
            col_link = bsdf.inputs['Base Color'].links
            bsdf.inputs['Emission Strength'].default_value = 6.0
            if col_link: links.new(col_link[0].from_socket, bsdf.inputs['Emission Color'])
            else: bsdf.inputs['Emission Color'].default_value = bsdf.inputs['Base Color'].default_value
        else:
            em = nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 6.0
            img = next((n for n in nodes if n.type == 'TEX_IMAGE'), None)
            if img: links.new(img.outputs['Color'], em.inputs['Color'])
            if outn: links.new(em.outputs['Emission'], outn.inputs['Surface'])

# ---------- split targets into hall / outside ----------
def center(o):
    return sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector()) / 8
groups = {'hall': [], 'out': []}
for o in targets:
    c = center(o)   # blender y = -three z
    inside = (-c.y) < -6.8 and abs(c.x) < 16.6 and c.z < 13.0
    groups['hall' if inside else 'out'].append(o)
    o['lm'] = 'hall' if inside else 'out'
print({k: len(v) for k, v in groups.items()})

# every target gets its own material copy so each atlas can be the active bake image
for o in targets:
    for slot in o.material_slots:
        if slot.material: slot.material = slot.material.copy()

def select_only(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

for gname, objs in groups.items():
    if not objs: continue
    for o in objs:
        me = o.data
        if 'LM' not in me.uv_layers: me.uv_layers.new(name='LM')
        me.uv_layers.active = me.uv_layers['LM']
    select_only(objs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.dissolve_degenerate(threshold=0.0005); bpy.ops.mesh.delete_loose(); bpy.ops.mesh.select_all(action='SELECT')
    # one shared atlas for the group, sized by surface area (works headless, unlike pack_islands)
    bpy.ops.uv.lightmap_pack(PREF_CONTEXT='ALL_FACES', PREF_PACK_IN_ONE=True, PREF_NEW_UVLAYER=False, PREF_BOX_DIV=12, PREF_MARGIN_DIV=0.15)
    bpy.ops.object.mode_set(mode='OBJECT')

    res = RES * 2 if gname == 'hall' else RES          # the hall is seen up close: twice the lightmap detail
    img = bpy.data.images.new('LM_' + gname, res, res, float_buffer=True)
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            if not m: continue
            m.use_nodes = True
            n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = img; n.name = 'LM_BAKE'
            uvn = m.node_tree.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'LM'
            m.node_tree.links.new(uvn.outputs['UV'], n.inputs['Vector'])
            m.node_tree.nodes.active = n
    select_only(objs)
    print('baking', gname, flush=True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=6, use_clear=True)
    img.filepath_raw = os.path.join(OUT, f'lm_{gname}.exr'); img.file_format = 'OPEN_EXR'; img.save()
    print('saved', img.filepath_raw, flush=True)
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            if not m: continue
            for nn in [x for x in m.node_tree.nodes if x.name.startswith('LM_BAKE') or (x.type == 'UVMAP' and x.uv_map == 'LM')]:
                m.node_tree.nodes.remove(nn)

select_only(targets)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'static_baked.glb'), use_selection=True, export_extras=True,
                          export_texcoords=True, export_normals=True, export_lights=False, export_cameras=False)
print('done', flush=True)
