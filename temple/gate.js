// 三川殿: the temple's front gate, in a Tang-inspired style (唐風): vermilion timber framing round cream plaster walls,
// generous painted bracket sets, beams in malachite, azurite, cinnabar and gold where every bay is painted differently,
// and a real Tang-era mural (Dunhuang, public domain) on each wall panel. A little of a dream world: gilt that catches
// the light, two glowing stone lanterns and a few golden motes drifting in the air.
// The old code-built gate in scene.js stays in the scene but hidden, so the baked-lighting fingerprint still matches;
// everything here is live-lit (role 'skip'). Layout is unchanged: three door bays at x = -6, 0, 6, platform z 18.5–25.5,
// front colonnade at z = 24.2, the scanned dragon pillars (main.js) at x = ±1.6.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex } from './scene.js';

const Z = 22, COLZ = Z + 2.2, BACKZ = Z - 2.2, TOP = 0.3;              // wall centre, front and back colonnades, platform top
const SERIF = '"TempleKai", "LXGW WenKai TC", "Noto Serif TC", serif';
const TL = new THREE.TextureLoader();

// Tang mineral palette: cinnabar, vermilion, malachite, azurite, lapis, ochre, gold, plaster
const P = { cinnabar: '#a33a2a', vermilion: '#b8432c', malachite: '#4a8a70', paleGreen: '#86b59f', azurite: '#3c6182',
  paleBlue: '#8eabc2', lapis: '#2e4865', ochre: '#c58d3e', gold: '#d6ae5c', cream: '#efe4cc', ink: '#2a2420', rose: '#c9786a' };
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

// ---------- carved stone: a height field (white = raised) shaded into a colour map + normal map ----------
function relief(w, h, draw, { base = [196, 184, 160], depth = 3, repeat } = {}) {
  const hc = document.createElement('canvas'); hc.width = w; hc.height = h;
  const g = hc.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.filter = 'blur(1.6px)'; draw(g, w, h); g.filter = 'none';
  const H = g.getImageData(0, 0, w, h).data, ht = (x, y) => H[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4] / 255;
  const cc = document.createElement('canvas'); cc.width = w; cc.height = h; const cg = cc.getContext('2d'), cd = cg.createImageData(w, h);
  const nc = document.createElement('canvas'); nc.width = w; nc.height = h; const ng = nc.getContext('2d'), nd = ng.createImageData(w, h);
  const rnd = seeded(w * 7 + h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, v = ht(x, y), dx = ht(x + 1, y) - ht(x - 1, y), dy = ht(x, y + 1) - ht(x, y - 1);
    const lit = 1 + (-dx + dy) * 1.6, ao = 0.66 + 0.34 * v, n = 0.94 + rnd() * 0.1;
    for (let k = 0; k < 3; k++) cd.data[i + k] = Math.min(255, base[k] * lit * ao * n);
    cd.data[i + 3] = 255;
    const nx = -dx * depth, ny = dy * depth, l = Math.hypot(nx, ny, 1);
    nd.data[i] = (nx / l * 0.5 + 0.5) * 255; nd.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; nd.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[i + 3] = 255;
  }
  cg.putImageData(cd, 0, 0); ng.putImageData(nd, 0, 0);
  const map = new THREE.CanvasTexture(cc), normalMap = new THREE.CanvasTexture(nc);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = normalMap.anisotropy = 8;
  if (repeat) for (const t of [map, normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.82 });
}

