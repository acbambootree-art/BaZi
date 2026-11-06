// The world beyond the temple: it stands on a green plateau ringed by cliffs, above a sea of cloud, with a real
// photograph of Zhangjiajie's sandstone pillars (張家界) all round the horizon under an open, misty sky.
import * as THREE from 'three';
import { canvasTex, PLATEAU, plateauR, sharedTex } from './scene.js';

const TL = new THREE.TextureLoader();
const pbr = (id, o = {}) => {
  const ld = (m, srgb) => { const t = sharedTex(`/temple/assets/tex/${id}_${m}.webp`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return new THREE.MeshStandardMaterial({ map: ld('diff', true), normalMap: ld('nor'), roughnessMap: ld('rough'), roughness: 1, ...o });
};

export function buildScenery(scene, { isMobile }) {
  let seed = 8080; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ticks = [], skip = (o) => { o.userData.role = 'skip'; return o; };
  const clouds = [];                                                  // left out of water reflections by main.js

  // ---- sky at sunrise: soft blue overhead, peach and deep gold toward the horizon, brightest round the sun ----
  // (an equirect painted on a canvas). The sun sits low on the side the sunlight comes from (SUN_DIR).
  const SUN_DIR = new THREE.Vector3(-35, 0, 30).normalize();
  const sunU = Math.atan2(SUN_DIR.z, SUN_DIR.x) / (Math.PI * 2) + 0.5, sunEl = 0.16;   // azimuth, and ~9° above the horizon
  const sky = canvasTex(2048, 1024, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    // saturated on purpose: tone mapping squeezes pale pastels into beige, so the colours go in deep to come out clear
    g.addColorStop(0, '#2f6cc4'); g.addColorStop(0.2, '#5c9ad8'); g.addColorStop(0.32, '#a9c6de'); g.addColorStop(0.39, '#f0c8b0');
    g.addColorStop(0.44, '#ffb877'); g.addColorStop(0.49, '#ff9a45'); g.addColorStop(0.53, '#ffbe73'); g.addColorStop(1, '#f7d6a8');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const sx = sunU * w, sy = h * (0.5 - sunEl / Math.PI);
    for (const dx of [0, -w, w]) {                                   // drawn wrapped, so the glow crosses the seam
      const glow = c.createRadialGradient(sx + dx, sy, 0, sx + dx, sy, w * 0.32);
      glow.addColorStop(0, 'rgba(255,244,214,0.95)'); glow.addColorStop(0.08, 'rgba(255,214,140,0.75)'); glow.addColorStop(0.35, 'rgba(255,180,100,0.3)'); glow.addColorStop(1, 'rgba(255,170,90,0)');
      c.fillStyle = glow; c.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 70; i++) {                                    // soft cloud streaks, lit gold from below near the sun
      const x = r() * w, y = h * (0.1 + r() * 0.34), rw = 60 + r() * 220, rh = 6 + r() * 18;
      const near = Math.max(0, 1 - Math.min(Math.abs(x - sx), w - Math.abs(x - sx)) / (w * 0.3));
      const col = near > 0.2 ? `255,${Math.round(214 - near * 40)},${Math.round(170 - near * 80)}` : '255,226,214';   // rose-gold, golden near the sun
      const cg = c.createRadialGradient(x, y, 0, x, y, rw); cg.addColorStop(0, `rgba(${col},${0.25 + r() * 0.35})`); cg.addColorStop(1, `rgba(${col},0)`);
      c.save(); c.translate(x, y); c.scale(1, rh / rw); c.translate(-x, -y); c.fillStyle = cg; c.fillRect(x - rw, y - rw, rw * 2, rw * 2); c.restore();
    }
  });
  sky.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = sky; scene.backgroundIntensity = 1;
  scene.fog = new THREE.FogExp2(0xf2dcc0, 0.0042);                   // thin golden morning haze: the pillars fade with distance

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
  const ring = skip(new THREE.Mesh(new THREE.CylinderGeometry(RR, RR, RH, 96, 1, true), new THREE.MeshBasicMaterial({ map: ringTex, color: 0xffe2bc, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  // the photo's own pale, misty sky would hide our sunrise: wherever the upper photo is bright and colourless, let it go
  // see-through, so the peaks stand in silhouette against the dawn (the mist round their feet stays)
  ring.material.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      float sat = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
      float skyness = smoothstep(0.55, 0.78, lum) * (1.0 - smoothstep(0.07, 0.2, sat)) * smoothstep(0.42, 0.62, vMapUv.y);
      diffuseColor.a *= 1.0 - skyness;`);
  };
  ring.position.set(P.x, 4 + RH * 0.35 - RH / 2, P.z); ring.rotation.y = 0.6; ring.renderOrder = -2; scene.add(ring);   // the photo's horizon near eye level

  // ---- the rising sun: a bright disc with long golden rays, just inside the photo ring so it shines over the peaks ----
  const sunTex = canvasTex(1024, 1024, (c, w) => {
    const m = w / 2;
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 48; i++) {                                    // long, soft rays of uneven length
      const a = (i / 48) * Math.PI * 2 + r() * 0.05, len = m * (0.45 + r() * 0.55), wd = 0.008 + r() * 0.018;
      const g = c.createLinearGradient(m, m, m + Math.cos(a) * len, m + Math.sin(a) * len);
      g.addColorStop(0, 'rgba(255,226,160,0.32)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(m, m); c.lineTo(m + Math.cos(a - wd) * len, m + Math.sin(a - wd) * len); c.lineTo(m + Math.cos(a + wd) * len, m + Math.sin(a + wd) * len); c.fill();
    }
    const halo = c.createRadialGradient(m, m, 0, m, m, m * 0.5);
    halo.addColorStop(0, 'rgba(255,250,235,1)'); halo.addColorStop(0.07, 'rgba(255,246,220,1)'); halo.addColorStop(0.1, 'rgba(255,220,150,0.6)'); halo.addColorStop(0.4, 'rgba(255,190,110,0.18)'); halo.addColorStop(1, 'rgba(255,180,100,0)');
    c.fillStyle = halo; c.fillRect(0, 0, w, w);
  });
  const sunSprite = skip(new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })));
  const SD = 250;
  sunSprite.position.set(P.x + SUN_DIR.x * SD * Math.cos(sunEl), SD * Math.sin(sunEl) + 6, P.z + SUN_DIR.z * SD * Math.cos(sunEl));
  sunSprite.scale.setScalar(170); sunSprite.renderOrder = -1; scene.add(sunSprite); clouds.push(sunSprite);
  ticks.push((dt) => { sunSprite.material.rotation += dt * 0.004; });   // the rays turn, very slowly

  // ---- the sea of cloud: a white floor far below, and soft banks drifting between the pillars ----
  const billow = canvasTex(512, 512, (c, w, h) => {                   // soft billows, so from above it reads as cloud, not a sheet
    c.fillStyle = '#f4e3cc'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, R = 20 + r() * 70, lit = 236 + r() * 19;
      for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {   // drawn wrapped, so the tile repeats seamlessly
        const g = c.createRadialGradient(x + dx - R * 0.2, y + dy - R * 0.25, 0, x + dx, y + dy, R);
        g.addColorStop(0, `rgba(255,${lit - 6},${lit - 30},0.85)`); g.addColorStop(0.7, 'rgba(236,212,186,0.35)'); g.addColorStop(1, 'rgba(236,212,186,0)');
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
    const s = skip(new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0xffe8cc, transparent: true, depthWrite: false, opacity: 0.55 + r() * 0.35 })));
    const y = low ? -32 + r() * 14 : -16 + r() * 14;                  // most hug the valley; a few drift higher, still below the eye
    s.position.set(P.x + Math.cos(a) * d, y, P.z + Math.sin(a) * d); s.scale.set(60 + r() * 90, (25 + r() * 30) * (low ? 1 : 0.6), 1);
    s.userData.a = a; s.userData.d = d; s.userData.sp = (0.004 + r() * 0.006) * (r() < 0.5 ? 1 : -1);
    scene.add(s); banks.push(s); clouds.push(s);
  }
  ticks.push((dt) => { billow.offset.x += dt * 0.0015; billow.offset.y += dt * 0.0008; });   // the cloud sea drifts
  ticks.push((dt) => { for (const s of banks) { s.userData.a += s.userData.sp * dt * 0.2; s.position.x = P.x + Math.cos(s.userData.a) * s.userData.d; s.position.z = P.z + Math.sin(s.userData.a) * s.userData.d; } });

  return { tick: (dt) => ticks.forEach((f) => f(dt)), clouds };
}
