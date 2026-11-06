// Builds the temple world, all procedural (no model files):
//   front plaza → 三川殿 gate → courtyard with 天公爐 → grand main hall (正殿)
//   with a spiral 藻井 dome, gilded deities, lamp walls, kneeling cushions.
// Layout (metres): gate at z≈22, courtyard z 19…-5, hall floor z -7…-35 at y=1.2.
import * as THREE from 'three';

const RED = 0xa8261e, DEEP_RED = 0x7a1712, GOLD = 0xd9a441, DARK_WOOD = 0x3a2219,
  TILE = 0xc9762c, JADE = 0x2f8f74, BLUE = 0x2c4f86;
// the plateau the temple stands on: an irregular oval, its edge dropping away in cliffs (scenery.js)
export const PLATEAU = { x: 0, z: 10, rx: 70, rz: 84 };
export const plateauR = (a) => 1 + 0.07 * Math.sin(3 * a + 1) + 0.05 * Math.sin(7 * a + 2) + 0.03 * Math.sin(13 * a + 0.5);
export const onPlateau = (x, z, k = 1) => { const dx = (x - PLATEAU.x) / PLATEAU.rx, dz = (z - PLATEAU.z) / PLATEAU.rz; return Math.hypot(dx, dz) < plateauR(Math.atan2(dz, dx)) * k; };
// where the old stone paving still lies: under the hall and the gate, the courtyard and the plaza. Beyond these the
// slabs give out into grass along a ragged, mossy edge (the mask is drawn from this, and the grass grows outside it).
const vnoise = (x, z) => {
  const h = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  return (h(i, j) * (1 - sx) + h(i + 1, j) * sx) * (1 - sz) + (h(i, j + 1) * (1 - sx) + h(i + 1, j + 1) * sx) * sz;
};
const PAVED = [[-17.5, 17.5, -33, -6, 1], [-16.5, 16.5, -7, 19.5, 4], [-16, 16, 19, 25.5, 1], [-14.5, 14.5, 24.5, 36.5, 4], [-3.2, 3.2, 35, 39, 0.5]];   // x0 x1 z0 z1 corner
const pavedDist = (x, z) => {                                        // > 0 inside the paving, metres from its (straight) edge
  let best = -99;
  for (const [x0, x1, z0, z1, rc] of PAVED) {
    const dx = Math.max(x0 + rc - x, 0, x - x1 + rc), dz = Math.max(z0 + rc - z, 0, z - z1 + rc);
    const inX = Math.min(x - x0, x1 - x), inZ = Math.min(z - z0, z1 - z);
    best = Math.max(best, dx > 0 || dz > 0 ? rc - Math.hypot(dx, dz) : Math.min(inX, inZ));
  }
  return best;
};
export const pavedAt = (x, z) => pavedDist(x, z) + (vnoise(x * 0.35, z * 0.35) - 0.5) * 3.2 + (vnoise(x * 1.3, z * 1.3) - 0.5) * 1.1 > 0;
export const HALL = { floor: 1.2, front: -6.5, back: -35, halfW: 16, ceil: 23, domeZ: -17 };   // ceil: tall enough for the 21 m Guanyin

export function canvasTex(w, h, draw, repeat, isText = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.userData.text = isText;
  return t;
}

// photographic PBR materials (Poly Haven, CC0) — the main step from "toy" to "real"
THREE.Cache.enabled = true;
const TL = new THREE.TextureLoader();
// one decode and one GPU upload per file: clones share the image but keep their own repeat
const TEXS = new Map();
export function sharedTex(url) {
  let e = TEXS.get(url);
  if (!e) { e = { kids: [] }; e.base = TL.load(url, () => e.kids.forEach((k) => { k.needsUpdate = true; })); TEXS.set(url, e); }
  const t = e.base.clone();
  if (e.base.image) t.needsUpdate = true; else e.kids.push(t);
  return t;
}
function pbr(id, rx, ry, o = {}) {
  const { noDiff, ...rest } = o;
  const load = (m, srgb) => {
    const t = sharedTex(`/temple/assets/tex/${id}_${m}.webp`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return new THREE.MeshStandardMaterial({ map: noDiff ? null : load('diff', true), normalMap: load('nor'), roughnessMap: load('rough'), roughness: 1, ...rest });
}
const LACQUER = (ry = 3) => pbr('lacquered_cherry_wood', 1, ry, { noDiff: true, color: 0x6a2c24, roughness: 0.82 });   // aged cinnabar, not fresh lacquer
const DARK_LACQUER = (ry = 3) => pbr('lacquered_cherry_wood', 1, ry, { noDiff: true, color: 0x33241c, roughness: 0.8 });   // plain dark wood
const BRICK = (rx, ry) => pbr('large_red_bricks', rx, ry, { color: 0xe8a090 });
const PLASTER = (rx, ry) => pbr('red_plaster_weathered', rx, ry, { color: 0xa0806a });   // aged earth plaster
const WOOD = (rx = 2, ry = 1) => pbr('dark_wooden_planks', rx, ry);
const GRANITE = (rx, ry) => pbr('granite_tile_02', rx, ry);
const TILES = (rx, ry) => pbr('clay_roof_tiles_02', rx, ry, { side: THREE.DoubleSide });
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
const GOLD_MAT = () => std(0xd6a548, { metalness: 0.85, roughness: 0.28 });
// deity seat (神座): red lacquer with gilded carving — key-fret friezes, framed panels, cloud scrolls, a lotus.
// Drawn twice from one routine: once in colour, once as a gold-only mask that becomes the metalness map.
const THRONE_MAT = (() => {
  let mat;
  const draw = (c, w, h, k) => {
    const gold = k.gold, line = (x, y, x2, y2) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); };
    c.fillStyle = k.bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = c.fillStyle = gold;
    c.lineWidth = 12; c.strokeRect(6, 6, w - 12, h - 12);
    c.lineWidth = 3; c.strokeRect(22, 22, w - 44, h - 44);
    // 回紋 key-fret friezes top and bottom
    c.lineWidth = 5;
    for (const y0 of [30, h - 66]) for (let x = 34; x < w - 60; x += 40) {
      const u = 30; c.beginPath();
      c.moveTo(x, y0 + u); c.lineTo(x, y0); c.lineTo(x + u, y0); c.lineTo(x + u, y0 + u * 0.75); c.lineTo(x + u * 0.3, y0 + u * 0.75); c.lineTo(x + u * 0.3, y0 + u * 0.35); c.lineTo(x + u * 0.65, y0 + u * 0.35);
      c.stroke(); line(x, y0 + u, x + 40, y0 + u);
    }
    // three recessed panels
    const py = 80, ph = h - 160, pw = (w - 120) / 3;
    for (let i = 0; i < 3; i++) {
      const px = 40 + i * (pw + 20);
      c.fillStyle = k.panel; c.fillRect(px, py, pw, ph);
      c.strokeStyle = gold; c.lineWidth = 6; c.strokeRect(px + 6, py + 6, pw - 12, ph - 12);
      c.lineWidth = 2; c.strokeRect(px + 16, py + 16, pw - 32, ph - 32);
      const cx = px + pw / 2, cy = py + ph / 2;
      c.fillStyle = gold;
      if (i === 1) {                                   // lotus
        for (let j = -3; j <= 3; j++) {
          c.save(); c.translate(cx, cy + 34); c.rotate(j * 0.36);
          c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-26, -40, 0, -78 + Math.abs(j) * 8); c.quadraticCurveTo(26, -40, 0, 0); c.fill(); c.restore();
        }
        c.fillRect(cx - 70, cy + 34, 140, 6);
      } else {                                         // 祥雲 cloud scrolls
        c.lineWidth = 6;
        for (const [ox, oy, r, d] of [[-60, 6, 22, 1], [0, -14, 30, -1], [60, 6, 22, 1], [-28, 30, 16, -1], [30, 30, 16, 1]]) {
          c.beginPath(); c.arc(cx + ox, cy + oy, r, 0, Math.PI * 1.6 * d, d < 0); c.stroke();
          c.beginPath(); c.arc(cx + ox, cy + oy, r * 0.45, Math.PI, Math.PI * 2.6); c.stroke();
        }
        line(cx - 92, cy + 50, cx + 92, cy + 50);
      }
    }
  };
  return () => mat || (mat = (() => {
    const map = canvasTex(1024, 330, (c, w, h) => draw(c, w, h, { bg: '#5e0c09', panel: '#7a140f', gold: '#e8b850' }));
    const metal = canvasTex(1024, 330, (c, w, h) => draw(c, w, h, { bg: '#000', panel: '#000', gold: '#666' }));
    metal.colorSpace = THREE.NoColorSpace;
    return new THREE.MeshStandardMaterial({ map, metalnessMap: metal, metalness: 1, roughness: 0.33 });
  })());
})();

function mesh(geo, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.receive ?? true;
  return m;
}
const SERIF = '"TempleKai", "LXGW WenKai TC", "Noto Serif TC", serif';   // 王漢宗顏楷: Yan-style regular script, like real temple plaques

// ---------- textures ----------
const stoneTex = (rep = [14, 14]) => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#8d8880'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) {
    const v = 120 + Math.random() * 40 | 0;
    g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.25)`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.strokeStyle = 'rgba(40,36,30,0.55)'; g.lineWidth = 3;
  for (let r = 0; r < 4; r++) {
    const y = r * h / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    const off = r % 2 ? w / 4 : 0;
    for (let c = 0; c < 3; c++) { const x = off + c * w / 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h / 4); g.stroke(); }
  }
}, rep);

const floorTex = () => canvasTex(512, 512, (g, w, h) => {
  // polished dark-red temple tiles
  g.fillStyle = '#5b2a20'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const v = Math.random() * 18 | 0;
    g.fillStyle = `rgb(${110 + v},${52 + v / 2},${40 + v / 3})`;
    g.fillRect(c * 128 + 3, r * 128 + 3, 122, 122);
  }
}, [16, 16]);

const roofTex = (rep = [10, 3]) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b8641f'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) {
    const grd = g.createLinearGradient(x, 0, x + 16, 0);
    grd.addColorStop(0, '#8e4512'); grd.addColorStop(0.5, '#e39a45'); grd.addColorStop(1, '#8e4512');
    g.fillStyle = grd; g.fillRect(x, 0, 16, h);
  }
  g.fillStyle = 'rgba(60,25,5,0.35)';
  for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 3);
}, rep);

// lantern silk: a colour, gold bands top and bottom, and the blessing written on it (repeated round the lantern)
const lanternTexes = new Map();
const lanternTex = (text = '平安', bg = '#d42a1c', ribs = 0, faces = 2) => {
  const key = [text, bg, ribs, faces].join('|');
  if (!lanternTexes.has(key)) lanternTexes.set(key, canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, 'rgba(0,0,0,.18)'); sh.addColorStop(0.5, 'rgba(255,220,160,.12)'); sh.addColorStop(1, 'rgba(0,0,0,.22)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);                          // the light inside shows brightest at the waist
    g.fillStyle = '#f2c14e'; g.fillRect(0, 0, w, 16); g.fillRect(0, h - 16, w, 16);
    g.fillStyle = 'rgba(242,193,78,.55)'; for (let i = 0; i < ribs; i++) g.fillRect((i / ribs) * w, 0, 3, h);
    g.fillStyle = '#2a0d08'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const chars = [...text], fs = chars.length > 1 ? 70 : 118;
    g.font = `${fs}px ${SERIF}`;
    for (let f = 0; f < faces; f++) {
      const x = ((f + 0.5) / faces) * w;
      chars.forEach((c, i) => g.fillText(c, x, h * (chars.length > 1 ? 0.36 + i * 0.3 : 0.52)));
    }
  }));
  return lanternTexes.get(key);
};
// five kinds, so no two neighbours match: round, drum (鼓燈), tall oval, six-sided palace lantern (宮燈)
const LANTERN_STYLES = [
  { shape: 'round', text: '平安', bg: '#d42a1c' },
  { shape: 'drum', text: '福', bg: '#c8241a', ribs: 16 },
  { shape: 'oval', text: '吉祥', bg: '#e07018' },
  { shape: 'palace', text: '如意', bg: '#b81e18' },
  { shape: 'round', text: '光明', bg: '#d8501c' },
];

export function plaqueTex(text, vertical = false) {
  const [W, H] = vertical ? [300, 1024] : [1024, 300];
  return canvasTex(W, H, (g, w, h) => {
    g.fillStyle = '#c9952f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#122a4a'; g.fillRect(22, 22, w - 44, h - 44);
    g.strokeStyle = '#f0c75e'; g.lineWidth = 6; g.strokeRect(40, 40, w - 80, h - 80);
    g.fillStyle = '#f3cf6a'; g.font = `170px ${SERIF}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(80,50,10,0.6)'; g.shadowBlur = 6; g.shadowOffsetY = 3;     // gilded carved letters
    if (vertical) [...text].forEach((ch, i, a) => g.fillText(ch, w / 2, h / 2 + (i - (a.length - 1) / 2) * 210));
    else g.fillText(text, w / 2, h / 2 + 8);
  }, null, true);
}

