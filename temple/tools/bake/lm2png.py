# Convert baked float lightmaps (EXR) to 8-bit sRGB PNG storing value/SCALE (the site multiplies back).
#   blender -b --factory-startup -P lm2png.py -- <scale> <a.exr> [b.exr ...]
import bpy, sys, os, numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
SCALE = float(argv[0])
for src in argv[1:]:
    img = bpy.data.images.load(src)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    rgb = np.clip(px[..., :3] / SCALE, 0, 1)
    srgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(rgb, 1 / 2.4) - 0.055)
    out = np.concatenate([srgb, np.ones((h, w, 1), np.float32)], axis=2)
    print(os.path.basename(src), 'max', float(px[..., :3].max()), 'p99', float(np.percentile(px[..., :3], 99)))
    o = bpy.data.images.new('o', w, h, alpha=False)
    o.pixels.foreach_set(out.ravel())
    o.filepath_raw = src.replace('.exr', '.png'); o.file_format = 'PNG'; o.save()
