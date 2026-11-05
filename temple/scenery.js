// The world beyond the temple: it stands on a green plateau ringed by cliffs, above a sea of cloud, with a real
// photograph of Zhangjiajie's sandstone pillars (張家界) all round the horizon under an open, misty sky.
import * as THREE from 'three';
import { canvasTex, PLATEAU, plateauR } from './scene.js';

const TL = new THREE.TextureLoader();
const pbr = (id, o = {}) => {
  const ld = (m, srgb) => { const t = TL.load(`/temple/assets/tex/${id}_${m}.webp`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return new THREE.MeshStandardMaterial({ map: ld('diff', true), normalMap: ld('nor'), roughnessMap: ld('rough'), roughness: 1, ...o });
};

export function buildScenery(scene, { isMobile }) {
  let seed = 8080; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ticks = [], skip = (o) => { o.userData.role = 'skip'; return o; };
  const clouds = [];                                                  // left out of water reflections by main.js

  // ---- sky: pale blue overhead, misty white at the horizon (an equirect painted on a canvas) ----
  const sky = canvasTex(1024, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7f9cbc'); g.addColorStop(0.3, '#b3c5d4'); g.addColorStop(0.47, '#e2e9ec'); g.addColorStop(0.52, '#eef1f0'); g.addColorStop(1, '#f3f5f4');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {                                    // soft cloud streaks
      const x = r() * w, y = h * (0.1 + r() * 0.34), rw = 60 + r() * 220, rh = 6 + r() * 18;
      const cg = c.createRadialGradient(x, y, 0, x, y, rw); cg.addColorStop(0, `rgba(255,255,255,${0.25 + r() * 0.35})`); cg.addColorStop(1, 'rgba(255,255,255,0)');
      c.save(); c.translate(x, y); c.scale(1, rh / rw); c.translate(-x, -y); c.fillStyle = cg; c.fillRect(x - rw, y - rw, rw * 2, rw * 2); c.restore();
    }
  });
  sky.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = sky; scene.backgroundIntensity = 1;
  scene.fog = new THREE.FogExp2(0xdfe6e7, 0.0042);                   // thin haze: the pillars fade with distance

  // ---- the plateau: grass on top, sheer cliffs dropping into the cloud ----
  const N = 180, P = PLATEAU;
  const rim = (a, k = 1) => { const R = plateauR(a) * k; return [P.x + Math.cos(a) * P.rx * R, P.z + Math.sin(a) * P.rz * R]; };
  const top = new THREE.Shape();
  for (let i = 0; i <= N; i++) { const [x, z] = rim((i / N) * Math.PI * 2); i ? top.lineTo(x, -z) : top.moveTo(x, -z); }
  const topGeo = new THREE.ShapeGeometry(top, 1).rotateX(-Math.PI / 2);  // facing up; shape y = -world z
  const tu = topGeo.attributes.uv; for (let i = 0; i < tu.count; i++) tu.setXY(i, tu.getX(i) / 3, tu.getY(i) / 3);
  const grass = pbr('leafy_grass', { color: 0x9cb47e });
  const plateau = skip(new THREE.Mesh(topGeo, grass)); plateau.position.y = -0.03; plateau.receiveShadow = true; scene.add(plateau);
  // cliff: rings of vertices going down, each pushed in or out a little, so the face is broken into buttresses and overhangs
  const DEPTHS = [0, -2, -6, -14, -28, -50, -85, -130], pos = [], uv = [], idx = [];
  DEPTHS.forEach((y, j) => {
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, f = 1 + (j ? (Math.sin(a * 23 + j * 1.7) * 0.012 + Math.sin(a * 61 + j) * 0.006 - j * 0.004) : 0);
      const [x, z] = rim(a, f);
      pos.push(x, y, z); uv.push((i / N) * 120, y / 9);
    }
  });
  for (let j = 0; j < DEPTHS.length - 1; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const cliffGeo = new THREE.BufferGeometry();
  cliffGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cliffGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); cliffGeo.setIndex(idx);
  cliffGeo.computeVertexNormals();
  const cliff = skip(new THREE.Mesh(cliffGeo, pbr('cliff_side', { color: 0xc8b8a0, side: THREE.DoubleSide }))); cliff.receiveShadow = true; scene.add(cliff);

  // ---- the horizon: a real photograph of the Wulingyuan pillars (chensiyuan, CC BY-SA 4.0) on a ring round the
  // world, twice round and mirrored so the joins are seamless; its hazy sky fades into ours, its foot into the cloud ----
  const ringTex = TL.load(`/temple/assets/zjj_ring${isMobile ? '_m' : ''}.webp`);
  ringTex.colorSpace = THREE.SRGBColorSpace; ringTex.wrapS = THREE.MirroredRepeatWrapping; ringTex.repeat.x = 2; ringTex.anisotropy = 8;
  const RR = 270, RH = (2 * Math.PI * RR) / 2 / (8841 / 1263) * 1.7;   // the photo stretched upward: taller, more towering pillars
  const ring = skip(new THREE.Mesh(new THREE.CylinderGeometry(RR, RR, RH, 96, 1, true), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  ring.position.set(P.x, 4 + RH * 0.35 - RH / 2, P.z); ring.rotation.y = 0.6; ring.renderOrder = -2; scene.add(ring);   // the photo's horizon near eye level

  // ---- the sea of cloud: a white floor far below, and soft banks drifting between the pillars ----
  const billow = canvasTex(512, 512, (c, w, h) => {                   // soft billows, so from above it reads as cloud, not a sheet
    c.fillStyle = '#e9edec'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, R = 20 + r() * 70, lit = 236 + r() * 19;
      for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {   // drawn wrapped, so the tile repeats seamlessly
        const g = c.createRadialGradient(x + dx - R * 0.2, y + dy - R * 0.25, 0, x + dx, y + dy, R);
        g.addColorStop(0, `rgba(${lit},${lit},${lit},0.85)`); g.addColorStop(0.7, 'rgba(214,220,222,0.35)'); g.addColorStop(1, 'rgba(214,220,222,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x + dx, y + dy, R, 0, 7); c.fill();
      }
    }
  }, [10, 10]);
  const floor = skip(new THREE.Mesh(new THREE.CircleGeometry(420, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: billow })));
  floor.position.y = -34; scene.add(floor);
  const puffTex = canvasTex(256, 256, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w - 0.5, v = (y / h - 0.5) * 1.7, d = Math.hypot(u, v) * 2;
      const n = Math.sin(x * 0.09 + Math.sin(y * 0.05) * 3) * 0.5 + Math.sin(y * 0.11 + x * 0.03) * 0.5;
      const a = Math.max(0, 1 - d) ** 1.4 * (0.75 + n * 0.25), i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = 252; img.data[i + 2] = 250; img.data[i + 3] = 255 * a;
    }
    c.putImageData(img, 0, 0);
  });
  const banks = [];
  for (let i = 0; i < (isMobile ? 40 : 80); i++) {
    const a = r() * Math.PI * 2, d = 85 + r() * 165, low = r() < 0.8;    // inside the photo ring, so they lie at its foot, not over it
    const s = skip(new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0.55 + r() * 0.35 })));
    const y = low ? -32 + r() * 14 : -16 + r() * 14;                  // most hug the valley; a few drift higher, still below the eye
    s.position.set(P.x + Math.cos(a) * d, y, P.z + Math.sin(a) * d); s.scale.set(60 + r() * 90, (25 + r() * 30) * (low ? 1 : 0.6), 1);
    s.userData.a = a; s.userData.d = d; s.userData.sp = (0.004 + r() * 0.006) * (r() < 0.5 ? 1 : -1);
    scene.add(s); banks.push(s); clouds.push(s);
  }
  ticks.push((dt) => { billow.offset.x += dt * 0.0015; billow.offset.y += dt * 0.0008; });   // the cloud sea drifts
  ticks.push((dt) => { for (const s of banks) { s.userData.a += s.userData.sp * dt * 0.2; s.position.x = P.x + Math.cos(s.userData.a) * s.userData.d; s.position.z = P.z + Math.sin(s.userData.a) * s.userData.d; } });

  return { tick: (dt) => ticks.forEach((f) => f(dt)), clouds };
}