const beamTex = () => canvasTex(1024, 64, (c, w, h) => {
  c.fillStyle = '#1f3d6b'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 128) {
    c.fillStyle = '#2f8f74'; c.fillRect(x + 8, 8, 52, h - 16);
    c.fillStyle = '#d9a441'; c.fillRect(x + 66, 14, 54, h - 28);
    c.fillStyle = '#a8261e'; c.beginPath(); c.arc(x + 93, h / 2, 12, 0, 7); c.fill();
  }
});

// gold brackets stacked on red: used for the 藻井 rings
const bracketTex = canvasTex(512, 64, (c, w, h) => {
  c.fillStyle = '#7a1712'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) {
    c.fillStyle = '#e0b04f'; c.fillRect(x + 4, 6, 24, 30);
    c.fillStyle = '#9a6a1f'; c.fillRect(x + 4, 30, 24, 6);
  }
  c.fillStyle = '#2f8f74'; c.fillRect(0, 44, w, 10);
  c.fillStyle = '#e0b04f'; c.fillRect(0, 56, w, 8);
});

// painted coffers (天花): 2×2 per tile. Mineral pigments — malachite, azurite, cinnabar, gold — with a lotus or a
// cloud roundel in each square, gold swallow-tail corners, and a dark green border the raised ribs sit on.
const cofferTex = () => canvasTex(1024, 1024, (c, w) => {
  const S = w / 2, GOLD = '#d7a84a', GREEN = '#2e6b5a', BLUE = '#2b4a7a', RED = '#a5321f', CREAM = '#efe1bf';
  const lotus = (x, y, R) => {
    for (const [n, rr, col, rot] of [[16, R, '#c9933a', 0], [8, R * 0.78, RED, Math.PI / 8], [8, R * 0.55, '#e8b85a', 0]]) {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rot;
        c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col;
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(rr * 0.42, rr * 0.45, 0, rr); c.quadraticCurveTo(-rr * 0.42, rr * 0.45, 0, 0); c.fill();
        c.strokeStyle = 'rgba(60,30,10,.35)'; c.lineWidth = 2; c.stroke(); c.restore();
      }
    }
    c.fillStyle = GOLD; c.beginPath(); c.arc(x, y, R * 0.2, 0, 7); c.fill();
    c.fillStyle = '#7a3a12'; for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; c.beginPath(); c.arc(x + Math.cos(a) * R * 0.11, y + Math.sin(a) * R * 0.11, 3, 0, 7); c.fill(); }
  };
  const clouds = (x, y, R) => {
    c.fillStyle = RED; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
    c.strokeStyle = GOLD; c.lineWidth = 5; c.beginPath(); c.arc(x, y, R - 6, 0, 7); c.stroke();
    c.lineWidth = 6;
    for (let k = 0; k < 4; k++) {                                     // four curling cloud scrolls round a pearl
      c.save(); c.translate(x, y); c.rotate(k * Math.PI / 2);
      c.beginPath(); for (let t = 0; t < 9; t += 0.2) { const rr = R * 0.62 - t * 4.2; c.lineTo(R * 0.28 + Math.cos(t) * rr * 0.32, Math.sin(t) * rr * 0.32); } c.stroke();
      c.restore();
    }
    c.fillStyle = CREAM; c.beginPath(); c.arc(x, y, R * 0.16, 0, 7); c.fill();
  };
  for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) {
    const x = k * S, y = r * S, cx = x + S / 2, cy = y + S / 2;
    c.fillStyle = '#1f4a3e'; c.fillRect(x, y, S, S);                   // border (under the ribs)
    c.fillStyle = GOLD; c.fillRect(x + 22, y + 22, S - 44, S - 44);
    c.fillStyle = (r + k) % 2 ? BLUE : GREEN; c.fillRect(x + 30, y + 30, S - 60, S - 60);
    c.fillStyle = (r + k) % 2 ? '#3d6496' : '#3f8270'; c.fillRect(x + 70, y + 70, S - 140, S - 140);
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {   // swallow-tail corners (燕尾)
      c.fillStyle = GOLD; c.beginPath();
      const ox = cx + sx * (S / 2 - 30), oy = cy + sy * (S / 2 - 30);
      c.moveTo(ox, oy); c.lineTo(ox - sx * 92, oy); c.lineTo(ox - sx * 60, oy - sy * 22); c.lineTo(ox - sx * 22, oy - sy * 60); c.lineTo(ox, oy - sy * 92); c.closePath(); c.fill();
      c.fillStyle = RED; c.beginPath(); c.arc(ox - sx * 30, oy - sy * 30, 11, 0, 7); c.fill();
    }
    c.strokeStyle = 'rgba(239,225,191,.55)'; c.lineWidth = 3; c.strokeRect(x + 84, y + 84, S - 168, S - 168);
    if ((r + k) % 2) clouds(cx, cy, S * 0.25); else lotus(cx, cy, S * 0.27);
  }
}, [8 / 2.4, 8 / 2.4]);

// ink landscape murals for the hall walls
const muralTex = (seed) => canvasTex(1024, 512, (c, w, h) => {
  c.fillStyle = '#e9dcc0'; c.fillRect(0, 0, w, h);
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let layer = 0; layer < 3; layer++) {
    c.fillStyle = ['rgba(90,100,95,0.35)', 'rgba(60,70,65,0.5)', 'rgba(35,40,38,0.7)'][layer];
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) c.lineTo(x, h * (0.45 + layer * 0.12) - Math.abs(Math.sin(x / (80 + rnd() * 6) + layer * 2 + seed)) * (120 - layer * 20) * (0.6 + rnd() * 0.4));
    c.lineTo(w, h); c.fill();
  }
  c.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(rnd() * w, h * 0.3 + rnd() * h * 0.3, 18 + rnd() * 30, 0, 7); c.fill(); }
  c.fillStyle = '#b8231a'; c.beginPath(); c.arc(w * 0.8, h * 0.18, 34, 0, 7); c.fill();
  c.strokeStyle = '#c9952f'; c.lineWidth = 18; c.strokeRect(9, 9, w - 18, h - 18);
});

// ---------- roof ----------
// One curved slope: concave profile + upturned corners — the Minnan silhouette.
function roofSlope({ halfW, zEave, zRidge, yEave, yRidge, lift = 0.9, mat }) {
  const geo = new THREE.PlaneGeometry(1, 1, 40, 12);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, v = p.getY(i) + 0.5;
    p.setXYZ(i,
      u * halfW * (1 + 0.05 * (1 - v)),
      yEave + (yRidge - yEave) * Math.pow(v, 1.6) + lift * Math.pow(Math.abs(u), 6) * (1 - v),
      zEave + (zRidge - zEave) * v);
  }
  geo.computeVertexNormals();
  return mesh(geo, mat);
}

function roof({ halfW, zFront, zBack, yEave, yRidge, lift, mat, gableMat }) {
  const g = new THREE.Group();
  const zMid = (zFront + zBack) / 2;
  g.add(roofSlope({ halfW, zEave: zFront, zRidge: zMid, yEave, yRidge, lift, mat }));
  g.add(roofSlope({ halfW, zEave: zBack, zRidge: zMid, yEave, yRidge, lift, mat }));
  const s = new THREE.Shape(), half = (zFront - zBack) / 2;
  s.moveTo(-half * 0.92, 0);
  for (let i = 0; i <= 10; i++) { const v = i / 10; s.lineTo(-half * 0.92 * (1 - v), (yRidge - yEave) * Math.pow(v, 1.6)); }
  for (let i = 10; i >= 0; i--) { const v = i / 10; s.lineTo(half * 0.92 * (1 - v), (yRidge - yEave) * Math.pow(v, 1.6)); }
  const gGeo = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false });
  for (const sx of [-1, 1]) {
    const gm = mesh(gGeo, gableMat, sx * halfW * 0.93, yEave - 0.05, zMid);
    gm.rotation.y = Math.PI / 2;
    g.add(gm);
  }
  return g;
}

// Swallowtail ridge (燕尾脊) with two dragons chasing a pearl.
function ridge({ halfW, y, z, s = 1 }) {
  const g = new THREE.Group();
  const ridgeMat = std(0x8a2a1a, { roughness: 0.6 });
  const jade = std(JADE, { roughness: 0.4, metalness: 0.2 });
  const gold = GOLD_MAT();
  g.add(mesh(new THREE.BoxGeometry(halfW * 2 - 1.6 * s, 0.45 * s, 0.45 * s), ridgeMat, 0, y + 0.1 * s, z));
  for (const sx of [-1, 1]) {
    const x0 = sx * (halfW - 0.8 * s);
    for (const sz of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x0, y + 0.1 * s, z),
        new THREE.Vector3(x0 + sx * 0.9 * s, y + 0.35 * s, z + sz * 0.05 * s),
        new THREE.Vector3(x0 + sx * 1.6 * s, y + 1.0 * s, z + sz * 0.22 * s),
        new THREE.Vector3(x0 + sx * 1.85 * s, y + 1.75 * s, z + sz * 0.4 * s),
      ]);
      g.add(mesh(new THREE.TubeGeometry(curve, 20, 0.14 * s, 8), ridgeMat));
    }
  }
  [0.6, 0.45, 0.3].forEach((r, i) => g.add(mesh(new THREE.CylinderGeometry(r * 0.8 * s, r * s, 0.25 * s, 8), gold, 0, y + (0.45 + i * 0.25) * s, z)));
  g.add(mesh(new THREE.SphereGeometry(0.28 * s, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffa640, emissiveIntensity: 0.8 }), 0, y + 1.35 * s, z));
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(new THREE.Vector3(sx * (4.2 - t * 3.2) * s, y + (0.45 + Math.sin(t * Math.PI * 2.2) * 0.35 + t * 0.6) * s, z + Math.cos(t * 7) * 0.12 * s));
    }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.13 * s, 8), jade));
    const head = mesh(new THREE.ConeGeometry(0.2 * s, 0.55 * s, 8), gold);
    head.position.copy(pts[pts.length - 1]); head.rotation.z = sx * Math.PI / 2;
    g.add(head);
    for (let i = 2; i < 13; i += 3) {
      const fin = mesh(new THREE.ConeGeometry(0.07 * s, 0.3 * s, 4), gold);
      fin.position.copy(pts[i]); fin.position.y += 0.17 * s;
      g.add(fin);
    }
  }
  return g;
}