// ---------- Tang ornament, drawn per piece from a seed, so no two bays repeat ----------
// 寶相花 baoxiang: a layered rosette of pointed and rounded petals
function baoxiang(c, x, y, r, cols, rnd) {
  const n = [8, 10, 12][(rnd() * 3) | 0], tw = rnd() * Math.PI;
  for (let ring = 0; ring < 3; ring++) {
    const rr = r * (1 - ring * 0.3), col = cols[ring % cols.length];
    c.fillStyle = col;
    for (let k = 0; k < n; k++) {
      const a = tw + (k / n) * Math.PI * 2 + (ring % 2) * (Math.PI / n);
      c.beginPath(); c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(a - 0.35) * rr * 1.05, y + Math.sin(a - 0.35) * rr * 1.05, x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      c.quadraticCurveTo(x + Math.cos(a + 0.35) * rr * 1.05, y + Math.sin(a + 0.35) * rr * 1.05, x, y); c.fill();
    }
  }
  c.fillStyle = P.gold; c.beginPath(); c.arc(x, y, r * 0.2, 0, 7); c.fill();
  c.fillStyle = cols[0]; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.beginPath(); c.arc(x + Math.cos(a) * r * 0.12, y + Math.sin(a) * r * 0.12, r * 0.04, 0, 7); c.fill(); }
}
// 忍冬 honeysuckle scroll: an S-wave with curling leaves
function scroll(c, x0, x1, y, amp, col, rnd) {
  c.strokeStyle = col; c.lineWidth = Math.max(2, amp * 0.18); c.lineCap = 'round';
  const step = amp * 3, ph = rnd() * 6;
  c.beginPath(); for (let x = x0; x <= x1; x += 4) { const yy = y + Math.sin((x - x0) / step * Math.PI + ph) * amp * 0.45; x === x0 ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke();
  for (let x = x0 + step * 0.5, k = 0; x < x1 - step * 0.3; x += step, k++) {
    const s = k % 2 ? 1 : -1, yy = y + Math.sin((x - x0) / step * Math.PI + ph) * amp * 0.45;
    c.beginPath(); c.arc(x, yy + s * amp * 0.35, amp * 0.32, 0, Math.PI * 1.6 * s, s < 0); c.stroke();
  }
}
// 祥雲 cloud curl
function cloud(c, x, y, s, col) {
  c.strokeStyle = col; c.lineWidth = s * 0.14; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, s * 0.5, Math.PI, Math.PI * 2.7); c.stroke();
  c.beginPath(); c.arc(x + s * 0.55, y + s * 0.1, s * 0.3, Math.PI * 1.2, Math.PI * 2.8); c.stroke();
  c.beginPath(); c.moveTo(x - s * 0.5, y); c.quadraticCurveTo(x - s * 1.1, y + s * 0.5, x - s * 1.6, y + s * 0.1); c.stroke();
}
// a painted band (beams, friezes, dado, clerestory): border stripes, a run of medallions with scrolls or clouds
// between, colour order and motifs picked from the seed
function band(seed, w = 1024, h = 128, { cells = 3 } = {}) {
  return canvasTex(w, h, (c, W, H) => {
    const r = seeded(seed * 9973 + 17);
    const grounds = [P.malachite, P.azurite, P.lapis, P.cinnabar, P.malachite, P.azurite];
    const ground = grounds[(r() * grounds.length) | 0], edge = ground === P.cinnabar ? P.malachite : P.cinnabar;
    c.fillStyle = edge; c.fillRect(0, 0, W, H);
    c.fillStyle = P.gold; c.fillRect(0, H * 0.06, W, H * 0.05); c.fillRect(0, H * 0.89, W, H * 0.05);
    c.fillStyle = ground; c.fillRect(0, H * 0.13, W, H * 0.74);
    const n = Math.max(1, Math.round(cells + (r() - 0.5) * 2)), cw = W / n, motif = r();
    const petals = [[P.cream, P.rose, P.ochre], [P.paleBlue, P.cream, P.azurite], [P.paleGreen, P.cream, P.malachite], [P.gold, P.cinnabar, P.cream], [P.rose, P.cream, P.vermilion]];
    for (let i = 0; i < n; i++) {
      const cx = cw * (i + 0.5), cols = petals[(r() * petals.length) | 0];
      // a framed cartouche (包袱) behind every other medallion
      if ((i + seed) % 2 === 0) { c.fillStyle = 'rgba(239,228,204,.18)'; c.beginPath(); c.ellipse(cx, H / 2, cw * 0.36, H * 0.34, 0, 0, 7); c.fill(); c.strokeStyle = P.gold; c.lineWidth = 2; c.stroke(); }
      baoxiang(c, cx, H / 2, Math.min(cw * 0.2, H * 0.32), cols, r);
      const lc = [P.gold, P.paleGreen, P.paleBlue, P.cream][(r() * 4) | 0];
      if (motif < 0.5) { scroll(c, cx + cw * 0.18, cx + cw * 0.48, H / 2, H * 0.36, lc, r); scroll(c, cx - cw * 0.48, cx - cw * 0.18, H / 2, H * 0.36, lc, r); }
      else { cloud(c, cx + cw * 0.3, H / 2, H * 0.3, lc); cloud(c, cx - cw * 0.3, H / 2, H * 0.3, lc); }
    }
  });
}
// coffered ceiling: square coffers each with its own flower and colour
function coffers(seed, nx, ny) {
  return canvasTex(nx * 128, ny * 128, (c, W, H) => {
    const r = seeded(seed * 31 + 5);
    c.fillStyle = P.cinnabar; c.fillRect(0, 0, W, H);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = i * 128, y = j * 128, g = [P.malachite, P.azurite, P.lapis][(r() * 3) | 0];
      c.fillStyle = P.gold; c.fillRect(x + 5, y + 5, 118, 118);
      c.fillStyle = g; c.fillRect(x + 10, y + 10, 108, 108);
      baoxiang(c, x + 64, y + 64, 40, [[P.cream, P.rose, P.ochre], [P.paleBlue, P.cream, P.azurite], [P.gold, P.cinnabar, P.cream]][(r() * 3) | 0], r);
    }
  });
}
// warm plaster (粉壁): faint trowel marks and age
const plasterTex = (seed) => canvasTex(512, 512, (c, W, H) => {
  const r = seeded(seed + 3);
  c.fillStyle = P.cream; c.fillRect(0, 0, W, H);
  for (let k = 0; k < 900; k++) { c.fillStyle = `rgba(${150 + r() * 60},${130 + r() * 50},${100 + r() * 40},${0.03 + r() * 0.05})`; c.beginPath(); c.ellipse(r() * W, r() * H, 6 + r() * 40, 3 + r() * 16, r() * 3, 0, 7); c.fill(); }
  const g = c.createLinearGradient(0, H * 0.75, 0, H); g.addColorStop(0, 'rgba(120,100,70,0)'); g.addColorStop(1, 'rgba(120,100,70,.18)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
}, [2, 2]);

// a mural panel: the painting fitted (cover) inside a gilt and vermilion border, softened like old pigment on plaster
function muralMat(url, aspect) {
  const W = 1024, H = Math.round(W / aspect);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const draw = (img) => {
    const c = cv.getContext('2d');
    c.fillStyle = P.cream; c.fillRect(0, 0, W, H);
    if (img) {
      const pad = 34, iw = W - pad * 2, ih = H - pad * 2, s = Math.max(iw / img.width, ih / img.height);
      c.save(); c.beginPath(); c.rect(pad, pad, iw, ih); c.clip();
      c.filter = 'saturate(1.08) contrast(1.02)';
      c.drawImage(img, pad + (iw - img.width * s) / 2, pad + (ih - img.height * s) / 2, img.width * s, img.height * s);
      c.filter = 'none';
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.65);   // a little age at the edges
      g.addColorStop(0, 'rgba(239,228,204,0)'); g.addColorStop(1, 'rgba(120,96,60,.28)'); c.fillStyle = g; c.fillRect(pad, pad, iw, ih);
      c.restore();
    }
    c.strokeStyle = P.vermilion; c.lineWidth = 16; c.strokeRect(10, 10, W - 20, H - 20);
    c.strokeStyle = P.gold; c.lineWidth = 5; c.strokeRect(24, 24, W - 48, H - 48);
    c.fillStyle = P.gold; for (const [x, y] of [[24, 24], [W - 24, 24], [24, H - 24], [W - 24, H - 24]]) { c.beginPath(); c.arc(x, y, 12, 0, 7); c.fill(); }
    t.needsUpdate = true;
  };
  draw(null);
  const img = new Image(); img.onload = () => draw(img); img.src = url;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
}

