// 三川殿: the temple's front gate, rebuilt in detail (it's the first thing every visitor sees).
// The old code-built gate in scene.js stays in the scene but hidden, so the baked-lighting fingerprint still matches;
// everything here is live-lit (role 'skip'). Layout is unchanged: three door bays at x = -6, 0, 6, platform z 18.5–25.5,
// front colonnade at z = 24.2, the scanned dragon pillars (main.js) at x = ±1.6.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex } from './scene.js';

const Z = 22, FRONT = Z + 0.31, COLZ = Z + 2.2, TOP = 0.3;            // wall centre, wall face, colonnade, platform top
const SERIF = '"TempleKai", "LXGW WenKai TC", "Noto Serif TC", serif';
const TL = new THREE.TextureLoader();

// ---------- carved stone: draw a height field (white = raised), get a shaded colour map and a matching normal map ----------
function relief(w, h, draw, { base = [150, 154, 150], depth = 3, repeat } = {}) {
  const hc = document.createElement('canvas'); hc.width = w; hc.height = h;
  const g = hc.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.filter = 'blur(1.6px)'; draw(g, w, h); g.filter = 'none';
  const H = g.getImageData(0, 0, w, h).data, ht = (x, y) => H[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4] / 255;
  const cc = document.createElement('canvas'); cc.width = w; cc.height = h; const cg = cc.getContext('2d'), cd = cg.createImageData(w, h);
  const nc = document.createElement('canvas'); nc.width = w; nc.height = h; const ng = nc.getContext('2d'), nd = ng.createImageData(w, h);
  let seed = w * 7 + h; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, v = ht(x, y), dx = ht(x + 1, y) - ht(x - 1, y), dy = ht(x, y + 1) - ht(x, y - 1);
    const lit = 1 + (-dx + dy) * 1.6, ao = 0.62 + 0.38 * v, n = 0.93 + rnd() * 0.12;          // light from the upper left
    for (let k = 0; k < 3; k++) cd.data[i + k] = Math.min(255, base[k] * lit * ao * n);
    cd.data[i + 3] = 255;
    let nx = -dx * depth, ny = dy * depth; const l = Math.hypot(nx, ny, 1);
    nd.data[i] = (nx / l * 0.5 + 0.5) * 255; nd.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; nd.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[i + 3] = 255;
  }
  cg.putImageData(cd, 0, 0); ng.putImageData(nd, 0, 0);
  const map = new THREE.CanvasTexture(cc), normalMap = new THREE.CanvasTexture(nc);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = normalMap.anisotropy = 8;
  if (repeat) for (const t of [map, normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.82 });
}
// motifs for the height field
const frame = (g, w, h, a = 10) => { g.strokeStyle = '#fff'; g.lineWidth = a; g.strokeRect(a, a, w - 2 * a, h - 2 * a); g.lineWidth = a * 0.35; g.strokeRect(a * 2.6, a * 2.6, w - 5.2 * a, h - 5.2 * a); };
function cloud(g, x, y, s, flip = 1) {                                   // 祥雲: a curl with a tail
  g.lineWidth = s * 0.16; g.strokeStyle = '#fff'; g.lineCap = 'round';
  g.beginPath(); g.arc(x, y, s * 0.5, Math.PI, Math.PI * 2.75 * flip, flip < 0); g.stroke();
  g.beginPath(); g.arc(x, y, s * 0.22, 0, Math.PI * 1.6); g.stroke();
  g.beginPath(); g.moveTo(x - s * 0.5 * flip, y); g.quadraticCurveTo(x - s * 1.1 * flip, y + s * 0.5, x - s * 1.6 * flip, y + s * 0.15); g.stroke();
}
function fret(g, w, h, u) {                                              // 回紋 key-fret band
  g.strokeStyle = '#fff'; g.lineWidth = u * 0.22;
  for (let x = u * 0.4; x < w - u; x += u * 1.3) {
    const y0 = h / 2 - u / 2; g.beginPath();
    g.moveTo(x, y0 + u); g.lineTo(x, y0); g.lineTo(x + u, y0); g.lineTo(x + u, y0 + u * 0.75); g.lineTo(x + u * 0.3, y0 + u * 0.75); g.lineTo(x + u * 0.3, y0 + u * 0.35); g.lineTo(x + u * 0.65, y0 + u * 0.35);
    g.stroke(); g.beginPath(); g.moveTo(x, y0 + u); g.lineTo(x + u * 1.3, y0 + u); g.stroke();
  }
}
function vase(g, cx, by, s) {                                            // 花瓶 (平安) with peonies and leaves
  g.fillStyle = '#bbb'; g.beginPath();
  g.moveTo(cx - s * 0.18, by); g.bezierCurveTo(cx - s * 0.55, by - s * 0.25, cx - s * 0.45, by - s * 0.75, cx - s * 0.12, by - s * 0.85);
  g.lineTo(cx - s * 0.16, by - s * 1.0); g.lineTo(cx + s * 0.16, by - s * 1.0); g.lineTo(cx + s * 0.12, by - s * 0.85);
  g.bezierCurveTo(cx + s * 0.45, by - s * 0.75, cx + s * 0.55, by - s * 0.25, cx + s * 0.18, by); g.fill();
  g.fillStyle = '#fff';
  for (const [dx, dy, r] of [[0, -1.32, 0.2], [-0.34, -1.18, 0.15], [0.36, -1.2, 0.16], [-0.18, -1.55, 0.12], [0.2, -1.5, 0.11]]) {
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; g.beginPath(); g.arc(cx + (dx + Math.cos(a) * r * 0.55) * s, by + (dy + Math.sin(a) * r * 0.55) * s, r * 0.5 * s, 0, 7); g.fill(); }
  }
  g.fillStyle = '#ddd';
  for (const [dx, dy, a] of [[-0.5, -1.0, -0.6], [0.52, -1.0, 0.6], [-0.15, -0.95, -0.2], [0.18, -0.92, 0.25]]) {
    g.save(); g.translate(cx + dx * s, by + dy * s); g.rotate(a); g.beginPath(); g.ellipse(0, 0, s * 0.07, s * 0.2, 0, 0, 7); g.fill(); g.restore();
  }
}