// ---------- small pieces ----------
function lantern(x, y, z, s = 1, style = 0) {
  const st = LANTERN_STYLES[style % LANTERN_STYLES.length], g = new THREE.Group();
  const tex = lanternTex(st.text, st.bg, st.ribs || 0, st.shape === 'palace' ? 3 : 2);
  const silk = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xff6a30, emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.8 });
  const gold = std(GOLD, { metalness: 0.5, roughness: 0.4 }), wood = std(0x3a1e12, { roughness: 0.6 });
  let half = 0.5;
  if (st.shape === 'palace') {                                         // 宮燈: silk panels in a dark wooden frame, a tassel at each corner
    g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.72, 6, 1, true), silk, 0, 0, 0, { cast: false }));
    for (const yy of [0.42, -0.42]) g.add(mesh(new THREE.CylinderGeometry(yy > 0 ? 0.3 : 0.46, yy > 0 ? 0.46 : 0.3, 0.12, 6), wood, 0, yy, 0));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.add(mesh(new THREE.BoxGeometry(0.04, 0.74, 0.04), wood, Math.sin(a) * 0.36, 0, Math.cos(a) * 0.36));
      const ts = mesh(new THREE.ConeGeometry(0.035, 0.28, 6), std(0xd42a1c), Math.sin(a) * 0.46, -0.62, Math.cos(a) * 0.46); ts.rotation.x = Math.PI; g.add(ts);
    }
    half = 0.48;
  } else {
    const body = st.shape === 'drum'
      ? mesh(new THREE.LatheGeometry([[0.3, -0.42], [0.4, -0.25], [0.44, 0], [0.4, 0.25], [0.3, 0.42]].map(([r, yy]) => new THREE.Vector2(r, yy)), 24), silk, 0, 0, 0, { cast: false })
      : mesh(new THREE.SphereGeometry(0.42, 22, 16), silk, 0, 0, 0, { cast: false });
    if (st.shape === 'round') body.scale.set(1, 1.08, 1);
    if (st.shape === 'oval') { body.scale.set(0.78, 1.55, 0.78); half = 0.68; }
    g.add(body);
    const cap = new THREE.CylinderGeometry(0.22, 0.26, 0.1, 12);
    g.add(mesh(cap, gold, 0, half, 0), mesh(cap, gold, 0, -half, 0));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8), std(0x222222), 0, half + 0.45, 0));
  const tassel = mesh(new THREE.ConeGeometry(0.08, 0.35, 8), std(0xd42a1c), 0, -half - 0.25, 0);
  tassel.rotation.x = Math.PI;
  g.add(tassel);
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  g.userData.swing = Math.random() * 6;
  return g;
}

function tianGongLu() {
  const g = new THREE.Group();
  const bronze = std(0x6b5236, { metalness: 0.7, roughness: 0.45 });
  const stone = std(0x77736b);
  g.add(mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.5, 8), stone, 0, 0.25, 0));
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.8), bronze, Math.cos(a) * 0.65, 0.85, Math.sin(a) * 0.65));
  }
  g.add(mesh(new THREE.SphereGeometry(0.95, 24, 16, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), bronze, 0, 1.75, 0));
  const rim = mesh(new THREE.TorusGeometry(0.8, 0.07, 8, 32), GOLD_MAT(), 0, 2.32, 0);
  rim.rotation.x = Math.PI / 2; g.add(rim);
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16, Math.PI), bronze, sx * 0.95, 2.45, 0);
    ear.rotation.z = sx * 0.2; g.add(ear);
  }
  const ash = mesh(new THREE.CircleGeometry(0.78, 24), std(0x9c9488, { roughness: 1 }), 0, 2.2, 0);
  ash.rotation.x = -Math.PI / 2; g.add(ash);
  const plate = mesh(new THREE.PlaneGeometry(1.1, 0.42), new THREE.MeshStandardMaterial({
    map: canvasTex(256, 96, (c, w, h) => {
      c.fillStyle = '#5a4128'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f0c75e'; c.font = `64px ${SERIF}`;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('天公爐', w / 2, h / 2 + 3);
    }), metalness: 0.4, roughness: 0.5,
  }), 0, 1.5, 0.93, { cast: false });
  plate.rotation.x = -0.25;
  g.add(plate);
  g.userData.ashY = 2.2;
  return g;
}

function dragonColumn(x, y0, z, h, r) {
  const g = new THREE.Group();
  g.name = 'dragonCol'; g.userData.spot = { x, y: y0, z, h };
  g.add(mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 16), std(0x8d8a84, { roughness: 0.9 }), x, y0 + h / 2, z));
  const pts = [];
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    pts.push(new THREE.Vector3(x + Math.cos(t * Math.PI * 7) * (r + 0.1), y0 + 0.4 + t * (h - 0.8), z + Math.sin(t * Math.PI * 7) * (r + 0.1)));
  }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, r * 0.32, 6), std(0x6f6c66)));
  return g;
}

function banyan(x, z, s = 1) {
  const g = new THREE.Group();
  const bark = std(0x4b3a2a, { roughness: 1 });
  g.add(mesh(new THREE.CylinderGeometry(0.45, 0.7, 3.4, 10), bark, 0, 1.7, 0));
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 3, 5), bark, Math.cos(a) * 1.6, 1.8, Math.sin(a) * 1.6)); }
  const leaf = std(0x2f5a2e, { roughness: 0.9 }), leaf2 = std(0x3d6e35, { roughness: 0.9 });
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 2;
    g.add(mesh(new THREE.SphereGeometry(1.1 + Math.random() * 0.6, 10, 8), i % 2 ? leaf : leaf2, Math.cos(a) * r, 3.6 + Math.random() * 1.3, Math.sin(a) * r));
  }
  g.position.set(x, 0, z); g.scale.setScalar(s);
  return g;
}

// ---------- candles ----------
// Taiwanese altar candle: a brass dragon-foot stand, a tall red wax candle that has burned a while
// (uneven rim, wax runs down the side), a wick, and a flame made of two soft additive sprites.
export const flames = [];
const flameCore = canvasTex(64, 128, (c, w, h) => {
  const g = c.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.62, h * 0.45);
  g.addColorStop(0, 'rgba(255,255,235,1)'); g.addColorStop(0.35, 'rgba(255,214,120,0.95)');
  g.addColorStop(0.7, 'rgba(255,130,30,0.45)'); g.addColorStop(1, 'rgba(255,90,0,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(w / 2, 2);
  c.bezierCurveTo(w * 0.95, h * 0.45, w * 0.85, h * 0.95, w / 2, h - 2); c.bezierCurveTo(w * 0.15, h * 0.95, w * 0.05, h * 0.45, w / 2, 2); c.fill();
  const b = c.createRadialGradient(w / 2, h * 0.86, 0, w / 2, h * 0.86, w * 0.22);
  b.addColorStop(0, 'rgba(120,150,255,0.7)'); b.addColorStop(1, 'rgba(120,150,255,0)'); c.fillStyle = b; c.fillRect(0, h * 0.6, w, h * 0.4);
});
const flameGlow = canvasTex(64, 64, (c, w) => {
  const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,190,90,0.55)'); g.addColorStop(1, 'rgba(255,120,30,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w);
});
function candle(h, seed) {
  let s = Math.abs(seed * 9301 + 49297) % 233280; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const g = new THREE.Group();
  const brass = std(0xb8862f, { metalness: 0.9, roughness: 0.3 });
  const wax = new THREE.MeshStandardMaterial({ color: 0xa8101a, roughness: 0.38, emissive: 0x3a0306, emissiveIntensity: 0.6 });
  // stand: flared foot, knotted stem, drip pan with a spike
  const stand = [[0, 0], [0.17, 0], [0.18, 0.02], [0.12, 0.06], [0.05, 0.1], [0.045, 0.16], [0.07, 0.19], [0.04, 0.22], [0.035, 0.3], [0.06, 0.33], [0.14, 0.35], [0.15, 0.37], [0.04, 0.37], [0, 0.37]];
  g.add(mesh(new THREE.LatheGeometry(stand.map(([a, b]) => new THREE.Vector2(a, b)), 24), brass));
  // wax body: slightly irregular radius, melted cup at the top
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.075 + Math.sin(t * 9 + seed) * 0.003, t * h)); }
  pts.push(new THREE.Vector2(0.071, h + 0.012), new THREE.Vector2(0.06, h - 0.004), new THREE.Vector2(0.02, h - 0.012), new THREE.Vector2(0, h - 0.014));
  const body = mesh(new THREE.LatheGeometry(pts, 28), wax, 0, 0.37, 0); g.add(body);
  // wax runs: thin drops trickling down from the rim, one pooled in the pan
  for (let i = 0; i < 4 + Math.floor(rnd() * 3); i++) {
    const a = rnd() * Math.PI * 2, len = 0.06 + rnd() * h * 0.45;
    const run = mesh(new THREE.CapsuleGeometry(0.011 + rnd() * 0.006, len, 4, 8), wax, Math.cos(a) * 0.077, 0.37 + h - len / 2 - 0.01, Math.sin(a) * 0.077);
    g.add(run);
  }
  const pool = mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.012, 20), wax, 0.01, 0.375, 0); g.add(pool);
  g.add(mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.05, 6), std(0x1a1210), 0, 0.37 + h + 0.01, 0, { cast: false }));
  // flame (live, animated in main.js)
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameCore, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.scale.set(0.07, 0.15, 1); core.position.set(0, 0.37 + h + 0.09, 0);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
  glow.scale.setScalar(0.5); glow.position.copy(core.position);
  core.userData.role = 'skip'; glow.userData.role = 'skip';
  g.add(core, glow);
  flames.push({ core, glow, base: core.position.clone(), seed: rnd() * 100 });
  return g;
}

