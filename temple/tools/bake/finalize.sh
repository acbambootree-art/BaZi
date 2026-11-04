#!/bin/zsh
# Turn a Blender bake output folder into the web assets in temple/assets/baked/.
#   finalize.sh <bake-out-dir>
set -e
D=${1:A}
HERE=${0:A:h}
OUT=$HERE/../../assets/baked
mkdir -p $OUT
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P $HERE/lm2png.py -- 4 $D/lm_hall.exr $D/lm_out.exr 2>&1 | grep max
python3 -c "
from PIL import Image, ImageFilter
for n in ['hall', 'out']:
    Image.open('$D/lm_' + n + '.png').convert('RGB').filter(ImageFilter.GaussianBlur(1.2)).save('$OUT/lm_' + n + '.webp', 'WEBP', quality=88)
"
# keep objects separate (each carries its lightmap name) and keep the second UV set
npx -y @gltf-transform/cli@4.1.1 optimize $D/static_baked.glb $OUT/static.glb --compress meshopt \
  --texture-compress webp --texture-size 1024 --simplify false --join false --flatten false \
  --instance false --palette false --prune-attributes false 2>&1 | grep "→"
# geometry fingerprint written by __temple.exportBake(): the site refuses a bake that no longer matches
[ -f $D/../stamp.json ] && cp $D/../stamp.json $OUT/stamp.json
ls -la $OUT
