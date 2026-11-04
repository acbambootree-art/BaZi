# Render each tree variant (one per top-level node) to a transparent PNG for billboard trees.
#   blender -b --factory-startup -P render_trees.py -- <out_dir> <tree.gltf> [more.gltf ...]
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
OUT, files = argv[0], argv[1:]
os.makedirs(OUT, exist_ok=True)

for path in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=path)
    roots = [o for o in sc.objects if o.parent is None and o.type in ('MESH', 'EMPTY')]
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    # soft overcast light, like the misty forest sky
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.85, 0.9, 0.95, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.3
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = 2.5; sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; sc.camera = cam
    name = os.path.splitext(os.path.basename(path))[0]
    for i, r in enumerate(roots):
        for o in roots: o.hide_render = o is not r
        objs = [r] + list(r.children_recursive)
        pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
        if not pts: continue
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        size = hi - lo; cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
        H = size.z; Wd = max(size.x, size.y)
        sc.render.resolution_x = 512; sc.render.resolution_y = int(512 * H / Wd) // 8 * 8 if H > Wd else 512
        cam.data.ortho_scale = max(H, Wd) * 1.02
        cam.location = (cx, cy - 100, lo.z + H / 2); cam.rotation_euler = (math.radians(90), 0, 0)
        sc.render.filepath = os.path.join(OUT, f'{name}_{i}.png')
        bpy.ops.render.render(write_still=True)
        with open(os.path.join(OUT, f'{name}_{i}.txt'), 'w') as f: f.write(f'{H:.3f} {Wd:.3f}\n')
        print('rendered', name, i, 'height', round(H, 2), flush=True)