// ---------- 三川殿 front gate ----------
function gate() {
  const g = new THREE.Group();
  const Z = 22, red = LACQUER(2), wall = BRICK(2, 2);
  g.add(mesh(new THREE.BoxGeometry(24, 0.3, 7), GRANITE(6, 2), 0, 0.15, Z));
  // front wall with three door bays at x = -6, 0, 6
  const doorTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#a8261e'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#5a1510'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    for (let r = 0; r < 9; r++) for (let k = 0; k < 5; k++) {
      c.fillStyle = '#f0c75e'; c.beginPath(); c.arc(30 + k * 49, 40 + r * 54, 11, 0, 7); c.fill();
      c.fillStyle = '#9a6a1f'; c.beginPath(); c.arc(33 + k * 49, 43 + r * 54, 5, 0, 7); c.fill();
    }
  });
  const doorMat = std(0xffffff, { map: doorTex, roughness: 0.5 });
  for (const [x0, x1] of [[-11.5, -7.4], [-4.6, -1.4], [1.4, 4.6], [7.4, 11.5]]) g.add(mesh(new THREE.BoxGeometry(x1 - x0, 6, 0.6), wall, (x0 + x1) / 2, 3, Z));
  for (const x of [-6, 0, 6]) {
    const w = x === 0 ? 2.8 : 2.8;
    g.add(mesh(new THREE.BoxGeometry(w + 0.2, 1.58, 0.56), wall, x, 5.2, Z));   // lintel (recessed, slightly lower: no shared faces with the walls)
    for (const sx of [-1, 1]) {                                                   // open door leaves
      const d = mesh(new THREE.BoxGeometry(w / 2, 4.3, 0.12), doorMat, x + sx * (w / 2 + 0.05), 2.2, Z - w / 4 - 0.3);
      d.rotation.y = sx * Math.PI / 2;
      g.add(d);
    }
  }
  // columns + painted beam in front
  for (const x of [-10, -7.4, -4.6, 4.6, 7.4, 10]) g.add(mesh(new THREE.CylinderGeometry(0.32, 0.36, 6, 14), red, x, 3, Z + 2.2));
  for (const x of [-1.6, 1.6]) g.add(dragonColumn(x, 0.3, Z + 2.2, 5.7, 0.32));
  g.add(mesh(new THREE.BoxGeometry(23, 0.55, 0.45), std(0xffffff, { map: beamTex() }), 0, 6.1, Z + 2.2));
  g.add(mesh(new THREE.BoxGeometry(23, 0.55, 0.45), std(0xffffff, { map: beamTex() }), 0, 6.1, Z - 2.2));
  const plaque = mesh(new THREE.PlaneGeometry(4.6, 1.35), new THREE.MeshStandardMaterial({ map: plaqueTex('歇腳廟'), roughness: 0.5 }), 0, 5.2, Z + 0.32, { cast: false });
  g.add(plaque);
  const back = plaque.clone(); back.rotation.y = Math.PI; back.position.z = Z - 0.32; g.add(back);
  // roofs: wide side roof + raised centre roof (三川脊)
  const tiles = TILES(14, 4);
  g.add(roof({ halfW: 12.8, zFront: Z + 3.6, zBack: Z - 3.6, yEave: 6.4, yRidge: 8.6, lift: 0.9, mat: tiles, gableMat: wall }));
  g.add(mesh(new THREE.BoxGeometry(9, 1.4, 4), wall, 0, 8.6, Z));
  g.add(roof({ halfW: 5.6, zFront: Z + 3.4, zBack: Z - 3.4, yEave: 9.0, yRidge: 10.9, lift: 0.8, mat: tiles, gableMat: wall }));
  g.add(ridge({ halfW: 5.6, y: 10.9, z: Z, s: 0.8 }));
  for (const sx of [-1, 1]) g.add(ridge({ halfW: 3.4, y: 8.6, z: Z, s: 0.5 }).translateX(sx * 8.8));
  return g;
}

// ---------- the deity (kept non-specific on purpose: a gilded seated figure) ----------
const robeTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#9e1b14'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#e0b04f'; c.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 1.5); c.stroke();
    c.beginPath(); c.arc(x + 9, y, 5, Math.PI, Math.PI * 2.6); c.stroke();
  }
  c.fillStyle = '#e0b04f'; c.fillRect(0, h - 22, w, 10);
}, [3, 2]);

function deity(scale, robeColor = 0xffffff) {
  const g = new THREE.Group();
  const gold = GOLD_MAT();
  const robe = std(robeColor, { map: robeTex, metalness: 0.25, roughness: 0.45 });
  const face = std(0xe9c48a, { metalness: 0.55, roughness: 0.35 });
  const lathe = (pts, mat) => mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 32), mat);
  // throne
  g.add(mesh(new THREE.BoxGeometry(2.8, 0.9, 2.0), THRONE_MAT(), 0, 0.45, -0.1));
  g.children[g.children.length - 1].add(mesh(new THREE.BoxGeometry(2.86, 0.07, 2.06), gold, 0, 0.42, 0, { cast: false }));
  g.add(mesh(new THREE.BoxGeometry(3.0, 3.3, 0.3), std(0x7a1712, { metalness: 0.2 }), 0, 2.3, -1.05));
  g.add(mesh(new THREE.BoxGeometry(3.2, 0.3, 0.4), gold, 0, 4.0, -1.05));
  // seated body
  const body = new THREE.Group(); body.position.y = 0.9; g.add(body);
  body.add(lathe([[0, 0], [1.05, 0], [1.1, 0.25], [1.0, 0.75], [0.8, 1.0], [0.62, 1.15], [0, 1.15]], robe));
  for (const sx of [-1, 1]) { const k = mesh(new THREE.CapsuleGeometry(0.32, 0.7, 6, 12), robe, sx * 0.4, 0.8, 0.45); k.rotation.x = Math.PI / 2; body.add(k); }
  const apron = mesh(new THREE.PlaneGeometry(0.75, 1.0), std(0xffffff, { map: robeTex, side: THREE.DoubleSide, metalness: 0.3 }), 0, 0.55, 1.12, { cast: false });
  apron.rotation.x = -0.12; body.add(apron);
  body.add(lathe([[0.6, 1.1], [0.68, 1.5], [0.75, 2.0], [0.62, 2.25], [0.25, 2.4], [0, 2.42]], robe));
  const collar = mesh(new THREE.TorusGeometry(0.5, 0.11, 8, 28), gold, 0, 2.22, 0.02);
  collar.rotation.x = Math.PI / 2; body.add(collar);
  // arms reaching to hands at the chest, holding a 笏 tablet
  const up = new THREE.Vector3(0, 1, 0);
  for (const sx of [-1, 1]) {
    const a = new THREE.Vector3(sx * 0.72, 2.05, 0), b = new THREE.Vector3(sx * 0.14, 1.55, 0.66);
    const arm = mesh(new THREE.CapsuleGeometry(0.19, a.distanceTo(b), 6, 12), robe);
    arm.position.copy(a).add(b).multiplyScalar(0.5);
    arm.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    body.add(arm);
    const sleeve = mesh(new THREE.ConeGeometry(0.3, 0.5, 14, 1, true), robe, b.x * 1.3, b.y - 0.05, b.z - 0.12);
    sleeve.rotation.x = -1.2; body.add(sleeve);
    body.add(mesh(new THREE.SphereGeometry(0.13, 12, 10), face, sx * 0.1, 1.58, 0.72));
  }
  const tablet = mesh(new THREE.BoxGeometry(0.14, 0.95, 0.04), gold, 0, 1.95, 0.76);
  tablet.rotation.x = -0.28; body.add(tablet);
  // head, serene face, crown with bead curtains (旒)
  const head = new THREE.Group(); head.position.y = 2.85; body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.44, 28, 20), face));
  const dark = new THREE.MeshBasicMaterial({ color: 0x2a1a10 });
  for (const sx of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.045, 10, 6), dark, sx * 0.15, 0.03, 0.4, { cast: false }); eye.scale.set(1.6, 0.45, 0.6); head.add(eye);
    head.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), face, sx * 0.43, -0.02, 0));    // ears
  }
  const lips = mesh(new THREE.SphereGeometry(0.05, 10, 6), std(0xb8231a), 0, -0.2, 0.4, { cast: false }); lips.scale.set(1.4, 0.5, 0.6); head.add(lips);
  head.add(mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.42, 20), gold, 0, 0.42, -0.02));
  head.add(mesh(new THREE.BoxGeometry(1.05, 0.07, 0.75), gold, 0, 0.66, 0));
  const bead = new THREE.CylinderGeometry(0.014, 0.014, 0.5, 4), beadMat = std(0xfff0c0, { metalness: 0.6, roughness: 0.3 });
  for (let i = -4; i <= 4; i++) for (const sz of [-1, 1]) head.add(mesh(bead, beadMat, i * 0.11, 0.38, sz * 0.36, { cast: false }));
  for (const sx of [-1, 1]) { const ph = mesh(new THREE.ConeGeometry(0.08, 0.45, 6), gold, sx * 0.5, 0.6, 0); ph.rotation.z = -sx * 1.1; head.add(ph); }
  // halo
  const halo = mesh(new THREE.CircleGeometry(0.95, 40), new THREE.MeshStandardMaterial({
    map: canvasTex(256, 256, (c, w) => {
      const r = c.createRadialGradient(w / 2, w / 2, 10, w / 2, w / 2, w / 2);
      r.addColorStop(0, '#fff2c0'); r.addColorStop(0.6, '#e0a83f'); r.addColorStop(1, '#8a5a12');
      c.fillStyle = r; c.fillRect(0, 0, w, w);
      c.strokeStyle = 'rgba(255,240,190,0.7)'; c.lineWidth = 3;
      for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; c.beginPath(); c.moveTo(w / 2, w / 2); c.lineTo(w / 2 + Math.cos(a) * w / 2, w / 2 + Math.sin(a) * w / 2); c.stroke(); }
    }), emissive: 0x8a5a12, emissiveIntensity: 0.25, metalness: 0.6, roughness: 0.35,
  }), 0, 0.1, -0.55, { cast: false });
  head.add(halo);
  g.scale.setScalar(scale);
  return g;
}