// ---------- painted woodwork (彩繪), in faded mineral colours ----------
const C = { blue: '#4a6470', green: '#5f7a64', ochre: '#b48a4a', cinnabar: '#8a3b2c', gold: '#c9a25a', ink: '#23282a', paper: '#c9bc9c' };
function beamTex(len) {                                                  // 包巾 centre with lotus medallions, banded ends
  return canvasTex(2048, 128, (c, w, h) => {
    c.fillStyle = C.blue; c.fillRect(0, 0, w, h);
    c.fillStyle = C.green; c.fillRect(0, 10, w, h - 20);
    c.strokeStyle = C.gold; c.lineWidth = 4; c.strokeRect(2, 6, w - 4, h - 12);
    const seg = Math.max(3, Math.round(len / 3.2));
    for (let i = 0; i < seg; i++) {
      const x0 = (i / seg) * w, sw = w / seg;
      c.fillStyle = C.blue; c.fillRect(x0 + 6, 14, 26, h - 28); c.fillRect(x0 + sw - 32, 14, 26, h - 28);
      c.fillStyle = C.ochre; c.beginPath(); c.ellipse(x0 + sw / 2, h / 2, sw * 0.28, h * 0.32, 0, 0, 7); c.fill();
      c.fillStyle = C.paper; c.beginPath(); c.ellipse(x0 + sw / 2, h / 2, sw * 0.24, h * 0.24, 0, 0, 7); c.fill();
      c.strokeStyle = C.cinnabar; c.lineWidth = 3;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; c.beginPath(); c.ellipse(x0 + sw / 2 + Math.cos(a) * 14, h / 2 + Math.sin(a) * 11, 9, 5, a, 0, 7); c.stroke(); }
      c.fillStyle = C.gold; c.beginPath(); c.arc(x0 + sw / 2, h / 2, 7, 0, 7); c.fill();
      c.strokeStyle = C.gold; c.lineWidth = 2;
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x0 + sw / 2 + s * (sw * 0.36 + k * 10), h / 2, 18 - k * 4, 0, 7); c.stroke(); }
    }
  });
}
const friezeTex = (seed) => canvasTex(1024, 256, (c, w, h) => {            // 水車堵: framed vignettes of landscape and clouds
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  c.fillStyle = C.ink; c.fillRect(0, 0, w, h);
  c.fillStyle = C.blue; c.fillRect(10, 10, w - 20, h - 20);
  const n = 3, pw = (w - 40) / n;
  for (let i = 0; i < n; i++) {
    const x0 = 20 + i * pw;
    c.fillStyle = C.gold; c.fillRect(x0 + 6, 22, pw - 12, h - 44);
    c.fillStyle = C.paper; c.fillRect(x0 + 12, 28, pw - 24, h - 56);
    // ink landscape: layered hills, a pine, a pavilion
    for (let l = 0; l < 3; l++) {
      c.fillStyle = ['rgba(95,122,100,.35)', 'rgba(74,100,112,.5)', 'rgba(35,40,42,.65)'][l];
      c.beginPath(); c.moveTo(x0 + 12, h - 28);
      for (let x = 0; x <= pw - 24; x += 12) c.lineTo(x0 + 12 + x, h - 40 - l * 22 - Math.abs(Math.sin(x * 0.02 + l * 2 + seed + i)) * (60 - l * 10) * r());
      c.lineTo(x0 + pw - 12, h - 28); c.fill();
    }
    c.strokeStyle = C.ink; c.lineWidth = 3; const px = x0 + 40 + r() * (pw - 120);
    c.beginPath(); c.moveTo(px, h - 40); c.lineTo(px + 6, 70); c.stroke();
    c.fillStyle = 'rgba(35,60,45,.8)'; for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(px + 6 + (k % 2 ? 18 : -14), 74 + k * 16, 24, 8, 0, 0, 7); c.fill(); }
    c.fillStyle = C.cinnabar; c.fillRect(px + 50, h - 74, 26, 22); c.fillStyle = C.ink; c.beginPath(); c.moveTo(px + 44, h - 74); c.lineTo(px + 63, h - 90); c.lineTo(px + 82, h - 74); c.fill();
  }
  c.strokeStyle = C.gold; c.lineWidth = 3;
  for (let x = 30; x < w; x += 70) { c.beginPath(); c.arc(x, 16, 5, 0, 7); c.stroke(); c.beginPath(); c.arc(x, h - 16, 5, 0, 7); c.stroke(); }
});
const ceilingTex = () => canvasTex(512, 512, (c, w, h) => {              // porch ceiling: coffers with faded lotus
  c.fillStyle = C.ink; c.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const x = k * 128, y = r * 128;
    c.fillStyle = C.green; c.fillRect(x + 6, y + 6, 116, 116);
    c.fillStyle = C.blue; c.fillRect(x + 18, y + 18, 92, 92);
    c.fillStyle = C.ochre; for (let p = 0; p < 8; p++) { const a = (p / 8) * Math.PI * 2; c.beginPath(); c.ellipse(x + 64 + Math.cos(a) * 18, y + 64 + Math.sin(a) * 18, 14, 6, a, 0, 7); c.fill(); }
    c.fillStyle = C.gold; c.beginPath(); c.arc(x + 64, y + 64, 9, 0, 7); c.fill();
  }
}, [6, 1.2]);