// door leaf art: vermilion boards, gilt frame, a door god (public-domain 1922 plates) on the centre leaves
function leafTex(godImg, flip) {
  return canvasTex(512, 1536, (c, w, h) => {
    c.fillStyle = '#8e2f22'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4) { c.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`; c.fillRect(x, 0, 2, h); }
    c.strokeStyle = P.gold; c.lineWidth = 10; c.strokeRect(18, 18, w - 36, h - 36);
    c.lineWidth = 3; c.strokeRect(40, 40, w - 80, h - 80);
    if (godImg) {
      const s = (h * 0.7) / godImg.height, gw = godImg.width * s, gh = godImg.height * s;
      c.save(); if (flip) { c.translate(w, 0); c.scale(-1, 1); }
      c.save(); c.beginPath(); c.rect(44, 44, w - 88, h - 88); c.clip();
      c.globalAlpha = 0.95; c.drawImage(godImg, (w - gw) / 2, 90, gw, gh); c.restore(); c.restore();
      c.fillStyle = 'rgba(30,10,6,.3)'; c.fillRect(54, h * 0.86, w - 108, h * 0.1);
      c.strokeStyle = P.gold; c.lineWidth = 3; c.strokeRect(54, h * 0.86, w - 108, h * 0.1);
    }
  });
}

// ---------- geometry helpers ----------
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
function textBoard(lines, w, h, { fg = '#e2c06e', bg = '#1d3a33', size = 0.62 } = {}) {   // vertical couplet: gilt on deep malachite
  return canvasTex(256, Math.round(256 * h / w), (c, cw, ch) => {
    c.fillStyle = bg; c.fillRect(0, 0, cw, ch);
    c.strokeStyle = 'rgba(226,192,110,.75)'; c.lineWidth = 5; c.strokeRect(10, 10, cw - 20, ch - 20);
    c.font = `${Math.round(cw * size)}px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const step = (ch - 60) / lines.length;
    [...lines].forEach((t, i) => { const y = 30 + step * (i + 0.5); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillText(t, cw / 2 + 2, y + 3); c.fillStyle = fg; c.fillText(t, cw / 2, y); });
  }, null, true);
}
// 斗拱 bracket set, Tang-generous: vermilion blocks and arms, edges picked out in malachite or azurite, gilt bearings
function bracketGeo(edge) {
  const parts = [], col = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const add = (w, h, d, x, y, z, hex, rx = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, z); parts.push(col(g.toNonIndexed(), hex)); };
  const red = P.vermilion, gold = P.gold;
  add(0.42, 0.24, 0.42, 0, 0.12, 0, red); add(0.46, 0.05, 0.46, 0, 0.26, 0, gold);
  add(1.25, 0.17, 0.16, 0, 0.37, 0, red); add(1.27, 0.04, 0.17, 0, 0.47, 0, edge); add(0.16, 0.17, 1.1, 0, 0.37, 0.14, red);
  for (const [x, z] of [[-0.55, 0], [0.55, 0], [0, 0.62]]) { add(0.24, 0.15, 0.24, x, 0.54, z, red); add(0.26, 0.035, 0.26, x, 0.63, z, gold); }
  add(1.9, 0.16, 0.16, 0, 0.73, 0, red); add(1.92, 0.04, 0.17, 0, 0.83, 0, edge); add(0.16, 0.16, 1.5, 0, 0.73, 0.28, red);
  for (const [x, z] of [[-0.86, 0], [0.86, 0], [0, 0.98]]) { add(0.24, 0.15, 0.24, x, 0.9, z, red); add(0.26, 0.035, 0.26, x, 0.99, z, gold); }
  add(0.14, 0.14, 1.65, 0, 0.78, 0.62, P.cinnabar, -0.36); add(0.15, 0.04, 0.3, 0, 1.0, 1.36, gold, -0.36);   // 昂 cantilever, gilt tip
  return mergeGeometries(parts);
}