// ---------- main hall 正殿 ----------
function mainHall() {
  const g = new THREE.Group();
  const { floor: F, front: ZF, back: ZB, halfW: HW, ceil: C, domeZ } = HALL;
  const red = LACQUER(3), gold = GOLD_MAT();
  const stone = GRANITE(8, 6);

  // platform, front stairs, interior floor
  const plinth = mesh(new THREE.BoxGeometry(HW * 2 + 2, F - 0.04, ZF - ZB + 1.8), stone, 0, (F - 0.04) / 2, (ZF + ZB) / 2 - 0.6);
  plinth.userData.role = 'occ';     // its top is under the floor; not worth lightmap space
  g.add(plinth);
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(HW * 2, F * (i + 1) / 4, 0.5), stone, 0, F * (i + 1) / 8, ZF + 1.75 - i * 0.5));
  const fl = mesh(new THREE.PlaneGeometry(HW * 2, ZF - ZB), pbr('large_grey_tiles', 10, 9, { roughness: 0.75 }), 0, F + 0.01, (ZF + ZB) / 2, { cast: false });   // large grey stone slabs (Poly Haven, CC0): a calm field under the red
  fl.rotation.x = -Math.PI / 2; fl.name = 'hallFloor'; g.add(fl);

  // walls: back + sides
  g.add(mesh(new THREE.BoxGeometry(HW * 2, C, 0.5), PLASTER(6, 3), 0, F + C / 2, ZB));
  // side walls (hidden: the hall is open at the sides, looking out to the bamboo and the lotus lake; kept for the bake fingerprint)
  for (const sx of [-1, 1]) g.add(Object.assign(mesh(new THREE.BoxGeometry(0.5, C, ZF - ZB - 1), PLASTER(6, 3), sx * HW, F + C / 2, (ZF + ZB) / 2 - 0.5), { visible: false }));
  // murals behind the side altars
  const murals = [];
  for (const sx of [-1, 1]) {
    const m = mesh(new THREE.PlaneGeometry(3.6, 5.4), std(0xffffff, { map: muralTex(sx > 0 ? 7 : 3) }), sx * 13.1, F + 8.2, ZB + 0.31, { cast: false });
    murals.push(m);
    g.add(m);
  }

  // columns: front row is carved dragon pillars, the rest red lacquer painted with gold peony scrolls (瀝粉貼金),
  // standing on gilded lotus bases
  const colH = C - 0.3, colGeo = new THREE.CylinderGeometry(0.5, 0.55, colH, 18);
  const scrollTex = canvasTex(512, 1024, (c, w, h) => {
    c.fillStyle = '#9e1f17'; c.fillRect(0, 0, w, h);
    let sd = 3; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${rr() < 0.5 ? '60,8,4' : '200,60,40'},${0.05 + rr() * 0.06})`; c.fillRect(rr() * w, rr() * h, 2 + rr() * 6, 2 + rr() * 6); }   // worn lacquer
    const GOLD_A = '#e2b54f', GOLD_B = '#b8862c';
    c.lineCap = 'round';
    for (const x0 of [w * 0.25, w * 0.75]) {                          // two climbing vines, each swaying the other way
      const flip = x0 < w / 2 ? 1 : -1;
      c.strokeStyle = GOLD_A; c.lineWidth = 16; c.beginPath();
      for (let y = -20; y <= h + 20; y += 8) c.lineTo(x0 + Math.sin((y / h) * Math.PI * 4) * 60 * flip, y);
      c.stroke();
      for (let k = 0; k < 4; k++) {
        const y = (k + 0.5) * (h / 4), x = x0 + Math.sin(((k + 0.5) / 4) * Math.PI * 4) * 60 * flip, side = (k % 2 ? 1 : -1) * flip;
        c.strokeStyle = GOLD_A; c.lineWidth = 11; c.beginPath();     // a curling tendril
        for (let t = 0; t < 7; t += 0.15) { const rad = 70 - t * 9; c.lineTo(x + side * (40 + Math.cos(t) * rad * 0.6), y - 50 + Math.sin(t) * rad * 0.6); }
        c.stroke();
        for (let l = 0; l < 6; l++) {                                 // leaves along it, and down the stem
          c.save(); c.translate(x + side * (10 + l * 18) * (l < 3 ? 1 : -0.6), y + 30 - l * 34); c.rotate(side * (0.5 + l * 0.35));
          c.fillStyle = l % 2 ? GOLD_B : GOLD_A; c.beginPath(); c.ellipse(0, 0, 44, 15, 0, 0, 7); c.fill();
          c.strokeStyle = '#9e1f17'; c.lineWidth = 2; c.beginPath(); c.moveTo(-36, 0); c.lineTo(36, 0); c.stroke(); c.restore();
        }
        const px = x - side * 60, py = y + 40;                       // a peony on the other side
        for (const [n, R, col] of [[12, 74, GOLD_B], [12, 58, GOLD_A], [9, 38, GOLD_B], [7, 22, GOLD_A]]) for (let p = 0; p < n; p++) {
          const a = (p / n) * Math.PI * 2 + R;
          c.fillStyle = col; c.beginPath(); c.ellipse(px + Math.cos(a) * R * 0.55, py + Math.sin(a) * R * 0.55, R * 0.48, R * 0.3, a, 0, 7); c.fill();
        }
        c.fillStyle = '#9e1f17'; c.beginPath(); c.arc(px, py, 9, 0, 7); c.fill();
      }
    }
  }, [2, 5]);                                                         // bold gold over much of the red, like 瀝粉貼金
  const lacquer = new THREE.MeshStandardMaterial({ map: scrollTex, roughness: 0.42, metalness: 0.15 });
  const gildBase = std(0xd6a548, { metalness: 0.75, roughness: 0.32 });
  const rows = [-8, -14, -20, -26, -31];
  for (const z of rows) for (const x of [-11, -5.5, 5.5, 11]) {
    if (z === -8 && Math.abs(x) < 6) g.add(dragonColumn(x, F, z, colH, 0.5));
    else g.add(mesh(colGeo, lacquer, x, F + colH / 2, z));
    g.add(mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.35, 16), stone, x, F + 0.17, z));
    // the two rows nearest the altar, and the inner pair among the cushions, are left out: nothing stands between you and the deities. (Hidden, not
    // removed, so the baked-lighting fingerprint still matches; their baked copies are hidden with them.)
    const gone = z === -20 || z === -26 || z === -31 || (z === -14 && Math.abs(x) < 8);
    if (gone) g.children.slice(-2).forEach((o) => (o.visible = false));   // none among the cushions, none in the giant statues
    else if (!(z === -8 && Math.abs(x) < 6)) {                          // a gilded lotus base round the foot of each red column
      const base = new THREE.Group(); base.userData.role = 'skip';
      base.add(mesh(new THREE.LatheGeometry([[0.001, 0], [0.8, 0], [0.82, 0.12], [0.7, 0.22], [0.74, 0.32], [0.62, 0.5], [0.58, 0.95], [0.66, 1.05], [0.56, 1.12]].map(([r, yy]) => new THREE.Vector2(r, yy)), 40), gildBase, 0, 0, 0));
      for (let k = 0; k < 16; k++) {                                   // lotus petals round the drum
        const a = (k / 16) * Math.PI * 2, pt = mesh(new THREE.SphereGeometry(0.16, 10, 8), gildBase, Math.sin(a) * 0.66, 0.38, Math.cos(a) * 0.66);
        pt.scale.set(0.9, 1.3, 0.35); pt.rotation.y = a; base.add(pt);
      }
      base.position.set(x, F + 0.34, z); g.add(base);
    }
  }
  // beams
  const bt = beamTex();
  for (const z of rows) {
    if (Math.abs(z - domeZ) < 5) {        // leave the dome's span open so it can be seen from the nave
      for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(HW - 5.5, 0.7, 0.55), std(0xffffff, { map: bt }), sx * (HW + 5.5) / 2, F + C - 0.6, z));
    } else g.add(mesh(new THREE.BoxGeometry(HW * 2, 0.7, 0.55), std(0xffffff, { map: bt }), 0, F + C - 0.6, z));
    if (z === -31) g.children[g.children.length - 1].visible = false;   // it would cut through Guanyin's crown
  }
  for (const x of [-11, -5.5, 5.5, 11]) g.add(mesh(new THREE.BoxGeometry(0.5, 0.6, ZF - ZB), std(BLUE), x, F + C - 0.5, (ZF + ZB) / 2));

  // coffered ceiling with an octagonal opening for the dome
  const R = 5.2, shape = new THREE.Shape();
  shape.moveTo(-HW, ZF); shape.lineTo(HW, ZF); shape.lineTo(HW, ZB); shape.lineTo(-HW, ZB); shape.lineTo(-HW, ZF);
  const hole = new THREE.Path();
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; const fn = i ? 'lineTo' : 'moveTo'; hole[fn](Math.cos(a) * (R - 0.45), domeZ + Math.sin(a) * (R - 0.45)); }
  shape.holes.push(hole);
  const ceilGeo = new THREE.ShapeGeometry(shape);
  ceilGeo.rotateX(Math.PI / 2);
  const uv = ceilGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 8);
  g.add(mesh(ceilGeo, std(0xc9bc9e, { map: cofferTex(), side: THREE.DoubleSide }), 0, F + C, 0, { cast: false }));   // tinted: old pigment, softened by smoke

  // 藻井: stacked octagonal bracket rings, each turned a little — the spiral dome
  const domeStart = g.children.length;
  const ringMat = new THREE.MeshStandardMaterial({ map: bracketTex, side: THREE.DoubleSide, metalness: 0.35, roughness: 0.5 });
  bracketTex.wrapS = THREE.RepeatWrapping; bracketTex.repeat.set(3, 1);
  for (let i = 0; i < 11; i++) {
    const r0 = R - i * 0.43, r1 = r0 - 0.38;
    const ring = mesh(new THREE.CylinderGeometry(r1, r0, 0.55, 8, 1, true), ringMat, 0, F + C + 0.27 + i * 0.5, domeZ, { cast: false });
    ring.rotation.y = Math.PI / 8 + i * 0.16;
    g.add(ring);
    g.add(mesh(new THREE.RingGeometry(r1 - 0.05, r1 + 0.02, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8 + i * 0.16), std(0xe0b04f, { side: THREE.DoubleSide, metalness: 0.6 }), 0, F + C + 0.55 + i * 0.5, domeZ, { cast: false }));
  }
  const capR = R - 11 * 0.43;
  const cap = mesh(new THREE.CircleGeometry(capR + 0.1, 24), new THREE.MeshStandardMaterial({
    map: canvasTex(256, 256, (c, w) => {
      c.fillStyle = '#e0b04f'; c.fillRect(0, 0, w, w);
      c.strokeStyle = '#7a1712'; c.lineWidth = 10;
      c.beginPath(); for (let t = 0; t < 30; t += 0.1) { const r = t * 4; c.lineTo(w / 2 + Math.cos(t) * r, w / 2 + Math.sin(t) * r); } c.stroke();
      c.fillStyle = '#fff2c0'; c.beginPath(); c.arc(w / 2, w / 2, 20, 0, 7); c.fill();
    }), emissive: 0x6a4a10, emissiveIntensity: 0.4, side: THREE.DoubleSide,
  }), 0, F + C + 5.75, domeZ, { cast: false });
  cap.rotation.x = Math.PI / 2; g.add(cap);
  // The 藻井 in carved detail: eight octagonal tiers of gilded brackets (斗栱), each tier turned a little so the
  // dome spirals up; painted fascias and azure soffits between them; a gold lotus and a hanging lotus at the crown.
  // (The plain rings above are kept, hidden, so the baked-lighting fingerprint still matches; everything here is
  // instanced or marked 'skip' and stays out of it.)
  g.children.slice(domeStart).forEach((o) => (o.visible = false));
  {
    const D = new THREE.Group(); D.userData.role = 'skip'; g.add(D);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const M = {
      gold: new THREE.MeshStandardMaterial({ color: 0xd9a845, metalness: 0.6, roughness: 0.35, emissive: 0x4a3008, emissiveIntensity: 0.35 }),
      red: new THREE.MeshStandardMaterial({ color: 0x8a1d14, roughness: 0.5 }),
      green: new THREE.MeshStandardMaterial({ color: 0x2f7a62, roughness: 0.55 }),
      blue: new THREE.MeshStandardMaterial({ color: 0x23406a, roughness: 0.6 }),
      teal: new THREE.MeshStandardMaterial({ color: 0x245e4c, roughness: 0.6 }),
      fascia: new THREE.MeshStandardMaterial({ roughness: 0.55, map: canvasTex(64, 128, (c, w, h) => {
        const bands = [['#d9a845', 10], ['#8a1d14', 30], ['#d9a845', 6], ['#2f7a62', 44], ['#d9a845', 6], ['#2b4f88', 26], ['#d9a845', 6]];
        let y = 0; for (const [col, hh] of bands) { c.fillStyle = col; c.fillRect(0, y, w, hh); y += hh; }
        c.fillStyle = '#e9c66a'; for (let x = 4; x < w; x += 16) { c.beginPath(); c.arc(x, 68, 5, 0, 7); c.fill(); }   // a row of gold studs
      }) }),
    };
    const parts = { gold: [], red: [], green: [], blue: [], teal: [], fascia: [] };
    const put = (kind, p, yaw, sx, sy, sz, pitch = 0) => parts[kind].push([p.clone(), yaw, pitch, sx, sy, sz]);
    const TIERS = 8, R0 = R - 0.35, STEP = (R0 - 1.0) / TIERS, H = 0.36, K = H / 0.6;   // the roof is ~3 m above the ceiling: keep under it
    for (let i = 0; i < TIERS; i++) {
      const rc = R0 - i * STEP, y0 = F + C + i * H, tw = Math.PI / 8 + i * 0.13;
      const vtx = (k, rr) => new THREE.Vector3(Math.cos(tw + (k * Math.PI) / 4) * rr, 0, domeZ + Math.sin(tw + (k * Math.PI) / 4) * rr);
      for (let k = 0; k < 8; k++) {
        const a = vtx(k, rc), b = vtx(k + 1, rc), mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
        const yaw = -Math.atan2(b.z - a.z, b.x - a.x), inward = new THREE.Vector3(0, 0, domeZ).sub(mid).setY(0).normalize();
        put('fascia', mid.clone().setY(y0 + 0.11 * K), yaw, len + 0.06, 0.22 * K, 0.07);                       // painted band
        put(i % 2 ? 'teal' : 'blue', mid.clone().addScaledVector(inward, STEP / 2).setY(y0 + H - 0.02), yaw, len, 0.04, STEP + 0.05);   // azure / malachite soffit
        put('gold', mid.clone().addScaledVector(inward, STEP - 0.02).setY(y0 + H - 0.06), yaw, len * (1 - STEP / rc) + 0.04, 0.04, 0.05);   // gilded lip
        const n = Math.max(2, Math.round(len / 0.34));
        for (let j = 0; j < n; j++) {
          const p = a.clone().lerp(b, (j + 0.5) / n);
          put('gold', p.clone().addScaledVector(inward, 0.03).setY(y0 + 0.27 * K), yaw, 0.18, 0.12 * K, 0.18);          // 斗 block
          put('red', p.clone().addScaledVector(inward, 0.06).setY(y0 + 0.36 * K), yaw, Math.min(0.3, len / n * 0.9), 0.08 * K, 0.09);   // 栱 arm
          put('green', p.clone().addScaledVector(inward, 0.06 + STEP * 0.45).setY(y0 + 0.44 * K), yaw, 0.08, 0.07 * K, STEP * 0.95, -0.22);   // 昂 cantilever
          put('gold', p.clone().addScaledVector(inward, STEP * 0.92).setY(y0 + 0.5 * K), yaw, 0.1, 0.07 * K, 0.1);        // small block on its tip
        }
      }
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), sc = new THREE.Vector3();
    for (const [kind, list] of Object.entries(parts)) {
      const im = new THREE.InstancedMesh(box, M[kind], list.length);
      list.forEach(([p, yaw, pitch, sx, sy, sz], i) => im.setMatrixAt(i, m4.compose(p, q.setFromEuler(e.set(pitch, yaw, 0)), sc.set(sx, sy, sz))));
      im.castShadow = false; im.receiveShadow = true; D.add(im);
    }
    // the crown: a gold lotus roundel, and a lotus bud hanging from it
    const topY = F + C + TIERS * H;
    const crown = new THREE.Mesh(new THREE.CircleGeometry(1.15, 48), new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4, emissive: 0x6a4a10, emissiveIntensity: 0.45,
      map: canvasTex(512, 512, (c, w) => {
        c.fillStyle = '#2b4f88'; c.fillRect(0, 0, w, w);
        for (const [n, R2, col, rot] of [[24, 250, '#b8862e', 0], [16, 200, '#8a1d14', Math.PI / 16], [12, 150, '#e0b04f', 0], [8, 100, '#c0451f', Math.PI / 8]]) {
          for (let k = 0; k < n; k++) {
            c.save(); c.translate(w / 2, w / 2); c.rotate((k / n) * Math.PI * 2 + rot); c.fillStyle = col;
            c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(R2 * 0.3, R2 * 0.5, 0, R2); c.quadraticCurveTo(-R2 * 0.3, R2 * 0.5, 0, 0); c.fill();
            c.strokeStyle = 'rgba(50,25,5,.4)'; c.lineWidth = 2; c.stroke(); c.restore();
          }
        }
        c.fillStyle = '#f3d27a'; c.beginPath(); c.arc(w / 2, w / 2, 46, 0, 7); c.fill();
        c.strokeStyle = '#8a1d14'; c.lineWidth = 6; c.beginPath(); for (let t = 0; t < 14; t += 0.1) c.lineTo(w / 2 + Math.cos(t) * t * 2.6, w / 2 + Math.sin(t) * t * 2.6); c.stroke();
      }),
    }));
    crown.rotation.x = Math.PI / 2; crown.position.set(0, topY + 0.02, domeZ); D.add(crown);
    const bud = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), M.gold); bud.scale.set(1, 1.5, 1); bud.position.set(0, topY - 0.6, domeZ); D.add(bud);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 12), M.gold); tip.rotation.x = Math.PI; tip.position.set(0, topY - 1.0, domeZ); D.add(tip);
    for (let k = 0; k < 8; k++) {                                       // petals cupping the bud
      const pt = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M.red); pt.scale.set(0.5, 1.4, 0.25);
      const a = (k / 8) * Math.PI * 2; pt.position.set(Math.cos(a) * 0.2, topY - 0.42, domeZ + Math.sin(a) * 0.2); pt.rotation.set(0, -a, 0.5); pt.rotateZ(0); D.add(pt);
    }
    const lamp = new THREE.PointLight(0xffd9a0, 16, 9, 1.4); lamp.position.set(0, topY - 1.4, domeZ); D.add(lamp);   // lights the dome from within
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 6), M.gold); cord.position.set(0, topY - 0.22, domeZ); D.add(cord);
  }
  // raised ribs (支條) over the coffer borders, with gilded rosettes where they cross
  {
    const CELL = 1.2, Y = F + C - 0.045, segs = [], dots = [];
    const open = (x, z) => Math.hypot(x, z - domeZ) < R + 0.15;            // the dome's opening
    const k0 = (lo, hi) => { const out = []; for (let k = Math.ceil(lo / CELL); k * CELL <= hi + 1e-3; k++) out.push(k * CELL); return out; };
    const xs = k0(-HW, HW), zs = k0(ZB, ZF);
    for (const x of xs) for (let j = 0; j + 1 < zs.length; j++) { const z = (zs[j] + zs[j + 1]) / 2; if (!open(x, z)) segs.push([x, z, 0.11, CELL]); }
    for (const z of zs) for (let j = 0; j + 1 < xs.length; j++) { const x = (xs[j] + xs[j + 1]) / 2; if (!open(x, z)) segs.push([x, z, CELL, 0.11]); }
    for (const x of xs) for (const z of zs) if (!open(x, z)) dots.push([x, z]);
    const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.07, 1), new THREE.MeshStandardMaterial({ color: 0x24564a, roughness: 0.6 }), segs.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    segs.forEach(([x, z, sx, sz], i) => ribs.setMatrixAt(i, m4.compose(v.set(x, Y, z), q, sc.set(sx, 1, sz))));
    const ros = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0xd9a845, metalness: 0.6, roughness: 0.35, emissive: 0x3a2606, emissiveIntensity: 0.3 }), dots.length);
    dots.forEach(([x, z], i) => ros.setMatrixAt(i, m4.compose(v.set(x, Y - 0.05, z), q, sc.set(1, 1, 1))));
    for (const m of [ribs, ros]) { m.userData.role = 'skip'; m.receiveShadow = true; g.add(m); }
  }
  // soft light shaft from the dome
  const shaftTex = canvasTex(4, 128, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,230,170,0.9)'); gr.addColorStop(1, 'rgba(255,230,170,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.6, C + 3, 24, 1, true), new THREE.MeshBasicMaterial({
    map: shaftTex, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  shaft.position.set(0, F + (C + 3) / 2 - 0.5, domeZ);
  g.add(shaft);

  // ---- altar: raised dais, gold shrine with a little roof, three deities ----
  const DZ = -32.2;
  const daisStart = g.children.length;
  g.add(mesh(new THREE.BoxGeometry(24, 1.4, 5.6), std(0x6a1712, { roughness: 0.4 }), 0, F + 0.7, DZ));
  g.add(mesh(new THREE.BoxGeometry(24.2, 0.15, 5.8), gold, 0, F + 1.45, DZ));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(10 - i * 0.4, 0.45 * (i + 1), 0.45), std(0x6a1712), 0, F + 0.225 * (i + 1), DZ + 3.0 + (2 - i) * 0.45));
  // The old dais was too small for the colossal statues (they hung off its front and sides). It is hidden, not
  // removed (bake fingerprint), and a grand throne platform (須彌座) runs the full width of the hall in its place:
  // red lacquer, gold mouldings, and gilt-framed carved panels under a band of upturned lotus petals.
  g.children.slice(daisStart).forEach((o) => (o.visible = false));
  {
    const W = 36.6, Z0 = -35.2, Z1 = -28.3, D = Z1 - Z0, ZC = (Z0 + Z1) / 2, TOP = F + 1.5;
    const red = std(0x6a1712, { roughness: 0.38 }), gilt = std(0xe0b04a, { metalness: 0.85, roughness: 0.28 });
    const skirtTex = (rep) => canvasTex(2048, 128, (c, w, h) => {
      c.fillStyle = '#7a1712'; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 40) {                                // upturned lotus petals along the top
        const gr = c.createLinearGradient(0, 0, 0, 34); gr.addColorStop(0, '#f6d27a'); gr.addColorStop(1, '#b8862c');
        c.fillStyle = gr; c.beginPath(); c.moveTo(x + 2, 36); c.quadraticCurveTo(x + 4, 6, x + 20, 2); c.quadraticCurveTo(x + 36, 6, x + 38, 36); c.fill();
        c.strokeStyle = '#8a5a1a'; c.lineWidth = 2; c.stroke();
      }
      const n = 16, pw = w / n;                                        // gilt-framed panels, a cloud scroll in each
      for (let i = 0; i < n; i++) {
        const x = i * pw, cx = x + pw / 2, cy = 46 + (h - 58) / 2;
        c.strokeStyle = '#e8bd5a'; c.lineWidth = 5; c.strokeRect(x + 10, 46, pw - 20, h - 58);
        c.lineWidth = 4;
        for (const d of [-1, 1]) {
          c.beginPath(); c.moveTo(cx, cy); c.bezierCurveTo(cx + d * 22, cy - 22, cx + d * 46, cy + 4, cx + d * 30, cy + 12); c.stroke();
          c.beginPath(); c.arc(cx + d * 24, cy + 8, 7, 0, Math.PI * 2); c.stroke();
        }
      }
    }, [rep, 1], true);
    const add = (o) => { o.userData.role = 'skip'; g.add(o); return o; };
    add(mesh(new THREE.BoxGeometry(W, TOP - 0.18, D), red, 0, (TOP - 0.18) / 2, ZC));                     // the body, down to the ground (the hall is open at the sides)
    add(mesh(new THREE.BoxGeometry(W + 0.3, 0.18, D + 0.3), gilt, 0, TOP - 0.09, ZC));                  // gilt top moulding the statues sit on
    add(mesh(new THREE.BoxGeometry(W + 0.24, 0.1, D + 0.24), gilt, 0, TOP - 0.26, ZC));                 // a finer bead below it
    add(mesh(new THREE.BoxGeometry(W + 0.4, 0.3, D + 0.4), red, 0, F + 0.15, ZC));                      // the plinth step at the floor
    add(mesh(new THREE.BoxGeometry(W + 0.44, 0.06, D + 0.44), gilt, 0, F + 0.33, ZC));
    add(mesh(new THREE.PlaneGeometry(W - 0.4, 0.95), new THREE.MeshStandardMaterial({ map: skirtTex(1), roughness: 0.4, metalness: 0.25 }), 0, F + 0.84, Z1 + 0.006, { cast: false }));
    for (const sx of [-1, 1]) {                                        // the two ends, seen from the open sides of the hall
      const e = add(mesh(new THREE.PlaneGeometry(D - 0.4, 0.95), new THREE.MeshStandardMaterial({ map: skirtTex(D / W), roughness: 0.4, metalness: 0.25 }), sx * (W / 2 + 0.006), F + 0.84, ZC, { cast: false }));
      e.rotation.y = sx * Math.PI / 2;
    }
  }
  // backdrop: red with gold rays
  const backdrop = mesh(new THREE.PlaneGeometry(25.6, C - 2.0), std(0xffffff, {   // floor-to-beam behind the statues
    map: canvasTex(1024, 400, (c, w, h) => {
      c.fillStyle = '#7a1712'; c.fillRect(0, 0, w, h);
      for (const cx of [w * 0.2, w * 0.5, w * 0.8]) {
        c.strokeStyle = 'rgba(224,176,79,0.5)'; c.lineWidth = 3;
        for (let i = 0; i < 40; i++) { const a = Math.PI + i / 39 * Math.PI; c.beginPath(); c.moveTo(cx, h * 0.55); c.lineTo(cx + Math.cos(a) * 260, h * 0.55 + Math.sin(a) * 260); c.stroke(); }
      }
      c.strokeStyle = '#e0b04f'; c.lineWidth = 14; c.strokeRect(7, 7, w - 14, h - 14);
    }),
  }), 0, F + 1.5 + (C - 2.0) / 2, ZB + 0.3, { cast: false });
  g.add(backdrop);
  // shrine frame (神龕) and its gold roof. Hidden: the statues now rise to just under the ceiling, and the frame
  // stood in their way. (Kept, not removed, so the baked-lighting fingerprint still matches.)
  const shrineStart = g.children.length;
  for (const sx of [-1, 1]) {
    g.add(mesh(new THREE.BoxGeometry(0.8, 11.2, 0.8), gold, sx * 5.9, F + 1.5 + 5.6, DZ + 1.6));
  }
  g.add(mesh(new THREE.BoxGeometry(12.8, 0.9, 1.0), gold, 0, F + 12.8, DZ + 1.6));
  g.add(roof({ halfW: 7.2, zFront: DZ + 2.8, zBack: DZ - 1.8, yEave: F + 13.2, yRidge: F + 14.6, lift: 0.5, mat: std(0xd6a548, { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }), gableMat: gold }));
  const val = mesh(new THREE.PlaneGeometry(11.4, 1.1), std(0xffffff, {
    side: THREE.DoubleSide,
    map: canvasTex(1024, 192, (c, w, h) => {
      c.fillStyle = '#c4271c'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2c14e';
      for (let x = 0; x < w; x += 96) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 48, h - 60); c.lineTo(x + 96, h); c.fill(); }
      c.font = `96px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('有 求 必 應', w / 2, 66);
    }, null, true),
  }), 0, F + 12.0, DZ + 2.12, { cast: false });
  g.add(val);
  g.children.slice(shrineStart).forEach((o) => (o.visible = false));
  const center = deity(2.3); center.position.set(0, F + 1.5, DZ + 0.3); g.add(center);
  const sides = [];
  for (const sx of [-1, 1]) {
    const d = deity(1.7, sx < 0 ? 0x7fd0a8 : 0x9fb6ff);
    d.position.set(sx * 9.4, F + 1.5, DZ + 0.3);
    g.add(d); sides.push(d);
  }
  // vertical couplet plaques on the front shrine pillars
  for (const [sx, txt] of [[-1, '歇腳'], [1, '安心']]) {
    const p = mesh(new THREE.PlaneGeometry(0.75, 2.7), new THREE.MeshStandardMaterial({ map: plaqueTex(txt, true) }), sx * 5.9, F + 8.4, DZ + 2.02, { cast: false });
    p.visible = false; g.add(p);                                       // they hung on the shrine's pillars
  }
  // big hanging plaque above the altar
  g.add(mesh(new THREE.PlaneGeometry(6, 1.7), new THREE.MeshStandardMaterial({ map: plaqueTex('慈光普照') }), 0, F + C - 1.3, -21.6, { cast: false }));

  // ---- offering table ----
  const table = new THREE.Group();
  table.add(mesh(new THREE.BoxGeometry(9, 0.2, 1.8), WOOD(3, 1), 0, 1.15, 0));
  table.add(mesh(new THREE.BoxGeometry(8.9, 1.05, 0.05), std(0xffffff, {
    map: canvasTex(1024, 128, (c, w, h) => {
      c.fillStyle = '#b8231a'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#f2c14e'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
      c.fillStyle = '#f2c14e'; c.font = `84px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('合 境 平 安', w / 2, h / 2 + 4);
    }, null, true),
  }), 0, 0.55, 0.9));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) table.add(mesh(new THREE.BoxGeometry(0.2, 1.05, 0.2), WOOD(0.3, 1), sx * 4.3, 0.55, sz * 0.75));
  const bronze = std(0x6b5236, { metalness: 0.75, roughness: 0.35 });
  table.add(mesh(new THREE.CylinderGeometry(0.5, 0.38, 0.5, 20), bronze, 0, 1.5, -0.3));
  for (const x of [-3.6, -2.6, 2.6, 3.6]) {
    const c = candle(0.95 - Math.abs(x) * 0.09, x * 13.7);
    c.position.set(x, 1.25, -0.4); table.add(c);
  }
  for (const x of [-1.6, 1.6]) {
    table.add(mesh(new THREE.CylinderGeometry(0.4, 0.28, 0.08, 18), gold, x, 1.3, -0.4));
    for (let i = 0; i < 5; i++) table.add(Object.assign(mesh(new THREE.SphereGeometry(0.13, 12, 10), std([0xe9c840, 0xf2a33a, 0xc23a2a][i % 3]), x + Math.cos(i * 1.3) * 0.18, 1.45 + (i === 4 ? 0.15 : 0), -0.4 + Math.sin(i * 1.3) * 0.18), { name: 'standIn' }));
  }
  for (const x of [-0.9, 0.9]) {                                            // vases of flowers
    table.add(Object.assign(mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.5, 14), std(0x2c4f86, { metalness: 0.3, roughness: 0.3 }), x * 3.3, 1.5, -0.6), { name: 'standIn' }));   // swapped for real scans in main.js
  }
  const tube = new THREE.Group();
  tube.add(mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.6, 16, 1, true), std(0x8a5a2b, { side: THREE.DoubleSide })));
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.15;
    const st = mesh(new THREE.BoxGeometry(0.03, 0.8, 0.012), std(0xd8b979), Math.cos(a) * r, 0.2, Math.sin(a) * r, { cast: false });
    st.rotation.z = (Math.random() - 0.5) * 0.2; tube.add(st);
  }
  tube.position.set(-1.0, 1.55, 0.4);
  table.add(tube);
  table.position.set(0, F, -27.3);
  g.add(table);

  // ---- lamp walls (光明燈) lining both sides of the hall: retired (hidden) — blessings now hang on the Bodhi tree (main.js) ----
  const lampStart = g.children.length;
  const COLS = 34, ROWS = 20, cell = 0.6, z0 = -29.5;
  // each niche: a gilded figurine rendered from the scanned Guanyin (tools/bake/render_figure.py)
  const lampTex = TL.load('/temple/assets/env/lamp_cell.webp');
  lampTex.colorSpace = THREE.SRGBColorSpace; lampTex.anisotropy = 8;
  const cells = new THREE.InstancedMesh(new THREE.PlaneGeometry(cell * 0.9, cell * 0.9), new THREE.MeshBasicMaterial({ map: lampTex }), COLS * ROWS * 2);
  const slots = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), one = new THREE.Vector3(1, 1, 1);
  let k = 0;
  for (const sx of [-1, 1]) {
    const x = sx * (HW - 0.55);
    g.add(mesh(new THREE.BoxGeometry(0.5, ROWS * cell + 0.6, COLS * cell + 0.6), std(0x4a1a12), x + sx * 0.05, F + 1.2 + ROWS * cell / 2, z0 + COLS * cell / 2));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -sx * Math.PI / 2);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = new THREE.Vector3(x - sx * 0.27, F + 1.5 + r * cell, z0 + cell / 2 + c * cell);
      cells.setMatrixAt(k, m4.compose(p, q, one));
      const lit = Math.random() < 0.22;                                   // a scattering of lit lamps, not a wall of light
      cells.setColorAt(k, col.set(lit ? 0xffe2b8 : 0x3a2c22).multiplyScalar(lit ? 0.5 + Math.random() * 0.15 : 1));
      slots.push({ pos: p, side: sx, lit });
      k++;
    }
    const pl = mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshStandardMaterial({ map: plaqueTex('光明燈') }), x - sx * 0.32, F + 1.5 + ROWS * cell + 0.3, z0 + COLS * cell / 2, { cast: false });
    pl.rotation.y = -sx * Math.PI / 2; g.add(pl);
  }
  g.add(cells);
  // lacquered lattice in front of the niches, so they read as recessed boxes
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std(0x3a160e, { roughness: 0.45 }), (ROWS + 1 + COLS + 1) * 2);
  let bi = 0; const bq = new THREE.Quaternion(), bp = new THREE.Vector3(), bs = new THREE.Vector3();
  for (const sx of [-1, 1]) {
    const x = sx * (HW - 0.55) - sx * 0.31;
    for (let r = 0; r <= ROWS; r++) bars.setMatrixAt(bi++, m4.compose(bp.set(x, F + 1.2 + r * cell, z0 + COLS * cell / 2), bq, bs.set(0.08, 0.05, COLS * cell)));
    for (let c = 0; c <= COLS; c++) bars.setMatrixAt(bi++, m4.compose(bp.set(x, F + 1.2 + ROWS * cell / 2, z0 + c * cell), bq, bs.set(0.08, ROWS * cell, 0.05)));
  }
  g.add(bars);
  g.children.slice(lampStart).forEach((o) => (o.visible = false));

  // ---- kneeling cushions (拜墊) in the nave ----
  const spots = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) spots.push(new THREE.Vector3(-7.5 + c * 2.5, F, -24 + r * 2.6));
  const cushion = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.08, 0.7), pbr('red_plaster_weathered', 1, 1, { noDiff: true, color: 0x8a1c15, roughness: 0.95 }), spots.length);
  const trim = new THREE.InstancedMesh(new THREE.BoxGeometry(1.04, 0.04, 0.74), std(0x9a7430, { metalness: 0.6, roughness: 0.5 }), spots.length);
  spots.forEach((p, i) => {
    cushion.setMatrixAt(i, m4.makeTranslation(p.x, F + 0.06, p.z));   // top at F + 0.10: a kneeler (lifted 0.22, sinking 0.13 onto the heels) rests on it
    trim.setMatrixAt(i, m4.makeTranslation(p.x, F + 0.02, p.z));
  });
  cushion.receiveShadow = true; cushion.name = 'cushions';
  g.add(cushion, trim);

  // ---- exterior: front facade brackets, roofs, ridges, plaques ----
  const brackets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.3, 0.5), gold, 60);
  for (let i = 0; i < 60; i++) brackets.setMatrixAt(i, m4.makeTranslation(-HW + 0.3 + i * (HW * 2 - 0.6) / 59, F + C + 0.15, ZF - 1.1));
  g.add(brackets);
  g.add(mesh(new THREE.BoxGeometry(HW * 2, 0.7, 0.5), std(0xffffff, { map: bt }), 0, F + C - 0.5, ZF - 1.1));
  g.add(mesh(new THREE.PlaneGeometry(6.2, 1.8), new THREE.MeshStandardMaterial({ map: plaqueTex('歇腳廟') }), 0, F + C - 1.9, ZF - 0.8, { cast: false }));
  const tiles = TILES(20, 9);
  g.add(roof({ halfW: HW + 2.8, zFront: ZF + 2.2, zBack: ZB - 2.4, yEave: F + C + 0.5, yRidge: F + C + 5.4, lift: 1.4, mat: tiles, gableMat: BRICK(0.35, 0.35) }));
  g.add(mesh(new THREE.BoxGeometry(HW * 1.4, 2.4, (ZF - ZB) * 0.42), PLASTER(6, 1), 0, F + C + 5.6, (ZF + ZB) / 2 - 0.5));
  g.add(mesh(new THREE.PlaneGeometry(5, 1.4), new THREE.MeshStandardMaterial({ map: plaqueTex('正殿') }), 0, F + C + 5.7, (ZF + ZB) / 2 - 0.5 + (ZF - ZB) * 0.21 + 0.02, { cast: false }));
  const tiles2 = TILES(14, 5);
  const ridgeZ = (ZF + ZB) / 2 - 0.5;
  g.add(roof({ halfW: HW * 0.78, zFront: ridgeZ + 8.2, zBack: ridgeZ - 8.2, yEave: F + C + 6.8, yRidge: F + C + 10.2, lift: 1.1, mat: tiles2, gableMat: BRICK(0.35, 0.35) }));
  g.add(ridge({ halfW: HW * 0.78, y: F + C + 10.2, z: ridgeZ, s: 1.6 }));

  return { group: g, table, tube, tableBurnerPos: new THREE.Vector3(0, F + 1.8, -27.6), lamps: { cells, slots }, cushions: { mesh: cushion, spots }, altar: { center, sides, backdrop, murals, group: g } };
}

function sideCorridor(sx) {
  // covered walkway along the courtyard sides (護龍)
  const g = new THREE.Group();
  const red = LACQUER(2);
  g.add(mesh(new THREE.BoxGeometry(0.4, 4.5, 25), BRICK(10, 2), sx * 19.3, 2.25, 7));
  for (let z = -4.5; z <= 18.5; z += 3.83) g.add(mesh(new THREE.CylinderGeometry(0.22, 0.25, 4, 12), red, sx * 16.6, 2, z));
  const r = roof({ halfW: 12.6, zFront: 2.4, zBack: -2.4, yEave: 4.0, yRidge: 5.6, lift: 0.5, mat: TILES(14, 2), gableMat: BRICK(0.35, 0.35) });
  r.rotation.y = Math.PI / 2;
  r.position.set(sx * 18, 0, 7);
  g.add(r);
  return g;
}

// ---------- forest: photoreal tree billboards (rendered from CC0 Poly Haven models, tools/bake/render_trees.py) ----------
const TREES = [
  ['fir0', 18.9, 6.5], ['fir1', 14.1, 6.1], ['fir2', 14.5, 6.3],
  ['pine0', 20.4, 8.3], ['pine1', 14.9, 7.6], ['pine2', 17.5, 7.9], ['broad0', 5.0, 4.8],
];
function treeKind(name, h, w, planes) {
  const tex = TL.load(`/temple/assets/env/tree_${name}.webp`);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const parts = [];
  for (let i = 0; i < planes; i++) parts.push(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0).rotateY((i * Math.PI) / planes));
  const geo = mergeGeos(parts);
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide });
  mat.color.setRGB(0.95, 1.4, 0.65);   // fresh, vivid green leaves
  return { geo, mat };
}
function mergeGeos(list) {
  const pos = [], uv = [], idx = []; let off = 0;
  for (const g of list) {
    const p = g.attributes.position, u = g.attributes.uv, ix = g.index;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
function forest(scene) {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const spots = [[], [], [], [], [], []];
  for (let tries = 0, n = 0; n < 70 && tries < 9000; tries++) {
    const x = (rnd() - 0.5) * 190, z = -120 + rnd() * 200;
    if (Math.abs(x) < 24 && z > -44 && z < 21) continue;               // the temple and its walls
    if (Math.abs(x) < 16 && z >= 21 && z < 46) continue;               // open plaza in front of the gate
    if (x > -36 && x < -15 && z > -14 && z < 22) continue;              // the lotus lake and its shore (west side)
    if (Math.hypot(x + 38, z - 4) < 17) continue;                       // the great tree's crown
    if (Math.hypot(x - 36, z - 4) < 25) continue;                       // the blessing banyan's crown
    if (Math.abs(x) < 6 && z >= 46) continue;                          // the approach path
    if (!onPlateau(x, z, 0.97) || onPlateau(x, z, 0.85)) continue;     // a thin fringe along the cliff edge; the view opens to the peaks
    spots[Math.floor(rnd() * 6)].push([x, z, 0.55 + rnd() * 0.35, rnd() * Math.PI]); n++;
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  spots.forEach((list, k) => {
    const [name, h, w] = TREES[k], { geo, mat } = treeKind(name, h, w, 2);
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, z, sc, yaw], i) => im.setMatrixAt(i, m4.compose(v.set(x, 0, z), q.setFromAxisAngle(up, yaw), s.setScalar(sc))));
    im.userData.role = 'skip'; im.frustumCulled = false;
    scene.add(im);
  });
  // broadleaf trees in the courtyard and by the gate (three planes: they're seen up close)
  const { geo, mat } = treeKind('broad0', 5.0, 4.8, 3);
  const near = [[-12, 30, 2.3], [13, 31, 2.0], [-13.5, 12, 2.1], [13.5, -2, 1.9]];
  const im = new THREE.InstancedMesh(geo, mat, near.length);
  near.forEach(([x, z, sc], i) => im.setMatrixAt(i, m4.compose(v.set(x, 0, z), q.setFromAxisAngle(up, i), s.setScalar(sc))));
  im.userData.role = 'skip'; im.name = 'nearTrees'; im.userData.spots = near;   // swapped for a real 3D tree in main.js
  scene.add(im);
}

export function buildWorld(scene) {
  scene.fog = new THREE.FogExp2(0x909184, 0.0085);   // matches the misty horizon of the sky

  // the paving: one plane (as baked), cut to the old stone's ragged outline by a mask, mossy where it frays.
  // Mask: G = stone here (alpha), R = moss. 10 px per metre; canvas row 0 is the plane's far (z = -32) end.
  const mask = canvasTex(440, 700, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const x = -22 + (px + 0.5) / 10, z = -32 + (py + 0.5) / 10, i = (py * w + px) * 4;
      const d = pavedDist(x, z) + (vnoise(x * 0.35, z * 0.35) - 0.5) * 3.2 + (vnoise(x * 1.3, z * 1.3) - 0.5) * 1.1;
      const moss = Math.min(1, Math.max(0, 1 - d / 2.6) * 0.9 + Math.max(0, vnoise(x * 0.8 + 40, z * 0.8) - 0.72) * 2.2);
      img.data[i] = 255 * moss; img.data[i + 1] = d > 0 ? 255 : 0; img.data[i + 2] = 0; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  });
  mask.colorSpace = THREE.NoColorSpace;
  const paving = pbr('granite_tile_04', 44 / 3, 70 / 3, { alphaMap: mask, alphaTest: 0.5, color: 0xbfc2bd });   // weathered grey granite flagstones (青石板), ~0.75 m slabs
  paving.onBeforeCompile = (sh) => {                                  // moss and grass creeping in near the edges
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_ALPHAMAP
        float moss = texture2D(alphaMap, vAlphaMapUv).r;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.68, 0.42), moss * 0.85);
      #endif`);
  };
  const ground = mesh(new THREE.PlaneGeometry(44, 70), paving, 0, 0, 3, { cast: false });
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grass = mesh(new THREE.PlaneGeometry(400, 400), pbr('leafy_grass', 130, 130, { color: 0x9cb47e }), 0, -0.02, 0, { cast: false });
  grass.rotation.x = -Math.PI / 2; grass.userData.role = 'occ'; grass.visible = false;   // replaced by the plateau (scenery.js)
  scene.add(grass);

  const gateG = gate();
  scene.add(gateG);
  // the side walkways are gone: the courtyard opens onto bamboo and, on the left, a lotus lake (main.js). Hidden, not
  // removed, so the baked-lighting fingerprint still matches.
  for (const sx of [-1, 1]) { const c = sideCorridor(sx); c.visible = false; scene.add(c); }
  // perimeter wall behind the hall
  const wallMat = BRICK(14, 1);
  // (hidden too: the temple now stands open in the bamboo and the forest, like a mountain temple)
  scene.add(Object.assign(mesh(new THREE.BoxGeometry(40, 2.5, 0.5), wallMat, 0, 1.25, -38), { visible: false }));
  for (const sx of [-1, 1]) scene.add(Object.assign(mesh(new THREE.BoxGeometry(0.5, 2.46, 34), wallMat, sx * 19.8, 1.23, -21), { visible: false }));

  const hall = mainHall();
  scene.add(hall.group);
  const lu = tianGongLu();
  lu.position.set(0, 0, 8);
  lu.scale.setScalar(1.3);
  scene.add(lu);
  forest(scene);

  const lanterns = [];
  [-12, -6, 0, 6, 12].forEach((x, i) => { const l = lantern(x, HALL.floor + HALL.ceil - 1.6, -5.2, 1.4, [3, 0, 1, 0, 3][i]); lanterns.push(l); scene.add(l); });   // palace lanterns at the ends, round and drum between
  for (const sx of [-1, 1]) { const l = lantern(sx * 4.8, 5.4, 24.6, 1, sx < 0 ? 0 : 4); lanterns.push(l); scene.add(l); }
  // street lanterns in front of the gate
  for (const z of [28, 33]) for (const sx of [-1, 1]) {
    scene.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2), std(DARK_WOOD), sx * 6, 1.6, z));
    const l = lantern(sx * 6, 3.4, z, 0.75, z === 28 ? (sx < 0 ? 2 : 1) : (sx < 0 ? 1 : 2)); lanterns.push(l); scene.add(l);
  }

  // lights
  scene.add(new THREE.HemisphereLight(0xf6e6d0, 0x8a8a78, 0.75));      // warm morning sky over warm-grey ground
  const sun = new THREE.DirectionalLight(0xffe2b4, 2.0);             // golden morning sun
  sun.position.set(-35, 45, 30);
  sun.castShadow = true;
  const S = sun.shadow, small = window.innerWidth < 800;
  S.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(S.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 5, far: 140 });
  S.bias = -0.0004; S.normalBias = 0.12;      // larger normal bias: no stripes (acne) on stone
  scene.add(sun);
  const F = HALL.floor;
  const addLight = (c, i, d, x, y, z) => { const l = new THREE.PointLight(c, i, d, 1.5); l.position.set(x, y, z); scene.add(l); return l; };
  // soft near-white daylight in the hall (clerestory and doors), only the altar a touch warmer
  addLight(0xffe6c8, 55, 30, 0, F + 11, -25);         // altar
  addLight(0xfff4e3, 34, 28, 0, F + 13.5, HALL.domeZ); // dome / clerestory
  addLight(0xfff0e0, 18, 22, -9, F + 8, -15);
  addLight(0xfff0e0, 18, 22, 9, F + 8, -15);
  addLight(0xfff2e6, 24, 24, 0, 10, -3);              // hall porch: light from the open doors
  const luLight = addLight(0xff8a3a, 10, 9, 0, 3.5, 8);
  scene.traverse((o) => { if (o.isMesh && o.material?.map?.userData?.text) o.userData.role = 'occ'; });

  return {
    lanterns, luLight,
    luPos: new THREE.Vector3(0, lu.userData.ashY * 1.3, 8),
    table: hall.table, tube: hall.tube, tableBurnerPos: hall.tableBurnerPos,
    lamps: hall.lamps, cushions: hall.cushions, altar: hall.altar, lu,
    occluders: [gateG],
  };
}
