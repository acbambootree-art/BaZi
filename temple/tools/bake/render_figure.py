# Render the scanned statue as a small gilded figurine (transparent PNG) for the 光明燈 lamp niches.
#   blender -b --factory-startup -P render_figure.py -- <statue.glb> <out.png>
import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)

gold = bpy.data.materials.new('gilt'); gold.use_nodes = True
b = gold.node_tree.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (0.95, 0.66, 0.26, 1)
b.inputs['Metallic'].default_value = 1.0
b.inputs['Roughness'].default_value = 0.32
meshes = [o for o in sc.objects if o.type == 'MESH']
for o in meshes:
    o.data.materials.clear(); o.data.materials.append(gold)

pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
H = hi.z - lo.z; c = (lo + hi) / 2

sc.render.engine = 'CYCLES'; sc.cycles.samples = 96; sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x, sc.render.resolution_y = 256, 320
sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (1.0, 0.75, 0.45, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
def area(name, loc, energy, color, size):
    l = bpy.data.objects.new(name, bpy.data.lights.new(name, 'AREA')); sc.collection.objects.link(l)
    l.data.energy = energy; l.data.color = color; l.data.size = size; l.location = loc
    d = (c - Vector(loc)).normalized(); l.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
area('key', (c.x + H * 0.6, c.y - H * 1.4, c.z + H * 0.6), 400 * H * H, (1, 0.8, 0.55), H)
area('fill', (c.x - H, c.y - H, c.z), 120 * H * H, (1, 0.6, 0.35), H)
area('rim', (c.x, c.y + H, c.z + H * 0.8), 250 * H * H, (1, 0.9, 0.7), H * 0.6)

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = H * 1.28
cam.location = (c.x, c.y - 50, c.z + H * 0.02); cam.rotation_euler = (math.radians(90), 0, 0)
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('figure done', flush=True)
