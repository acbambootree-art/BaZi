# Re-baking the temple lighting

Run this whenever the temple's fixed geometry changes. Work files go to `temple/.bake/` (git-ignored).

1. Start the site (`node server/server.js`) and the upload sink:
   `python3 temple/tools/bake/receiver.py temple/.bake`
2. Open `http://localhost:3000/temple.html?nobake`, wait for the statues and props to load, then run
   `await __temple.exportBake()` in the browser console. It writes `temple/.bake/static.glb`.
3. Bake (Blender 5, GPU; about 30–60 min at full quality):
   `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P temple/tools/bake/bake.py -- temple/.bake/static.glb temple/.bake/out temple/assets/sky.hdr 128 2048`
4. Publish: `temple/tools/bake/finalize.sh temple/.bake/out` — writes `temple/assets/baked/`.

The site multiplies lightmaps back by `LM_GAIN` in `temple/main.js` (they are stored as value/4).