// door leaf art: aged cinnabar boards, gilt frame, a door god (public-domain 1922 plates) or bronze studs
function leafTex(godImg, flip) {
  return canvasTex(512, 1536, (c, w, h) => {
    c.fillStyle = '#6e2a22'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4) { c.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`; c.fillRect(x, 0, 2, h); }   // board grain
    c.strokeStyle = C.gold; c.lineWidth = 10; c.strokeRect(18, 18, w - 36, h - 36);
    c.lineWidth = 3; c.strokeRect(40, 40, w - 80, h - 80);
    if (godImg) {
      const s = (h * 0.7) / godImg.height, gw = godImg.width * s, gh = godImg.height * s;   // tall as the leaf allows; the halo's edges may crop
      c.save(); if (flip) { c.translate(w, 0); c.scale(-1, 1); }
      c.save(); c.beginPath(); c.rect(44, 44, w - 88, h - 88); c.clip();
      c.globalAlpha = 0.93; c.drawImage(godImg, (w - gw) / 2, 90, gw, gh); c.restore(); c.restore();
      c.fillStyle = 'rgba(30,10,6,.35)'; c.fillRect(54, h * 0.86, w - 108, h * 0.1);
      c.strokeStyle = C.gold; c.lineWidth = 3; c.strokeRect(54, h * 0.86, w - 108, h * 0.1);
    }
  });
}

// ---------- geometry helpers ----------
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
function textBoard(lines, w, h, { fg = '#d8b56a', bg = '#2a2f30', size = 0.62 } = {}) {   // vertical carved couplet
  return canvasTex(256, Math.round(256 * h / w), (c, cw, ch) => {
    c.fillStyle = bg; c.fillRect(0, 0, cw, ch);
    c.strokeStyle = 'rgba(216,181,106,.6)'; c.lineWidth = 4; c.strokeRect(10, 10, cw - 20, ch - 20);
    c.font = `${Math.round(cw * size)}px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const step = (ch - 60) / lines.length;
    [...lines].forEach((t, i) => {
      const y = 30 + step * (i + 0.5);
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillText(t, cw / 2 + 2, y + 3);     // carved: dark lip, gilt face
      c.fillStyle = fg; c.fillText(t, cw / 2, y);
    });
  }, null, true);
}
// 斗拱 bracket set: blocks and crossed arms in two tiers with a sloping cantilever, painted
function bracketGeo() {
  const parts = [], col = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const add = (w, h, d, x, y, z, hex, rx = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, z); parts.push(col(g.toNonIndexed(), hex)); };
  const blk = '#5f7a64', arm = '#4a6470', gold = '#b8954f';
  add(0.34, 0.2, 0.34, 0, 0.1, 0, blk); add(0.38, 0.04, 0.38, 0, 0.22, 0, gold);
  add(1.05, 0.15, 0.14, 0, 0.32, 0, arm); add(0.14, 0.15, 0.95, 0, 0.32, 0.12, arm);
  for (const [x, z] of [[-0.45, 0], [0.45, 0], [0, 0.55]]) { add(0.2, 0.13, 0.2, x, 0.46, z, blk); add(0.22, 0.03, 0.22, x, 0.54, z, gold); }
  add(1.6, 0.14, 0.14, 0, 0.62, 0, arm); add(0.14, 0.14, 1.3, 0, 0.62, 0.25, arm);
  for (const [x, z] of [[-0.72, 0], [0.72, 0], [0, 0.85]]) add(0.2, 0.13, 0.2, x, 0.76, z, blk);
  add(0.12, 0.12, 1.4, 0, 0.66, 0.55, '#6b2f26', -0.38);                // 昂: the sloping cantilever
  return mergeGeometries(parts);
}