// ---------- the gate ----------
export function buildGate(scene, { gl, isMobile, oldGate }) {
  if (oldGate) for (const o of oldGate.children) if (o.isMesh) o.visible = false;

  const G = new THREE.Group(); G.name = 'gate3'; G.userData.role = 'skip';
  // grey granite for the platform, steps and plinths (matching the courtyard's flagstones); vermilion lacquer; gilt; cream plaster
  const stone = relief(512, 512, (g, w, h) => {
    g.fillStyle = '#888'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5c5c5c'; for (let x = 0; x < w; x += 170) g.fillRect(x, 0, 3, h); for (let y = 0; y < h; y += 256) g.fillRect(0, y, w, 3);
  }, { base: [168, 170, 165], depth: 1.2, repeat: [6, 2] });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0xa8392a, roughness: 0.42, metalness: 0.05 });
  const lacquerDark = new THREE.MeshStandardMaterial({ color: 0x7e2a20, roughness: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9ad55, metalness: 0.85, roughness: 0.28, emissive: 0x2a1a04, emissiveIntensity: 0.4 });
  const green = new THREE.MeshStandardMaterial({ color: 0x3f8a6c, roughness: 0.55 });
  const plasters = [0, 1, 2, 3].map((i) => new THREE.MeshStandardMaterial({ map: plasterTex(i * 13 + 2), roughness: 0.95 }));

  // platform and steps
  G.add(box(24, 0.3, 7, stone, 0, 0.15, Z));
  G.add(box(24.1, 0.08, 0.18, gold, 0, 0.3, Z + 3.5));                                   // a thin gilt nosing along the front edge
  for (const [x, w] of [[0, 4.2], [-6, 3.0], [6, 3.0]]) for (const s of [1, -1]) G.add(box(w, 0.1, 0.45, stone, x, 0.05, Z + s * 3.72), box(w - 0.2, 0.2, 0.35, stone, x, 0.1, Z + s * 3.62));

  // the four wall segments: plinth, vermilion frame, painted dado, plaster with a mural, painted frieze
  const segs = [[-11.5, -7.4], [-4.6, -1.4], [1.4, 4.6], [7.4, 11.5]];
  // one real painting per panel (front faces 1–4, courtyard faces 5–8): Dunhuang / Tang-era, public domain
  const MURALS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `/temple/assets/gate/mural_${i}.webp`);
  let mi = 0, seed = 11;
  segs.forEach(([x0, x1], si) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    G.add(box(w, 5.7, 0.5, plasters[si], cx, TOP + 2.85, Z));
    for (const side of [1, -1]) {
      const zf = Z + side * 0.25, out = (d) => zf + side * d, face = (m) => { if (side < 0) m.rotation.y = Math.PI; return m; };
      const plane = (pw, ph, mat, y, d = 0.012) => { const m = face(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat)); m.position.set(cx, y, out(d)); G.add(m); return m; };
      G.add(box(w + 0.1, 0.45, 0.16, stone, cx, TOP + 0.225, out(0.05)));                                   // plinth
      plane(w - 0.3, 0.6, new THREE.MeshStandardMaterial({ map: band(seed++, 1024, 192, { cells: 3 }), roughness: 0.8 }), TOP + 0.9);   // dado
      const pw = w - 0.75, ph = 2.55;
      plane(pw, ph, muralMat(MURALS[side > 0 ? si : 4 + si], pw / ph), TOP + 2.75, 0.02);                    // the mural
      plane(w - 0.1, 1.1, new THREE.MeshStandardMaterial({ map: band(seed++, 1024, 224, { cells: 2 }), roughness: 0.8 }), TOP + 5.02, 0.03);   // frieze
      // vermilion frame: corner posts and rails
      for (const sx of [-1, 1]) G.add(box(0.26, 5.2, 0.12, lacquer, cx + sx * (w / 2 - 0.13), TOP + 2.95, out(0.06)));
      for (const y of [1.24, 4.18, 4.45, 5.62]) G.add(box(w, y === 4.18 ? 0.08 : 0.14, 0.12, y === 4.18 ? gold : lacquer, cx, TOP + y, out(0.06)));
      G.add(box(w, 0.08, 0.13, gold, cx, TOP + 1.32, out(0.065)));
      mi++;
    }
  });
  for (const s of [-1, 1]) G.add(box(0.5, 5.7, 4.9, plasters[s < 0 ? 0 : 3], s * 11.75, TOP + 2.85, Z));   // end walls

  // doors: vermilion jambs and lintel, gilt door pins, a painted transom, leaves swung open (walkway clear)
  const godL = new Image(), godR = new Image(), godTex = [null, null];
  for (const x of [-6, 0, 6]) {
    const W = 2.8, centre = x === 0;
    for (const s of [-1, 1]) {
      G.add(box(0.32, 4.3, 0.62, lacquer, x + s * (W / 2 + 0.06), TOP + 2.15, Z));
      G.add(box(0.36, 0.5, 0.66, stone, x + s * (W / 2 + 0.06), TOP + 0.25, Z));                              // stone foot
    }
    G.add(box(W + 0.75, 0.42, 0.66, lacquer, x, TOP + 4.5, Z));
    G.add(box(W + 0.75, 0.06, 0.68, gold, x, TOP + 4.28, Z));
    for (const side of [1, -1]) {
      for (const px of centre ? [-0.75, -0.25, 0.25, 0.75] : [-0.4, 0.4]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 16), gold); p.rotation.x = Math.PI / 2;
        p.position.set(x + px, TOP + 4.5, Z + side * 0.4); G.add(p);
      }
      const ft = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.1, 0.95), new THREE.MeshStandardMaterial({ map: band(seed++, 1024, 352, { cells: centre ? 3 : 2 }), roughness: 0.8 }));
      if (side < 0) ft.rotation.y = Math.PI;
      ft.position.set(x, TOP + 5.22, Z + side * 0.26); G.add(ft);
    }
    G.add(box(W + 0.2, 1.05, 0.5, lacquerDark, x, TOP + 5.2, Z));
    G.add(box(W + 0.1, 0.1, 0.34, stone, x, TOP + 0.05, Z));
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(x + s * W / 2, TOP, Z - 0.05); pivot.rotation.y = s * -1.36;
      const front = new THREE.MeshStandardMaterial({ map: leafTex(null), roughness: 0.55 }), back = new THREE.MeshStandardMaterial({ map: leafTex(null), roughness: 0.6 });
      if (centre) godTex[s < 0 ? 0 : 1] = front;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(W / 2, 4.25, 0.1), [lacquerDark, lacquerDark, lacquerDark, lacquerDark, front, back]);
      leaf.position.set(-s * W / 4, 2.125, 0); pivot.add(leaf);
      if (!centre) {                                                                     // gilt studs 門釘, 5 × 9
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

  // colonnades: round vermilion columns on carved lotus bases (覆盆), gilt collars and capitals; couplets in front
  const lotusBase = new THREE.LatheGeometry([[0, 0], [0.52, 0], [0.54, 0.08], [0.5, 0.18], [0.42, 0.3], [0.36, 0.38], [0.34, 0.44], [0, 0.44]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
  const petals = relief(512, 128, (g, w, h) => { g.fillStyle = '#fff'; for (let k = 0; k < 16; k++) { const x = (k + 0.5) * w / 16; g.beginPath(); g.ellipse(x, h * 0.62, w / 40, h * 0.42, 0, 0, 7); g.fill(); } }, { base: [214, 198, 168], depth: 3 });
  const couplets = { 4.6: '歇腳暫聽松下水', '-4.6': '安心常照佛前燈', 7.4: '竹影掃階塵不動', '-7.4': '月穿潭底水無痕' };
  const column = (x, z, r, withCouplet) => {
    const base = new THREE.Mesh(lotusBase, petals); base.position.set(x, TOP, z); base.scale.setScalar(r / 0.3); G.add(base);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r, 5.4, 24), lacquer); col.position.set(x, TOP + 0.44 + 2.7, z); G.add(col);
    for (const y of [TOP + 0.5, TOP + 5.6]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.06, r * 1.06, 0.12, 24), gold); c.position.set(x, y, z); G.add(c); }
    const cap = box(r * 2.6, 0.26, r * 2.6, lacquer, x, TOP + 5.86, z); G.add(cap);                    // 櫨斗 bearing block
    G.add(box(r * 2.7, 0.05, r * 2.7, gold, x, TOP + 5.74, z));
    const text = withCouplet && couplets[x];
    if (text) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 4.1), new THREE.MeshStandardMaterial({ map: textBoard(text, 0.28, 4.1), roughness: 0.6 })); b.position.set(x, TOP + 3.2, z + r + 0.02); G.add(b); }
  };
  for (const x of [-10, -7.4, -4.6, 4.6, 7.4, 10]) column(x, COLZ, 0.3, true);
  for (const x of [-10, -7.4, -4.6, -1.6, 1.6, 4.6, 7.4, 10]) column(x, BACKZ, 0.28, false);

  // beams: each bay its own painting, front and back, upper and lower
  const bays = [-11.7, -10, -7.4, -4.6, -1.6, 1.6, 4.6, 7.4, 10, 11.7];
  for (const z of [COLZ, BACKZ]) for (let i = 0; i < bays.length - 1; i++) {
    const a = bays[i], b = bays[i + 1], L = b - a, cx = (a + b) / 2;
    const up = new THREE.MeshStandardMaterial({ map: band(seed++, 1024, Math.round(1024 * 0.55 / L), { cells: Math.max(1, Math.round(L / 1.4)) }), roughness: 0.7 });
    const lo = new THREE.MeshStandardMaterial({ map: band(seed++, 1024, Math.round(1024 * 0.24 / L), { cells: Math.max(1, Math.round(L / 1.1)) }), roughness: 0.7 });
    G.add(box(L, 0.55, 0.42, [lacquer, lacquer, lacquer, lacquer, up, up], cx, 6.14, z));
    G.add(box(L, 0.24, 0.3, [lacquer, lacquer, lacquer, lacquer, lo, lo], cx, 5.6, z));
    G.add(box(L, 0.04, 0.44, gold, cx, 5.86, z));
  }
  // 雀替 corner braces: gilt openwork with a vermilion scroll, and gilt lotus pendants 吊筒
  const braceTex = canvasTex(256, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = P.gold; c.strokeStyle = P.cinnabar; c.lineWidth = 5;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.quadraticCurveTo(w * 0.35, h * 0.2, 0, h); c.closePath(); c.fill();
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(w * (0.25 + k * 0.15), h * 0.18, 10 + k * 2, 0, Math.PI * 1.7); c.stroke(); }
    c.fillStyle = P.malachite; c.beginPath(); c.arc(w * 0.12, h * 0.12, 9, 0, 7); c.fill();
  });
  const braceMat = new THREE.MeshStandardMaterial({ map: braceTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.5 });
  for (const z of [COLZ, BACKZ]) for (const x of [-10, -7.4, -4.6, -1.6, 1.6, 4.6, 7.4, 10]) for (const s of [-1, 1]) {
    if ((x === -10 && s < 0) || (x === 10 && s > 0)) continue;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.48), braceMat); p.position.set(x + s * 0.68, 5.25, z); p.scale.x = -s; G.add(p);
  }
  const lotusP = new THREE.LatheGeometry([[0, -0.8], [0.12, -0.72], [0.2, -0.55], [0.17, -0.42], [0.11, -0.36], [0.1, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
  for (const x of [-8.7, -3.1, 3.1, 8.7]) { const l = new THREE.Mesh(lotusP, gold); l.position.set(x, 6.1, COLZ + 0.34); G.add(l); }

  // 斗拱: generous bracket sets on the beams, front and back, edges alternating malachite and azurite
  const bx = [-10, -8.7, -7.4, -6, -4.6, -3.1, -1.6, 0, 1.6, 3.1, 4.6, 6, 7.4, 8.7, 10];
  const bmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const m4 = new THREE.Matrix4(), rot = new THREE.Matrix4().makeRotationY(Math.PI);
  for (const [edge, pick] of [[P.malachite, 0], [P.azurite, 1]]) {
    const xs = bx.filter((_, i) => i % 2 === pick);
    const br = new THREE.InstancedMesh(bracketGeo(edge), bmat, xs.length * 2);
    xs.forEach((x, i) => { br.setMatrixAt(i, m4.makeTranslation(x, 6.42, COLZ)); br.setMatrixAt(xs.length + i, m4.makeTranslation(x, 6.42, BACKZ).multiply(rot)); });
    G.add(br);
  }
  // porch ceilings: coffers, each one different
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(23.4, 1.9), new THREE.MeshStandardMaterial({ map: coffers(s > 0 ? 7 : 19, 24, 2), roughness: 0.75, side: THREE.DoubleSide }));
    p.rotation.x = Math.PI / 2; p.position.set(0, 6.36, Z + s * 1.25); G.add(p);
  }

  // plaques: 歇腳廟 facing the plaza, 回頭是岸 facing the courtyard — lapis faces, gilt characters and frames
  for (const [text, side] of [['歇腳廟', 1], ['回頭是岸', -1]]) {
    const pl = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.25), new THREE.MeshStandardMaterial({ map: plaqueFace(text), roughness: 0.45 }));
    face.position.z = 0.09; pl.add(face);
    pl.add(box(4.9, 1.75, 0.16, lacquer, 0, 0, 0));
    for (const [w, h, x, y] of [[4.9, 0.16, 0, 0.8], [4.9, 0.16, 0, -0.8], [0.16, 1.75, -2.37, 0], [0.16, 1.75, 2.37, 0]]) pl.add(box(w, h, 0.22, gold, x, y, 0.03));
    const crown = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.8), new THREE.MeshStandardMaterial({ map: crownTex(), transparent: true, alphaTest: 0.4, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }));
    crown.position.set(0, 1.18, 0.02); pl.add(crown);
    pl.scale.setScalar(0.75); pl.position.set(0, 5.62, Z + side * 0.42); if (side < 0) pl.rotation.y = Math.PI;
    pl.rotation.x = side * -0.06;
    G.add(pl);
  }
  // clerestory under the raised centre roof: two painted faces, different
  G.add(box(9, 1.4, 4, [lacquer, lacquer, lacquer, lacquer,
    new THREE.MeshStandardMaterial({ map: band(seed++, 1024, 160, { cells: 4 }), roughness: 0.75 }),
    new THREE.MeshStandardMaterial({ map: band(seed++, 1024, 160, { cells: 4 }), roughness: 0.75 })], 0, 8.6, Z));
  // gilded pagoda (寶塔) on the centre ridge, and gilt 鴟尾 (owl-tail ridge ends, a Tang hallmark) at both ends
  const pag = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const r = 0.36 - k * 0.07, y = k * 0.3;
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.8, 0.18, 6), gold); tier.position.y = y; pag.add(tier);
    const eave = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 0.75, 0.08, 6), green); eave.position.y = y + 0.13; pag.add(eave);
  }
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 8), gold); fin.position.y = 1.35; pag.add(fin);
  pag.position.set(0, 11.12, Z); pag.scale.setScalar(1.25); G.add(pag);
  const chiwei = (() => {                                                               // a tall curled fin, extruded
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.7, 0); s.quadraticCurveTo(0.75, 0.7, 0.45, 1.25); s.quadraticCurveTo(0.2, 1.55, -0.1, 1.45);
    s.quadraticCurveTo(0.2, 1.3, 0.25, 1.05); s.quadraticCurveTo(-0.05, 0.9, -0.12, 0.45); s.lineTo(0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 10 }).translate(-0.3, 0, -0.08);
  })();
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(chiwei, gold); c.position.set(sx * 5.55, 10.85, Z); c.scale.set(-sx, 1, 1); G.add(c); }

  // two Tang stone lanterns (石燈) at the platform's front corners, glowing softly
  const glowTex = canvasTex(64, 64, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,236,190,1)'); g.addColorStop(0.4, 'rgba(255,196,130,.45)'); g.addColorStop(1, 'rgba(255,170,110,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); });
  const flame = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb860, emissiveIntensity: 2.2 });
  for (const sx of [-1, 1]) {
    const L = new THREE.Group();
    L.add(new THREE.Mesh(lotusBase, petals));
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.2, 8), stone); shaft.position.y = 1.0; L.add(shaft);
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.16, 8), stone); tray.position.y = 1.68; L.add(tray);
    const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 8), flame); fire.position.y = 2.01; L.add(fire);
    for (let k = 0; k < 8; k++) { const p = box(0.06, 0.52, 0.06, stone, Math.cos(k / 8 * Math.PI * 2) * 0.28, 2.01, Math.sin(k / 8 * Math.PI * 2) * 0.28); L.add(p); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.38, 8), stone); roof.position.y = 2.46; L.add(roof);
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), gold); jewel.position.y = 2.72; L.add(jewel);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd7a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    glow.scale.setScalar(1.6); glow.position.y = 2.02; L.add(glow);
    L.position.set(sx * 11.25, TOP, Z + 3.0); G.add(L);
  }

  // a few golden motes drifting slowly up around the gate (the only moving thing here; animated as it's drawn)
  const N = isMobile ? 40 : 80, pos = new Float32Array(N * 3), seeds = [];
  const rm = seeded(4242);
  for (let i = 0; i < N; i++) seeds.push([(rm() - 0.5) * 24, rm() * 7.5, Z + 1 + rm() * 5, rm() * 6.28, 0.08 + rm() * 0.12]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(pg, new THREE.PointsMaterial({ map: glowTex, color: 0xffe0a0, size: 0.13, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false; motes.userData.role = 'skip';
  motes.onBeforeRender = () => {
    const t = performance.now() / 1000;
    seeds.forEach(([x, y, z, ph, sp], i) => {
      const yy = (y + t * sp) % 7.5;
      pos[i * 3] = x + Math.sin(t * 0.3 + ph) * 0.6; pos[i * 3 + 1] = 0.4 + yy; pos[i * 3 + 2] = z + Math.cos(t * 0.25 + ph) * 0.4;
    });
    pg.attributes.position.needsUpdate = true;
  };
  scene.add(motes);

  G.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(G);
  return G;
}

function plaqueFace(text) {
  return canvasTex(1024, 300, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#1f3f66'); grd.addColorStop(1, '#16304f');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(217,173,85,.85)'; g.lineWidth = 5; g.strokeRect(26, 26, w - 52, h - 52);
    g.font = `${text.length > 3 ? 150 : 178}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(text, w / 2 + 3, h / 2 + 12);
    g.fillStyle = '#e6c06a'; g.fillText(text, w / 2, h / 2 + 8);
    g.fillStyle = '#b8432c'; g.fillRect(w - 92, 44, 40, 40); g.fillRect(52, h - 84, 40, 40);    // seal marks
  }, null, true);
}
function crownTex() {                                                    // gilt cloud crest above the plaque
  return canvasTex(1024, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = P.gold;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h - 40 - Math.abs(Math.sin(x * 0.012)) * 70 - (Math.abs(x - w / 2) < 120 ? 40 * Math.cos((x - w / 2) / 120 * Math.PI / 2) : 0));
    g.lineTo(w, h); g.fill();
    g.strokeStyle = P.cinnabar; g.lineWidth = 6;
    for (let x = 60; x < w; x += 110) { g.beginPath(); g.arc(x, h - 40, 22, Math.PI, Math.PI * 2.6); g.stroke(); }
  });
}