// ---------- the gate ----------
export function buildGate(scene, { gl, isMobile, oldGate }) {
  // hide every plain mesh of the old gate (walls, doors, columns, beams, plaques, platform); keep its roofs, ridges and the
  // dragon-pillar stand-ins (main.js swaps those for the scans)
  if (oldGate) for (const o of oldGate.children) if (o.isMesh) o.visible = false;

  const G = new THREE.Group(); G.name = 'gate3'; G.userData.role = 'skip';
  const stone = relief(512, 512, (g, w, h) => {                          // dressed 青斗石: faint chisel courses
    g.fillStyle = '#777'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a5a5a'; for (let y = 0; y < h; y += 128) g.fillRect(0, y, w, 3);
    for (let y = 0; y < h; y += 128) for (let x = (y / 128) % 2 ? 0 : 128; x < w; x += 256) g.fillRect(x, y, 3, 128);
  }, { base: [158, 160, 154], depth: 1.5, repeat: [2, 2] });
  const granite = relief(512, 512, (g, w, h) => {
    g.fillStyle = '#888'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#666'; for (let x = 0; x < w; x += 170) g.fillRect(x, 0, 3, h); for (let y = 0; y < h; y += 256) g.fillRect(0, y, w, 3);
  }, { base: [182, 176, 164], depth: 1.2, repeat: [6, 2] });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3e30, roughness: 0.75 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb8954f, metalness: 0.55, roughness: 0.42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 1 });

  // platform (same size as before, now grey dressed stone with a carved curb) and steps for each door
  G.add(box(24, 0.3, 7, granite, 0, 0.15, Z));
  G.add(box(24.1, 0.08, 0.18, stone, 0, 0.26, Z + 3.5), box(24.1, 0.08, 0.18, stone, 0, 0.26, Z - 3.5));
  for (const [x, w] of [[0, 4.2], [-6, 3.0], [6, 3.0]]) for (const s of [1, -1]) {
    G.add(box(w, 0.1, 0.45, granite, x, 0.05, Z + s * 3.72), box(w - 0.2, 0.2, 0.35, granite, x, 0.1, Z + s * 3.62).translateY(0.0));
  }

  // walls between the doors: base course, carved skirt, key-fret waist, body (window), top band, painted frieze
  const panels = {
    skirt: relief(512, 256, (g, w, h) => { frame(g, w, h, 8); vase(g, w / 2, h - 34, 150); cloud(g, w * 0.18, h * 0.45, 46); cloud(g, w * 0.82, h * 0.45, 46, -1); }),
    waist: relief(1024, 96, (g, w, h) => { fret(g, w, h, 46); }),
    top: relief(1024, 160, (g, w, h) => { frame(g, w, h, 6); for (let x = 90; x < w; x += 170) cloud(g, x, h / 2 + 6, 52, (x / 170) % 2 ? 1 : -1); }),
  };
  const friezes = [friezeTex(3), friezeTex(11), friezeTex(23), friezeTex(31)];
  const segs = [[-11.5, -7.4], [-4.6, -1.4], [1.4, 4.6], [7.4, 11.5]];
  segs.forEach(([x0, x1], si) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    G.add(box(w, 5.7, 0.56, stone, cx, TOP + 2.85, Z));                 // the wall core
    for (const side of [1, -1]) {                                         // both faces: plaza and courtyard
      const zf = Z + side * 0.3, out = (d) => zf + side * d, face = (m) => { if (side < 0) m.rotation.y = Math.PI; return m; };
      G.add(box(w + 0.1, 0.45, 0.14, granite, cx, TOP + 0.225, out(0.04)));                       // 櫃台腳 base course
      const sk = face(new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, 1.0), panels.skirt)); sk.position.set(cx, TOP + 0.98, out(0.012)); G.add(sk);
      const ws = face(new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, 0.38), panels.waist)); ws.position.set(cx, TOP + 1.72, out(0.05)); G.add(ws);
      G.add(box(w, 0.06, 0.1, granite, cx, TOP + 1.5, out(0.03)), box(w, 0.06, 0.1, granite, cx, TOP + 1.94, out(0.03)));
      const tp = face(new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, 0.52), panels.top)); tp.position.set(cx, TOP + 4.05, out(0.012)); G.add(tp);
      const fz = face(new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, 1.15), new THREE.MeshStandardMaterial({ map: friezes[si], roughness: 0.8 }))); fz.position.set(cx, TOP + 5.0, out(0.03)); G.add(fz);
      G.add(box(w, 0.1, 0.16, wood, cx, TOP + 4.38, out(0.04)), box(w, 0.1, 0.16, wood, cx, TOP + 5.62, out(0.04)));
      // 竹節窗: stone bamboo-joint window, round on the inner walls, square on the outer ones
      G.add(bambooWindow(cx, TOP + 2.9, out(0.02), si === 1 || si === 2, Math.min(0.9, w * 0.28), stone, dark, side));
    }
  });
  // end walls (gables) closing the two sides
  for (const s of [-1, 1]) G.add(box(0.5, 5.7, 4.9, stone, s * 11.75, TOP + 2.85, Z));

  // door frames, door pins, transoms and leaves
  const godL = new Image(), godR = new Image();
  const godTex = [null, null];
  for (const x of [-6, 0, 6]) {
    const W = 2.8, centre = x === 0;
    for (const s of [-1, 1]) G.add(box(0.32, 4.3, 0.62, stone, x + s * (W / 2 + 0.06), TOP + 2.15, Z));          // jambs
    G.add(box(W + 0.75, 0.42, 0.66, stone, x, TOP + 4.5, Z));                                                 // lintel 門楣
    G.add(box(W + 0.2, 1.05, 0.5, wood, x, TOP + 5.2, Z));                                                     // transom
    for (const side of [1, -1]) {
      const pins = centre ? [-0.75, -0.25, 0.25, 0.75] : [-0.4, 0.4];                                       // 門簪
      for (const px of pins) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 16), gold); p.rotation.x = Math.PI / 2;
        p.position.set(x + px, TOP + 4.5, Z + side * 0.4); G.add(p);
      }
      const ft = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, 0.9), new THREE.MeshStandardMaterial({ map: friezes[(x / 6 + 1 + (side < 0 ? 2 : 0)) % 4], roughness: 0.8 }));
      if (side < 0) ft.rotation.y = Math.PI;
      ft.position.set(x, TOP + 5.25, Z + side * 0.26); if (!centre) G.add(ft);
    }
    G.add(box(W + 0.1, 0.1, 0.34, wood, x, TOP + 0.05, Z));                                                  // low threshold
    // leaves, swung most of the way in so the passage stays clear (hinges at the jambs)
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(x + s * W / 2, TOP, Z - 0.05); pivot.rotation.y = s * -1.36;
      const mats = [wood, wood, wood, wood, null, null];
      const front = new THREE.MeshStandardMaterial({ roughness: 0.6 }), back = new THREE.MeshStandardMaterial({ map: leafTex(null), roughness: 0.65 });
      front.map = leafTex(null); if (centre) godTex[s < 0 ? 0 : 1] = front;
      mats[4] = front; mats[5] = back;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(W / 2, 4.25, 0.1), mats); leaf.position.set(-s * W / 4, 2.125, 0); pivot.add(leaf);
      if (!centre) {                                                                                       // bronze studs 門釘, 5 × 9
        const stud = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), gold, 45);
        const m4 = new THREE.Matrix4(); let k = 0;
        for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) stud.setMatrixAt(k++, m4.makeTranslation(-s * W / 4 + (c - 2) * 0.24, 0.45 + r * 0.42, 0.05));
        pivot.add(stud);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 20), gold); ring.position.set(-s * (W / 2 - 0.22), 2.0, 0.08); pivot.add(ring);
      G.add(pivot);
    }
  }
  godL.onload = () => { godTex[0].map = leafTex(godL, false); godTex[0].needsUpdate = true; };
  godR.onload = () => { godTex[1].map = leafTex(godR, false); godTex[1].needsUpdate = true; };
  godL.src = '/temple/assets/gate/doorgod_l.webp'; godR.src = '/temple/assets/gate/doorgod_r.webp';

  // front colonnade: octagonal stone columns on carved drum bases, carved couplets on the inner four
  const couplets = { 4.6: '歇腳暫聽松下水', '-4.6': '安心常照佛前燈', 7.4: '竹影掃階塵不動', '-7.4': '月穿潭底水無痕' };
  for (const x of [-10, -7.4, -4.6, 4.6, 7.4, 10]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 5.5, 8), stone); col.position.set(x, TOP + 0.55 + 2.75, COLZ); col.rotation.y = Math.PI / 8; G.add(col);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.55, 24), granite); drum.position.set(x, TOP + 0.275, COLZ); G.add(drum);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 6, 24), granite); lip.rotation.x = Math.PI / 2; lip.position.set(x, TOP + 0.55, COLZ); G.add(lip);
    const text = couplets[x];
    if (text) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 4.2), new THREE.MeshStandardMaterial({ map: textBoard(text, 0.26, 4.2), roughness: 0.7 }));
      b.position.set(x, TOP + 3.25, COLZ + 0.315); G.add(b);
    }
  }
  // the courtyard side has its own (plain) colonnade carrying the back beam
  for (const x of [-10, -7.4, -4.6, -1.6, 1.6, 4.6, 7.4, 10]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.31, 5.5, 8), stone); col.position.set(x, TOP + 0.55 + 2.75, Z - 2.2); col.rotation.y = Math.PI / 8; G.add(col);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.55, 24), granite); drum.position.set(x, TOP + 0.275, Z - 2.2); G.add(drum);
  }
  // painted beams over the colonnade and at the back, 雀替 corner braces, hanging lotus pendants 吊筒
  const beamMat = new THREE.MeshStandardMaterial({ map: beamTex(23.4), roughness: 0.75 });
  for (const z of [COLZ, Z - 2.2]) {
    G.add(box(23.4, 0.52, 0.4, [wood, wood, wood, wood, beamMat, beamMat], 0, 6.12, z));
    G.add(box(23.4, 0.22, 0.28, wood, 0, 5.62, z));
  }
  const braceTex = canvasTex(256, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = C.gold; c.strokeStyle = C.cinnabar; c.lineWidth = 5;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.quadraticCurveTo(w * 0.35, h * 0.2, 0, h); c.closePath(); c.fill();
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(w * (0.25 + k * 0.15), h * 0.18, 10 + k * 2, 0, Math.PI * 1.7); c.stroke(); }
  });
  const braceMat = new THREE.MeshStandardMaterial({ map: braceTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.3 });
  for (const x of [-10, -7.4, -4.6, -1.6, 1.6, 4.6, 7.4, 10]) for (const s of [-1, 1]) {
    if ((x === -10 && s < 0) || (x === 10 && s > 0)) continue;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), braceMat); p.position.set(x + s * 0.65, 5.28, COLZ); p.scale.x = -s; G.add(p);
  }
  const lotus = new THREE.LatheGeometry([[0, -0.8], [0.12, -0.72], [0.2, -0.55], [0.17, -0.42], [0.11, -0.36], [0.1, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
  for (const x of [-8.7, -3.1, 3.1, 8.7]) { const l = new THREE.Mesh(lotus, gold); l.position.set(x, 6.1, COLZ + 0.34); G.add(l); }
  // 斗拱 bracket sets on the beams, under the eaves (front and back)
  const bg = bracketGeo(), bmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const bx = [-10, -8.7, -7.4, -6, -4.6, -3.1, -1.6, 0, 1.6, 3.1, 4.6, 6, 7.4, 8.7, 10];
  const br = new THREE.InstancedMesh(bg, bmat, bx.length * 2), m4 = new THREE.Matrix4(), rot = new THREE.Matrix4();
  bx.forEach((x, i) => {
    br.setMatrixAt(i, m4.makeTranslation(x, 6.38, COLZ));
    br.setMatrixAt(bx.length + i, m4.makeTranslation(x, 6.38, Z - 2.2).multiply(rot.makeRotationY(Math.PI)));
  });
  G.add(br);
  // porch ceiling between the wall and the colonnade (front and back)
  const ceil = new THREE.MeshStandardMaterial({ map: ceilingTex(), roughness: 0.8, side: THREE.DoubleSide });
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(23.4, 1.9), ceil); p.rotation.x = Math.PI / 2; p.position.set(0, 6.36, Z + s * 1.25); G.add(p); }

  // plaques: 歇腳廟 facing the plaza, 回頭是岸 facing the courtyard (read as you leave)
  for (const [text, side] of [['歇腳廟', 1], ['回頭是岸', -1]]) {
    const pl = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.25), new THREE.MeshStandardMaterial({ map: plaqueFace(text), roughness: 0.5 }));
    face.position.z = 0.09; pl.add(face);
    pl.add(box(4.9, 1.75, 0.16, wood, 0, 0, 0));
    for (const [w, h, x, y] of [[4.9, 0.16, 0, 0.8], [4.9, 0.16, 0, -0.8], [0.16, 1.75, -2.37, 0], [0.16, 1.75, 2.37, 0]]) pl.add(box(w, h, 0.22, gold, x, y, 0.03));
    const crown = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.8), new THREE.MeshStandardMaterial({ map: crownTex(), transparent: true, alphaTest: 0.4, metalness: 0.4, roughness: 0.45, side: THREE.DoubleSide }));
    crown.position.set(0, 1.18, 0.02); pl.add(crown);
    pl.scale.setScalar(0.75); pl.position.set(0, 5.62, Z + side * 0.42); if (side < 0) pl.rotation.y = Math.PI;
    pl.rotation.x = side * -0.06;                                                        // tilted forward a little, as real plaques hang
    G.add(pl);
  }
  // the raised centre roof sits on a painted clerestory (the old one was plain brick)
  const cl = new THREE.MeshStandardMaterial({ map: friezeTex(41), roughness: 0.8 });
  G.add(box(9, 1.4, 4, [wood, wood, wood, wood, cl, cl], 0, 8.6, Z));
  // a gilded pagoda (寶塔) on the centre ridge, between the ridge dragons
  const pag = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const r = 0.36 - k * 0.07, y = k * 0.3;
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.8, 0.18, 6), gold); tier.position.y = y; pag.add(tier);
    const eave = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 0.75, 0.08, 6), new THREE.MeshStandardMaterial({ color: 0x5f7a64, roughness: 0.6 })); eave.position.y = y + 0.13; pag.add(eave);
  }
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 8), gold); fin.position.y = 1.35; pag.add(fin);
  pag.position.set(0, 11.12, Z); pag.scale.setScalar(1.25); G.add(pag);

  G.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(G);
  return G;
}

// window built from geometry: a stone frame with bamboo-joint bars (竹節窗) over a dark recess
function bambooWindow(cx, cy, z, round, R, stone, dark, side) {
  const g = new THREE.Group(), parts = [];
  const back = new THREE.Mesh(round ? new THREE.CircleGeometry(R, 40) : new THREE.PlaneGeometry(R * 2, R * 1.7), dark);
  if (side < 0) back.rotation.y = Math.PI; back.position.z = -side * 0.01; g.add(back);
  const half = (x) => (round ? Math.sqrt(Math.max(0, R * R - x * x)) : R * 0.85);
  for (let i = -3; i <= 3; i++) {
    const x = (i / 3.5) * R, hh = half(x) - 0.02; if (hh < 0.05) continue;
    parts.push(new THREE.CylinderGeometry(0.045, 0.045, hh * 2, 10).translate(x, 0, 0));
    for (let y = -hh + 0.18; y < hh - 0.1; y += 0.3) parts.push(new THREE.TorusGeometry(0.05, 0.016, 6, 12).rotateX(Math.PI / 2).translate(x, y, 0));
  }
  g.add(new THREE.Mesh(mergeGeometries(parts.map((p) => p.toNonIndexed())), stone));
  if (round) { const t = new THREE.Mesh(new THREE.TorusGeometry(R + 0.05, 0.1, 10, 48), stone); g.add(t); }
  else for (const [w, h, x, y] of [[R * 2 + 0.3, 0.16, 0, R * 0.85 + 0.08], [R * 2 + 0.3, 0.16, 0, -R * 0.85 - 0.08], [0.16, R * 1.7 + 0.3, -R - 0.08, 0], [0.16, R * 1.7 + 0.3, R + 0.08, 0]]) g.add(box(w, h, 0.14, stone, x, y, 0));
  g.position.set(cx, cy, z);
  return g;
}
function plaqueFace(text) {
  return canvasTex(1024, 300, (g, w, h) => {
    g.fillStyle = '#1b2430'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(201,162,90,.7)'; g.lineWidth = 4; g.strokeRect(26, 26, w - 52, h - 52);
    g.font = `${text.length > 3 ? 150 : 178}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(text, w / 2 + 3, h / 2 + 12);
    g.fillStyle = '#d6b46a'; g.fillText(text, w / 2, h / 2 + 8);
    g.fillStyle = '#8a3b2c'; g.fillRect(w - 92, 44, 40, 40); g.fillRect(52, h - 84, 40, 40);    // seal marks
  }, null, true);
}
function crownTex() {                                                    // gilt cloud crest above the plaque
  return canvasTex(1024, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#c9a25a';
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h - 40 - Math.abs(Math.sin(x * 0.012)) * 70 - (Math.abs(x - w / 2) < 120 ? 40 * Math.cos((x - w / 2) / 120 * Math.PI / 2) : 0));
    g.lineTo(w, h); g.fill();
    g.strokeStyle = '#7a5a2a'; g.lineWidth = 6;
    for (let x = 60; x < w; x += 110) { g.beginPath(); g.arc(x, h - 40, 22, Math.PI, Math.PI * 2.6); g.stroke(); }
  });
}
