import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildWorld, canvasTex, HALL, flames, onPlateau, pavedAt } from './scene.js';
import { buildScenery } from './scenery.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { connectPresence } from './presence.js';
import { buildGate } from './gate.js';

// Presence server (Cloudflare Worker). Empty = solo mode. ?ws=... overrides for local testing.
const WS_URL = new URLSearchParams(location.search).get('ws') || window.TEMPLE_WS || '';

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('xjm.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('xjm.' + k, JSON.stringify(v)); } catch {} },
};


// ---------------- language (中文 / English) ----------------
// ?lang=en|zh wins, then the visitor's saved choice, then the browser language.
const LANG = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'zh') { store.set('lang', q); return q; }
  return store.get('lang', null) || (/^zh/i.test(navigator.language) ? 'zh' : 'en');
})();
const EN = LANG === 'en';
const ZOD_EN = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
const TX = {
  brand: ['歇腳廟', 'Xiejiao Temple'],
  room: [(n) => `第 ${n} 殿`, (n) => `Hall ${n}`],
  hint: [matchMedia('(pointer: coarse)').matches ? '搖桿走路轉向・拖曳看看・雙指拉近' : '↑↓ 走路・←→ 轉向・拖曳看看・滾輪拉近（第一人稱）', matchMedia('(pointer: coarse)').matches ? 'Joystick to walk & turn · drag to look · pinch to zoom' : '↑↓ walk · ←→ turn · drag to look · scroll in for first person'],
  loading: ['雲 開 中', 'Parting the clouds'],
  endPray: ['結束', 'End prayer'],
  praying: ['雙手合十，靜靜祈禱。想結束時按「結束」或走開就好', 'Palms together. Pray as long as you like. Tap End prayer or walk away to finish.'],
  rest: ['你在廟裡歇著', 'You are resting in the temple'],
  wake: ['回到廟裡', 'Come back in'],
  acts: [['拜拜', '坐下', '上香', '擲筊', '求籤', '祈福', '木魚'], ['Pray', 'Kneel', 'Incense', 'Blocks', 'Fortune', 'Blessing', 'Muyu']],
  muyuHint: ['再點「木魚」或按空白鍵，敲一聲', 'Tap Muyu again (or press Space) to strike'],
  kneel: ['跪在拜墊上，靜靜待一會兒', 'Kneeling on the cushion. Stay as long as you like.'],
  bench: ['坐在水邊，看看水、看看魚。想走時動一下就好', 'Sitting by the water. Watch the lotus and the koi. Move whenever you like to get up.'],
  watch: ['坐下看水', 'Sit & watch'],
  toBurner: ['走到天公爐前…', 'Walking to the Heaven burner…'],
  incenseDone: [(n) => `香已插上，心意神明收到了（第 ${n} 炷）`, (n) => `Your incense is offered. The gods received it (stick no. ${n}).`],
  copied: ['已複製，貼給朋友吧', 'Link copied. Paste it to a friend.'],
  myLamp: ['我的祈福', 'My blessing'],
  no: ['先不要', 'Not now'],
  jiaoTitle: ['擲筊・問神明', 'Moon blocks · ask the gods'],
  jiaoIntro: ['雙手合十，在心裡說：自己的姓名、生日、住在哪裡，然後問一件「是或不是」的事。',
    'Put your palms together. Silently tell the gods your name, birthday and where you live, then ask one yes-or-no question.'],
  private: ['問題只放在你心裡，不會傳到任何地方。', 'Your question stays in your heart. Nothing is sent anywhere.'],
  throw: ['擲筊', 'Throw'],
  jiao: {
    sheng: [['聖筊', '一正一反，神明點頭了。這件事可以去做。'], ['Yes · 聖筊', 'One flat, one round: the gods nod. Go ahead.']],
    xiao: [['笑筊', '兩面都朝上，神明笑而不答。問題可能沒說清楚，或答案你心裡早就有了，換個問法再問一次。'], ['Smiling · 笑筊', 'Both flat: the gods smile without answering. Maybe the question was unclear, or you already know. Ask it another way.']],
    yin: [['陰筊', '兩面都朝下，神明不太同意，或是時機還沒到。先緩一緩。'], ['No · 陰筊', 'Both round: the gods disagree, or the time is not right. Slow down for now.']],
  },
  strong: ['<span class="tag">連續三個聖筊</span> 神明非常肯定。', '<span class="tag">Three Yes in a row</span> The gods are certain.'],
  streak: [(n) => `連續聖筊 ${n} 次，習慣上連三次才算定案。`, (n) => `${n} Yes in a row. By custom, three in a row settles it.`],
  thanks: ['謝謝神明', 'Thank the gods'],
  again: ['再擲一次', 'Throw again'],
  qianTitle: ['求籤', 'Draw a fortune'],
  qianIntro: ['先向神明稟報姓名、生日、住址，再說想問的事：工作、感情、健康、家人都可以。',
    'First tell the gods your name, birthday and address, then the matter on your mind: work, love, health or family.'],
  qianRule: ['抽到籤之後要擲到「聖筊」，才代表是神明給你的那一支。', 'After drawing a stick you must throw a Yes with the moon blocks. Only then is it truly yours.'],
  shake: ['開始搖籤', 'Shake the sticks'],
  lotN: [(n) => `第 ${n} 籤`, (n) => `Lot ${n}`],
  drew: [(n) => `抽到第 ${n} 籤`, (n) => `You drew lot ${n}`],
  confirmAsk: ['請擲筊問神明：「是不是這一支？」', 'Throw the moon blocks and ask: "Is this the one?"'],
  confirm: ['擲筊確認', 'Throw to confirm'],
  notThis: ['神明說不是這一支。再搖一次吧。', 'The gods say this is not the one. Shake again.'],
  notToday: ['求不到也沒關係，可能今天不適合問這件事。', 'That is fine. Perhaps today is not the day for this question.'],
  stop: ['今天先這樣', 'Enough for today'],
  reshake: ['再搖一次', 'Shake again'],
  lampTitle: ['寫下祝福', 'Write a blessing'],
  lampIntro: ['為自己或家人寫下祝福。菩提樹上會有一尊小佛守著這份心意，祈求 2027 丁未年光明平安。', 'Write a blessing for yourself or family. A little Buddha on the Bodhi tree will keep it, for a bright and peaceful 2027, Year of the Fire Goat.'],
  lampName: ['祝福給誰（可以只寫暱稱）', 'Who is it for (a nickname is fine)'],
  lampPh: ['例如：阿嬤、小明', 'e.g. Grandma, Ming'],
  birthYear: ['出生年（國曆生日在 2/4 立春前，請選前一年）', 'Birth year (born before Feb 4? pick the year before; that is when the zodiac year begins)'],
  light: ['掛上', 'Hang it'],
  someone: ['有緣人', 'A friend'],
  kindGM: ['光明祈福', 'Brightness blessing 光明'],
  kindTS: ['安太歲祈福', 'Tai Sui blessing 安太歲'],
  lampLit: [(nm, k) => `${nm} 的${k}，有一尊小佛守著了`, (nm, k) => `${nm}'s ${k} now rests with a little Buddha`],
  born: [(z, y) => `屬${z}・${y} 年生`, (z, y) => `Year of the ${z} · born ${y}`],
  clashText: ['丁未羊年你犯太歲，傳統會安太歲，求一年平穩。變動多的年份，重要決定慢一點做。',
    'In 2027, the Year of the Fire Goat, your sign clashes with Tai Sui, the god of the year. Tradition is to pacify Tai Sui (安太歲) for a steady year. Expect change, and take big decisions slowly.'],
  okText: ['2027 丁未年你沒有犯太歲。祈求一年前途光明、諸事順利。',
    'Your sign does not clash with Tai Sui in 2027. This blessing asks for a clear road and a smooth year.'],
  zodiacNote: ['生肖只看出生年。真正的流年吉凶要看完整八字（年、月、日、時）。', 'Your zodiac uses only the birth year. A full BaZi chart (year, month, day and hour) shows much more.'],
  bazi2027: ['免費排八字，看 2027 流年', 'Free BaZi chart: see your 2027'],
  shareFamily: ['分享給家人', 'Share with family'],
  ok: ['好', 'OK'],
  shareLamp: [(nm, k) => `我在歇腳廟幫${nm}點了一盞${k} 🏮`, (nm, k) => `I lit a ${k} for ${nm} at Xiejiao Temple 🏮`],
  poemLoading: ['（籤詩載入中，請稍後再試）', '(The poem is still loading. Try again in a moment.)'],
  confirmed: ['聖筊・神明確認', 'Confirmed by a Yes from the gods'],
  lotNote: ['籤詩是方向，不是判決。解籤時把它放回你問的那件事裡讀。', 'A fortune poem points a direction; it is not a verdict. Read it against the question you asked.'],
  baziLot: ['配合八字看這支籤', 'Read this lot with your BaZi chart'],
  sharePoem: ['分享籤詩', 'Share the poem'],
  keep: ['收下', 'Keep it'],
  shareLot: [(n, l) => `我在歇腳廟求到第 ${n} 籤${l ? '：' + l : ''}`, (n, l) => `I drew lot ${n} at Xiejiao Temple${l ? ': "' + l + '"' : ''}`],
  langBtn: ['EN', '中'],
};
const t = (k, ...a) => { const v = TX[k][EN ? 1 : 0]; return typeof v === 'function' ? v(...a) : v; };

document.documentElement.lang = EN ? 'en' : 'zh-Hant-TW';
if (EN) document.title = 'Xiejiao Temple · a quiet online Taiwanese temple';
$('#brand b').textContent = t('brand');
$('#room').textContent = t('room', 1);
$('#hint').textContent = t('hint');
$('#gateMsg').textContent = t('loading');
const intro = { on: true, parting: false, k: 0 };          // the cloud intro (built further down)
// every three.js loader reports to the default manager: the gates stay shut until all of it has arrived
const loadState = { done: 0, total: 0, idle: null };
THREE.DefaultLoadingManager.onProgress = (url, done, total) => {
  loadState.done = done; loadState.total = total;
  if (!intro.on) { (window.__lateLoads ||= []).push(url); return; }
  const w = Math.max(parseFloat($('#gateBar').style.width) || 0, (done / total) * 92);   // never runs backwards
  $('#gateBar').style.width = w + '%'; $('#gatePct').textContent = Math.floor(w) + '%';
};
$('#rest div').textContent = t('rest');
$('#wake').textContent = t('wake');
document.querySelectorAll('#bar button').forEach((b, i) => { b.lastChild.textContent = TX.acts[+EN][i]; });
$('#lang').textContent = t('langBtn');
$('#lang').onclick = () => { store.set('lang', EN ? 'zh' : 'en'); const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u; };

// ---------------- renderer / scene ----------------
const app = $('#app');
const isMobile = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile || devicePixelRatio < 2 });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.25 : 1.5));   // ponytail: fixed caps; full retina was 4x the pixels for little visible gain
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;                      // redrawn every third frame (see frame()): the sun and the temple don't move
let shadowTick = 0;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
app.appendChild(renderer.domElement);

const labels = new CSS2DRenderer();
labels.setSize(innerWidth, innerHeight);
Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
app.appendChild(labels.domElement);

const scene = new THREE.Scene();
// real sunset sky (Poly Haven HDRI, CC0) for reflections + background; studio env until it loads
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;
scene.background = new THREE.Color(0xc89a7a);
new RGBELoader().load('/temple/assets/sky.hdr', (hdr) => { scene.environment = pmrem.fromEquirectangular(hdr).texture; hdr.dispose(); });

const fovFor = (a) => (a < 0.8 ? 66 : 50); // wider lens on portrait phones
const camera = new THREE.PerspectiveCamera(fovFor(innerWidth / innerHeight), innerWidth / innerHeight, 0.1, 400);
// glow on lanterns, candles and lamps
const DBG = new URLSearchParams(location.search);   // ?nomsaa ?nomirror ?noao for performance checks
// multisampled target: post-processing otherwise drops the canvas MSAA and thin edges shimmer as you move
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(
  innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio(),
  { type: THREE.HalfFloatType, samples: DBG.has('nomsaa') ? 0 : isMobile ? 2 : 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight).multiplyScalar(0.5), 0.1, 0.4, 0.98);   // barely any glow: halos read as glare, not calm
{ const ss = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => ss(w * 0.5, h * 0.5); }   // a soft glow needs no full-res blur
const HQ = !isMobile;
// (no screen-space AO: the baked lighting already has soft contact shadows, and AO crawled as you moved)
if (!isMobile) composer.addPass(bloom);                    // phones: the faint glow isn't worth two extra passes
composer.addPass(new OutputPass());
// film grade: warm highlights, cool shadows, gentle contrast, vignette, fine grain
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col *= mix(vec3(0.94, 0.97, 1.04), vec3(1.05, 1.0, 0.93), smoothstep(0.05, 0.85, l));
      col = mix(vec3(l), col, 1.06);
      col = smoothstep(-0.03, 1.02, col);
      vec2 d = vUv - 0.5; col *= 1.0 - dot(d, d) * 0.6;
      col += (fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012;
      gl_FragColor = vec4(col, c.a);
    }`,
});
composer.addPass(grade);
await Promise.race([
  Promise.all([
    document.fonts.load('64px "TempleKai"', '歇腳廟慈光普照合境平安有求必應光明燈正殿天公爐安心'),
    document.fonts.load('700 64px "LXGW WenKai TC"', 'A'),
  ]),
  new Promise((res) => setTimeout(res, 4000)),
]).catch(() => {});
const world = buildWorld(scene);

// desktop only: soft reflections on the polished hall floor
let floorMirror = null;
// ground clutter (grass, ferns, scattered rocks) is left out of every reflection pass: you can't see it in the
// water, and drawing it again per mirror was most of the cost
const noReflect = new Set();
const reflectLean = (m, every = isMobile ? 4 : 3) => { const f = m.onBeforeRender; let n = 0; m.onBeforeRender = function (...a) { if (n++ % every) return;   // re-render the reflection every few frames; the ripples still move every frame
  const was = []; for (const o of noReflect) { was.push(o.visible); o.visible = false; } f.apply(this, a); let i = 0; for (const o of noReflect) o.visible = was[i++]; }; };
if (HQ && !DBG.has('nomirror')) {
  const fl = scene.getObjectByName('hallFloor');
  const p = fl.geometry.parameters;
  floorMirror = new Reflector(new THREE.PlaneGeometry(p.width, p.height), {
    textureWidth: innerWidth / 2, textureHeight: innerHeight / 2, clipBias: 0.003, multisample: 0,
  });
  floorMirror.material.transparent = true;
  reflectLean(floorMirror, 2);
  floorMirror.material.depthWrite = false;
  Object.assign(floorMirror.material, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  floorMirror.material.fragmentShader = floorMirror.material.fragmentShader.replace(
    'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'gl_FragColor = vec4( base.rgb, 0.16 * mirrorFade );');
  floorMirror.material.uniforms.mirrorFade = { value: 0 };
  floorMirror.material.fragmentShader = 'uniform float mirrorFade;\n' + floorMirror.material.fragmentShader;
  floorMirror.rotation.x = -Math.PI / 2;
  floorMirror.position.copy(fl.getWorldPosition(new THREE.Vector3()));
  scene.add(floorMirror);
}

// Over-the-shoulder follow camera: it sits at a fixed height behind the monk and never floats.
// Dragging only turns the view (yaw, and a little pitch to look up at the statues); scroll / pinch
// zooms between behind-the-shoulder and first person (through the monk's eyes).
const controls = { target: new THREE.Vector3(), update() {} };   // the look target, read by steering code
const cam = { yaw: 0, pitch: -0.1, dist: 3.4, ready: false, dragging: false };

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = fovFor(camera.aspect);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  labels.setSize(innerWidth, innerHeight);
});

// ---------------- real statue scan + paintings (swapped in once loaded) ----------------
const qs = new URLSearchParams(location.search);
const STATUE = { url: qs.get('statue') || '/temple/assets/statue.glb', yaw: +(qs.get('yaw') || 0) };
function placeScan(gltfScene, slot, height, yaw, { onDais = false, dx = 0, depth = 1 } = {}) {
  const m = gltfScene;
  m.rotation.y = yaw;
  m.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
  m.scale.multiplyScalar(height / size.y); m.scale.z *= depth;      // depth < 1: slimmer front to back, so a giant still fits before the back wall
  m.updateMatrixWorld(true);
  box.setFromObject(m);
  const c = box.getCenter(new THREE.Vector3());
  const base = slot.position;                        // deity group sits on the dais; its throne is 0.9*scale tall
  m.position.add(new THREE.Vector3(base.x + dx - c.x, base.y + (onDais ? 0 : slot.scale.y * 0.9) - box.min.y, base.z + 0.2 - c.z));
  m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.envMapIntensity = 1.4; } });
  m.userData.role = 'occ';
  slot.parent.add(m);
  // keep the procedural pedestal, hide the procedural figure and its backrest
  slot.children.forEach((ch, i) => { if (i > 0 || onDais) ch.visible = false; });   // on the dais itself: its pedestal goes too
  gild(m);
  m.updateMatrixWorld(true);
  adorn(m);
  backlight(m);
}

// ---- pure gold: the scan's carving and wear survive as subtle tone in the gilding ----
function gild(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material.map?.image;
    let detail = null, ao = null, bump = null, rough = null;
    if (src) {
      // the scan's own shading holds its carving: stretch its contrast, then use it four ways — tone in the gilding,
      // occlusion in the recesses, bump for crisp edges, and polish on the raised parts (worn smooth by hands)
      const w = Math.min(1024, src.width), h = Math.min(1024, src.height);
      const rd = document.createElement('canvas'); rd.width = w; rd.height = h;
      const rg = rd.getContext('2d'); rg.drawImage(src, 0, 0, w, h);
      const px = rg.getImageData(0, 0, w, h).data, L = new Float32Array(w * h);
      for (let i = 0; i < L.length; i++) L[i] = (0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2]) / 255;
      const sorted = L.slice().sort(), lo = sorted[Math.floor(L.length * 0.02)], hi = sorted[Math.floor(L.length * 0.98)];
      for (let i = 0; i < L.length; i++) L[i] = Math.min(1, Math.max(0, (L[i] - lo) / Math.max(0.01, hi - lo)));
      const tex = (f, srgb) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'), d = g.createImageData(w, h);
        for (let i = 0; i < L.length; i++) { const v = Math.round(255 * f(L[i])); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
        g.putImageData(d, 0, 0);
        const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.flipY = o.material.map.flipY; t.anisotropy = 8; return t;
      };
      detail = tex((l) => 0.6 + 0.4 * Math.pow(l, 0.8), true);
      ao = tex((l) => 0.25 + 0.75 * Math.pow(l, 0.6));                 // deep shadow in the folds outlines every feature
      bump = tex((l) => l);
      rough = tex((l) => 0.5 + 0.5 * (1 - l));                         // raised parts polished, recesses a little duller
    }
    // the decimated scan shades in flat facets: weld its vertices and smooth the normals
    const g0 = new THREE.BufferGeometry();                             // unpack the quantized, interleaved scan to plain floats first
    for (const k of ['position', 'uv']) {
      const at = o.geometry.attributes[k]; if (!at) continue;
      const n = at.itemSize, arr = new Float32Array(at.count * n);
      for (let i = 0; i < at.count; i++) for (let j = 0; j < n; j++) arr[i * n + j] = at.getComponent(i, j);
      g0.setAttribute(k, new THREE.BufferAttribute(arr, n));
    }
    if (o.geometry.index) g0.setIndex(o.geometry.index);
    try { const sm = mergeVertices(g0, 1e-3); sm.computeVertexNormals(); o.geometry = sm; } catch (e) { console.warn('statue smoothing skipped', e); }
    // polished gilding; the scan's own shading doubles as occlusion, so folds and recesses darken and the form reads in 3D
    o.material = new THREE.MeshPhysicalMaterial({ color: 0xffc85a, map: detail, aoMap: ao, aoMapIntensity: 1, bumpMap: bump, bumpScale: 1.4,
      roughnessMap: rough, metalness: 1, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.05, envMapIntensity: 3.6 });
  });
}

// ---- precious stones set on the carved crown, necklace and belt (found by casting rays onto the scan) ----
const GEM_GEO = new THREE.IcosahedronGeometry(1, 0).scale(1, 1, 0.55);
const BEZEL_GEO = new THREE.TorusGeometry(1.05, 0.2, 6, 18);
const GEM = {
  ruby: new THREE.MeshPhysicalMaterial({ color: 0xff0a2a, roughness: 0.03, clearcoat: 1, ior: 2.2, emissive: 0xc00018, emissiveIntensity: 0.9, envMapIntensity: 3 }),
  emerald: new THREE.MeshPhysicalMaterial({ color: 0x00d26a, roughness: 0.03, clearcoat: 1, ior: 2.2, emissive: 0x00873c, emissiveIntensity: 0.9, envMapIntensity: 3 }),
  sapphire: new THREE.MeshPhysicalMaterial({ color: 0x1240ff, roughness: 0.03, clearcoat: 1, ior: 2.2, emissive: 0x0a22c8, emissiveIntensity: 0.9, envMapIntensity: 3 }),
  pearl: new THREE.MeshPhysicalMaterial({ color: 0xfff8ec, roughness: 0.2, clearcoat: 1, sheen: 1, iridescence: 0.6, emissive: 0x3a352c, envMapIntensity: 2 }),
};
const BEZEL = new THREE.MeshPhysicalMaterial({ color: 0xffc24e, metalness: 1, roughness: 0.12, envMapIntensity: 2.1 });
function adorn(root) {
  const meshes = []; root.traverse((o) => o.isMesh && meshes.push(o));
  const box = new THREE.Box3().setFromObject(root), H = box.max.y - box.min.y, W = box.max.x - box.min.x, cx = (box.min.x + box.max.x) / 2;
  const ray = new THREE.Raycaster(), n = new THREE.Vector3();
  const place = (fx, fy, kind, size) => {
    ray.set(new THREE.Vector3(cx + fx * W, box.min.y + fy * H, box.max.z + 2), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObjects(meshes, false)[0]; if (!hit) return;
    n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    if (n.z < 0.15) n.set(0, 0, 1);                                   // grazing hit: just face forward
    const r = H * size;
    const gem = new THREE.Mesh(GEM_GEO, GEM[kind]); gem.position.copy(hit.point).addScaledVector(n, r * 0.35); gem.scale.setScalar(r);
    gem.lookAt(gem.position.clone().add(n));
    const bezel = new THREE.Mesh(BEZEL_GEO, BEZEL); bezel.position.copy(gem.position).addScaledVector(n, -r * 0.2); bezel.scale.setScalar(r); bezel.lookAt(bezel.position.clone().add(n));
    gem.userData.role = bezel.userData.role = 'skip';
    scene.add(gem, bezel);
  };
  const cycle = ['ruby', 'emerald', 'sapphire', 'pearl'];
  for (let i = -3; i <= 3; i++) place(i * 0.035, 0.915 - Math.abs(i) * 0.008, cycle[(i + 3) % 4], 0.009);       // crown
  place(0, 0.95, 'ruby', 0.014);                                                                           // crown jewel
  for (let i = -5; i <= 5; i++) place(i * 0.028, 0.555 + (i * i) * 0.0026, i % 2 ? 'pearl' : (i % 4 ? 'emerald' : 'ruby'), 0.0075);   // necklace: U-shaped drape on the chest
  place(0, 0.52, 'sapphire', 0.014);                                                                       // pendant
  for (let i = -3; i <= 3; i++) place(i * 0.06, 0.38, cycle[(i + 5) % 4], 0.008);                          // belt
}

let DEITY = null;                                   // the main statue's footprint, for ritual framing
// ---- 背光: a glowing mandorla and head halo behind each statue ----
// Drawn like a carved gilt aureole: a flame border licking outward, a ring of beads, a ring of lotus petals, fine
// rays, and a soft glow at the heart. Additive, so only the light shows.
const auraPt = (cx, cy, rx, ry, s, f) => {                              // the aureole's outline: round below, a flame point on top
  const a = f * Math.PI * 2, up = Math.max(0, Math.cos(a));
  return [cx + Math.sin(a) * rx * s * (1 - 0.32 * up ** 3), cy - Math.cos(a) * ry * s * (Math.cos(a) > 0 ? 1 + 0.18 * up ** 6 : 0.92)];
};
const auraPath = (c, cx, cy, rx, ry, s) => { c.beginPath(); for (let i = 0; i <= 240; i++) { const [x, y] = auraPt(cx, cy, rx, ry, s, i / 240); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); };
const petalAt = (c, x, y, ang, len, wid, fill) => { c.save(); c.translate(x, y); c.rotate(ang); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(wid, -len * 0.5, 0, -len); c.quadraticCurveTo(-wid, -len * 0.5, 0, 0); c.fillStyle = fill; c.fill(); c.restore(); };
const ringOf = (c, n, pt, draw) => { for (let i = 0; i < n; i++) { const f = i / n, [x, y] = pt(f), [x2, y2] = pt(f + 0.002); draw(x, y, Math.atan2(y2 - y, x2 - x)); } };
const mandorlaTex = canvasTex(1024, 1280, (c, w, h) => {
  const cx = w / 2, cy = h * 0.58, rx = w * 0.46, ry = h * 0.5;
  c.save(); auraPath(c, cx, cy, rx, ry, 0.9); c.clip();
  const g = c.createRadialGradient(cx, cy, 10, cx, cy, h * 0.55);
  g.addColorStop(0, 'rgba(255,246,215,1)'); g.addColorStop(0.45, 'rgba(255,208,115,0.8)'); g.addColorStop(1, 'rgba(255,160,50,0.35)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(255,236,180,0.28)'; c.lineWidth = 1.5;                 // fine rays
  for (let i = 0; i < 220; i++) { const a = (i / 220) * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60); c.lineTo(cx + Math.cos(a) * h, cy + Math.sin(a) * h); c.stroke(); }
  c.restore();
  // lotus-petal ring, bead ring, gilded rims
  ringOf(c, 64, (f) => auraPt(cx, cy, rx, ry, 0.8, f), (x, y, t) => petalAt(c, x, y, t - Math.PI / 2 + Math.PI, 34, 13, 'rgba(255,200,110,0.55)'));
  c.fillStyle = 'rgba(255,240,190,0.9)'; ringOf(c, 110, (f) => auraPt(cx, cy, rx, ry, 0.87, f), (x, y) => { c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); });
  for (const [sc, lw, col] of [[0.9, 8, 'rgba(255,220,130,0.95)'], [0.84, 3, 'rgba(255,210,120,0.7)'], [0.74, 3, 'rgba(255,210,120,0.55)']]) { c.strokeStyle = col; c.lineWidth = lw; auraPath(c, cx, cy, rx, ry, sc); c.stroke(); }
  // flame border: tongues licking outward, each curling a little, gold at the root and orange at the tip
  ringOf(c, 46, (f) => auraPt(cx, cy, rx, ry, 0.91, f), (x, y, t) => {
    const len = 46 + Math.sin(x * 0.05 + y * 0.03) * 12;
    c.save(); c.translate(x, y); c.rotate(t - Math.PI / 2 + Math.PI);
    const fg = c.createLinearGradient(0, 0, 0, -len); fg.addColorStop(0, 'rgba(255,215,120,0.85)'); fg.addColorStop(1, 'rgba(255,120,30,0)');
    c.fillStyle = fg; c.beginPath(); c.moveTo(-14, 0); c.bezierCurveTo(-16, -len * 0.5, 10, -len * 0.6, 4, -len); c.bezierCurveTo(16, -len * 0.55, 14, -len * 0.2, 14, 0); c.fill(); c.restore();
  });
});
const haloTex = canvasTex(512, 512, (c, w) => {
  const m = w / 2;
  const g = c.createRadialGradient(m, m, 0, m, m, m * 0.62);
  g.addColorStop(0, 'rgba(255,252,230,0.95)'); g.addColorStop(0.7, 'rgba(255,214,130,0.55)'); g.addColorStop(1, 'rgba(255,190,90,0.25)');
  c.fillStyle = g; c.beginPath(); c.arc(m, m, m * 0.62, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,238,190,0.35)'; c.lineWidth = 1.2;
  for (let i = 0; i < 120; i++) { const a = (i / 120) * Math.PI * 2; c.beginPath(); c.moveTo(m + Math.cos(a) * 30, m + Math.sin(a) * 30); c.lineTo(m + Math.cos(a) * m * 0.6, m + Math.sin(a) * m * 0.6); c.stroke(); }
  const circ = (s) => (f) => [m + Math.cos(f * Math.PI * 2) * m * s, m + Math.sin(f * Math.PI * 2) * m * s];
  ringOf(c, 24, circ(0.66), (x, y, t) => petalAt(c, x, y, t + Math.PI / 2 + Math.PI, 30, 12, 'rgba(255,205,115,0.7)'));
  c.fillStyle = 'rgba(255,242,200,0.95)'; ringOf(c, 60, circ(0.62), (x, y) => { c.beginPath(); c.arc(x, y, 3.2, 0, 7); c.fill(); });
  for (const [sc, lw] of [[0.6, 4], [0.8, 5]]) { c.strokeStyle = 'rgba(255,222,140,0.9)'; c.lineWidth = lw; c.beginPath(); c.arc(m, m, m * sc, 0, 7); c.stroke(); }
  ringOf(c, 36, circ(0.81), (x, y, t) => {                               // a fringe of small flames
    c.save(); c.translate(x, y); c.rotate(t + Math.PI / 2 + Math.PI);
    const fg = c.createLinearGradient(0, 0, 0, -36); fg.addColorStop(0, 'rgba(255,210,120,0.8)'); fg.addColorStop(1, 'rgba(255,120,30,0)');
    c.fillStyle = fg; c.beginPath(); c.moveTo(-8, 0); c.bezierCurveTo(-9, -18, 6, -22, 2, -36); c.bezierCurveTo(9, -20, 8, -8, 8, 0); c.fill(); c.restore();
  });
});
function backlight(root) {
  const box = new THREE.Box3().setFromObject(root), H = box.max.y - box.min.y, W = box.max.x - box.min.x;
  const cx = (box.min.x + box.max.x) / 2, z = box.min.z + (box.max.z - box.min.z) * 0.18;
  const mat = (map, opacity) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const roof = HALL.floor + HALL.ceil - 0.35;                             // never taller than the hall
  const bot = box.min.y + H * 0.02, top = Math.min(box.min.y + H * 1.1, roof), bh = top - bot;
  const body = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(W * 1.25, bh * 0.82), bh), mat(mandorlaTex, 0.92));
  body.position.set(cx, (top + bot) / 2, z);
  if (!DEITY || H > DEITY.top - DEITY.base) DEITY = { x: cx, z: (box.min.z + box.max.z) / 2, base: box.min.y, top: box.min.y + H * 1.1, halfW: W * 0.63 };
  const hy = box.min.y + H * 0.86, hr = Math.min(W * 0.3, (roof - hy) / 0.96);   // its flame fringe reaches ~0.95 of the disc
  const head = new THREE.Mesh(new THREE.CircleGeometry(hr, 64), mat(haloTex, 0.95));
  head.position.set(cx, hy, z + 0.02);
  body.userData.role = head.userData.role = 'skip';
  scene.add(body, head);
}
const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const scenery = buildScenery(scene, { isMobile });                  // plateau, cliffs, sea of cloud, Zhangjiajie horizon, sky
scenery.clouds.forEach((c) => noReflect.add(c));
buildGate(scene, { gl, isMobile, oldGate: world.occluders[0] });   // the detailed 三川殿 front gate (gate.js)
{ const fill = new THREE.PointLight(0xfff1dc, 14, 13, 1.6); fill.position.set(0, 4.6, 25.2); scene.add(fill); }   // soft daylight bounce under the gate porch
// missing file → keep the procedural statues
gl.load(STATUE.url, (g) => placeScan(g.scene, world.altar.center, 21.0, STATUE.yaw, { onDais: true, depth: 0.58 }), undefined, () => {});   // colossal: seated on the dais, crown just under the raised ceiling
gl.load('/temple/assets/statue_side.glb', (g) => {
  world.altar.sides.forEach((s, i) => {
    const m = i ? g.scene : g.scene.clone(true);
    if (!i) m.scale.x = -1;                           // mirror the left one so both lean toward the centre
    placeScan(m, s, 13.0, 0, { onDais: true, dx: Math.sign(s.position.x) * 3.25, depth: 0.85 });
  });
}, undefined, () => {});

// ---------------- photoscanned props (replace the code-built stand-ins once loaded) ----------------
// the scans' texture atlases have pure-white padding round each island; it bled in as white specks. Paint it the
// atlas's average stone colour (once per texture).
const cleanMaps = new Map();
function cleanScanMap(map) {
  if (!map?.image) return map;
  if (cleanMaps.has(map)) return cleanMaps.get(map);
  if ([...cleanMaps.values()].includes(map)) return map;
  const img = map.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < p.length; i += 4) if (p[i] < 225 || p[i + 1] < 225 || p[i + 2] < 225) { sr += p[i]; sg += p[i + 1]; sb += p[i + 2]; n++; }
  if (n) for (let i = 0; i < p.length; i += 4) if (p[i] >= 225 && p[i + 1] >= 225 && p[i + 2] >= 225) { p[i] = sr / n; p[i + 1] = sg / n; p[i + 2] = sb / n; }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = map.colorSpace; t.flipY = map.flipY; t.anisotropy = 8;
  t.wrapS = map.wrapS; t.wrapT = map.wrapT;
  cleanMaps.set(map, t); return t;
}
function placeProp(src, { x, y = 0, z, h, yaw = 0, mirror = false, girthOf = h }) {   // girthOf: size its thickness as if it were this tall
  const m = src.clone(true);
  m.rotation.y = yaw; if (mirror) m.scale.x = -1;
  m.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
  m.scale.multiplyScalar(girthOf / size.y); m.scale.y *= h / girthOf;
  m.updateMatrixWorld(true); box.setFromObject(m);
  const c = box.getCenter(new THREE.Vector3());
  m.position.add(new THREE.Vector3(x - c.x, y - box.min.y, z - c.z));
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    // scans ship as "unlit"; make them react to the temple's light like real stone and bronze
    if (o.material.isMeshBasicMaterial) {
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();   // unlit scans ship without normals
      o.material = new THREE.MeshStandardMaterial({ map: o.material.map, roughness: 0.85, metalness: 0 });
    }
    if (o.material.map) o.material.map = cleanScanMap(o.material.map);
    o.material.side = THREE.DoubleSide;                // a crack in the scanned shell shows dark stone, not the bright sky behind
  });
  m.userData.role = 'occ';
  scene.add(m);
  return m;
}
const PROPS = '/temple/assets/props/';
gl.load(PROPS + 'pillar_dragon_02.glb', (g) => {
  scene.traverse((o) => {
    if (o.name !== 'dragonCol') return;
    const s = o.userData.spot;
    o.visible = false;
    // the scan only has a carved front; pairs are mirrored so the two dragons of each pair face each other
    const hall = s.y > 1;                                              // the hall's pair: slimmer and set back, so their lotus bases stay on the hall floor, not over the steps
    placeProp(g.scene, { x: s.x, y: s.y, z: hall ? s.z - 0.45 : s.z, h: s.h, girthOf: hall ? 10.5 : s.h, yaw: -Math.PI / 2, mirror: s.x < 0 });
  });
}, undefined, () => {});
gl.load(PROPS + 'lion_stone_big.glb', (g) => {
  // Taiwanese convention: male (paw on the embroidered ball) on the dragon side 龍邊 — the temple's left
  // looking out, i.e. the visitor's right (+x); female on the tiger side. Both face out, guarding the approach.
  // The scan faces +x; a free matching female (with cub) doesn't exist, so the left one is a mirror for now.
  placeProp(g.scene, { x: 3.1, z: 26.2, h: 2.3, yaw: -Math.PI / 2 });
  placeProp(g.scene, { x: -3.1, z: 26.2, h: 2.3, yaw: Math.PI / 2, mirror: true });
}, undefined, () => {});
gl.load(PROPS + 'drum_stone.glb', (g) => {
  for (const sx of [-1, 1]) placeProp(g.scene, { x: sx * 1.75, z: 22.75, h: 1.25, yaw: sx * Math.PI / 2 });
}, undefined, () => {});
gl.load(PROPS + 'censer_ding_cleveland.glb', (g) => {
  world.lu.visible = false;
  const ding = placeProp(g.scene, { x: 0, y: 0, z: 8, h: 2.6 });   // a 天公爐 stands on its own three legs
  const top = new THREE.Box3().setFromObject(ding).max.y;
  world.luPos.y = top - 0.45;                      // incense goes into the ash just below the rim
  setTimeout(restoreSticks, 0);                     // your still-burning sticks from an earlier visit (needs the ash height)
  luSmoke.pos.y = top - 0.1;
}, undefined, () => {});

// ---------------- offerings on the altar table: real scanned fruit and flowers ----------------
// The code-built fruit and vases (named 'standIn') are hidden; loadBaked() hides their baked copies too.
world.table.traverse((o) => { if (o.name === 'standIn') o.visible = false; });
// a clone scaled to height h, sitting on y=0 and centred, as a child of the table (table-local coordinates)
function offer(src, h, x, y, z, yaw = 0) {
  const m = src.clone(true), w = new THREE.Group();
  w.add(m); w.rotation.y = yaw;
  const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3());
  m.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  w.scale.setScalar(h / (box.max.y - box.min.y));
  w.position.set(x, y, z);
  w.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  w.userData.role = 'skip';                       // live objects, not part of the bake
  world.table.add(w);
  return w;
}
const OFF = '/temple/assets/offerings/', TOP = 1.25, PLATE = 1.345;
const rnd = (i) => ((Math.sin(i * 91.7) * 43758.5) % 1 + 1) % 1;   // stable per-piece jitter
// a pyramid of fruit on a plate: ring of n, then a smaller ring, then one on top
function pile(models, cx, cz, d, seed) {
  let k = 0;
  const put = (x, y, z) => { const m = models[k % models.length]; offer(m, d * (0.92 + rnd(seed + k) * 0.16), cx + x, y, cz + z, rnd(seed + k++) * 6.28); };
  for (let i = 0; i < 6; i++) put(Math.cos(i * 1.047) * d * 1.25, PLATE, Math.sin(i * 1.047) * d * 1.25);
  for (let i = 0; i < 3; i++) put(Math.cos(i * 2.09 + 0.5) * d * 0.62, PLATE + d * 0.62, Math.sin(i * 2.09 + 0.5) * d * 0.62);
  put(0, PLATE + d * 1.25, 0);
}
Promise.all(['mandarin', 'apple', 'pineapple', 'bananas', 'vase', 'mum', 'orchid'].map((n) => gl.loadAsync(OFF + n + '.glb').then((g) => g.scene)))
  .then(([mandarin, apple, pineapple, bananas, vase, mum, orchid]) => {
    pile([mandarin], -1.6, -0.4, 0.2, 1);                       // 柑橘: luck (吉)
    pile([apple], 1.6, -0.4, 0.21, 7);                           // 蘋果: peace (平安)
    offer(pineapple, 0.95, 1.0, TOP, 0.35, 0.6);                   // 鳳梨 旺來: prosperity
    offer(bananas, 0.27, -1.95, TOP + 0.05, 0.45, 2.9);

    // chrysanthemums: the scan is a pink single bloom; recolour its petals to the temple's gold and white
    const tint = (hue, white) => {
      const img = mum.getObjectByProperty('isMesh', true).material.map.image;
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, cv.width, cv.height), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (!(r > g && b > g * 0.9 && mx - mn > 0.15)) continue;          // pink/magenta petals only
        const v = mx;
        if (white) { const l = 0.78 + v * 0.2; p[i] = l * 255; p[i + 1] = l * 250; p[i + 2] = l * 232; }
        else { const c = new THREE.Color().setHSL(hue, 0.85, 0.32 + v * 0.3); p[i] = c.r * 255; p[i + 1] = c.g * 255; p[i + 2] = c.b * 255; }
      }
      cx.putImageData(d, 0, 0);
      const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace;
      const src = mum.clone(true);
      src.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.map = t; } });
      return src;
    };
    const mums = [tint(0.12, false), tint(0, true)];
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 0.8 });
    for (const sx of [-1, 1]) {
      const vx = sx * 3.1, vz = -0.75, vh = 0.85;
      offer(vase, vh, vx, TOP, vz, sx > 0 ? Math.PI : 0);
      // a domed bouquet: heads on a half-sphere above the neck, stems converging into it
      for (let i = 0; i < 19; i++) {
        const a = i * 2.4 + sx, r = i ? 0.12 + 0.26 * Math.sqrt(i / 19) : 0;
        const hx = Math.cos(a) * r, hz = Math.sin(a) * r * 0.8, hy = TOP + vh + 0.5 - r * 0.9;
        const head = offer(mums[i % 3 === 2 ? 1 : 0], 0.21, vx + hx, hy, vz + hz, rnd(i + sx * 5) * 6.28);
        head.rotation.x = hz * 1.6; head.rotation.z = -hx * 1.6;
        head.traverse((o) => (o.castShadow = false));                     // tiny: shadows cost more than they show          // tilt outward like a real bunch
        const from = new THREE.Vector3(vx, TOP + vh - 0.05, vz), to = new THREE.Vector3(vx + hx, hy, vz + hz);
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, from.distanceTo(to), 5), stemMat);
        st.position.copy(from).lerp(to, 0.5); st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
        st.userData.role = 'skip'; world.table.add(st);
      }
    }

    // white moth orchids (蝴蝶蘭) in glazed pots either side of the censer, sprays arching outward
    orchid.traverse((o) => { if (o.isMesh && o.material.name === 'phong1SG') o.visible = false; });   // the scan's lime display base
    const pot = new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.16, 0.03], [0.19, 0.17], [0.2, 0.2], [0.185, 0.2], [0.17, 0.05], [0, 0.05]].map(([x, y]) => new THREE.Vector2(x * 1.5, y * 1.5)), 32);
    const glaze = new THREE.MeshPhysicalMaterial({ color: 0x1d3f6e, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
    const moss = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 });
    for (const sx of [-1, 1]) {
      const ox = sx * 0.92, oz = -0.7;
      const p = new THREE.Mesh(pot, glaze); p.position.set(ox, TOP, oz); p.castShadow = p.receiveShadow = true; p.userData.role = 'skip'; world.table.add(p);
      const soil = new THREE.Mesh(new THREE.CircleGeometry(0.27, 24), moss); soil.rotation.x = -Math.PI / 2; soil.position.set(ox, TOP + 0.27, oz); soil.userData.role = 'skip'; world.table.add(soil);
      offer(orchid, 1.7, ox + sx * 0.19, TOP - 0.07, oz, sx < 0 ? 0 : Math.PI);   // spray leans to -x in the scan; offsets put its roots in the pot
    }
  })
  .catch((e) => console.warn('offerings unavailable', e));

// ---------------- the close-up trees: a real 3D broadleaf (Poly Haven "Jacaranda Tree", CC0, leaves reduced) ----------------
// replaces the crossed-card stand-ins that read as cardboard up close
if (!isMobile) gl.load('/temple/assets/env/broadleaf.glb', (g) => {   // phones keep the light card trees
  const cards = scene.getObjectByName('nearTrees'); if (!cards) return;
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (/leaves/.test(o.material.name)) {                 // thin leaves: lit from both sides, a little translucent-bright
      o.material.transparent = false; o.material.depthWrite = true; o.material.side = THREE.DoubleSide;
      o.material.color.setRGB(1.5, 1.6, 1.35); o.material.roughness = 0.75;
      o.material.emissive = new THREE.Color(0x1c2a12); o.material.emissiveIntensity = 1;
    }
  });
  const box = new THREE.Box3().setFromObject(g.scene), h = box.max.y - box.min.y;
  cards.userData.spots.forEach(([x, z, sc], i) => {
    const t = g.scene.clone(); t.scale.setScalar((sc * 4.4) / h);           // about as tall as the card tree it replaces
    t.position.set(x, -box.min.y * t.scale.y, z); t.rotation.y = i * 1.9;
    t.userData.role = 'skip'; scene.add(t);
  });
  cards.visible = false;
}, undefined, () => {});

// ---------------- bamboo groves (Guanyin's 紫竹林): "Free Bamboo Set" by JonhGillessen, CC BY 4.0 ----------------
// The set holds 9 whole plants (culm + branches + leaf cards). Each becomes a template; hundreds of stalks are drawn as
// instances in three groves: lining the approach path, framing the plaza, and rising behind the courtyard walls.
gl.load('/temple/assets/env/bamboo.glb', (g) => {
  g.scene.updateMatrixWorld(true);
  const meshes = []; g.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const box = (o) => new THREE.Box3().setFromObject(o);
  const culms = meshes.filter((o) => /bamboo(Mat|old)/.test(o.material.name) && box(o).getSize(new THREE.Vector3()).y > 20);
  const plants = culms.map((c) => {
    const cb = box(c), base = new THREE.Vector3((cb.min.x + cb.max.x) / 2, cb.min.y, (cb.min.z + cb.max.z) / 2);
    const parts = meshes.filter((o) => { const b = box(o), m = b.getCenter(new THREE.Vector3()); return Math.hypot(m.x - base.x, m.z - base.z) < 4 && b.max.y > cb.min.y + 5; });
    let top = 0;
    const geos = parts.map((o) => {
      const geo = o.geometry.clone();
      for (const n of ['position', 'normal']) {                     // dequantize before moving (meshopt-packed)
        const at = geo.attributes[n]; if (!at || at.array instanceof Float32Array) continue;
        const f = new Float32Array(at.count * at.itemSize);
        for (let i = 0; i < at.count; i++) for (let k = 0; k < at.itemSize; k++) f[i * at.itemSize + k] = at.getComponent(i, k);
        geo.setAttribute(n, new THREE.BufferAttribute(f, at.itemSize));
      }
      geo.applyMatrix4(o.matrixWorld); geo.translate(-base.x, -base.y, -base.z);
      geo.computeBoundingBox(); top = Math.max(top, geo.boundingBox.max.y);
      const mat = o.material.clone();
      if (mat.transparent) { mat.transparent = false; mat.alphaTest = 0.45; mat.depthWrite = true; mat.side = THREE.DoubleSide; }
      return { geo, mat, culm: o === c };
    });
    return { geos, top };
  });
  if (!plants.length) return;
  // where: dense bands, seeded so every visitor sees the same grove
  let seed = 1717; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const spots = [];
  const band = (n, x0, x1, z0, z1) => { for (let i = 0; i < n; i++) spots.push([x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0)]); };
  const many = isMobile ? 0.45 : 0.8;                    // ponytail: fixed density; add distance-based thinning if phones struggle
  for (const sx of [-1, 1]) {
    band(40 * many, sx * 6.5, sx * 13, 46, 72);        // lining the approach path
    band(26 * many, sx * 18.5, sx * 23, 20, 44);       // framing the plaza
    band(38 * many, sx * 18.2, sx * 23.5, -40, 18);    // behind the courtyard walls
  }
  band(40 * many, -33, -38, -14, 24);                  // behind the lake (west)
  const keep = spots.filter(([x, z]) => !inPond(x, z, 1.6) && !inLake(x, z, 1.5) && Math.hypot(x + 38, z - 4) > 9.5 && Math.hypot(x - 36, z - 4) > 19.5 && Math.hypot(x - 13, z - 31) > 2.5 && Math.hypot(x + 12, z - 30) > 2.5);
  // each spot is a little clump of 2–3 culms of mixed heights, leaning slightly
  const per = plants.map(() => []);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const [x, z] of keep) {
    const n = 2 + (rnd() < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const pi = (rnd() * plants.length) | 0, h = 7.5 + rnd() * 4.5, s = h / plants[pi].top;
      e.set((rnd() - 0.5) * 0.12, rnd() * 6.28, (rnd() - 0.5) * 0.12);
      per[pi].push(m4.compose(v.set(x + (rnd() - 0.5) * 1.2, -0.05, z + (rnd() - 0.5) * 1.2), q.setFromEuler(e), sc.setScalar(s)).clone());
    }
  }
  const purple = new THREE.Color(0x6a4d5e);              // 紫竹: a share of the culms in purple-black
  plants.forEach((pl, pi) => {
    const list = per[pi]; if (!list.length) return;
    for (const { geo, mat, culm } of pl.geos) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((m, i) => { im.setMatrixAt(i, m); if (culm) im.setColorAt(i, rnd() < 0.3 ? purple : new THREE.Color(1, 1, 1)); });
      im.castShadow = false; im.receiveShadow = true; im.userData.role = 'skip';
      im.computeBoundingSphere();
      scene.add(im);
    }
  });
}, undefined, () => {});

// koi that feel alive: each one wanders to spots of its own choosing, turning gradually; it cruises, sometimes darts
// off with a few strong tail beats and glides, sometimes hangs almost still. The tail beats with its speed (its own
// shader uniforms), it drifts a little up and down, and it keeps clear of the edge and of the other fish.
function koiSchool(put, ticks, P, n, y0, inside) {
  gl.load('/temple/assets/pond/koi.glb', (g) => {
    let seed = Math.round(P.x * 31 + P.z * 7) | 0; const r = () => ((seed = (seed * 16807 + 11) % 2147483647 + 2147483647) % 2147483647 / 2147483647);
    const pick = () => { for (let i = 0; i < 40; i++) { const x = P.x + (r() - 0.5) * 2 * P.rx, z = P.z + (r() - 0.5) * 2 * P.rz; if (inside(x, z, 0.82)) return [x, z]; } return [P.x, P.z]; };
    // The scan was caught mid-turn: its body is bent in a C. Measure that bend (the body's centreline, sideways offset
    // along its length; in the model the fish runs along z, head at +z, side-to-side is x) so the shader can
    // straighten it before adding a proper swimming wave.
    let geoRef = null; g.scene.traverse((o) => { if (o.isMesh && !geoRef) geoRef = o.geometry; });
    const B = 13, cl = new Array(B).fill(0);
    {
      const pa = geoRef.attributes.position, bins = Array.from({ length: B }, () => []);
      for (let i = 0; i < pa.count; i++) bins[Math.min(B - 1, Math.round((pa.getZ(i) + 1) / 2 * (B - 1)))].push(pa.getX(i));
      bins.forEach((xs, k) => { xs.sort((a, b) => a - b); cl[k] = xs.length ? xs[xs.length >> 1] : 0; });
      for (let pass = 0; pass < 2; pass++) for (let k = 1; k < B - 1; k++) cl[k] = (cl[k - 1] + 2 * cl[k] + cl[k + 1]) / 4;   // smooth
    }
    const fish = [];
    for (let i = 0; i < n; i++) {
      const u = { phase: { value: r() * 6 }, amp: { value: 0.1 }, fin: { value: r() * 6 } };
      const src = g.scene.clone(true);
      src.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        o.material.onBeforeCompile = (sh) => {
          sh.uniforms.uPhase = u.phase; sh.uniforms.uAmp = u.amp; sh.uniforms.uFin = u.fin; sh.uniforms.uCL = { value: cl };
          sh.vertexShader = `uniform float uPhase; uniform float uAmp; uniform float uFin; uniform float uCL[${B}];\n` + sh.vertexShader.replace('#include <begin_vertex>',
            `#include <begin_vertex>
             float fz = clamp((transformed.z + 1.0) * 0.5 * ${B - 1}.0, 0.0, ${B - 1}.0);
             int i0 = int(floor(fz)); int i1 = min(i0 + 1, ${B - 1});
             float centre = mix(uCL[i0], uCL[i1], fz - float(i0));
             float side = transformed.x - centre;
             transformed.x = side;                                                   // straighten the scanned bend
             float along = clamp((1.0 - transformed.z) * 0.5, 0.0, 1.0);              // 0 at the snout .. 1 at the tail fan
             // swimming: a travelling wave, small at the head, big at the tail
             transformed.x += sin(uPhase - along * 6.2) * uAmp * (0.15 + along * along * 1.6);
             // pectoral fins (wide parts just behind the head) row up and down
             float finZone = smoothstep(0.25, 0.32, along) * (1.0 - smoothstep(0.42, 0.5, along));
             float finOut = max(abs(side) - 0.13, 0.0);
             transformed.y += sin(uFin + sign(side) * 0.6) * finOut * 0.9 * finZone;`);
        };
      });
      const [x, z] = pick();
      const f = put(src, 0.36 + r() * 0.16, x, y0, z);
      fish.push({ f, u, x, z, h: r() * 6.28, v: 0.15, vWant: 0.2, tgt: pick(), t: 0, mode: 'cruise', yPh: r() * 6.28, y0: y0 + r() * 0.04 });
    }
    ticks.push((dt) => {
      dt = Math.min(dt, 0.05);
      for (const k of fish) {
        k.t -= dt;
        const dx = k.tgt[0] - k.x, dz = k.tgt[1] - k.z, d = Math.hypot(dx, dz);
        if (d < 0.4 || k.t <= 0) {                                         // a new whim
          const roll = r();
          k.mode = roll < 0.14 ? 'dart' : roll < 0.26 ? 'rest' : 'cruise';
          k.vWant = k.mode === 'dart' ? 0.7 + r() * 0.3 : k.mode === 'rest' ? 0.03 + r() * 0.03 : 0.18 + r() * 0.16;
          k.t = k.mode === 'dart' ? 1 + r() : k.mode === 'rest' ? 2 + r() * 4 : 4 + r() * 6;
          if (k.mode !== 'rest') k.tgt = pick();
        }
        // steer: toward the target, away from close neighbours, back in from the edge
        let want = Math.atan2(dx, dz);
        for (const o of fish) {
          if (o === k) continue;
          const ox = k.x - o.x, oz = k.z - o.z, od = Math.hypot(ox, oz);
          if (od < 0.6 && od > 1e-3) want += Math.sign(Math.sin(Math.atan2(ox, oz) - k.h)) * 0.6 * (1 - od / 0.6);
        }
        const look = Math.min(0.6, 0.2 * Math.min(P.rx, P.rz));            // look a little ahead (less in a small pond)
        const ahead = [k.x + Math.sin(k.h) * look, k.z + Math.cos(k.h) * look];
        if (!inside(ahead[0], ahead[1], 0.9)) want = Math.atan2(P.x - k.x, P.z - k.z) + Math.sin(k.yPh) * 0.4;   // curve back in
        const turn = Math.atan2(Math.sin(want - k.h), Math.cos(want - k.h));
        const rate = (k.mode === 'dart' ? 2.2 : 0.9) + Math.sin(k.yPh + k.t) * 0.2;   // gentle, slightly wavering turns
        k.h += THREE.MathUtils.clamp(turn, -rate * dt, rate * dt);
        k.v += (k.vWant - k.v) * (1 - Math.exp(-dt * (k.vWant > k.v ? 2.5 : 0.8)));   // quick to speed up, slow to glide down
        k.x += Math.sin(k.h) * k.v * dt; k.z += Math.cos(k.h) * k.v * dt;
        if (!inside(k.x, k.z, 0.97)) { const a = Math.atan2(P.x - k.x, P.z - k.z); k.x += Math.sin(a) * 0.3 * dt; k.z += Math.cos(a) * 0.3 * dt; }   // never through the bank
        // tail beat follows speed; a resting koi just fans its tail slowly
        k.u.phase.value += dt * (2.5 + k.v * 16);                          // tail beat follows speed
        k.u.amp.value = 0.05 + Math.min(0.16, k.v * 0.3) + Math.abs(turn) * 0.04;   // bigger strokes when fast or turning
        k.u.fin.value += dt * (k.v < 0.08 ? 3.2 : 1.6);                      // a resting koi sculls with its fins
        k.yPh += dt * 0.4;
        k.f.position.set(k.x, k.y0 + Math.sin(k.yPh) * 0.02, k.z);
        k.f.rotation.set(0, k.h + KOI_YAW, Math.sin(k.yPh * 1.7) * 0.04);
      }
    });
  }, undefined, () => {});
}

// ---------------- 放生池: a stone-edged lotus pond on the plaza, right of the approach ----------------
const POND = { x: 11.6, z: 34.0, rx: 4.3, rz: 2.5, y: 0.3 };
const pondK = (a) => 1 + 0.07 * Math.sin(3 * a + 1.3) + 0.04 * Math.sin(5 * a + 0.4);           // organic, not an ellipse
const pondAt = (a, k = 1) => [POND.x + Math.cos(a) * POND.rx * pondK(a) * k, POND.z + Math.sin(a) * POND.rz * pondK(a) * k];
const inPond = (x, z, k = 1) => { const a = Math.atan2((z - POND.z) / POND.rz, (x - POND.x) / POND.rx), K = pondK(a) * k; return ((x - POND.x) / (POND.rx * K)) ** 2 + ((z - POND.z) / (POND.rz * K)) ** 2 < 1; };
let pondTick = null, pondBank = null;
// a quiet lotus lake on the west side of the courtyard (where the walkway used to stand)
const LAKE = { x: -25.5, z: 4, rx: 6.3, rz: 12, y: 0.26 };
const lakeK = (a) => 1 + 0.08 * Math.sin(3 * a + 2.1) + 0.05 * Math.sin(5 * a + 1.2) + 0.03 * Math.sin(7 * a);
const lakeAt = (a, k = 1) => [LAKE.x + Math.cos(a) * LAKE.rx * lakeK(a) * k, LAKE.z + Math.sin(a) * LAKE.rz * lakeK(a) * k];
const inLake = (x, z, k = 1) => { const a = Math.atan2((z - LAKE.z) / LAKE.rz, (x - LAKE.x) / LAKE.rx), K = lakeK(a) * k; return ((x - LAKE.x) / (LAKE.rx * K)) ** 2 + ((z - LAKE.z) / (LAKE.rz * K)) ** 2 < 1; };
let lakeBank = null, lakeTick = null;
const KOI_YAW = Math.PI / 2;    // placed, the koi's head (geometry +z: the round end with the pectoral fins) points along -x
{
  const N = 72, shape = new THREE.Shape();
  for (let i = 0; i <= N; i++) { const [x, z] = pondAt((i / N) * Math.PI * 2); i ? shape.lineTo(x - POND.x, -(z - POND.z)) : shape.moveTo(x - POND.x, -(z - POND.z)); }
  const flat = (geo, y, mat) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(POND.x, y, POND.z); m.userData.role = 'skip'; scene.add(m); return m; };
  // dark silty basin, then a bank sloping from the paving up to the waterline (rocks sit on it)
  flat(new THREE.ShapeGeometry(shape), 0.03, new THREE.MeshStandardMaterial({ color: 0x1a1f17, roughness: 1 }));
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2, [ox, oz] = pondAt(a, 1.16), [ix, iz] = pondAt(a, 0.97);
    pos.push(ox, 0.005, oz, ix, POND.y + 0.06, iz); uvs.push(ox * 0.6, oz * 0.6, ix * 0.6, iz * 0.6);
    if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const bank = new THREE.BufferGeometry(); bank.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bank.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); bank.setIndex(idx); bank.computeVertexNormals();
  const bm = new THREE.Mesh(bank, new THREE.MeshStandardMaterial({ color: 0x3b3a2c, roughness: 0.95, side: THREE.DoubleSide }));
  bm.receiveShadow = true; bm.userData.role = 'skip'; scene.add(bm); pondBank = bm;
  // the water: real planar reflections of the trees and sky, rippled by a slowly drifting normal map
  const normals = new THREE.TextureLoader().load('/temple/assets/env/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const res = isMobile ? 256 : 512;
  const water = new Water(new THREE.ShapeGeometry(shape), {
    textureWidth: res, textureHeight: res, waterNormals: normals,
    sunDirection: new THREE.Vector3(-35, 45, 30).normalize(), sunColor: 0x8a7a64,
    waterColor: 0x123a30, distortionScale: 0.3, fog: true, alpha: 0.9,
  });
  water.material.uniforms.size.value = 6; reflectLean(water);
  water.rotation.x = -Math.PI / 2; water.position.set(POND.x, POND.y, POND.z); water.userData.role = 'skip';
  scene.add(water);
  water.material.transparent = true; water.material.uniforms.alpha.value = 0.62;   // just clear enough to see koi below
  water.renderOrder = 1;
  // only render the water (and its reflection pass) when you're out on the plaza: from the hall it's lost in the
  // fog, and the hall's floor mirror would otherwise draw the pond's mirror again inside its own
  const ticks = [(dt) => { water.material.uniforms.time.value += dt * 0.3; water.visible = camera.position.z > 8; }];
  pondTick = (dt) => ticks.forEach((f) => f(dt));

  // ---- life in the pond: real scanned / modelled lotus, water lily, koi, cattails ----
  const PD = '/temple/assets/pond/';
  const put = (src, size, x, y, z, yaw = 0, by = 'w') => {      // clone, size it (w = widest side, h = height), sit it on y
    const m = src.clone(true), w = new THREE.Group(); w.add(m);
    const b = new THREE.Box3().setFromObject(m), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    m.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
    w.scale.setScalar(size / (by === 'h' ? sz.y : Math.max(sz.x, sz.z)));
    w.position.set(x, y, z); w.rotation.y = yaw;
    w.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    w.userData.role = 'skip'; scene.add(w); return w;
  };
  const at = (u, v, y) => [POND.x + u * POND.rx, y, POND.z + v * POND.rz];   // pond-relative spot, u/v in -1..1
  gl.load(PD + 'lotus.glb', (g) => {
    g.scene.traverse((o) => { if (o.isMesh && /glass|transparent/.test(o.material.name)) o.visible = false; });   // the model's display jar
    for (const [u, v, w, yaw] of [[0.5, 0.3, 2.4, 0.4], [-0.55, 0.45, 1.8, 2.2], [0.05, 0.6, 1.5, 4.1], [0.78, -0.2, 1.4, 5.3]]) put(g.scene, w, ...at(u, v, POND.y - 0.25), yaw);
  }, undefined, () => {});
  gl.load(PD + 'lily.glb', (g) => {
    for (const [u, v, w, yaw] of [[-0.15, -0.35, 1.0, 1.0], [0.45, -0.45, 0.8, 3.9], [-0.6, -0.05, 0.85, 5.0]]) put(g.scene, w, ...at(u, v, POND.y - 0.3), yaw);
  }, undefined, () => {});
  gl.load(PD + 'cattails.glb', (g) => {
    for (const [u, v, h, yaw] of [[0.85, 0.55, 1.5, 0], [0.98, 0.15, 1.2, 1.7], [0.6, 0.85, 1.35, 3.1], [-0.95, 0.4, 1.1, 0.8]]) put(g.scene, h, ...at(u, v, POND.y - 0.1), yaw, 'h');
  }, undefined, () => {});
  koiSchool(put, ticks, POND, 6, 0.06, inPond);         // ~27 cm deep: they stay under
}
{
  const N = 120, shape = new THREE.Shape();
  for (let i = 0; i <= N; i++) { const [x, z] = lakeAt((i / N) * Math.PI * 2); i ? shape.lineTo(x - LAKE.x, -(z - LAKE.z)) : shape.moveTo(x - LAKE.x, -(z - LAKE.z)); }
  const flat = (geo, y, mat) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(LAKE.x, y, LAKE.z); m.userData.role = 'skip'; scene.add(m); return m; };
  flat(new THREE.ShapeGeometry(shape), 0.03, new THREE.MeshStandardMaterial({ color: 0x18201a, roughness: 1 }));   // dark silty bed
  // a bank sloping from the ground up to the waterline (rocks sit on it)
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2, [ox, oz] = lakeAt(a, 1.14), [ix, iz] = lakeAt(a, 0.98);
    pos.push(ox, 0.005, oz, ix, LAKE.y + 0.06, iz); uvs.push(ox * 0.6, oz * 0.6, ix * 0.6, iz * 0.6);
    if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const bank = new THREE.BufferGeometry(); bank.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bank.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); bank.setIndex(idx); bank.computeVertexNormals();
  lakeBank = new THREE.Mesh(bank, new THREE.MeshStandardMaterial({ color: 0x3b3a2c, roughness: 0.95, side: THREE.DoubleSide }));
  lakeBank.receiveShadow = true; lakeBank.userData.role = 'skip'; scene.add(lakeBank);
  {
    // a meadow ring outside the bank, so no plaza paving shows round the lake
    const gp = [], gi = [], gu = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, [ox, oz] = lakeAt(a, 1.13), [fx, fz] = lakeAt(a, 1.45);
      for (const [x, z] of [[ox, oz], [fx, fz]]) { gp.push(x, 0.011, z); gu.push(x * 0.31, z * 0.31); }
      if (i < N) { const b = i * 2; gi.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(gu, 2)); geo.setIndex(gi); geo.computeVertexNormals();
    const tl = new THREE.TextureLoader(), tex = (m, srgb) => { const t = tl.load(`/temple/assets/tex/leafy_grass_${m}.webp`); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
    const meadow = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex('diff', true), normalMap: tex('nor'), roughness: 1, color: 0x9cb47e, side: THREE.DoubleSide }));
    meadow.receiveShadow = true; meadow.userData.role = 'skip'; scene.add(meadow);
  }
  const normals = new THREE.TextureLoader().load('/temple/assets/env/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const res = isMobile ? 256 : 512;
  const water = new Water(new THREE.ShapeGeometry(shape), {
    textureWidth: res, textureHeight: res, waterNormals: normals, sunDirection: new THREE.Vector3(-35, 45, 30).normalize(),
    sunColor: 0x8a7a64, waterColor: 0x14423a, distortionScale: 0.3, fog: true, alpha: 0.6,   // clear enough to see the koi
  });
  water.material.uniforms.size.value = 5; water.material.transparent = true; water.renderOrder = 1; reflectLean(water);
  water.rotation.x = -Math.PI / 2; water.position.set(LAKE.x, LAKE.y, LAKE.z); water.userData.role = 'skip';
  scene.add(water);
  const ticks = [(dt) => { water.material.uniforms.time.value += dt * 0.3; water.visible = camera.position.x < 6 && camera.position.z > -14; }];
  lakeTick = (dt) => ticks.forEach((f) => f(dt));
  // rocks round the rim, ferns behind them
  let seed = 909; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stones = [], ferns = [];
  for (let i = 0; i < 150; i++) {
    const a = (i / 150) * Math.PI * 2 + r() * 0.03, k = 0.99 + r() * 0.08, [x, z] = lakeAt(a, k);
    stones.push([x, z, 0.6 + r() * 0.55, r() * 6.28, 0.5 + r() * 0.3, (LAKE.y + 0.06) * (1.14 - k) / 0.16]);
    if (r() < 0.22) { const [fx, fz] = lakeAt(a, 1.2 + r() * 0.15); ferns.push([fx, fz, 1.2 + r() * 0.6, r() * 6.28]); }
  }
  ring('/temple/assets/env/rocks.glb', stones, 0.3, true);
  ring('/temple/assets/env/fern.glb', ferns);
  // lotus clumps, floating water lilies and cattails (the same scans as the plaza pond)
  const put = (src, size, x, y, z, yaw = 0, by = 'w') => {
    const m = src.clone(true), w = new THREE.Group(); w.add(m);
    const b = new THREE.Box3().setFromObject(m), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    m.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
    w.scale.setScalar(size / (by === 'h' ? sz.y : Math.max(sz.x, sz.z)));
    w.position.set(x, y, z); w.rotation.y = yaw;
    w.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    w.userData.role = 'skip'; scene.add(w); return w;
  };
  const spot = (u, v) => [LAKE.x + u * LAKE.rx, LAKE.z + v * LAKE.rz];
  gl.load('/temple/assets/pond/lotus.glb', (g) => {
    g.scene.traverse((o) => { if (o.isMesh && /glass|transparent/.test(o.material.name)) o.visible = false; });
    for (const [u, v, w, yaw] of [[0.5, -0.6, 2.6, 0.3], [-0.3, -0.35, 2.2, 1.9], [0.25, 0.1, 2.0, 3.3], [-0.5, 0.45, 2.6, 4.4], [0.45, 0.72, 2.2, 5.6], [-0.1, 0.85, 1.8, 0.9], [0.62, 0.32, 1.7, 2.6]]) {
      const [x, z] = spot(u, v); put(g.scene, w, x, LAKE.y - 0.25, z, yaw);
    }
  }, undefined, () => {});
  gl.load('/temple/assets/pond/lily.glb', (g) => {
    for (const [u, v, w, yaw] of [[0.1, -0.15, 1.0, 1.0], [-0.45, 0.05, 0.85, 3.9], [0.35, 0.5, 0.9, 5.0], [-0.2, 0.62, 0.8, 2.2], [0.05, -0.8, 0.9, 0.4]]) {
      const [x, z] = spot(u, v); put(g.scene, w, x, LAKE.y - 0.3, z, yaw);
    }
  }, undefined, () => {});
  gl.load('/temple/assets/pond/cattails.glb', (g) => {
    for (const [u, v, h, yaw] of [[-0.95, -0.3, 1.5, 0], [-0.9, 0.35, 1.3, 1.7], [-0.7, 0.85, 1.4, 3.1], [-0.6, -0.85, 1.2, 0.8]]) {
      const [x, z] = spot(u, v); put(g.scene, h, x, LAKE.y - 0.1, z, yaw, 'h');
    }
  }, undefined, () => {});
  koiSchool(put, ticks, LAKE, 11, 0.07, inLake);
  // glowing lotus lanterns (蓮花燈) drifting slowly on the water: two rings of petals, white at the heart and pink at
  // the tips, a warm candle light inside, a green pad underneath
  // three shapes: wide open, half open, a tight bud; each lantern also gets its own size, colour and glow
  const petal = () => new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.07, 0.03, 0.15).translate(0, 0, 0.12);
  const lotusShape = (rings) => {
    const parts = [];
    for (const [n, tilt, rad, s, turn] of rings) for (let i = 0; i < n; i++) {
      const g = petal().scale(s, s, s); g.rotateX(-tilt); g.translate(0, 0.03, rad); g.rotateY((i / n) * Math.PI * 2 + turn);
      parts.push(g.toNonIndexed());
    }
    const geo = mergeGeometries(parts), p2 = geo.attributes.position, cols = [];
    for (let i = 0; i < p2.count; i++) { const k = THREE.MathUtils.smoothstep(Math.hypot(p2.getX(i), p2.getZ(i)) + p2.getY(i), 0.06, 0.2); cols.push(1, 1 - k * 0.3, 1 - k * 0.2); }   // pale heart, tinted tips
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    return geo;
  };
  const SHAPES = [
    lotusShape([[10, 0.55, 0.06, 1.05, 0], [8, 0.95, 0.03, 0.85, 0.3], [5, 1.3, 0.0, 0.6, 0.6]]),    // wide open
    lotusShape([[8, 0.95, 0.04, 0.95, 0], [6, 1.25, 0.01, 0.75, 0.4]]),                               // half open
    lotusShape([[6, 1.35, 0.01, 0.8, 0], [4, 1.5, 0.0, 0.6, 0.5]]),                                   // bud
  ];
  const TINTS = [0xffffff, 0xffe4ec, 0xffc2d4, 0xff9db8, 0xfff0cf];                                  // white, blush, pink, deep pink, pale gold
  const GLOWS = [0xffe6c0, 0xffd8c8, 0xffc8b8, 0xffbfae, 0xffe8a8];
  const LN = 18, lanterns = [], byShape = [[], [], []];
  const glowTex = canvasTex(64, 64, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,240,210,1)'); g.addColorStop(0.35, 'rgba(255,200,160,0.45)'); g.addColorStop(1, 'rgba(255,180,140,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); });
  for (let i = 0; i < LN; i++) {
    let x, z; do { x = LAKE.x + (r() - 0.5) * 1.6 * LAKE.rx; z = LAKE.z + (r() - 0.5) * 1.6 * LAKE.rz; } while (!inLake(x, z, 0.8));
    const shape = r() < 0.45 ? 0 : r() < 0.6 ? 1 : 2, tint = (r() * TINTS.length) | 0, size = 0.7 + r() * 0.65;
    const strength = shape === 2 ? 0.35 + r() * 0.2 : 0.55 + r() * 0.45;                          // buds glow faintly
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: GLOWS[tint], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: strength }));
    glow.scale.setScalar(0.7 * size + strength * 0.5); glow.userData.role = 'skip'; scene.add(glow);
    const L = { x, z, ph: r() * 6.28, sp: 0.015 + r() * 0.035, rad: 0.3 + r() * 1.0, yaw: r() * 6.28, glow, size, strength, shape, tint, k: byShape[shape].length };
    byShape[shape].push(L); lanterns.push(L);
  }
  const petals = SHAPES.map((geo, si) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0xfff0e6, emissiveIntensity: 0.28, side: THREE.DoubleSide }), Math.max(1, byShape[si].length));
    m.count = byShape[si].length;
    byShape[si].forEach((L) => m.setColorAt(L.k, new THREE.Color(TINTS[L.tint])));
    return m;
  });
  const pads = new THREE.InstancedMesh(new THREE.CircleGeometry(0.22, 18).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f6a32, roughness: 0.7 }), LN);
  for (const m of [...petals, pads]) { m.userData.role = 'skip'; m.frustumCulled = false; scene.add(m); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), v = new THREE.Vector3();
  let T = 0;
  ticks.push((dt) => {
    T += dt;
    lanterns.forEach((L, i) => {
      const a = T * L.sp + L.ph, x = L.x + Math.cos(a) * L.rad, z = L.z + Math.sin(a * 0.8) * L.rad;
      const y = LAKE.y + 0.01 + Math.sin(T * 0.9 + L.ph) * 0.012;                      // drifting, gently bobbing
      e.set(Math.sin(T * 0.7 + L.ph) * 0.05, L.yaw + T * 0.03, Math.cos(T * 0.6 + L.ph) * 0.05);
      q.setFromEuler(e); sc.setScalar(L.size);
      petals[L.shape].setMatrixAt(L.k, m4.compose(v.set(x, y + 0.02 * L.size, z), q, sc));
      pads.setMatrixAt(i, m4.compose(v.set(x, y, z), q, sc));
      L.glow.position.set(x, y + 0.1 * L.size, z);
      L.glow.material.opacity = L.strength * (0.88 + Math.sin(T * 2.3 + L.ph) * 0.08 + Math.sin(T * 5.1 + L.ph * 2) * 0.05);   // candle flicker
    });
    for (const m of petals) m.instanceMatrix.needsUpdate = true;
    pads.instanceMatrix.needsUpdate = true;
  });
}

// rim stones and ferns, from the same CC0 scans as the forest floor. Each part is re-centred and sized in metres
// (the files store their pieces spread apart), then instanced along the bank.
// split a mesh into its separate pieces (triangles joined by shared positions), e.g. single rocks out of a rock set
function islands(geo) {
  const pos = geo.attributes.position, idx = geo.index.array, key = new Map(), root = [];
  const vid = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e3)},${Math.round(pos.getY(i) * 1e3)},${Math.round(pos.getZ(i) * 1e3)}`;
    if (!key.has(k)) { key.set(k, root.length); root.push(root.length); }
    vid[i] = key.get(k);
  }
  const find = (x) => { while (root[x] !== x) x = root[x] = root[root[x]]; return x; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(vid[idx[t]]); root[find(vid[idx[t + 1]])] = a; root[find(vid[idx[t + 2]])] = a; }
  const groups = new Map();
  for (let t = 0; t < idx.length; t += 3) { const g = find(vid[idx[t]]); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(idx[t], idx[t + 1], idx[t + 2]); }
  // each piece gets only its own vertices (so its bounds are its own)
  return [...groups.values()].filter((tris) => tris.length > 600).map((tris) => {
    const remap = new Map(), used = [];
    const index = tris.map((v) => { if (!remap.has(v)) { remap.set(v, used.length); used.push(v); } return remap.get(v); });
    const g = new THREE.BufferGeometry();
    for (const [n, at] of Object.entries(geo.attributes)) {
      const out = new at.array.constructor(used.length * at.itemSize);
      used.forEach((v, i) => { for (let c = 0; c < at.itemSize; c++) out[i * at.itemSize + c] = at.array[v * at.itemSize + c]; });
      g.setAttribute(n, new THREE.BufferAttribute(out, at.itemSize, at.normalized));
    }
    g.setIndex(index);
    return g;
  });
}
function ring(url, list, sink = 0, split = false, onParts) {
  gl.load(url, (g) => {
    g.scene.updateMatrixWorld(true);
    const parts = [];
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      const whole = o.geometry.clone();
      for (const n of ['position', 'normal', 'tangent']) {           // quantized (int16/int8) attributes can't take a transform in place
        const at = whole.attributes[n]; if (!at || at.array instanceof Float32Array) continue;
        const f = new Float32Array(at.count * at.itemSize);
        for (let i = 0; i < at.count; i++) for (let c = 0; c < at.itemSize; c++) f[i * at.itemSize + c] = at.getComponent(i, c);
        whole.setAttribute(n, new THREE.BufferAttribute(f, at.itemSize));
      }
      whole.applyMatrix4(o.matrixWorld);
      for (const geo of split ? islands(whole) : [whole]) {
        geo.computeBoundingBox();
        const b = geo.boundingBox, c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
        geo.translate(-c.x, -b.min.y, -c.z);
        parts.push({ geo, mat: o.material, w: Math.max(size.x, size.z), h: size.y });
      }
    });
    const per = parts.map(() => []);
    list.forEach((it, i) => per[i % parts.length].push(it));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    parts.forEach((p, k) => {
      if (!per[k].length) return;
      const im = new THREE.InstancedMesh(p.geo, p.mat, per[k].length);
      per[k].forEach(([x, z, w, yaw, flat = 1, y0 = 0], i) => { const s = w / p.w; im.setMatrixAt(i, m4.compose(v.set(x, y0 - sink * p.h * s * flat, z), q.setFromAxisAngle(up, yaw), sc.set(s, s * flat, s))); });
      im.castShadow = !/fern/.test(url); im.receiveShadow = true; im.userData.role = 'skip';   // ferns: no shadow pass
      scene.add(im);
    });
    onParts?.(parts);
  }, undefined, () => {});
}
{
  let seed = 4242; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stones = [];
  // stones sit on the bank slope (which rises from the paving at k=1.16 to the waterline at k=0.97), almost touching
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + r() * 0.05, k = 0.99 + r() * 0.08, [x, z] = pondAt(a, k);
    stones.push([x, z, 0.6 + r() * 0.5, r() * 6.28, 0.5 + r() * 0.3, (POND.y + 0.06) * (1.16 - k) / 0.19]);
  }
  ring('/temple/assets/env/rocks.glb', stones, 0.3, true, (parts) => {      // the bank wears the same mossy stone
    const m = parts[0].mat;
    for (const bank of [pondBank, lakeBank]) if (bank) bank.material = new THREE.MeshStandardMaterial({ map: m.map, normalMap: m.normalMap, roughness: 1, color: 0x9a9a90, side: THREE.DoubleSide });
  });
  const ferns = [];
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    if (Math.abs(((a - Math.PI + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.8) continue;   // keep the path side open to the water
    const [x, z] = pondAt(a, 1.22 + r() * 0.12); ferns.push([x, z, 1.3 + r() * 0.6, r() * 6.28]);
  }
  ring('/temple/assets/env/fern.glb', ferns);
}

// ---------------- benches on the pond bank: sit and watch the water ----------------
// Two old painted wooden benches (Poly Haven, CC0) face the pond. Tap one: your monk walks over and sits, and the
// camera settles into a slow view across the water over his shoulder. Moving gets him up again.
const BENCHES = [
  ...[-1.9, 2.55].map((a) => { const [x, z] = pondAt(a, 1.5); return { x, z, look: POND, far: 2.8, up: 2.35 }; }),
  (() => { const [x, z] = lakeAt(0.05, 1.32); return { x, z, look: LAKE, far: 3.4, up: 2.9 }; })(),   // on the lotus lake's east shore
].map((b) => ({ ...b, yaw: Math.atan2(b.look.x - b.x, b.look.z - b.z) }));   // each faces the middle of its water
// a small floating 🪷 over each bench when you're near: tap it to sit and watch the water
const benchIcons = BENCHES.map((b, i) => {
  const el = document.createElement('button'); el.className = 'benchIcon'; el.textContent = '🪷 ' + t('watch');
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => { e.stopPropagation(); hideHint(); sitBench(i); });
  const o = new CSS2DObject(el); o.position.set(b.x, 1.9, b.z); o.visible = false; scene.add(o);
  return o;
});
const benchMeshes = [];
gl.load('/temple/assets/pond/bench.glb', (g) => {
  g.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3());
  const k = 1.5 / Math.max(size.x, size.z);
  BENCHES.forEach((b, i) => {
    const m = g.scene.clone(); m.scale.setScalar(k);
    const c = box.getCenter(new THREE.Vector3());
    m.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    const w = new THREE.Group(); w.add(m); w.position.set(b.x, 0, b.z); w.rotation.y = b.yaw + BENCH_YAW;
    w.userData = { role: 'skip', bench: i };
    w.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; benchMeshes.push(o); o.userData.bench = i; } });
    scene.add(w);
    b.seatY = size.y * k * SEAT_FRAC;
  });
}, undefined, () => {});
const BENCH_YAW = 0, SEAT_FRAC = 0.45;            // model faces +z; its seat is a little under half its height
let seated = null;                                // the bench you're sitting on, or null
async function sitBench(i) {
  const b = BENCHES[i];
  if (busy) return;
  setBusy(true);
  try {
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    await walkTo(b.x + fx * 0.75, b.z + fz * 0.75, b.yaw + Math.PI);   // step up to the bench, back to it
    await wait(0.2);
    await animate(0.6, (k) => {                                          // turn and sit down onto the seat
      me.root.position.x = b.x + fx * 0.75 * (1 - k); me.root.position.z = b.z + fz * 0.75 * (1 - k);
      me.seatY = (b.seatY || 0.45) * smooth(k);
      me.root.rotation.y = b.yaw + Math.PI * (1 - smooth(k));
    });
    me.root.rotation.y = b.yaw; me.kneel = true; seated = b;
    toast(t('bench'), 4200);
  } finally { setBusy(false); }
}
// through the monk's own eyes: seated on the bench, looking out over the water, the head drifting very slowly
function pondView(t) {
  if (!seated) return null;
  if (me.walking) { seated = null; me.seatY = 0; return null; }      // got up
  const b = seated, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), rx = fz, rz = -fx;
  const eye = groundY(b.x, b.z) + (b.seatY || 0.45) + 0.72;
  const pos = new THREE.Vector3(b.x + fx * 0.2, eye + Math.sin(t * 0.21) * 0.01, b.z + fz * 0.2);
  const wl = (b.look === LAKE ? LAKE : POND).y;                       // look down onto the water, gently scanning
  const look = new THREE.Vector3(b.look.x + rx * Math.sin(t * 0.05) * 1.6, wl + 0.15 + Math.sin(t * 0.07) * 0.12, b.look.z + rz * Math.sin(t * 0.05) * 1.6);
  return { pos, look, eyes: true };
}

function scatter(url, count, place, scaleRange, role = 'skip') {
  if (isMobile) count = Math.round(count * 0.5);                    // phones: half the clutter
  gl.load(url, (g) => {
    const parts = []; g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => { if (o.isMesh) parts.push(o); });
    let seed = url.length * 97; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const per = parts.map(() => []);
    for (let n = 0, tries = 0; n < count && tries < count * 40; tries++) {
      const p = place(rnd); if (!p) continue;
      per[n % parts.length].push([p[0], p[1], scaleRange[0] + rnd() * (scaleRange[1] - scaleRange[0]), rnd() * 6.28]); n++;
    }
    parts.forEach((part, k) => {
      const list = per[k]; if (!list.length) return;
      const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      list.forEach(([x, z, sc, yaw], i) => im.setMatrixAt(i, m4.compose(v.set(x, 0, z), q.setFromAxisAngle(up, yaw), s.setScalar(sc)).multiply(part.matrixWorld)));
      im.castShadow = false; im.receiveShadow = true; im.userData.role = role; noReflect.add(im);   // far-flung clutter: no shadow, no reflection
      scene.add(im);
    });
  }, undefined, () => {});
}
const outsideWalls = (rnd) => {
  const x = (rnd() - 0.5) * 120, z = -90 + rnd() * 150;
  if (Math.abs(x) < 21 && z > -40 && z < 20) return null;            // temple
  if (!onPlateau(x, z, 0.95)) return null;                           // not over the cliff edge
  if (Math.abs(x) < 5 && z > 20) return null;                        // keep the approach path clear
  if (inPond(x, z, 1.4)) return null;
  if (inLake(x, z, 1.4)) return null;
  return [x, z];
};
scatter('/temple/assets/env/fern.glb', 150, outsideWalls, [0.9, 1.7]);
scatter('/temple/assets/env/rocks.glb', 40, outsideWalls, [0.6, 1.4]);
scatter('/temple/assets/env/fern.glb', 24, (rnd) => {                // ferns at the foot of the courtyard walls
  const side = rnd() < 0.5 ? -1 : 1; return [side * (15.4 + rnd() * 0.6), -3 + rnd() * 21];
}, [0.6, 1.0]);

function paint(meshObj, url, keepAspect) {
  new THREE.TextureLoader().load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (keepAspect) { const p = meshObj.geometry.parameters; meshObj.scale.y = (t.image.height / t.image.width) * (p.width / p.height); }
    meshObj.material = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  }, undefined, () => {});
}
paint(world.altar.backdrop, '/temple/assets/backdrop.webp');
world.altar.murals.forEach((mm, i) => paint(mm, `/temple/assets/mural${i + 1}.webp`, true));

// ---------------- tiny tween helper ----------------
const tweens = new Set();
function animate(dur, fn) {
  return new Promise((res) => tweens.add({ t: 0, dur, fn, res }));
}
const wait = (s) => animate(s, () => {});
const ease = (k) => 1 - Math.pow(1 - k, 3);

// ---------------- sound (synthesized, no files) ----------------
// All sounds are real recordings (Freesound, CC0 / CC BY — see assets/CREDITS.md). Nothing is synthesized.
const SFX_FILES = { muyu: 'muyu', bowl: 'bowl', clack1: 'clack1', clack2: 'clack2', sticks: 'sticks', birds: 'birds_stream', water: 'waterfall' };
const sfx = {
  ctx: null, on: store.get('sound', true), buf: {},
  init() {
    if (this.ctx) return;
    this.ctx = window.__actx || new (window.AudioContext || window.webkitAudioContext)();   // made inside the Enter click when possible
    this.master = this.ctx.createGain();
    this.master.gain.value = this.on ? 1 : 0;
    this.master.connect(this.ctx.destination);
    // ambience bus: louder and open outdoors, softer and muffled inside the hall
    this.ambLP = this.ctx.createBiquadFilter(); this.ambLP.type = 'lowpass'; this.ambLP.frequency.value = 18000;
    this.ambGain = this.ctx.createGain(); this.ambGain.gain.value = 0;
    // tame the chirps: the high birdsong band is pulled down, the soft stream-and-air underneath stays
    this.ambShelf = this.ctx.createBiquadFilter(); this.ambShelf.type = 'highshelf'; this.ambShelf.frequency.value = 2800; this.ambShelf.gain.value = -8;
    this.ambLP.connect(this.ambShelf).connect(this.ambGain).connect(this.master);
    // 大悲咒 (Great Compassion Mantra), from its first chanted word: heard only while you kneel. 33 minutes, so it
    // streams (never preloaded) through its own fader, and resumes where it left off.
    this.chantEl = new Audio('/temple/assets/sfx/dabeizhou.m4a'); this.chantEl.loop = true; this.chantEl.preload = 'none';
    this.chantGain = this.ctx.createGain(); this.chantGain.gain.value = 0;
    this.ctx.createMediaElementSource(this.chantEl).connect(this.chantGain).connect(this.master);
    for (const [k, f] of Object.entries(SFX_FILES)) {
      fetch(`/temple/assets/sfx/${f}.mp3`).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b))
        .then((buf) => { this.buf[k] = buf; if (k === 'birds') this.ambient(); if (k === 'water') this.falls(); }).catch(() => {});
    }
  },
  toggle() {
    this.on = !this.on; store.set('sound', this.on);
    if (this.master) this.master.gain.value = this.on ? 1 : 0;
    $('#sound').textContent = this.on ? '🔈' : '🔇';
  },
  play(name, { gain = 1, rate = 1, when = 0, out } = {}) {
    const b = this.buf[name]; if (!this.ctx || !b) return;
    const s = this.ctx.createBufferSource(), v = this.ctx.createGain();
    s.buffer = b; s.playbackRate.value = rate; v.gain.value = gain;
    s.connect(v).connect(out || this.master); s.start(this.ctx.currentTime + when);
  },
  bell() { this.play('bowl', { gain: 0.55, rate: 0.98 + Math.random() * 0.04 }); },              // struck singing bowl (磬)
  clack(when = 0) { this.play(Math.random() < 0.5 ? 'clack1' : 'clack2', { gain: 0.8, rate: 0.9 + Math.random() * 0.25, when }); },
  muyu(g = 1) { this.play('muyu', { gain: 0.9 * g, rate: 0.93 + Math.random() * 0.08 }); },
  rattle() { this.play('sticks', { gain: 0.9, rate: 0.95 + Math.random() * 0.1 }); },
  ambient() {
    // forest birdsong by a stream (checked: no voices), looped by overlapping copies with a slow crossfade (no gap, no click)
    const b = this.buf.birds, X = 3;
    const next = (at) => {
      const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
      s.buffer = b; s.connect(g).connect(this.ambLP);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + X);
      g.gain.setValueAtTime(1, at + b.duration - X); g.gain.linearRampToValueAtTime(0, at + b.duration);
      s.start(at); s.stop(at + b.duration + 0.05);
      setTimeout(() => next(at + b.duration - X), (at + b.duration - X - this.ctx.currentTime - 1) * 1000);
    };
    next(this.ctx.currentTime + 0.05);
  },
  // the waterfall into the lotus lake: a real recording, looped, heard only as you come near it
  falls() {
    this.waterGain = this.ctx.createGain(); this.waterGain.gain.value = 0;
    this.waterLP = this.ctx.createBiquadFilter(); this.waterLP.type = 'lowpass'; this.waterLP.frequency.value = 18000;
    const s = this.ctx.createBufferSource(); s.buffer = this.buf.water; s.loop = true;
    s.connect(this.waterLP).connect(this.waterGain).connect(this.master); s.start();
  },
  chant(on, dt) {
    if (!this.chantEl) return;
    const el = this.chantEl, g = this.chantGain.gain;
    if (on && el.paused) el.play().catch(() => {});
    g.value += ((on ? 0.6 : 0) - g.value) * (1 - Math.exp(-dt * (on ? 0.7 : 1.5)));   // ~3 s swell in, quicker fade out
    if (!on && g.value < 0.01 && !el.paused) el.pause();
  },
  // called every frame: birds fade a little and turn muffled once you're inside the hall
  update(inside, dt, pos) {
    if (!this.ctx) return;
    const k = 1 - Math.exp(-dt * 1.5);
    if (this.waterGain && pos) {                                       // louder as you near the falls, muffled behind the hall walls
      const d = Math.hypot(pos.x - (LAKE.x - LAKE.rx + 0.5), pos.z - LAKE.z), near = Math.max(0, 1 - Math.max(0, d - 4) / 26) ** 2;
      this.waterGain.gain.value += ((inside ? 0.2 : 1) * 0.16 * near - this.waterGain.gain.value) * k;   // a soft murmur, never a roar
      this.waterLP.frequency.value += ((inside ? 700 : 1800 + near * 2600) - this.waterLP.frequency.value) * k;   // hiss rolled off: a gentle trickle
    }
    // a quiet bed under everything, not a soundtrack: it slowly swells and recedes (about a minute per breath),
    // so there are long gentle stretches rather than a constant wall of birds
    const tt = this.ctx.currentTime, swell = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(tt * 2 * Math.PI / 70)) * (0.6 + 0.4 * Math.sin(tt * 2 * Math.PI / 29 + 1));
    this.ambGain.gain.value += ((inside ? 0.05 : 0.11) * swell - this.ambGain.gain.value) * k;
    this.ambLP.frequency.value += ((inside ? 1400 : 18000) - this.ambLP.frequency.value) * k;
  },
};
$('#sound').textContent = sfx.on ? '🔈' : '🔇';
$('#sound').onclick = () => { sfx.init(); sfx.toggle(); };
addEventListener('pointerdown', () => { sfx.init(); if (sfx.ctx.state === 'suspended') sfx.ctx.resume(); }, { once: false });
// some browsers only let a media element play if it first started inside a tap: start the mantra silently once, then pause
addEventListener('pointerdown', () => { const el = sfx.chantEl; if (el && el.paused) el.play().then(() => { if (sfx.chantGain.gain.value < 0.01) el.pause(); }).catch(() => {}); }, { once: true });

// ---------------- smoke ----------------
const smokeTex = canvasTex(64, 64, (g, w) => {
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});
const smoke = { parts: [], emitters: [] };
function emitter(pos, rate, spread = 0.3) { const e = { pos, rate, spread, acc: 0 }; smoke.emitters.push(e); return e; }
function updateSmoke(dt) {
  for (const e of smoke.emitters) {
    e.acc += e.rate * dt;
    while (e.acc > 1 && smoke.parts.length < 220) {
      e.acc--;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xd8d2c8, transparent: true, depthWrite: false, opacity: 0 }));
      s.position.copy(e.pos).add(new THREE.Vector3((Math.random() - 0.5) * e.spread, 0, (Math.random() - 0.5) * e.spread));
      s.userData = { age: 0, life: 3 + Math.random() * 2, vx: (Math.random() - 0.5) * 0.15, vz: (Math.random() - 0.5) * 0.15 };
      scene.add(s); smoke.parts.push(s);
    }
  }
  for (let i = smoke.parts.length - 1; i >= 0; i--) {
    const s = smoke.parts[i], u = s.userData;
    u.age += dt;
    const k = u.age / u.life;
    s.position.x += (u.vx + Math.sin(u.age * 1.3) * 0.08) * dt;
    s.position.z += u.vz * dt;
    s.position.y += 0.55 * dt;
    s.scale.setScalar(0.2 + k * 1.3);
    s.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.45;
    if (k >= 1) { scene.remove(s); s.material.dispose(); smoke.parts.splice(i, 1); }
  }
}
const luSmoke = emitter(world.luPos.clone().add(new THREE.Vector3(0, 0.4, 0)), 2.5, 0.8);
emitter(world.tableBurnerPos.clone(), 1.2, 0.2);

// incense sticks planted in the 天公爐 (burn down over 3 min). A real joss stick: a pale bamboo handle, a brown
// coat of incense paste that burns down from the top, a short cap of grey ash and a glowing ember point.
const sticks = [];
const unitRod = (r) => new THREE.CylinderGeometry(r, r, 1, 6).translate(0, 0.5, 0);   // grows upward from y=0
const HANDLE = 0.24, BODY = 0.52;                                 // metres (the 天公爐 is a giant, so are its sticks)
const stickParts = {
  handle: unitRod(0.0055), body: unitRod(0.0095), ash: unitRod(0.0085),
  ember: new THREE.SphereGeometry(0.009, 8, 6),
};
const bambooMat = new THREE.MeshStandardMaterial({ color: 0xcaa874, roughness: 0.7 });
const pasteMat = new THREE.MeshStandardMaterial({ color: 0x40362e, roughness: 1 });   // sandalwood-and-charcoal brown
const ashMat = new THREE.MeshStandardMaterial({ color: 0x9e9890, roughness: 1 });
const emberMat = new THREE.MeshBasicMaterial({ color: 0xff7a30 });
function jossStick(scale = 1) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(stickParts.handle, bambooMat); handle.scale.y = HANDLE * scale;
  const body = new THREE.Mesh(stickParts.body, pasteMat); body.position.y = HANDLE * scale;
  const ash = new THREE.Mesh(stickParts.ash, ashMat); ash.scale.y = 0.012 * scale;
  const ember = new THREE.Mesh(stickParts.ember, emberMat); ember.scale.setScalar(scale);
  g.add(handle, body, ash, ember);
  g.userData = { body, ash, ember, scale };
  setBurn(g, 0);
  return g;
}
function setBurn(g, k) {                            // k: 0 fresh .. 1 burnt down to the handle
  const { body, ash, ember, scale } = g.userData, L = BODY * scale * (1 - k * 0.92);
  body.scale.y = L;
  ash.position.y = HANDLE * scale + L;
  ember.position.y = ash.position.y + 0.012 * scale;
}
const BURN_MS = 30 * 60000;                          // a stick burns for half an hour
function plantIncense(n = 3, born = Date.now(), spot) {
  for (let i = 0; i < n; i++) {
    const a = spot ? spot[i * 2] : Math.random() * Math.PI * 2, r = spot ? spot[i * 2 + 1] : Math.random() * 0.55;
    const g = jossStick();
    g.position.set(world.luPos.x + Math.cos(a) * r, world.luPos.y, world.luPos.z + Math.sin(a) * r);
    g.rotation.set((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2);
    g.userData.born = born; g.userData.spot = [a, r];
    scene.add(g); sticks.push(g);
  }
  while (sticks.length > 90) scene.remove(sticks.shift());
  luSmoke.rate = Math.min(14, 2.5 + sticks.length * 0.35);
}
// your sticks are remembered on this device, so leaving and coming back finds them still burning
function saveSticks() { store.set('incense', sticks.filter((g) => g.userData.mine).map((g) => [g.userData.born, ...g.userData.spot])); }
function restoreSticks() {
  for (const [born, a, r] of store.get('incense', [])) {
    if (Date.now() - born >= BURN_MS) continue;
    plantIncense(1, born, [a, r]); sticks[sticks.length - 1].userData.mine = true;
  }
  saveSticks();
}
function updateSticks() {
  const now = Date.now();
  for (let i = sticks.length - 1; i >= 0; i--) {
    const k = (now - sticks[i].userData.born) / BURN_MS;
    if (k >= 1) { const mine = sticks[i].userData.mine; scene.remove(sticks[i]); sticks.splice(i, 1); if (mine) saveSticks(); continue; }
    setBurn(sticks[i], k);
  }
  luSmoke.rate = Math.min(14, 2.5 + sticks.length * 0.35);
}

// thin smoke wisps rising from each burning tip: narrow at the ember, curling and widening as they climb
const wisps = [];
const wispTex = canvasTex(64, 64, (g, w) => {          // very soft round puff: no edge anywhere
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.65)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.28)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});
const tipPos = new THREE.Vector3();
function emitWisp(ember, acc, dt, rate = 16) {
  acc.v = (acc.v || 0) + rate * dt;
  while (acc.v > 1 && wisps.length < 500) {
    acc.v--;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: wispTex, color: 0xc8ccd2, transparent: true, depthWrite: false, opacity: 0 }));   // incense smoke is a soft blue-grey
    ember.getWorldPosition(s.position);
    s.userData = { age: 0, life: 2.4 + Math.random() * 1.2, ph: Math.random() * 6.28, x0: s.position.x, z0: s.position.z };
    scene.add(s); wisps.push(s);
  }
}
function updateWisps(dt) {
  // the newest sticks in the urn, and incense held by anyone mid-offering
  for (const g of sticks.slice(-12)) emitWisp(g.userData.ember, g.userData, dt);
  for (const pg of [me, ...peers.values()]) if (pg.incense?.visible) for (const e of pg.incenseEmbers) emitWisp(e, e.userData, dt, 12);
  for (let i = wisps.length - 1; i >= 0; i--) {
    const s = wisps[i], u = s.userData;
    u.age += dt;
    const k = u.age / u.life;
    s.position.y += (0.18 + u.age * 0.12) * dt;                     // rises, a little faster as it warms away
    const sway = Math.sin(u.age * 1.7 + u.ph) * 0.05 * u.age + Math.sin(u.age * 0.6 + u.ph * 2) * 0.03 * u.age;
    s.position.x = u.x0 + sway; s.position.z = u.z0 + Math.cos(u.age * 1.3 + u.ph) * 0.03 * u.age;
    const w = 0.02 + u.age * 0.07;
    s.scale.set(w, w * 1.6, 1);                                       // many small overlapping puffs read as one soft thread
    s.material.opacity = Math.min(1, k * 8) * (1 - k) ** 1.4 * 0.9;
    if (k >= 1) { scene.remove(s); s.material.dispose(); wisps.splice(i, 1); }
  }
}

// ---------------- pilgrims (chibi avatars) ----------------
const ADJ = ['早起的', '迷路的', '愛睡的', '慢慢的', '微笑的', '安靜的', '路過的', '吃飽的', '想家的', '認真的', '發呆的', '剛下班的'];
const ANI = ['麻雀', '石虎', '黑熊', '藍鵲', '白鷺鷥', '穿山甲', '小貓', '柴犬', '烏龜', '綠繡眼', '水鹿', '櫻花鉤吻鮭'];
const ADJ_EN = ['Early', 'Lost', 'Sleepy', 'Slow', 'Smiling', 'Quiet', 'Passing', 'Well-fed', 'Homesick', 'Earnest', 'Dreamy', 'Off-duty'];
const ANI_EN = ['Sparrow', 'Leopard Cat', 'Black Bear', 'Blue Magpie', 'Egret', 'Pangolin', 'Kitten', 'Shiba', 'Turtle', 'White-eye', 'Sambar', 'Trout'];
const COLORS = [0x6f8fa8, 0xc9a66b, 0x8aa37b, 0xb07a6e, 0x8f86ad, 0xd3b38a, 0x5f7f7a];
const pick = (a) => a[Math.random() * a.length | 0];

const blobTex = canvasTex(64, 64, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(0,0,0,0.7)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
// ---------------- pilgrims: chibi novice monks (小沙彌) with jointed, keyframed motion ----------------
// Joints: body (bob/lower) → spine (bow) → head (nod) / shoulders → elbows. Every act is a list of
// keyframes [time, pose]; poses are blended with smoothstep easing and then damped, so nothing snaps.
const POSE = {
  // sx/sz: shoulder forward/inward, e: elbow bend, ey: forearm turned in so the palms meet
  idle:     { spine: 0,    head: 0,    sx: 0.1,   sz: 0.16,  e: -0.2,  ey: 0 },
  palms:    { spine: 0.06, head: 0.1,  sx: -0.55, sz: -0.3,  e: -1.6,  ey: 0.85 },
  bow:      { spine: 0.62, head: 0.24, sx: -0.55, sz: -0.3,  e: -1.6,  ey: 0.85 },
  high:     { spine: 0.02, head: 0.05, sx: -0.95, sz: -0.28, e: -1.3,  ey: 0.75 },
  bowHigh:  { spine: 0.62, head: 0.2,  sx: -0.95, sz: -0.28, e: -1.3,  ey: 0.75 },
  prostrate:{ spine: 1.25, head: 0.35, sx: -1.55, sz: -0.12, e: -0.15, ey: 0.1 },
  wind:     { spine: -0.05, head: -0.05, sx: -0.85, sz: -0.3, e: -1.45, ey: 0.75 },
  release:  { spine: 0.18, head: 0.05, sx: -1.75, sz: -0.06, e: -0.25, ey: 0.05 },
};
const JOINTS = ['spine', 'head', 'sx', 'sz', 'e', 'ey'];
const smooth = (k) => k * k * (3 - 2 * k);
function bowSeq(up, down, base, n = 3, t0 = 0.35, period = 1.08) {
  const k = [[0, base], [t0, up]];
  for (let i = 0; i < n; i++) { const s = t0 + i * period; k.push([s + 0.42, down], [s + 0.62, down], [s + period, up]); }
  k.push([t0 + n * period + 0.35, base]);
  return k;
}
function actKeys(act, kneeling) {
  const base = kneeling ? 'palms' : 'idle';   // (a praying pilgrim's rest pose is also palms: see update())
  switch (act) {
    case 'palms': return [[0, base], [0.45, 'palms'], [1.8, 'palms'], [2.2, base]];
    case 'bai': return bowSeq('palms', kneeling ? 'prostrate' : 'bow', base);
    case 'incense': return bowSeq('high', 'bowHigh', base, 3, 0.4, 1.08);
    case 'shake': return [[0, base], [0.3, 'palms'], [1.5, 'palms'], [1.8, base]];
    case 'strike': return [[0, base], [0.5, base]];
    case 'throw': return [[0, base], [0.3, 'palms'], [0.48, 'wind'], [0.62, 'release'], [0.9, 'release'], [1.25, base]];
    case 'jiaoHold': return [[0, base], [0.45, 'palms'], [2.6, 'palms']];                                 // blocks held at the chest
    case 'jiaoPray': return [[0, 'palms'], [0.6, 'high'], [1.2, 'bowHigh'], [1.9, 'high'], [2.5, 'bowHigh'], [3.1, 'high'], [3.4, 'palms']];
  }
  return null;
}
function samplePose(keys, t) {
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
  const [t0, p0] = keys[i], [t1, p1] = keys[Math.min(i + 1, keys.length - 1)];
  const k = t1 > t0 ? smooth(Math.min(1, (t - t0) / (t1 - t0))) : 1;
  const out = {};
  for (const key of JOINTS) out[key] = POSE[p0][key] + (POSE[p1][key] - POSE[p0][key]) * k;
  return out;
}

class Pilgrim {
  constructor({ name, color, me = false }) {
    const S = (c, r = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    // everyone looks the same, like Sansa: no way to tell who is who except your own name tag
    const skin = S(0xe9b38a, 0.6), robe = S(0x8f979c, 0.9), sash = S(0xc99a3c, 0.85);
    const dark = new THREE.MeshBasicMaterial({ color: 0x3a2a22 }), blush = new THREE.MeshBasicMaterial({ color: 0xee9a88 });
    const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };
    const lathe = (pts, mat, phiStart = 0, phiLen = Math.PI * 2) => M(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 28, phiStart, phiLen), mat);

    this.root = new THREE.Group();
    this.root.scale.setScalar(0.8);                       // a small novice in a vast hall
    this.root.userData.role = 'skip';
    this.body = new THREE.Group(); this.root.add(this.body);
    // lower robe (skirt), squashes when kneeling
    this.skirt = new THREE.Group(); this.body.add(this.skirt);
    this.skirt.add(lathe([[0, 0.05], [0.35, 0.05], [0.37, 0.08], [0.33, 0.16], [0.28, 0.27], [0.25, 0.36], [0, 0.36]], robe));   // a long robe, flaring at the hem
    this.skirt.add(lathe([[0.315, 0.1], [0.3, 0.2], [0.255, 0.35]], sash, -1.25, 2.5));            // ochre apron front
    this.feet = [-1, 1].map((sx) => { const f = M(new THREE.SphereGeometry(0.075, 12, 8), S(0xf3efe6, 0.8), sx * 0.11, 0.04, 0.16); f.scale.set(1, 0.6, 1.4); this.body.add(f); return f; });
    // upper body bends at the waist
    this.spine = new THREE.Group(); this.spine.position.y = 0.34; this.body.add(this.spine);
    this.spine.add(lathe([[0.25, 0], [0.24, 0.14], [0.2, 0.28], [0.1, 0.36], [0, 0.37]], robe));
    const kasaya = lathe([[0.258, 0.0], [0.248, 0.14], [0.208, 0.27]], sash, -1.1, 2.2);           // sash over the chest
    kasaya.rotation.y = 0.35; this.spine.add(kasaya);
    const strap = M(new THREE.TorusGeometry(0.2, 0.035, 8, 20, Math.PI), sash, 0, 0.2, 0);
    strap.rotation.set(0, Math.PI / 2, 0.55); this.spine.add(strap);
    // head: big, shaved, sleepy calm face
    this.head = new THREE.Group(); this.head.position.y = 0.6; this.spine.add(this.head);
    this.head.add(M(new THREE.SphereGeometry(0.36, 32, 24), skin));
    for (const sx of [-1, 1]) {
      const eye = M(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI), dark, sx * 0.12, -0.02, 0.335);
      eye.rotation.z = Math.PI; this.head.add(eye);                                                     // closed, smiling eyes
      const b = M(new THREE.CircleGeometry(0.05, 14), blush, sx * 0.2, -0.1, 0.3); b.rotation.y = sx * 0.6; this.head.add(b);
      this.head.add(M(new THREE.SphereGeometry(0.07, 12, 8), skin, sx * 0.355, -0.02, 0));               // ears
    }
    const mouth = M(new THREE.TorusGeometry(0.03, 0.009, 6, 10, Math.PI), dark, 0, -0.13, 0.33);
    mouth.rotation.z = Math.PI; this.head.add(mouth);
    // arms: shoulder → elbow, wide sleeves, small hands
    this.arms = [-1, 1].map((sx) => {
      const sh = new THREE.Group(); sh.position.set(sx * 0.22, 0.24, 0); this.spine.add(sh);
      sh.add(M(new THREE.CapsuleGeometry(0.065, 0.1, 4, 10), robe, 0, -0.09, 0));
      const el = new THREE.Group(); el.position.y = -0.18; el.rotation.order = 'YXZ'; sh.add(el);
      const sleeve = M(new THREE.CylinderGeometry(0.065, 0.13, 0.2, 14, 1, true), robe, 0, -0.1, 0);   // wide bell sleeves
      sleeve.material = robe.clone(); sleeve.material.side = THREE.DoubleSide; el.add(sleeve);
      const hand = M(new THREE.SphereGeometry(0.058, 12, 10), skin, 0, -0.2, 0); hand.scale.set(0.85, 1.15, 0.7); el.add(hand);
      sh.userData.sx = sx;
      return { sh, el, hand, sx };
    });
    // incense sticks held in the right hand
    this.incense = new THREE.Group();
    this.incenseEmbers = [];
    for (let i = -1; i <= 1; i++) {
      const st = jossStick(0.62); st.position.set(i * 0.03, -0.3, 0); st.rotation.z = -i * 0.04;
      this.incense.add(st); this.incenseEmbers.push(st.userData.ember);
    }
    this.incense.position.set(-0.04, -0.2, 0.03); this.incense.visible = false;
    // mallet (for the wooden fish), held in the right hand
    this.mallet = new THREE.Group();
    this.mallet.add(M(new THREE.CylinderGeometry(0.014, 0.016, 0.34, 8), S(0x5a3218, 0.6), 0, 0.08, 0));
    this.mallet.add(M(new THREE.SphereGeometry(0.05, 12, 10), S(0x7a1712, 0.5), 0, 0.26, 0));
    this.mallet.position.set(0, -0.22, 0.02); this.mallet.rotation.x = 0.5; this.mallet.visible = false;
    this.arms[1].el.add(this.mallet);
    this.arms[1].el.add(this.incense);

    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.55 }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; blob.renderOrder = 2;
    Object.assign(blob.material, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    this.root.add(blob);

    this.label = null;
    if (me) {
      const tag = document.createElement('div');
      tag.className = 'nametag me';
      tag.textContent = name;
      this.label = new CSS2DObject(tag);
      this.label.position.y = 1.6;
      this.root.add(this.label);
    }

    this.name = name; this.color = color;
    this.walking = false; this.act = null; this.actT = 0; this.t = Math.random() * 10;
    this.kn = 0; this.walkAmt = 0;
    this.cur = { ...POSE.idle };
    this.target = null; // for peers: network position
  }
  setName(n) { this.name = n; if (this.label) this.label.element.textContent = n; }
  play(act) {
    this.keys = actKeys(act, this.kneel || this.praying); if (!this.keys) return;
    this.act = act; this.actT = 0; this.incense.visible = act === 'incense';
  }
  update(dt) {
    this.t += dt; this.actT += dt;
    if (this.walking) this.kneel = this.praying = false;
    const damp = (cur, want, rate) => cur + (want - cur) * (1 - Math.exp(-dt * rate));
    this.kn = damp(this.kn, this.kneel ? 1 : 0, 5);
    const spd = (this.speed ?? (this.walking ? 3 : 0)) + Math.min(1.2, (this.turnSpd || 0) * 0.35);   // turning on the spot takes small steps
    this.phase = (this.phase || 0) + spd * dt * 3.4;          // ~one stride cycle per 1.8 m
    this.walkAmt = damp(this.walkAmt, Math.min(1, spd / 2.4), 8);

    // target pose: running act keyframes, else the resting pose
    let want;
    if (this.act) {
      const end = this.keys[this.keys.length - 1][0];
      want = samplePose(this.keys, Math.min(this.actT, end));
      if (this.actT >= end) { this.act = null; this.incense.visible = false; }
    } else want = { ...POSE[this.kneel || this.praying ? 'palms' : 'idle'] };

    // breathing and a gentle walk cycle layered on top
    const ph = this.phase, w = this.walkAmt;
    want.spine += Math.sin(this.t * 1.6) * 0.012 + w * 0.06;
    const swing = Math.sin(ph) * 0.4 * w;
    for (const k of JOINTS) this.cur[k] = damp(this.cur[k], want[k], 14);

    const c = this.cur;
    this.spine.rotation.x = c.spine;
    this.head.rotation.x = c.head - c.spine * 0.25 + Math.sin(this.t * 1.6 + 1) * 0.01;
    for (const a of this.arms) {
      const walkArm = this.act ? 0 : swing * a.sx;
      a.sh.rotation.x = c.sx + walkArm;
      a.sh.rotation.z = a.sx * c.sz;          // sz < 0 brings the hands in toward the chest
      a.el.rotation.x = c.e;
      a.el.rotation.y = -a.sx * c.ey;
    }
    if (this.act === 'strike') {                       // right arm lifts the mallet and taps the fish
      const k = this.actT, lift = k < 0.14 ? smooth(k / 0.14) : k < 0.22 ? 1 - smooth((k - 0.14) / 0.08) : 0;
      const R = this.arms[1];
      R.sh.rotation.x = -0.85 - lift * 0.6; R.sh.rotation.z = -0.12; R.el.rotation.x = -0.75 - lift * 0.35; R.el.rotation.y = 0;
    }
    // body: bob while walking, sink onto the heels when kneeling
    this.body.position.y = Math.abs(Math.sin(ph)) * 0.035 * w - this.kn * 0.16;
    this.body.rotation.z = Math.sin(ph) * 0.035 * w;
    this.skirt.scale.y = 1 - this.kn * 0.45;
    // the robe moves with the body: it trails a little behind as he walks and sways with each stride
    this.skirt.rotation.x = damp(this.skirt.rotation.x, -0.07 * w, 6) + Math.sin(ph * 2) * 0.012 * w;
    this.skirt.rotation.z = Math.sin(ph) * 0.05 * w;
    this.skirt.scale.x = this.skirt.scale.z = 1 + Math.abs(Math.sin(ph)) * 0.05 * w;
    this.spine.position.y = 0.34 - this.kn * 0.16;
    this.feet.forEach((f, i) => { f.position.z = 0.2 + Math.sin(ph + i * Math.PI) * 0.12 * w - this.kn * 0.3; f.visible = this.kn < 0.6; });   // toes peek out from under the hem
  }
  get handPos() {
    return this.root.localToWorld(new THREE.Vector3(0, 0.95, 0.4));
  }
}

// ---------------- walkable area ----------------
// outside plaza (z>24.5) → gate door bays → courtyard → stairs → hall floor (y = HALL.floor)
const F = HALL.floor, DOORS = [-6, 0, 6], GATE = [19.4, 24.6];
const OBSTACLES = [
  [0, 8, 2.4],                                                         // 天公爐
  ...[-11, -5.5, 5.5, 11].flatMap((x) => [-8, -14].filter((z) => z === -8 || Math.abs(x) > 8).map((z) => [x, z, z === -8 && Math.abs(x) < 6 ? 1.35 : 0.8])),   // scanned dragon pillars have wide bases; no columns nearer the altar
  ...[-10, -7.4, -4.6, -1.6, 1.6, 4.6, 7.4, 10].map((x) => [x, 24.2, Math.abs(x) < 2 ? 0.7 : 0.5]),
  [-12, 30, 1.3], [13, 31, 1.1], [-13.5, 12, 1.1],
  [13.5, -2, 0.8],
  [3.0, -25.6, 0.5],                                                   // 木魚
  [-3.1, 26.2, 1.1], [3.1, 26.2, 1.1],                                  // stone lions
  ...[28, 33].flatMap((z) => [[-6, z, 0.3], [6, z, 0.3]]),
];
BENCHES.forEach((b) => OBSTACLES.push([b.x, b.z, 0.6]));
OBSTACLES.push([-11.25, 25, 0.7], [11.25, 25, 0.7]);                 // the gate's stone lanterns
OBSTACLES.push([36, 4, 13.4]);                                       // the banyan's terrace (BANYAN, defined below)
const inHall = (z) => z < HALL.front;
const nearestDoor = (x) => DOORS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
function clampWalk(p) {
  const C = THREE.MathUtils.clamp;
  if (p.z < -4.5) { p.x = C(p.x, -14.3, 14.3); p.z = Math.max(p.z, Math.abs(p.x) < 5 ? -26 : -27.6); }
  else if (p.z <= GATE[0]) p.x = C(p.x, -19.5, p.z > -4.5 && p.z < 16 ? 26 : 17.4); // courtyard: open to the lake shore and the banyan
  else if (p.z < GATE[1]) { const d = nearestDoor(p.x); p.x = C(p.x, d - 1.05, d + 1.05); }
  else { p.x = C(p.x, -18, 18); p.z = Math.min(p.z, 37); }
  for (const [ox, oz, r] of OBSTACLES) {
    const dx = p.x - ox, dz = p.z - oz, d = Math.hypot(dx, dz);
    if (d < r && d > 1e-4) { p.x = ox + dx / d * r; p.z = oz + dz / d * r; }
  }
  if (inLake(p.x, p.z, 1.1)) {                       // the lake shore: stand at the edge, not in the water
    const a = Math.atan2((p.z - LAKE.z) / LAKE.rz, (p.x - LAKE.x) / LAKE.rx); [p.x, p.z] = lakeAt(a, 1.11);
  }
  if (inPond(p.x, p.z, 1.12)) {                      // the pond's stone rim: stand at its edge, not in the water
    const a = Math.atan2((p.z - POND.z) / POND.rz, (p.x - POND.x) / POND.rx); [p.x, p.z] = pondAt(a, 1.13);
  }
  return p;
}
function groundY(x, z) {
  if (Math.abs(x) > 17) return 0;
  if (z <= HALL.front) return F;
  // the gate stands on a 0.3 m granite platform (x ±12, z 18.5–25.5); ease up its edge instead of popping
  if (z > 18) return 0.3 * THREE.MathUtils.clamp(Math.min(z - 18.3, 25.7 - z, 12.2 - Math.abs(x)) / 0.4, 0, 1);
  if (z >= -4.5) return 0;
  return F * (-4.5 - z) / 2;
}
// ---- route finding ----
// A* over a 0.3 m grid of the walkable ground (a spot is walkable if clampWalk leaves it where it is), stepping
// round the prayer cushions too, then pulled taut so the monk walks in straight lines and turns only at corners.
// Nobody walks through a pillar, a lion, the burner or a cushion row any more.
const NAV = { x0: -48, z0: -40, cell: 0.3, nx: 340, nz: 275 };
const navCache = new Int8Array(NAV.nx * NAV.nz);                     // 0 unknown, 1 free, 2 blocked
let navSoft = null;                                                   // the cushions: step round them, but you may kneel on one
const onGround = (x, z) => { const c = { x, z }; clampWalk(c); return Math.abs(c.x - x) + Math.abs(c.z - z) < 0.02; };
const offCushions = (x, z, ignore) => {
  navSoft ||= world.cushions.spots.map((p) => [p.x, p.z]);
  return !navSoft.some(([cx, cz], i) => i !== ignore[0] && i !== ignore[1] && Math.abs(x - cx) < 0.78 && Math.abs(z - cz) < 0.62);
};
const walkable = (x, z, ignore) => onGround(x, z) && offCushions(x, z, ignore);
function cellFree(i, j, ignore) {
  if (i < 0 || j < 0 || i >= NAV.nx || j >= NAV.nz) return false;
  const k = j * NAV.nx + i, x = NAV.x0 + i * NAV.cell, z = NAV.z0 + j * NAV.cell;
  if (!navCache[k]) navCache[k] = onGround(x, z) ? 1 : 2;
  return navCache[k] === 1 && offCushions(x, z, ignore);
}
function clearLine(a, b, ignore) {                                    // can you walk straight from a to b?
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.12);
  for (let s = 1; s < n; s++) { const t = s / n; if (!walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, ignore)) return false; }
  return true;
}
function planPath(from, to) {
  const cush = (p) => (navSoft || []).findIndex(([cx, cz]) => Math.abs(p.x - cx) < 0.78 && Math.abs(p.z - cz) < 0.62);
  walkable(0, 0, [-1, -1]);                                          // make sure navSoft exists
  const ignore = [cush(from), cush(to)];
  const a = { x: from.x, z: from.z }, b = { x: to.x, z: to.z };
  if (clearLine(a, b, ignore)) return [b];
  const toCell = (p) => [Math.round((p.x - NAV.x0) / NAV.cell), Math.round((p.z - NAV.z0) / NAV.cell)];
  const [si, sj] = toCell(a), [gi, gj] = toCell(b), N = NAV.nx * NAV.nz;
  const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
  const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
  const h = (i, j) => { const dx = Math.abs(i - gi), dz = Math.abs(j - gj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const s0 = sj * NAV.nx + si, goal = gj * NAV.nx + gi;
  g[s0] = 0; push(s0, h(si, sj));
  let found = false, n = 0;
  while (heap.length && n++ < 90000) {
    const k = pop(); if (shut[k]) continue; shut[k] = 1;
    if (k === goal) { found = true; break; }
    const i = k % NAV.nx, j = (k / NAV.nx) | 0;
    for (const [di, dj, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
      const ni = i + di, nj = j + dj, nk = nj * NAV.nx + ni;
      if (nk !== goal && !cellFree(ni, nj, ignore)) continue;
      if (di && dj && (!cellFree(i + di, j, ignore) || !cellFree(i, j + dj, ignore))) continue;   // no cutting corners
      const ng = g[k] + c; if (ng < g[nk]) { g[nk] = ng; came[nk] = k; push(nk, ng + h(ni, nj)); }
    }
  }
  if (!found) return [b];                                            // nowhere better: walk straight (clampWalk still keeps us out)
  const cells = []; for (let k = goal; k !== -1 && k !== s0; k = came[k]) cells.unshift({ x: NAV.x0 + (k % NAV.nx) * NAV.cell, z: NAV.z0 + ((k / NAV.nx) | 0) * NAV.cell });
  cells[cells.length - 1] = b;
  const out = []; let cur = a, i = 0;                                // pull the route taut: go to the farthest point in plain sight
  while (i < cells.length) { let j = cells.length - 1; while (j > i && !clearLine(cur, cells[j], ignore)) j--; out.push(cells[j]); cur = cells[j]; i = j + 1; }
  return out;
}

// ---------------- me ----------------
let nick = store.get('nick', null);
if (!Array.isArray(nick)) { nick = [Math.random() * ADJ.length | 0, Math.random() * ANI.length | 0]; store.set('nick', nick); }
const myName = EN ? `${ADJ_EN[nick[0]]} ${ANI_EN[nick[1]]}` : ADJ[nick[0]] + ANI[nick[1]];
const myColor = store.get('color', pick(COLORS)); store.set('color', myColor);
const me = new Pilgrim({ name: myName, color: myColor, me: true });
me.root.position.set((Math.random() - 0.5) * 2, 0, 29.5);
me.root.rotation.y = Math.PI;
scene.add(me.root);


let path = [], arrive = null;
function walkTo(x, z, faceRy) {
  const t = clampWalk({ x, z });
  me.kneel = me.praying = false;                     // get up off the cushion before going anywhere
  path = planPath(me.root.position, t);
  return new Promise((res) => { arrive = () => { if (faceRy !== undefined) turnTo(faceRy); res(); }; });
}
async function turnTo(ry) {
  const from = me.root.rotation.y;
  let d = ((ry - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  me.turnSpd = Math.abs(d) / (0.3 + Math.abs(d) * 0.22);              // a few small steps while turning round
  await animate(0.3 + Math.abs(d) * 0.22, (k) => { me.root.rotation.y = from + d * ease(k); });
  me.turnSpd = 0;
}
// keyboard: arrows / WASD walk relative to the camera (↑ = away from you on screen)
const KEYS = { ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
const held = new Set();
addEventListener('keydown', (e) => {
  if (!KEYS[e.code] || e.target.closest?.('input,select,textarea') || $('#modal').classList.contains('on') || intro.on) return;
  e.preventDefault(); held.add(e.code); hideHint();
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());
// Everything (keys, joystick, tap-to-walk) sets a desired velocity; the actual velocity eases toward it,
// so starts, stops and turns are smooth and the body turns to face where it is going.
const joy = { x: 0, y: 0 };                 // on-screen joystick, -1..1 (y = forward)
const loco = { vx: 0, vz: 0, speed: 0 };
const MAX_SPEED = 2.9;
const angDiff = (a, b) => ((a - b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
// ↑/↓ (joystick up/down) walk forward/back along where the monk faces; ←/→ turn him
const TURN_RATE = 2.3;
function steerInput() {
  let sx = joy.x, sy = joy.y;
  for (const k of held) { sx += KEYS[k][0]; sy += KEYS[k][1]; }
  if (Math.abs(sx) < 0.12 && Math.abs(sy) < 0.12) return null;
  return { turn: THREE.MathUtils.clamp(sx, -1, 1), fwd: THREE.MathUtils.clamp(sy, -1, 1) };
}
function locomotion(dt) {
  const pos = me.root.position;
  let wx = 0, wz = 0;
  const manual = !busy && steerInput();
  if (manual) {
    if (path.length) { path = []; arrive = null; }
    me.root.rotation.y -= manual.turn * TURN_RATE * dt * (Math.abs(manual.fwd) > 0.2 ? 0.85 : 1);
    const ry = me.root.rotation.y, sp = manual.fwd * MAX_SPEED * (manual.fwd < 0 ? 0.5 : 1);   // backing up is slower
    wx = Math.sin(ry) * sp; wz = Math.cos(ry) * sp;
  } else if (path.length && me.kn > 0.3) {
    // still rising from the cushion: stand up fully before the first step
  } else if (path.length) {
    const p = path[0], dx = p.x - pos.x, dz = p.z - pos.z, d = Math.hypot(dx, dz), last = path.length === 1;
    if (last && d < 0.05) {
      pos.x = p.x; pos.z = p.z; path.shift(); loco.vx = loco.vz = 0;
      const a = arrive; arrive = null; a?.();
    } else if (!last && d < 0.45) path.shift();               // round corners instead of stopping at them
    else {
      // a person turns toward where they are going, then walks forward: facing away, they turn on the spot;
      // a little off, they curve in at reduced speed
      const off = d > 0.2 ? Math.abs(angDiff(Math.atan2(dx, dz), me.root.rotation.y)) : 0;
      const align = off > 1.3 ? 0 : Math.cos(off) ** 2;
      const s = MAX_SPEED * (last ? Math.min(1, 0.25 + d / 1.1) : 1) * align;   // ease in to the stop
      wx = dx / d * s; wz = dz / d * s;
      if (d > 0.2) {
        const turn = angDiff(Math.atan2(dx, dz), me.root.rotation.y), step = THREE.MathUtils.clamp(turn * (1 - Math.exp(-dt * 7)), -5 * dt, 5 * dt);
        me.root.rotation.y += step; me.turnSpd = Math.abs(step) / Math.max(dt, 1e-4);
      }
    }
  }
  const k = 1 - Math.exp(-dt * (wx || wz ? 6 : 10));         // accelerate a little slower than we brake
  loco.vx += (wx - loco.vx) * k; loco.vz += (wz - loco.vz) * k;
  loco.speed = Math.hypot(loco.vx, loco.vz);
  if (loco.speed > 0.005) {
    const sx = loco.vx * dt, sz = loco.vz * dt;
    if (manual) {                                            // slide along walls, never teleport
      for (const [ax, az] of [[sx, sz], [sx, 0], [0, sz]]) {
        if (!ax && !az) continue;
        const c = { x: pos.x + ax, z: pos.z + az }, want = { ...c };
        clampWalk(c);
        if (Math.hypot(c.x - want.x, c.z - want.z) < 0.6 * Math.hypot(ax, az)) { pos.x = c.x; pos.z = c.z; break; }
      }
    } else { pos.x += sx; pos.z += sz; clampWalk(pos); }
  }
  if (!path.length && !manual) me.turnSpd = Math.max(0, (me.turnSpd || 0) - dt * 8);
  me.speed = loco.speed;
  me.walking = loco.speed > 0.25;
  if (me.walking && prayBtn().classList.contains('on')) endPrayer();   // walking away ends a prayer
  if (me.walking && atMuyu) { atMuyu = false; me.mallet.visible = false; }
}

// on-screen joystick for touch screens (bottom-left), like mobile games
if (isMobile) {
  const base = document.createElement('div'), knob = document.createElement('div');
  base.id = 'joy'; knob.id = 'joyKnob'; base.appendChild(knob); document.body.appendChild(base);
  const R = 44; let id = null, cx = 0, cy = 0;
  const set = (x, y) => {
    let dx = x - cx, dy = y - cy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.x = dx / R; joy.y = -dy / R;
  };
  base.addEventListener('pointerdown', (e) => {
    id = e.pointerId; base.classList.add('on');
    const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    try { base.setPointerCapture(id); } catch {}
    set(e.clientX, e.clientY); hideHint(); poke(); e.preventDefault();
  });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX, e.clientY); });
  const end = (e) => { if (e.pointerId !== id) return; id = null; joy.x = joy.y = 0; knob.style.transform = ''; base.classList.remove('on'); };
  base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
}

// tap to walk (ignore drags)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const plane0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), plane1 = new THREE.Plane(new THREE.Vector3(0, 1, 0), -F);
const marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; scene.add(marker);
let down = null;
const touches = new Map();
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (intro.on) return;
  down = { x: e.clientX, y: e.clientY, t: performance.now(), n: e.isPrimary }; poke();
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch {}
});
renderer.domElement.addEventListener('pointermove', (e) => {
  const prev = touches.get(e.pointerId); if (!prev) return;
  if (touches.size === 1) {
    cam.yaw -= (e.clientX - prev.x) * 0.006;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch - (e.clientY - prev.y) * 0.004, -0.45, 0.8);
    cam.dragging = true;
  } else if (touches.size === 2) {
    const [a, b] = [...touches.entries()].map(([id, p]) => (id === e.pointerId ? { x: e.clientX, y: e.clientY } : p));
    const [pa, pb] = [...touches.values()];
    const before = Math.hypot(pa.x - pb.x, pa.y - pb.y), after = Math.hypot(a.x - b.x, a.y - b.y);
    cam.dist = THREE.MathUtils.clamp(cam.dist - (after - before) * 0.012, 0, 5.5);
  }
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
const endTouch = (e) => { touches.delete(e.pointerId); if (!touches.size) cam.dragging = false; };
renderer.domElement.addEventListener('pointercancel', endTouch);
renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = THREE.MathUtils.clamp(cam.dist + e.deltaY * 0.004, 0, 5.5); poke(); }, { passive: false });
renderer.domElement.addEventListener('pointerup', (e) => {
  endTouch(e);
  if (!down || busy) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (moved > 8 || performance.now() - down.t > 450) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const cush = ray.intersectObject(world.cushions.mesh)[0];
  if (cush) { hideHint(); sitAt(cush.instanceId); return; }
  const bench = benchMeshes.length && ray.intersectObjects(benchMeshes)[0];
  if (bench) { hideHint(); sitBench(bench.object.userData.bench); return; }
  if (ray.intersectObject(muyu, true)[0]) { hideHint(); ACTS.muyu(); return; }
  const hit = new THREE.Vector3();
  let ok = ray.ray.intersectPlane(plane1, hit);
  if (!ok || !inHall(hit.z) || Math.abs(hit.x) > 16) ok = ray.ray.intersectPlane(plane0, hit);
  if (!ok || hit.distanceTo(camera.position) > 60) return;
  const t = clampWalk({ x: hit.x, z: hit.z });
  marker.position.set(t.x, groundY(t.x, t.z) + 0.02, t.z);
  animate(0.8, (k) => { marker.material.opacity = 0.9 * (1 - k); marker.scale.setScalar(1 + k * 0.6); });
  walkTo(t.x, t.z);
  hideHint();
});
let hintShown = true;
function hideHint() { if (hintShown) { hintShown = false; $('#hint').style.opacity = 0; } }
setTimeout(hideHint, 9000);

// ---------------- 木魚 wooden fish ----------------
// A large temple wooden fish on its cushion, beside the offering table. Tap 木魚 (or the fish) to kneel at
// it; every further tap or Space strikes it once. Other visitors see and hear it.
const MUYU = { x: 3.0, z: -25.6 };                 // front-right of the offering table, facing the main Guanyin
const muyu = (() => {
  const g = new THREE.Group();
  const lac = new THREE.MeshStandardMaterial({ color: 0x86290f, roughness: 0.32, metalness: 0.05, envMapIntensity: 1.2 });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xd6a548, metalness: 0.9, roughness: 0.3 });
  const M = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };
  g.add(M(new THREE.CylinderGeometry(0.46, 0.5, 0.16, 28), new THREE.MeshStandardMaterial({ color: 0xa8231a, roughness: 0.9 }), 0, 0.08, 0));   // cushion
  const body = new THREE.Group(); body.position.y = 0.42; g.add(body);
  const shell = M(new THREE.SphereGeometry(0.34, 36, 24), lac); shell.scale.set(1.15, 0.8, 1); body.add(shell);
  const slit = M(new THREE.TorusGeometry(0.3, 0.022, 8, 40, Math.PI * 1.15), new THREE.MeshStandardMaterial({ color: 0x1a0805, roughness: 0.9 }), 0, -0.02, 0.0);
  slit.rotation.set(Math.PI / 2, 0, Math.PI * 0.92); slit.scale.set(1.12, 1, 1); body.add(slit);                   // the mouth slit
  const rim = M(new THREE.TorusGeometry(0.39, 0.012, 6, 48), goldM); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 0.86, 1); rim.position.y = 0.04; body.add(rim);
  for (const sx of [-1, 1]) body.add(M(new THREE.SphereGeometry(0.035, 10, 8), goldM, sx * 0.13, 0.12, 0.27));       // fish eyes
  g.position.set(MUYU.x, HALL.floor, MUYU.z);
  g.userData.body = body; g.userData.role = 'skip';   // live object: not part of the bake
  scene.add(g);
  return g;
})();
let atMuyu = false;
function strike(who, gain = 1) {
  who.play('strike');
  setTimeout(() => {
    sfx.muyu(gain);
    animate(0.25, (k) => { const s = 1 - Math.sin(k * Math.PI) * 0.05; muyu.userData.body.scale.set(1 / s, s, 1 / s); });
  }, 190);
}
addEventListener('keydown', (e) => { if (e.code === 'Space' && atMuyu && !$('#modal').classList.contains('on')) { e.preventDefault(); strike(me); net.act('muyu'); } });

// ---------------- kneeling cushions ----------------
const CU = world.cushions;
async function sitAt(i) {
  const p = CU.spots[i];
  if (busy) return;
  setBusy(true);
  try {
    await walkTo(p.x, p.z, Math.PI);
    await wait(0.35);
    me.kneel = true; net.act('kneel');
    toast(t('kneel'));
    await shot(p.x * 0.8 + 1.2, F + 3.0, p.z + 5.5, p.x * 0.7, F + 1.8, p.z - 5, 1.6);
  } finally { setBusy(false); }
}
function nearestCushion() {
  let best = 0, bd = 1e9;
  CU.spots.forEach((p, i) => { const d = p.distanceTo(me.root.position) + Math.random() * 3; if (d < bd) { bd = d; best = i; } });
  return best;
}

// ---------------- follow camera ----------------
// scripted ritual shots (moon blocks): while set, the camera glides to director.pos looking at director.look
let director = null;
const reveal = { t: -1 };                                   // the first-entry view of the statues (see the frame loop)
function followCam(dt, snap = false) {
  if (director) {
    const k = 1 - Math.exp(-dt * (director.speed || 2.2));
    camera.position.lerp(director.pos, k); camLook.lerp(director.look, k);
    controls.target.copy(camLook); camera.lookAt(camLook); cam.wasFraming = true;
    return;
  }
  const p = me.root.position;
  if (!cam.dragging && (me.walking || busy)) cam.yaw *= Math.exp(-dt * 2.4);   // swing back behind you as you move
  const yaw = me.root.rotation.y + cam.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw);
  const ground = groundY(p.x, p.z);
  const eye = ground + 0.93 - (me.kn || 0) * 0.22;                           // the monk's eye height
  const firstPerson = cam.dist < 0.35;
  me.root.visible = !firstPerson;
  // pull in until the camera spot is somewhere a person could stand: never through walls or pillars
  let d = cam.dist;
  for (; d > 0.35; d -= 0.15) {
    const c = { x: p.x - fx * d, z: p.z - fz * d }, w = { ...c };
    clampWalk(c);
    if (Math.hypot(c.x - w.x, c.z - w.z) < 0.03) break;
  }
  d = Math.max(firstPerson ? 0 : 0.35, d);
  let h = firstPerson ? eye : THREE.MathUtils.lerp(eye, ground + 1.7, Math.min(1, d / 2.6));
  // During a ritual facing the deity, step back along the line to the statue until the whole statue and its
  // halo fit on screen, and tilt to take in its full height. The camera height stays fixed: no floating.
  const frame = pondView(clock.elapsedTime) || deityFraming(p, ground);
  const zoomWant = frame?.eyes ? 1.35 : 1;                            // seated: a closer, clearer look at the water
  if (Math.abs(camera.zoom - zoomWant) > 0.001) { camera.zoom += (zoomWant - camera.zoom) * (1 - Math.exp(-dt * 3)); camera.updateProjectionMatrix(); }
  if (frame) {
    if (frame.eyes) me.root.visible = false;                         // you are the monk now
    if (snap || !cam.ready) { camera.position.copy(frame.pos); cam.ready = true; }
    else {
      const k = 1 - Math.exp(-dt * 3);
      camera.position.lerp(frame.pos, k);
    }
    camLook.lerp(frame.look, 1 - Math.exp(-dt * 4));
    controls.target.copy(camLook); camera.lookAt(camLook);
    return;
  }
  // over the right shoulder (wider while kneeling, so you can see what's in front of you)
  const kneelK = me.kn || 0, side = firstPerson ? 0 : 0.35 + kneelK * 0.45;
  const rx = -fz, rz = fx;
  const want = new THREE.Vector3(p.x - fx * d + rx * side, h, p.z - fz * d + rz * side);
  if (snap || !cam.ready) { camera.position.copy(want); cam.ready = true; }
  else {
    const kxz = 1 - Math.exp(-dt * 12), ky = 1 - Math.exp(-dt * 8);
    camera.position.x += (want.x - camera.position.x) * kxz;
    camera.position.z += (want.z - camera.position.z) * kxz;
    camera.position.y += (want.y - camera.position.y) * ky;
  }
  const pitch = cam.pitch - kneelK * 0.2, cp = Math.cos(pitch);
  const lookWant = new THREE.Vector3(camera.position.x + fx * cp * 6 - rx * side * 0.5, camera.position.y + Math.sin(pitch) * 6, camera.position.z + fz * cp * 6 - rz * side * 0.5);
  camLook.lerp(lookWant, cam.wasFraming ? 1 - Math.exp(-dt * 4) : 1);           // ease out of a ritual view
  if (camLook.distanceTo(lookWant) < 0.05) cam.wasFraming = false;
  controls.target.copy(camLook); camera.lookAt(camLook);
}
const camLook = new THREE.Vector3();
function deityFraming(p, ground) {
  if (!DEITY || cam.dragging || me.walking) return null;
  if (!(me.kneel || me.praying || busy || me.act || atMuyu)) return null;
  const dx = DEITY.x - p.x, dz = DEITY.z - p.z, L0 = Math.hypot(dx, dz);
  if (L0 > 70 || Math.abs(angDiff(Math.atan2(dx, dz), me.root.rotation.y)) > 1.2) return null;   // not facing the deity
  const ux = dx / L0, uz = dz / L0, rx = -uz, rz = ux;
  const y = ground + 1.7;
  const vfov = THREE.MathUtils.degToRad(camera.fov), tanH = Math.tan(vfov / 2) * camera.aspect;
  let pos = null, L = L0;
  for (let d = 2.2; d <= 5; d += 0.3) {                                  // nearest spot behind you that fits it all; a colossus you look up at instead
    const c = { x: p.x - ux * d + rx * 0.45, z: p.z - uz * d + rz * 0.45 }, w = { ...c };
    clampWalk(c);
    if (Math.hypot(c.x - w.x, c.z - w.z) > 0.03) break;                  // a wall or pillar: stop here
    L = L0 + d; pos = new THREE.Vector3(c.x, y, c.z);
    const span = Math.atan2(DEITY.top - y, L) - Math.atan2(DEITY.base - y, L);
    if (span < vfov * 0.84 && DEITY.halfW / L < tanH * 0.9) break;
  }
  if (!pos) pos = new THREE.Vector3(p.x - ux * 2.2, y, p.z - uz * 2.2);
  const aTop = Math.atan2(DEITY.top - y, L), aBase = Math.atan2(DEITY.base - y, L);
  const pitch = aTop - vfov * 0.42;            // crown near the top edge; the rest of the frame shows you kneeling before it
  cam.wasFraming = true;
  const look = new THREE.Vector3(pos.x + ux * Math.cos(pitch) * 10, y + Math.sin(pitch) * 10, pos.z + uz * Math.cos(pitch) * 10);
  return { pos, look };
}

// ---------------- ritual camera shots ----------------
function shot() { return Promise.resolve(); }       // camera stays behind the monk during rituals
const SHOTS = {
  altar: () => shot(4.2, F + 4.6, -18.8, -0.3, F + 1.0, -26.4),
  burner: () => shot(5.2, 4.2, 16.5, 0, 2.6, 7.5),
  lamp: (side, z) => shot(-side * 4, F + 3.4, z + 6.5, side * 15, F + 3, z - 1.2),
};

// ---------------- UI helpers ----------------
let busy = false;
function setBusy(b) {
  busy = b; document.querySelectorAll('#bar button').forEach((x) => (x.disabled = b));
}
let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}
function modal(html) {
  $('#card').innerHTML = html; $('#modal').classList.add('on');
  return new Promise((res) => {
    $('#card').onclick = (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      const v = b.dataset.v; const form = {};
      $('#card').querySelectorAll('input,select').forEach((i) => (form[i.name] = i.value));
      $('#modal').classList.remove('on'); res({ v, form });
    };
  });
}
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') { $('#modal').classList.remove('on'); $('#card').onclick?.({ target: { closest: () => ({ dataset: { v: 'close' } }) } }); } });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------- moon blocks (筊) ----------------
const blockGeo = (() => {
  const s = new THREE.Shape();
  s.absarc(0, 0, 0.3, -1.25, 1.25, false);
  s.absarc(-0.25, 0, 0.447, 0.69, -0.69, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.03, bevelSegments: 5, curveSegments: 24 });
  const p = g.attributes.position, cols = [];
  const flat = new THREE.Color(0xd9603f), round = new THREE.Color(0xa11f18);
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) < 0) p.setZ(i, 0);            // flat back face
    const c = p.getZ(i) < 0.001 ? flat : round;
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  g.translate(-0.08, 0, 0);
  return g;
})();
const blockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
const thrown = [];
function clearBlocks() { thrown.splice(0).forEach((b) => scene.remove(b)); }
const JIAO = {
  sheng: { name: TX.jiao.sheng[+EN][0], text: TX.jiao.sheng[+EN][1] },
  xiao: { name: TX.jiao.xiao[+EN][0], text: TX.jiao.xiao[+EN][1] },
  yin: { name: TX.jiao.yin[+EN][0], text: TX.jiao.yin[+EN][1] },
};
const jiaoKind = (r) => (r[0] !== r[1] ? 'sheng' : r[0] ? 'xiao' : 'yin');
// moon-block sequence for your own throw: (1) the two blocks held at your chest, (2) look up to the deity and pray,
// (3) look down to the floor in front and throw — then lookAtBlocks() comes down over where they landed.
const heldBlocks = (() => {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(blockGeo, blockMat);
    b.scale.setScalar(0.85); b.rotation.set(0, sx * Math.PI / 2, Math.PI / 2); b.position.x = sx * 0.012;   // flat faces together, between the palms
    g.add(b);
  }
  g.visible = false;
  return g;
})();
async function jiaoShots(first) {
  const p = me.root.position, ry = me.root.rotation.y, F0 = groundY(p.x, p.z);
  const fwd = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), side = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
  me.arms[1].el.add(heldBlocks); heldBlocks.position.set(0.03, -0.24, 0.06); heldBlocks.visible = true;
  me.play('jiaoHold');
  // (1) close on the hands holding the blocks
  // in front of your hands, a little above and to the side, looking back at the blocks you're holding
  await wait(0.5);
  me.root.updateMatrixWorld(true);
  const held = heldBlocks.getWorldPosition(new THREE.Vector3()), head = me.head.getWorldPosition(new THREE.Vector3());
  const out = held.clone().sub(head).setY(0).normalize(), across = new THREE.Vector3(-out.z, 0, out.x);
  director = { pos: held.clone().addScaledVector(out, 0.75).addScaledVector(across, 0.3).add(new THREE.Vector3(0, 0.35, 0)), look: held, speed: 2.4 };
  await wait(first ? 2.4 : 1.4);
  // (2) low behind you, looking up past your head to the deity while you pray
  const top = DEITY ? new THREE.Vector3(DEITY.x, DEITY.base + (DEITY.top - DEITY.base) * 0.62, DEITY.z) : p.clone().addScaledVector(fwd, 8).setY(F0 + 6);
  director = { pos: p.clone().addScaledVector(fwd, -1.15).addScaledVector(side, 0.35).setY(F0 + 0.75), look: top, speed: 1.6 };
  me.play('jiaoPray'); await wait(first ? 3.3 : 2.4);
  // (3) high over the shoulder, looking down at the floor where they'll fall
  const land = p.clone().addScaledVector(fwd, 0.95).setY(F0);
  director = { pos: p.clone().addScaledVector(fwd, -0.35).addScaledVector(side, -0.55).setY(F0 + 2.0), look: land, speed: 2.2 };
  await wait(0.9);
  heldBlocks.visible = false;
}
function lookAtBlocks() {
  if (!thrown.length) return;
  const c = thrown.reduce((a, b) => a.add(b.position), new THREE.Vector3()).multiplyScalar(1 / thrown.length);
  const ry = me.root.rotation.y, side = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
  director = { pos: c.clone().addScaledVector(side, -0.95).add(new THREE.Vector3(0, 1.05, 0)), look: c, speed: 1.8 };   // from the side: your head stays out of the way
}
async function throwBlocks(who, r) {
  if (who === me) clearBlocks();
  who.play('throw');
  await wait(0.5);
  const from = who.handPos, ry = who.root.rotation.y, wz = who.root.position.z;
  const floor = groundY(who.root.position.x, wz) + (inHall(wz) ? 0.014 : 0.004);   // the visible floor surface: never sink in and flicker
  const fwd = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), side = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
  const jobs = r.map((flatUp, i) => {
    const b = new THREE.Mesh(blockGeo, blockMat); b.castShadow = true;
    b.rotation.order = 'YXZ';                          // flip about its own axis, then turn about the vertical: lies flat
    scene.add(b); thrown.push(b);
    const land = who.root.position.clone().addScaledVector(fwd, 0.85 + Math.random() * 0.25).addScaledVector(side, (i ? 1 : -1) * (0.3 + Math.random() * 0.15));
    const spinX = (flatUp ? Math.PI / 2 : -Math.PI / 2) + Math.PI * 2 * (2 + i), yaw = Math.random() * Math.PI * 2;
    // rest exactly on the floor: measure the block's lowest point in its final orientation
    b.rotation.set(spinX, yaw, 0); b.position.set(0, 0, 0); b.updateMatrixWorld(true);
    land.y = floor - new THREE.Box3().setFromObject(b).min.y + 0.002;
    return animate(0.85 + i * 0.08, (k) => {
      b.position.lerpVectors(from, land, k);
      b.position.y += Math.sin(k * Math.PI) * 0.9;
      b.rotation.set(spinX * ease(k), yaw * k, 0.3 * (1 - k));
      if (k === 1) sfx.clack();
    }).then(() => animate(0.25, (k) => { b.position.y = land.y + Math.sin(k * Math.PI) * 0.06; if (k === 1) sfx.clack(0.02); }));
  });
  await Promise.all(jobs);
  if (who !== me) setTimeout(() => thrown.length && thrown.every((b) => b.parent) && null, 0);
}

// ---------------- the great tree beyond the lotus lake ----------------
// A giant old tree rising from a mossy rock mound on the lake's far shore, water spilling from its roots into the
// lake, a little mist and drifting leaves. (The blessings live on the banyan across the courtyard.)
const BODHI = { x: -38, z: 4, h: 58, mound: 3.2, yaw: 0 };   // h: well above the hall roof (~20 m)
let bodhiTick = null;
(() => {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  let seed = 4321; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ticks = [];
  bodhiTick = (dt) => ticks.forEach((f) => f(dt));
  const Y0 = BODHI.mound, H = BODHI.h;

  // ---- the mound: big mossy boulders round a rock core ----
  const core = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 7.2, Y0, 28), new THREE.MeshStandardMaterial({ color: 0x4a4a3a, roughness: 1 }));
  core.position.set(BODHI.x, Y0 / 2 - 0.05, BODHI.z); core.receiveShadow = core.castShadow = true; core.userData.role = 'skip'; scene.add(core);
  const boulders = [];
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, ring = r();
    const rad = ring < 0.5 ? 6.2 + r() * 1.2 : ring < 0.8 ? 4.6 + r() * 1.0 : 3.2 + r() * 1.0;
    const y = ring < 0.5 ? 0 : ring < 0.8 ? Y0 * 0.45 : Y0 * 0.82;
    boulders.push([BODHI.x + Math.cos(a) * rad, BODHI.z + Math.sin(a) * rad, 2.2 + r() * 2.2, r() * 6.28, 0.6 + r() * 0.4, y]);
  }
  ring('/temple/assets/env/rocks.glb', boulders, 0.25, true, (parts) => { const m = parts[0].mat; core.material = new THREE.MeshStandardMaterial({ map: m.map, normalMap: m.normalMap, roughness: 1, color: 0x8a9478 }); });

  // ---- glow sprite (foam where the falls land) ----
  const glowTex = canvasTex(64, 64, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,240,205,1)'); g.addColorStop(0.3, 'rgba(255,205,150,0.5)'); g.addColorStop(1, 'rgba(255,190,130,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); });
  const glow = (pos, size, opacity, color = 0xffe2b0) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity }));
    s.position.copy(pos); s.scale.setScalar(size); s.userData.role = 'skip'; scene.add(s); return s;
  };
  // ---- the tree: one great old tree ("Island Tree 01", Poly Haven, CC0), twisted trunk set into the mound ----
  gl.load(`/temple/assets/env/greattree${isMobile ? '_m' : ''}.glb`, (g) => {   // phones: a version with fewer leaves
    const t = g.scene; t.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(t), size = box.getSize(new THREE.Vector3());
    const S = H / size.y;
    t.scale.setScalar(S); t.rotation.y = BODHI.yaw;
    t.position.set(BODHI.x, Y0 - 0.8 - box.min.y * S, BODHI.z);          // roots sunk into the mound
    t.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      if (o.material.alphaTest || o.material.transparent) { o.material.transparent = false; o.material.alphaTest = 0.5; o.material.side = THREE.DoubleSide; o.castShadow = false; }   // 371k leaves: not worth the shadow pass
    });
    t.userData.role = 'skip'; scene.add(t);
  }, undefined, () => {});

  // ---- water spilling from the roots into the lake: three falls, spray and a little mist at their feet ----
  // The falls are drawn by a shader: streaks of water that speed up as they fall, ragged soft edges, whiter where
  // the water breaks up near the bottom.
  const fallMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 } }]),
    fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
      uniform float uT; varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv; vec3 p = position;
        float k = 1.0 - uv.y;
        p += normal * sin(k * 14.0 - uT * 7.0 + uv.x * 9.0) * 0.035 * k;     // the sheet trembles as it falls
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uT; varying vec2 vUv;
      #include <fog_pars_fragment>
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        float x = vUv.x, k = 1.0 - vUv.y;                  // k: 0 at the lip .. 1 at the lake
        float s = sqrt(k);                                 // time along the fall: water speeds up
        float streak = fbm(vec2(x * 14.0, s * 3.0 - uT * 1.7));
        float fine = n(vec2(x * 40.0, s * 9.0 - uT * 4.0));
        float edgeN = fbm(vec2(k * 5.0 - uT * 0.8, x * 3.0)) - 0.5;
        float edge = smoothstep(0.0, 0.22, x + edgeN * 0.25) * (1.0 - smoothstep(0.78, 1.0, x - edgeN * 0.25));
        float lip = smoothstep(0.0, 0.1, k);
        float foam = smoothstep(0.6, 1.0, k);
        float w = smoothstep(0.35, 0.75, streak) * 0.75 + fine * 0.25;
        vec3 col = mix(vec3(0.52, 0.66, 0.64), vec3(0.96, 0.99, 1.0), clamp(w + foam * 0.5, 0.0, 1.0));
        float a = edge * lip * (0.18 + w * 0.62 + foam * 0.25);
        a *= mix(1.0, smoothstep(0.15, 0.6, streak + fine * 0.3), foam);  // breaking into spray at the bottom
        gl_FragColor = vec4(col, clamp(a * 0.9, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const lakeWestX = lakeAt(Math.PI, 1)[0];
  const SPRAY = 40, sprayFalls = [];
  for (const [dz, w, top] of [[-2.2, 1.6, Y0 * 0.95], [0.6, 2.4, Y0 * 0.75], [2.9, 1.2, Y0 * 0.85]]) {
    const z = BODHI.z + dz, x0 = BODHI.x + 4.6, x1 = Math.max(x0 + 1.0, lakeWestX + 0.6);
    // over the lip, then falling: horizontal speed constant, drop growing with time
    const geo = new THREE.PlaneGeometry(w, 1, 6, 24), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.5 - p.getY(i);
      const t2 = Math.min(1, k * 1.25), x = x0 + (x1 - x0) * Math.sqrt(t2), y = top + (LAKE.y - 0.05 - top) * k * k, spreadW = 1 + k * 0.35;
      p.setXYZ(i, x, y, z + p.getX(i) * spreadW);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, fallMat); m.userData.role = 'skip'; m.renderOrder = 2; m.frustumCulled = false; scene.add(m);
    glow(new THREE.Vector3(x1 + 0.3, LAKE.y + 0.1, z), w * 1.1, 0.22, 0xf0faff);   // foam where it lands
    sprayFalls.push({ x: x1 + 0.05, z, w });
  }
  // spray thrown up where each fall hits the lake: soft drops that rise, drift out and fade
  const sprayN = SPRAY * sprayFalls.length, sp = new Float32Array(sprayN * 3), sc = new Float32Array(sprayN * 3), sst = [];
  const sprayGeo = new THREE.BufferGeometry();
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sprayGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const sprayTex = canvasTex(64, 64, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); });
  const spray = new THREE.Points(sprayGeo, new THREE.PointsMaterial({ map: sprayTex, size: 0.55, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  spray.userData.role = 'skip'; spray.frustumCulled = false; scene.add(spray);
  const respawn = (s, f) => { s.x = f.x + r() * 0.3; s.y = LAKE.y + 0.05; s.z = f.z + (r() - 0.5) * f.w; s.vx = 0.3 + r() * 0.8; s.vy = 0.6 + r() * 1.1; s.vz = (r() - 0.5) * 0.5; s.life = 0; s.max = 0.8 + r() * 1.0; };
  for (let i = 0; i < sprayN; i++) { const s = { f: sprayFalls[(i / SPRAY) | 0] }; respawn(s, s.f); s.life = r() * s.max; sst.push(s); }
  let FT = 0;
  ticks.push((dt) => {
    FT += dt; fallMat.uniforms.uT.value = FT;
    sst.forEach((s, i) => {
      s.life += dt; if (s.life > s.max) respawn(s, s.f);
      s.vy -= 2.2 * dt; s.x += s.vx * dt; s.y = Math.max(LAKE.y, s.y + s.vy * dt); s.z += s.vz * dt;
      const a = Math.sin((s.life / s.max) * Math.PI) * 0.28;
      sp[i * 3] = s.x; sp[i * 3 + 1] = s.y; sp[i * 3 + 2] = s.z; sc[i * 3] = sc[i * 3 + 1] = sc[i * 3 + 2] = a;
    });
    sprayGeo.attributes.position.needsUpdate = sprayGeo.attributes.color.needsUpdate = true;
  });
  // mist drifting low round the foot of the falls and the mound
  const mistTex = canvasTex(128, 128, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); });
  const mists = [];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: 0xeef4f2, transparent: true, depthWrite: false, opacity: 0.1 }));
    const p = new THREE.Vector3(BODHI.x + 4 + r() * 5, LAKE.y + 0.4 + r() * 1.2, BODHI.z + (r() - 0.5) * 12);
    s.position.copy(p); s.scale.setScalar(3 + r() * 4); s.userData.role = 'skip'; scene.add(s);
    mists.push({ s, p, ph: r() * 6.28 });
  }
  // petals: drifting down from the crown, and floating on the lake
  const petalTex = canvasTex(32, 32, (c, w) => { c.fillStyle = 'hsl(78, 42%, 46%)'; c.beginPath(); c.ellipse(w / 2, w / 2, w * 0.42, w * 0.2, 0.5, 0, 7); c.fill(); });
  const PN = 260, petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.09), new THREE.MeshStandardMaterial({ map: petalTex, alphaTest: 0.4, side: THREE.DoubleSide, emissive: 0x141a08 }), PN);
  const pst = [];
  for (let i = 0; i < PN; i++) {
    const floating = i < 110;
    let x, z; if (floating) { do { x = LAKE.x + (r() - 0.5) * 2 * LAKE.rx; z = LAKE.z + (r() - 0.5) * 2 * LAKE.rz; } while (!inLake(x, z, 0.9)); }
    else { const a = r() * 6.28, rad = 2 + r() * 13; x = BODHI.x + Math.cos(a) * rad + 4; z = BODHI.z + Math.sin(a) * rad; }
    pst.push({ x, z, y: floating ? LAKE.y + 0.012 : Y0 + 4 + r() * 18, floating, ph: r() * 6.28, sp: 0.25 + r() * 0.35, rot: r() * 6.28 });
  }
  petals.userData.role = 'skip'; petals.frustumCulled = false; scene.add(petals);
  let T = 0;
  const pe = new THREE.Euler(), pv = new THREE.Vector3();
  ticks.push((dt) => {
    T += dt;
    for (const m of mists) { m.s.position.set(m.p.x + Math.sin(T * 0.07 + m.ph) * 1.5, m.p.y + Math.sin(T * 0.2 + m.ph) * 0.15, m.p.z + Math.cos(T * 0.05 + m.ph) * 1.5); }
    pst.forEach((k, i) => {
      if (k.floating) { k.x += Math.sin(T * 0.05 + k.ph) * 0.02 * dt; k.z += Math.cos(T * 0.04 + k.ph) * 0.02 * dt; pe.set(-Math.PI / 2, 0, k.rot); }
      else {
        k.y -= k.sp * dt; k.x += (0.18 + Math.sin(T * 0.6 + k.ph) * 0.25) * dt; k.z += Math.cos(T * 0.5 + k.ph) * 0.15 * dt;
        pe.set(T * 1.3 + k.ph, T * 0.9 + k.ph, 0);
        if (k.y < 0.3) { const a = r() * 6.28, rad = 2 + r() * 13; k.x = BODHI.x + Math.cos(a) * rad + 4; k.z = BODHI.z + Math.sin(a) * rad; k.y = Y0 + 16 + r() * 14; }
      }
      petals.setMatrixAt(i, m4.compose(pv.set(k.x, k.y, k.z), q.setFromEuler(pe), one));
    });
    petals.instanceMatrix.needsUpdate = true;
  });
})();
// ---------------- the blessing banyan (祈福榕樹) on the east side of the courtyard ----------------
// A vast old banyan on a stepped sandstone terrace. Its roots pour down over the steps; every riser between them is
// lined with little arched niches, each holding a small gold Buddha. Those Buddhas keep the blessings people write
// (same slot system the old lamp walls used, so earlier lamps reappear here); claimed ones glow brighter.
// Built here from tubes (trunk strands, roots, limbs, aerial roots) with leaf puffs cut from "Island Tree 01" (CC0).
const BANYAN = { x: 36, z: 4, tiers: 8, r0: 12.5, dr: 0.95, rise: 0.78, arc: 1.95 };   // arc: half-angle of the niche rows round the front
let banyanTick = null;
world.lamps = (() => {
  const B = BANYAN, slots = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s3 = new THREE.Vector3();
  let seed = 9091; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ticks = []; banyanTick = (dt) => ticks.forEach((f) => f(dt));
  const tl = new THREE.TextureLoader();
  const pbrM = (id, o = {}) => {
    const ld = (m, srgb) => { const t = tl.load(`/temple/assets/tex/${id}_${m}.webp`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
    return new THREE.MeshStandardMaterial({ map: ld('diff', true), normalMap: ld('nor'), roughnessMap: ld('rough'), roughness: 1, ...o });
  };
  const stone = pbrM('large_sandstone_blocks_01', { color: 0xf0e4cc });
  const bark = pbrM('chinese_hackberry_bark', { color: 0xf2ead8 });
  const add = (m, shadow = true) => { m.castShadow = shadow; m.receiveShadow = true; m.userData.role = 'skip'; scene.add(m); return m; };
  const tierR = (i) => B.r0 - i * B.dr, TOP = B.tiers * B.rise;
  const groundAt = (d) => (d >= B.r0 ? 0 : (Math.min(B.tiers - 1, Math.floor((B.r0 - d) / B.dr)) + 1) * B.rise);
  const at = (d, a, y) => new THREE.Vector3(B.x + Math.cos(a) * d, y, B.z + Math.sin(a) * d);

  // ---- the terrace: seven solid stone drums, each narrower and higher ----
  const parts = [];
  for (let i = 0; i < B.tiers; i++) {
    const R = tierR(i), h = (i + 1) * B.rise;
    const side = new THREE.CylinderGeometry(R, R + 0.04, h, 120, 1, true).translate(B.x, h / 2, B.z);
    const uv = side.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (Math.PI * 2 * R) / 3, uv.getY(k) * h / 3);
    const cap = new THREE.CircleGeometry(R, 120).rotateX(-Math.PI / 2).translate(B.x, h, B.z);
    const cu = cap.attributes.uv; for (let k = 0; k < cu.count; k++) cu.setXY(k, cu.getX(k) * R * 2 / 3, cu.getY(k) * R * 2 / 3);
    parts.push(side, cap);
  }
  add(new THREE.Mesh(mergeGeometries(parts), stone));

  // ---- tubes with a tapering radius (the whole tree is made of these) ----
  const tube = (pts, rad0, rad1, seg, rs = 10) => {
    const c = new THREE.CatmullRomCurve3(pts), fr = c.computeFrenetFrames(seg, false), len = c.getLength();
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, p = c.getPointAt(t), N = fr.normals[i], Bn = fr.binormals[i];
      const rr = THREE.MathUtils.lerp(rad0, rad1, Math.pow(t, 0.7)) * (1 + Math.sin(t * 23 + rad0 * 40) * 0.07);
      for (let k = 0; k <= rs; k++) {
        const a = (k / rs) * Math.PI * 2, cx = Math.cos(a), sx = Math.sin(a);
        const nx = cx * N.x + sx * Bn.x, ny = cx * N.y + sx * Bn.y, nz = cx * N.z + sx * Bn.z;
        const kn = rr * (1 + Math.sin(a * 3 + t * len * 1.3 + rad0 * 17) * 0.08 + Math.sin(a * 5 - t * len * 2.3) * 0.05 + Math.max(0, Math.sin(t * len * 0.9 + rad0 * 31)) ** 6 * 0.18);   // knots and swellings
        pos.push(p.x + nx * kn, p.y + ny * kn, p.z + nz * kn); nor.push(nx, ny, nz);
        uv.push((k / rs) * Math.max(1, Math.round(rr * 4)), (t * len) / 2.5);
      }
    }
    for (let i = 0; i < seg; i++) for (let k = 0; k < rs; k++) { const a = i * (rs + 1) + k, b = a + rs + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
  };
  const wood = [];
  const bakeGeo = (o) => {                                           // compressed meshes keep their scale on the node: bake it in
    const g2 = o.geometry.clone();
    for (const n of ['position', 'normal']) {
      const a = g2.attributes[n]; if (!a || a.array instanceof Float32Array) continue;
      const f = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
      g2.setAttribute(n, new THREE.BufferAttribute(f, 3));
    }
    g2.applyMatrix4(o.matrixWorld); return g2;
  };

  // ---- roots: from the foot of the trunk out over the terrace and down the steps to the ground ----
  const rootAngles = [];
  const settle = (d) => { let m = 0; for (let k = -3; k <= 3; k++) m += groundAt(d + k * 0.1); return Math.max(groundAt(d), m / 7); };   // a root rests on each step and slopes down its edge
  const rootDirs = [];
  for (let j = 0; j < 11; j++) rootDirs.push([Math.PI - B.arc * 0.92 + (j / 10) * B.arc * 1.84, j % 2 ? 0.15 : 0.28]);   // front: fewer, so the niches show between them
  for (let j = 0; j < 16; j++) rootDirs.push([Math.PI + B.arc + (j / 15) * (Math.PI * 2 - B.arc * 2), j % 3 ? 0.16 : 0.3]);
  const heaved = [];                                                  // blocks the roots have pushed up
  for (const [a0, t0] of rootDirs) {
    let a = a0 + (r() - 0.5) * 0.08;
    const thick = t0 + r() * 0.12, end = B.r0 + 0.8 + r() * 2.6;
    const dive = r() < 0.6 ? 7.4 + r() * 3.5 : -9;                     // where this root slips under a step and out again
    const pts = [at(4.5, a, TOP + 1.2), at(6.4, a, groundAt(6.4) + thick * 0.4)];
    for (let d = 7.0; d < end; d += 0.3) {
      a += (r() - 0.5) * 0.03;
      const under = Math.abs(d - dive) < 0.45;
      pts.push(at(d, a, settle(d) + thick * (under ? -1.1 : 0.6)));
      if (!under) rootAngles.push([d, a, thick]);
      if (groundAt(d + 0.3) < groundAt(d) && r() < 0.35) heaved.push([d, a + (r() < 0.5 ? -1 : 1) * (thick + 0.35) / d, groundAt(d)]);
    }
    wood.push(tube(pts, thick * 1.7, thick * 0.3, pts.length * 2, 9));
  }
  // the bole: wide enough low down to have swallowed the top tiers; flanges along each root break out through the
  // risers below. (Shared with the niches, which are left out wherever the wood has taken the stone.)
  const YF = TOP - 1.6;
  const trunkR = (th, y) => {
    let b = 0; for (const [a0, t0] of rootDirs) { const d = Math.atan2(Math.sin(th - a0), Math.cos(th - a0)); b += t0 * 9 * Math.exp(-(d * d) / 0.012); }
    const core = Math.min(7.4, 2.6 + 6.5 * Math.exp(-(y - YF) / 3.0));   // wider than the top two tiers: it has swallowed them
    return core + b * Math.exp(-Math.max(0, y - 1.2) / 3.4);
  };

  // ---- the trunk: one great flared bole. Wide at the foot, it runs out into buttresses that line up with the roots
  // spilling down the steps; higher up it is fluted and slightly twisted, like many stems grown into one ----
  {
    const NA = 160, NH = 56, y0 = 1.0, y1 = 22, pos = [], uv = [], col = [], idx = [];
    for (let i = 0; i <= NH; i++) {
      const y = y0 + (y1 - y0) * Math.pow(i / NH, 1.5);                 // rings packed low down, where the flare is
      const flare = Math.exp(-Math.max(0, y - YF) / 1.8);
      for (let k = 0; k <= NA; k++) {
        const th = (k / NA) * Math.PI * 2, tw = th + (y - y0) * 0.04;
        const lobes = flare * (0.7 * Math.sin(th * 7 + 1.3 + y * 0.15) + 0.45 * Math.sin(th * 12 - y * 0.6) + 0.25 * Math.sin(th * 19 + y * 1.4));   // fused root-stems at the foot, deep fissures between
        const rad = trunkR(th, y) + lobes + Math.sin(tw * 13) * 0.1 * (1 - flare) + Math.sin(th * 5 + y * 0.7) * 0.14 + Math.sin(th * 11 - y * 1.3) * 0.06 + Math.sin(th * 23 + y * 2.9) * 0.025;
        pos.push(B.x + Math.cos(th) * rad, y, B.z + Math.sin(th) * rad);
        uv.push((k / NA) * 8, y / 2.5);
        const moss = Math.exp(-Math.max(0, y - YF + 0.6) / 1.6);
        col.push(1 - moss * 0.4, 1 - moss * 0.22, 1 - moss * 0.5);      // darker, greener at the foot
      }
    }
    for (let i = 0; i < NH; i++) for (let k = 0; k < NA; k++) { const a = i * (NA + 1) + k, b = a + NA + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    g.computeVertexNormals();
    const trunkMat = bark.clone(); trunkMat.vertexColors = true;
    add(new THREE.Mesh(g, trunkMat));
  }

  if (heaved.length) {                                               // stones tipped up where roots force through
    const hb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stone, heaved.length), e3 = new THREE.Euler();
    heaved.forEach(([d, a, y], i) => hb.setMatrixAt(i, m4.compose(at(d - 0.15, a, y + 0.06), q.setFromEuler(e3.set((r() - 0.5) * 0.5, -a, 0.15 + r() * 0.3)), s3.set(0.42 + r() * 0.2, 0.2, 0.5 + r() * 0.2))));
    add(hb);
  }

  // ---- limbs: long, low and spreading, a few rising branches on each ----
  const sprigs = [];                                                  // points along limbs: leaves and hanging roots
  const limb = (a, y0, L, rad0, d0, rise, depth) => {
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8; a += (r() - 0.5) * 0.08;
      pts.push(at(d0 + u * L, a, y0 + Math.sin(u * Math.PI * 0.85) * rise + u * 1.5 - u * u * 2.5));
    }
    wood.push(tube(pts, rad0, rad0 * 0.18, 40, depth ? 8 : 12));
    const c = new THREE.CatmullRomCurve3(pts);
    for (let u = 0.25; u <= 1; u += 0.06) sprigs.push({ p: c.getPointAt(u), u, depth });
    if (!depth) for (const f of [0.4, 0.62, 0.8]) {
      const p = c.getPointAt(f), d = Math.hypot(p.x - B.x, p.z - B.z), b = Math.atan2(p.z - B.z, p.x - B.x);
      limb(b + (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.3), p.y, L * (0.35 + r() * 0.15), rad0 * 0.4, d, 3 + r() * 2, 1);
    }
  };
  for (let j = 0; j < 10; j++) {
    const a = (j / 10) * Math.PI * 2 + 0.3 + r() * 0.3;
    const towardHall = Math.cos(a) < -0.3 && Math.sin(a) < 0.2;       // keep clear of the hall roof
    limb(a, 13 + r() * 6, towardHall ? 9 + r() * 3 : 16 + r() * 6, 1.25 + r() * 0.3, 1.8, 4 + r() * 3, 0);
  }
  add(new THREE.Mesh(mergeGeometries(wood), bark));

  // ---- aerial roots: thin, slightly wavy strands hanging in small bunches; a few reach the ground ----
  const strands = [];
  for (const s of sprigs) {
    if (r() > 0.5) continue;
    const d = Math.hypot(s.p.x - B.x, s.p.z - B.z), floor = groundAt(d);
    for (let n = 1 + Math.floor(r() * 3); n > 0; n--) {
      const pillar = d < B.r0 + 2 && r() < 0.02;
      const len = pillar ? s.p.y - floor + 0.1 : Math.min(s.p.y - floor - 0.6, 1.5 + r() * 7);
      if (len < 0.8) continue;
      const x0 = s.p.x + (r() - 0.5) * 0.5, z0 = s.p.z + (r() - 0.5) * 0.5, ph = r() * 6.28, sw = 0.08 + r() * 0.12;
      const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(new THREE.Vector3(x0 + Math.sin(ph + t * 4) * sw * t, s.p.y + 0.1 - t * len, z0 + Math.cos(ph + t * 3) * sw * t)); }
      strands.push(pillar ? tube(pts, 0.045, 0.03, 14, 6) : tube(pts, 0.012 + r() * 0.016, 0.003, 10, 4));
    }
  }
  if (strands.length) add(new THREE.Mesh(mergeGeometries(strands), new THREE.MeshStandardMaterial({ color: 0x8a7860, roughness: 0.9 })), false);

  // ---- the canopy: puffs of real leaves along the limbs and over the crown ----
  gl.load('/temple/assets/env/leafpuffs.glb', (g) => {
    g.scene.updateMatrixWorld(true);
    const puffs = []; g.scene.traverse((o) => { if (o.isMesh && o.geometry.index.count < 3200) puffs.push({ geometry: bakeGeo(o), material: o.material }); });   // the lighter puffs only
    if (!puffs.length) return;
    const mat = puffs[0].material; mat.alphaTest = 0.5; mat.transparent = false; mat.side = THREE.DoubleSide; mat.color.set(0xd8e6b0);
    const spots = [];
    for (const s of sprigs) { const k = s.depth ? 2 : 1; for (let n = 0; n < k; n++) spots.push(new THREE.Vector3(s.p.x + (r() - 0.5) * 5, s.p.y + 1 + r() * 3.5, s.p.z + (r() - 0.5) * 5)); }
    for (let n = 0; n < 160; n++) { const a = r() * 6.28, d = Math.sqrt(r()) * 17; spots.push(at(d, a, 23 + r() * 5 - d * 0.25)); }   // the crown's dome
    const keep = isMobile ? spots.filter(() => r() < 0.4) : spots;
    const per = puffs.map(() => []);
    keep.forEach((p, i) => per[i % puffs.length].push(p));
    const e = new THREE.Euler();
    puffs.forEach((pf, k) => {
      const im = new THREE.InstancedMesh(pf.geometry, mat, per[k].length);
      per[k].forEach((p, i) => { e.set((r() - 0.5) * 0.6, r() * 6.28, (r() - 0.5) * 0.6); im.setMatrixAt(i, m4.compose(p, q.setFromEuler(e), s3.setScalar(16 + r() * 7))); });
      im.frustumCulled = false; add(im, false);
    });
  });

  // ---- niches round the front of every riser, skipping where a root runs down ----
  const W = 0.44, Hn = 0.58;
  const archPath = (s, P = new THREE.Shape()) => { P.moveTo(-W / 2 * s, 0); P.lineTo(W / 2 * s, 0); P.lineTo(W / 2 * s, (Hn - W / 2) * s); P.absarc(0, (Hn - W / 2) * s, W / 2 * s, 0, Math.PI, false); P.lineTo(-W / 2 * s, 0); return P; };
  const arch = (s) => new THREE.ShapeGeometry(archPath(s), 6);
  const frameShape = archPath(1.32); frameShape.holes.push(archPath(1, new THREE.Path()));   // a stone arch standing proud of the riser
  const spots = [];
  for (let i = 0; i < B.tiers; i++) {
    const R = tierR(i), n = Math.floor((2 * B.arc * R) / 0.62);
    for (let k = 0; k < n; k++) {
      const a = Math.PI - B.arc + ((k + 0.5) / n) * 2 * B.arc;
      const blocked = trunkR(a, i * B.rise + 0.35) > R - 0.2 || rootAngles.some(([d, ra, th]) => Math.abs(d - R) < 0.5 && Math.abs(Math.atan2(Math.sin(a - ra), Math.cos(a - ra))) * R < th * 1.2 + 0.25);
      if (!blocked) spots.push({ i, a, R });
    }
  }
  const N = spots.length;
  const rim = new THREE.InstancedMesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.15, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: 6 }).translate(0, -0.035, 0),
    stone, N);
  // the back of every niche glows warm gold round the Buddha's halo, fading to shadow at the edges
  const backGlow = canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.62);
    g.addColorStop(0, '#fff8e6'); g.addColorStop(0.4, '#f5dca0'); g.addColorStop(0.8, '#a87a3a'); g.addColorStop(1, '#3a2812');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  backGlow.repeat.set(1 / W, 1 / Hn); backGlow.offset.set(0.5, 0);    // the arch's UVs are in metres
  const inner = new THREE.InstancedMesh(arch(1), new THREE.MeshStandardMaterial({ color: 0x3a2008, map: backGlow, emissive: 0xffe6b8, emissiveMap: backGlow, emissiveIntensity: 0.8, roughness: 1 }), N);
  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.36, 0.14).translate(0, 0.18, 0),
    new THREE.MeshStandardMaterial({ color: 0xe8be5c, metalness: 0.8, roughness: 0.3, emissive: 0xc89a3a, emissiveIntensity: 0.38 }), N);
  spots.forEach(({ i, a, R }, k) => {
    const nrm = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), y = i * B.rise + 0.07;
    q.setFromAxisAngle(up, Math.atan2(nrm.x, nrm.z));
    const p = at(R, a, y);
    rim.setMatrixAt(k, m4.compose(p, q, s3.set(1, 1, 1)));
    inner.setMatrixAt(k, m4.compose(p.clone().addScaledVector(nrm, 0.01), q, s3.set(1, 1, 1)));
    const bp = p.clone().addScaledVector(nrm, 0.09);
    cells.setMatrixAt(k, m4.compose(bp, q, s3.set(1, 1, 1)));
    const lit = r() < 0.22;
    cells.setColorAt(k, col.set(lit ? 0xfff0d0 : 0xc9a160));                       // claimed: bright gold; waiting: softer gold
    slots.push({ pos: bp.clone().add(new THREE.Vector3(0, 0.2, 0)), ang: a, lit });
  });
  for (const m of [rim, inner, cells]) { m.frustumCulled = false; add(m, m === rim); }
  // the little seated Buddha (47 cm): lotus seat, crossed legs, robed body, hands in the lap, head and topknot, halo
  {
    const P = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => geo.scale(sx, sy, sz).translate(x, y, z);
    const body = new THREE.LatheGeometry([[0.001, 0.2], [0.25, 0.2], [0.24, 0.32], [0.2, 0.48], [0.19, 0.55], [0.12, 0.6], [0.06, 0.63], [0.001, 0.64]].map(([x, y]) => new THREE.Vector2(x, y)), 10);
    const parts = [
      P(new THREE.CylinderGeometry(0.36, 0.3, 0.09, 12), 0, 0.045, 0),                    // lotus seat
      P(new THREE.SphereGeometry(1, 12, 6), 0, 0.15, 0.03, 0.4, 0.11, 0.26),             // crossed legs
      body.scale(1, 1, 0.75),
      P(new THREE.SphereGeometry(1, 6, 4), 0, 0.26, 0.15, 0.11, 0.05, 0.07),             // hands in the lap
      P(new THREE.SphereGeometry(0.12, 10, 7), 0, 0.73, 0.01, 1, 1.08, 1),               // head
      P(new THREE.SphereGeometry(0.055, 6, 4), 0, 0.86, 0),                               // topknot
      P(new THREE.CircleGeometry(0.22, 16), 0, 0.72, -0.09),                              // halo
    ];
    const geo = mergeGeometries(parts); geo.scale(0.47, 0.47, 0.47);
    cells.geometry.dispose(); cells.geometry = geo;
  }
  // a Buddha holding someone's blessing glows: brighter gilding that shimmers, and a soft gold halo of light round it.
  // aGlow per niche: 0 waiting, 1 someone's blessing, 1.8 yours.
  const uT = { value: 0 };
  const glow = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  slots.forEach((s, k) => glow.setX(k, s.lit ? 1 : 0));
  cells.geometry.setAttribute('aGlow', glow);
  cells.material.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = 'attribute float aGlow;\nvarying float vGlow;\nvarying float vPh;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlow = aGlow; vPh = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;');
    sh.fragmentShader = 'uniform float uT;\nvarying float vGlow;\nvarying float vPh;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 1.0 + vGlow * (2.0 + 0.9 * sin(uT * 2.2 + vPh) + 0.5 * sin(uT * 5.3 + vPh * 2.0));');
  };
  cells.material.customProgramCacheKey = () => 'blessingBuddha';
  const hp = new Float32Array(N * 3), on = new Float32Array(N);
  slots.forEach((s, k) => { hp.set([s.pos.x, s.pos.y + 0.02, s.pos.z], k * 3); on[k] = glow.getX(k); });
  const hgeo = new THREE.BufferGeometry();
  hgeo.setAttribute('position', new THREE.BufferAttribute(hp, 3)); hgeo.setAttribute('aOn', new THREE.BufferAttribute(on, 1));
  const halos = new THREE.Points(hgeo, new THREE.ShaderMaterial({
    uniforms: { uT },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aOn; uniform float uT; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float pulse = 0.85 + 0.15 * sin(uT * 2.2 + position.x * 3.1 + position.z * 1.7);
        gl_PointSize = aOn > 0.0 ? (260.0 + 120.0 * (aOn - 1.0)) * pulse / -mv.z : 0.0;
        vA = min(aOn, 1.5) * pulse;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(max(0.0, 1.0 - d), 2.2) * 0.42 * vA;
        gl_FragColor = vec4(1.0, 0.84, 0.5, a);
      }`,
  }));
  halos.frustumCulled = false; halos.userData.role = 'skip'; scene.add(halos);
  const setGlow = (i, v) => { glow.setX(i, v); glow.needsUpdate = true; on[i] = v; hgeo.attributes.aOn.needsUpdate = true; };
  return { cells, slots, setGlow, uT };
})();

// ---------------- meadow: grass tufts and small wildflowers swaying in a light breeze ----------------
// Each tuft is three crossed cards of painted blades; thousands are instanced over the open ground (round the lake,
// round the banyan, in the woods), never on the paving or in the water.
let grassTick = null;
{
  let seed = 2468; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // painted blades: dark at the root, paler and warmer toward the tip, a few dry straw ones; flowers on thin stems
  const bladeTex = (flowers) => canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const blade = (x, top, bend, wd, dry) => {
      const g = c.createLinearGradient(0, h, 0, top);
      if (dry) { g.addColorStop(0, '#5a5430'); g.addColorStop(1, '#c8b77a'); }
      else { const hue = 80 + r() * 28; g.addColorStop(0, `hsl(${hue}, 38%, 24%)`); g.addColorStop(0.55, `hsl(${hue}, ${38 + r() * 18}%, ${28 + r() * 10}%)`); g.addColorStop(1, `hsl(${hue - 12}, ${35 + r() * 15}%, ${48 + r() * 14}%)`); }
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x - wd, h); c.quadraticCurveTo(x + bend * 0.35, (h + top) / 2, x + bend, top); c.quadraticCurveTo(x + bend * 0.35 + wd * 0.3, (h + top) / 2, x + wd, h); c.fill();
    };
    for (let i = 0; i < 70; i++) blade(20 + r() * 216, 40 + r() * 150 + (r() < 0.3 ? 40 : 0), (r() - 0.5) * 70, 1.4 + r() * 2.4, r() < 0.1);
    if (!flowers) return;
    const kinds = [
      { petals: 12, col: '#f6f3ea', heart: '#e9b52c', R: 6 },               // daisy
      { petals: 5, col: '#f1d23a', heart: '#d9a520', R: 5 },                // buttercup
      { petals: 4, col: '#8fa6dc', heart: '#f2f2f2', R: 3.5 },              // speedwell
    ];
    for (let i = 0; i < 7; i++) {
      const f = kinds[i % 3], x = 30 + r() * 196, top = 50 + r() * 100, bend = (r() - 0.5) * 30;
      c.strokeStyle = '#3d5a22'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, h); c.quadraticCurveTo(x + bend * 0.4, (h + top) / 2, x + bend, top); c.stroke();
      for (let k = 0; k < f.petals; k++) {
        const a = (k / f.petals) * 6.28;
        c.save(); c.translate(x + bend, top); c.rotate(a); c.fillStyle = f.col;
        c.beginPath(); c.ellipse(f.R * 0.7, 0, f.R * 0.75, f.R * (f.petals > 6 ? 0.22 : 0.45), 0, 0, 7); c.fill(); c.restore();
      }
      c.fillStyle = f.heart; c.beginPath(); c.arc(x + bend, top, f.R * 0.32, 0, 7); c.fill();
    }
  });
  const tuft = (wd, ht) => {
    const parts = [0, 1, 2].map((k) => new THREE.PlaneGeometry(wd, ht).translate(0, ht / 2, 0).rotateY((k * Math.PI) / 3));
    const g = mergeGeometries(parts), n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);           // lit like the ground it grows from: no dark card faces
    return g;
  };
  const uT = { value: 0 };
  const sway = (m) => { m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    // both faces of a blade keep the up-facing normal (the back face was flipped to point down and rendered black)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float bendK = uv.y * uv.y;
      transformed.x += sin(uT * 1.3 + wp.x * 0.35 + wp.z * 0.2) * 0.06 * bendK;
      transformed.z += cos(uT * 1.1 + wp.z * 0.3) * 0.04 * bendK;`);
  }; return m; };
  const mat = (flowers) => sway(new THREE.MeshStandardMaterial({ map: bladeTex(flowers), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95 }));
  const paved = (x, z) => (pavedAt(x, z) || (Math.abs(x) < 17.5 && z > -33 && z < -6)) && !inLake(x, z, 1.45);   // on the stones (and never under the hall)
  // never on a raised floor (hall, its steps, the gate platform, the altar's ends): tall tufts poked up through the stone
  const raised = (x, z) => [[0, 0], [0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]].some(([dx, dz]) => groundY(x + dx, z + dz) > 0.01) || (Math.abs(x) < 18.9 && z > -36 && z < -27.7);
  const ok = (x, z) => onPlateau(x, z, 0.98) && !paved(x, z) && !raised(x, z) && !inLake(x, z, 1.12) && !inPond(x, z, 1.2) && Math.hypot(x - BANYAN.x, z - BANYAN.z) > BANYAN.r0 + 0.3 && Math.hypot(x - BODHI.x, z - BODHI.z) > 7.6;
  const spots = [];
  const near = (cx, cz, r0, r1, n) => { for (let i = 0, t = 0; i < n && t < n * 6; t++) { const a = r() * 6.28, d = r0 + Math.sqrt(r()) * (r1 - r0), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (ok(x, z)) { spots.push([x, z]); i++; } } };
  const k = isMobile ? 0.3 : 1;
  near(LAKE.x, LAKE.z, 0, 24, 3200 * k);                                // round the lotus lake
  near(BANYAN.x, BANYAN.z, BANYAN.r0, BANYAN.r0 + 16, 2600 * k);        // round the banyan
  near(0, -20, 20, 70, 3600 * k);                                       // the woods all round
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const fill = (geo, material, list) => {
    const im = new THREE.InstancedMesh(geo, material, list.length);
    const tint = new THREE.Color();
    list.forEach(([x, z], i) => {
      const s2 = 0.7 + r() * 0.8; im.setMatrixAt(i, m4.compose(v.set(x, 0, z), q.setFromAxisAngle(up, r() * 6.28), sc.set(s2, s2 * (0.6 + r() * 0.7), s2)));
      im.setColorAt(i, tint.setHSL(0.2 + (r() - 0.5) * 0.06, 0.25 + r() * 0.25, 0.62 + r() * 0.25));   // every clump a slightly different green
    });
    im.userData.role = 'skip'; im.receiveShadow = true; im.frustumCulled = false; noReflect.add(im); scene.add(im);
  };
  const flowers = spots.filter((_, i) => i % 14 === 0), grass = spots.filter((_, i) => i % 14 !== 0);
  fill(tuft(0.85, 0.5), mat(false), grass);
  fill(tuft(0.8, 0.5), mat(true), flowers);
  grassTick = (dt) => { uT.value += dt; };
}
// more ferns where people look: round the lake and the banyan
scatter('/temple/assets/env/fern.glb', 60, (rnd) => { const a = rnd() * 6.28, [x, z] = lakeAt(a, 1.25 + rnd() * 1.1); return Math.abs(x) < 22.3 && z > -32.3 && z < 38.3 ? null : [x, z]; }, [0.9, 1.5]);
scatter('/temple/assets/env/fern.glb', 50, (rnd) => { const a = rnd() * 6.28, d = 13 + rnd() * 9, x = 36 + Math.cos(a) * d, z = 4 + Math.sin(a) * d; return x < 22.5 ? null : [x, z]; }, [0.9, 1.6]);

const LW = world.lamps;
const lampLabels = [];
const myLamps = store.get('lamps', []);
const lampCol = new THREE.Color();
function lightSlot(i, mine, name) {
  LW.slots[i].lit = true; LW.slots[i].mine = mine;
  LW.cells.setColorAt(i, lampCol.set(mine ? 0xffffff : 0xffe2b8));
  LW.cells.instanceColor.needsUpdate = true;
  LW.setGlow(i, mine ? 1.8 : 1);                     // a named blessing: the Buddha lights up
  if (mine) {
    const tag = document.createElement('div');
    tag.className = 'nametag'; tag.textContent = '🪷 ' + (name || t('myLamp'));
    const o = new CSS2DObject(tag); o.userData.slot = i;
    lampLabels.push(o);
    o.position.copy(lampWorld(i)).add(new THREE.Vector3(0, 0.6, 0));
    scene.add(o);
  }
}
function freeSlot() {
  const free = LW.slots.map((s, i) => (!s.lit ? i : -1)).filter((i) => i >= 0);
  if (!free.length) { const i = Math.random() * LW.slots.length | 0; return i; }
  const eye = (i) => { const s = LW.slots[i]; return Math.abs(s.pos.y - 1.5) * 0.8 + Math.abs(s.ang - Math.PI) * 3 + Math.random() * 0.8; };   // near eye level, facing the courtyard
  free.sort((a, b) => eye(a) - eye(b));
  return free[Math.random() * Math.min(12, free.length) | 0];
}
const lampWorld = (i) => LW.slots[i].pos.clone();
myLamps.forEach((l) => { if (!LW.slots[l.slot]) l.slot %= LW.slots.length; });   // lamps from older layouts move onto the banyan
store.set('lamps', myLamps);
myLamps.forEach((l) => lightSlot(l.slot, true, l.name));

// ---------------- 太歲 2027 丁未 ----------------
const BR = '子丑寅卯辰巳午未申酉戌亥', ZOD = '鼠牛虎兔龍蛇馬羊猴雞狗豬';
const TAISUI_2027 = EN
  ? { 7: 'Zhí Tài Suì · your own zodiac year', 1: 'Chōng Tài Suì · clashing with the year', 10: 'Xíng & Pò · at odds with the year', 0: 'Hài Tài Suì · harmed by the year' }
  : { 7: '值太歲（本命年）', 1: '沖太歲、刑太歲', 10: '刑太歲、破太歲', 0: '害太歲' };
const zod = (b) => (EN ? ZOD_EN[b] : ZOD[b]);
const branchOf = (y) => ((y - 4) % 12 + 12) % 12;

// ---------------- fortune lots ----------------
let LOTS = null;
fetch('/temple/lots.json').then((r) => (r.ok ? r.json() : null)).then((d) => (LOTS = d)).catch(() => {});
let LOTS_EN = null;
if (EN) fetch('/temple/lots_en.json').then((r) => (r.ok ? r.json() : null)).then((d) => (LOTS_EN = d)).catch(() => {});

const prayBtn = () => document.querySelector('#bar button[data-act="bai"]');
function endPrayer() {
  if (!me.praying) return;
  me.praying = false;
  prayBtn().lastChild.textContent = TX.acts[+EN][0]; prayBtn().classList.remove('on');
}
// ---------------- rituals ----------------
const ALTAR = { x: 0, z: -25.0 };
const toAltar = () => { SHOTS.altar(); return walkTo(ALTAR.x, ALTAR.z, Math.PI); };
const share = async (text) => {
  const url = location.origin + '/temple';
  try { if (navigator.share) { await navigator.share({ title: t('brand'), text, url }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); toast(t('copied')); } catch {}
};

const ACTS = {
  async muyu() {
    if (!atMuyu) {
      setBusy(true);
      try {
        await walkTo(MUYU.x, MUYU.z + 1.05, Math.PI);
        await wait(0.3);
        me.kneel = true; atMuyu = true; me.mallet.visible = true; net.act('kneel');
        toast(t('muyuHint'), 3500);
      } finally { setBusy(false); }
    }
    strike(me); net.act('muyu');
  },
  async sit() { setBusy(false); await sitAt(nearestCushion()); },

  // prayer mode: one gentle bow, then palms together facing the deity for as long as you like.
  // Tap the button again (now "End prayer") or simply walk away to finish.
  async bai() {
    if (me.praying) { endPrayer(); return; }
    me.praying = true; net.act('palms');
    me.play('palms');
    prayBtn().lastChild.textContent = t('endPray'); prayBtn().classList.add('on');
    toast(t('praying'), 4200);
  },

  async incense() {
    toast(t('toBurner'));
    SHOTS.burner();
    await walkTo(0, 10.8, Math.PI);
    me.play('incense'); net.act('incense');
    for (let i = 0; i < 3; i++) setTimeout(() => sfx.bell(), 400 + i * 1200);
    await wait(3.7);
    plantIncense(3); sticks.slice(-3).forEach((g) => (g.userData.mine = true)); saveSticks();
    const n = store.get('incenseCount', 0) + 1; store.set('incenseCount', n);
    toast(t('incenseDone', n), 3200);
  },

  async jiao() {
    const { v } = await modal(`
      <h2>${t('jiaoTitle')}</h2>
      <p>${t('jiaoIntro')}</p>
      <p class="muted">${t('private')}</p>
      <div class="row"><button class="btn ghost" data-v="no">${t('no')}</button><button class="btn primary" data-v="go">${t('throw')}</button></div>`);
    if (v !== 'go') return;
    await toAltar();
    let streak = 0, first = true;
    try { for (;;) {
      const r = [Math.random() < 0.5, Math.random() < 0.5];
      await jiaoShots(first); first = false;
      net.act('jiao', r);
      await throwBlocks(me, r);
      const kind = jiaoKind(r);
      streak = kind === 'sheng' ? streak + 1 : 0;
      lookAtBlocks();
      await wait(1.6);
      const strong = streak >= 3 ? `<p>${t('strong')}</p>` : streak > 0 ? `<p class="muted">${t('streak', streak)}</p>` : '';
      const { v: again } = await modal(`
        <div class="result">${JIAO[kind].name}</div>
        <p style="text-align:center">${JIAO[kind].text}</p>${strong}
        <div class="row"><button class="btn ghost" data-v="done">${t('thanks')}</button><button class="btn primary" data-v="again">${t('again')}</button></div>`);
      if (again !== 'again') break;
    } } finally { director = null; heldBlocks.visible = false; }   // always hand the camera back
    toast('🙏');
  },

  async qian() {
    const { v } = await modal(`
      <h2>${t('qianTitle')}</h2>
      <p>${t('qianIntro')}</p>
      <p class="muted">${t('qianRule')}</p>
      <div class="row"><button class="btn ghost" data-v="no">${t('no')}</button><button class="btn primary" data-v="go">${t('shake')}</button></div>`);
    if (v !== 'go') return;
    await toAltar();
    me.play('palms'); await wait(1.4);
    for (let tries = 1; ; tries++) {
      me.play('shake'); net.act('qian'); sfx.rattle();
      const tube = world.tube, base = tube.rotation.clone();
      await animate(1.6, (k) => { tube.rotation.x = Math.sin(k * 40) * 0.18 * (1 - k); tube.rotation.z = Math.cos(k * 33) * 0.1 * (1 - k); });
      tube.rotation.copy(base);
      // one stick pops out
      const n = 1 + (Math.random() * 60 | 0);
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.8, 0.015), new THREE.MeshStandardMaterial({ color: 0xe6c98a }));
      const start = tube.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0));
      scene.add(stick);
      await animate(0.7, (k) => { stick.position.copy(start).add(new THREE.Vector3(0, ease(k) * 0.9, ease(k) * 0.5)); stick.rotation.z = k * 0.6; });
      sfx.clack();
      toast(t('lotN', n));
      await wait(0.8);
      scene.remove(stick);
      const { v: c } = await modal(`
        <h2>${t('drew', n)}</h2>
        <p>${t('confirmAsk')}</p>
        <div class="row"><button class="btn primary" data-v="go">${t('confirm')}</button></div>`);
      if (c !== 'go') return;
      const r = [Math.random() < 0.5, Math.random() < 0.5];
      net.act('jiao', r);
      await throwBlocks(me, r);
      await wait(0.4);
      if (jiaoKind(r) === 'sheng') { await showLot(n); return; }
      const { v: re } = await modal(`
        <div class="result">${JIAO[jiaoKind(r)].name}</div>
        <p style="text-align:center">${t('notThis')}${tries >= 3 ? `<br><span class="muted">${t('notToday')}</span>` : ''}</p>
        <div class="row"><button class="btn ghost" data-v="stop">${t('stop')}</button><button class="btn primary" data-v="again">${t('reshake')}</button></div>`);
      if (re !== 'again') return;
      me.play('palms'); await wait(0.8);
    }
  },

  async lamp() {
    const years = [];
    for (let y = 2026; y >= 1930; y--) years.push(`<option value="${y}" ${y === store.get('year', 1990) ? 'selected' : ''}>${y}${EN ? ' (' + zod(branchOf(y)) + ')' : '（' + zod(branchOf(y)) + '）'}</option>`);
    const { v, form } = await modal(`
      <h2>${t('lampTitle')}</h2>
      <p>${t('lampIntro')}</p>
      <label>${t('lampName')}</label><input name="name" maxlength="${EN ? 14 : 8}" placeholder="${t('lampPh')}" value="${esc(store.get('lampName', ''))}">
      <label>${t('birthYear')}</label><select name="year">${years.join('')}</select>
      <div class="row"><button class="btn ghost" data-v="no">${t('no')}</button><button class="btn primary" data-v="go">${t('light')}</button></div>`);
    if (v !== 'go') return;
    const year = +form.year, nm = (form.name || '').trim().slice(0, EN ? 14 : 8) || t('someone');
    store.set('year', year); store.set('lampName', nm);
    const b = branchOf(year), clash = TAISUI_2027[b];
    const slot = freeSlot(), p = lampWorld(slot);
    // walk to the foot of the banyan's terrace, in front of your Buddha's niche, and look at it
    const sa = LW.slots[slot].ang;
    const stand = clampWalk({ x: BANYAN.x + Math.cos(sa) * (BANYAN.r0 + 1.4), z: BANYAN.z + Math.sin(sa) * (BANYAN.r0 + 1.4) });
    await walkTo(stand.x, stand.z, Math.atan2(BANYAN.x - stand.x, BANYAN.z - stand.z));
    const back = new THREE.Vector3(stand.x - BANYAN.x, 0, stand.z - BANYAN.z).normalize();
    director = { pos: new THREE.Vector3(stand.x, 0, stand.z).addScaledVector(back, 2.2).add(new THREE.Vector3(0.8, Math.max(2.2, p.y + 0.8), 0)), look: p.clone(), speed: 1.4 };
    me.play('palms'); await wait(1.2);
    sfx.bell();
    lightSlot(slot, true, nm);
    net.act('lamp', [slot]);
    myLamps.push({ slot, name: nm, year, type: clash ? 'taisui' : 'guangming' }); store.set('lamps', myLamps);
    await wait(1.2);
    const kind = clash ? t('kindTS') : t('kindGM');
    const { v: s } = await modal(`
      <h2>${t('lampLit', esc(nm), kind)}</h2>
      <p>${t('born', zod(b), year)}</p>
      ${clash
        ? `<p><span class="tag">2027 ${clash}</span></p><p>${t('clashText')}</p>`
        : `<p>${t('okText')}</p>`}
      <p class="muted">${t('zodiacNote')}</p>
      <div class="row"><a class="btn primary" href="/?utm_source=temple&utm_medium=lamp" target="_blank" rel="noopener">${t('bazi2027')}</a></div>
      <div class="row"><button class="btn ghost" data-v="share">${t('shareFamily')}</button><button class="btn ghost" data-v="ok">${t('ok')}</button></div>`);
    director = null;                                   // hand the camera back
    if (s === 'share') share(t('shareLamp', nm, kind));
  },
};

async function showLot(n) {
  const lot = LOTS?.[n - 1], en = EN ? LOTS_EN?.[n - 1] : null;
  const poem = lot ? lot.poem.map(esc).join('<br>') : t('poemLoading');
  const grade = en?.grade || lot?.grade;
  const { v } = await modal(`
    <div style="text-align:center"><span class="tag">${t('confirmed')}</span></div>
    <h2 style="text-align:center;margin-top:10px">${t('lotN', n)} ${lot ? esc(lot.gz) : ''} ${grade ? `<span class="tag">${esc(grade)}</span>` : ''}</h2>
    <div class="poem">${poem}</div>
    ${en ? `<p style="font-style:italic;line-height:1.75">${en.poem.map(esc).join('<br>')}</p>` : ''}
    ${(en?.meaning || lot?.meaning) ? `<p>${esc(en?.meaning || lot.meaning)}</p>` : ''}
    <p class="muted">${t('lotNote')}</p>
    <div class="row"><a class="btn primary" href="/?utm_source=temple&utm_medium=qian" target="_blank" rel="noopener">${t('baziLot')}</a></div>
    <div class="row"><button class="btn ghost" data-v="share">${t('sharePoem')}</button><button class="btn ghost" data-v="ok">${t('keep')}</button></div>`);
  if (v === 'share') share(t('shareLot', n, en ? en.poem[0] : lot?.poem[0]));
}

$('#credits').onclick = () => modal(`
  <h2>${EN ? 'Credits' : '鳴謝'}</h2>
  <p class="muted">${EN ? 'Statues, paintings and textures are public-domain (CC0) works from' : '佛像、畫作與材質為公共領域（CC0）作品，來自'} Minneapolis Institute of Art, Cleveland Museum of Art, Poly Haven.</p>
  <p class="muted">${EN ? 'Stone lions, dragon pillars and drum stones' : '石獅、龍柱、抱鼓石'}: "Stone Big Lion 01", "Stone Dragon Pillar 02", "Stone Old Sculpture Drum 01" by zhengzhangxun (Sketchfab), CC BY 4.0.</p>
  <p class="muted">${EN ? 'Offerings' : '供品'}: "Mandarin Scan", "Pineapple Scan" by Franco Pizzani; "White Orchid" by gottalovehana; "Chrystanthemum flower" by Lassi Kaukonen (recoloured) — Sketchfab, CC BY 4.0.</p>
  <p class="muted">${EN ? 'Bamboo' : '竹林'}: "Free Bamboo Set" by JonhGillessen — Sketchfab, CC BY 4.0.</p>
  <p class="muted">${EN ? 'Horizon' : '遠景'}: "Wulingyuan, Zhangjiajie" by chensiyuan — Wikimedia Commons, CC BY-SA 4.0 (contrast lifted, edges faded); ${EN ? 'cliff texture' : '崖壁材質'} — Poly Haven, CC0.</p>
  <p class="muted">${EN ? 'Great tree and banyan leaves' : '古樹與榕樹葉'}: "Island Tree 01"; ${EN ? 'bark and sandstone textures' : '樹皮與砂岩材質'} — Poly Haven, CC0.</p>
  <p class="muted">${EN ? 'Pond' : '放生池'}: "Lilypads" by sligocreatures; "Water Lily, Nymphaea cv." by ffish.asia / floraZia.com; "Koi Fish" by SDPM Esare; "Cattails" by AlkaliDragon — Sketchfab, CC BY 4.0.</p>
  <div class="row"><button class="btn ghost" data-v="ok">${t('ok')}</button></div>`);

document.querySelector('#bar').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b || busy) return;
  sfx.init(); hideHint(); poke();
  setBusy(true);
  try { await ACTS[b.dataset.act](); } finally { setBusy(false); }
});

// ---------------- presence (shared rooms) ----------------
const peers = new Map();
function peerJoin(p) {
  if (peers.has(p.id)) return;
  const pg = new Pilgrim({ name: p.name, color: p.color });
  pg.root.position.set(p.x, groundY(p.x, p.z), p.z); pg.root.rotation.y = p.ry;
  pg.target = { x: p.x, z: p.z, ry: p.ry };
  scene.add(pg.root); peers.set(p.id, pg);
}
function peerLeave(id) {
  const pg = peers.get(id); if (!pg) return;
  scene.remove(pg.root); pg.label?.element.remove(); peers.delete(id);
}
const net = connectPresence(WS_URL, {
  me: () => ({ name: myName, color: myColor, x: me.root.position.x, z: me.root.position.z, ry: me.root.rotation.y }),
  onWelcome({ room, peers: list }) { [...peers.keys()].forEach(peerLeave); list.forEach(peerJoin); $('#room').textContent = t('room', room); },
  onJoin: peerJoin,
  onLeave: peerLeave,
  onPos({ id, x, z, ry }) { const pg = peers.get(id); if (pg) pg.target = { x, z, ry }; },
  onAct({ id, a, r }) {
    const pg = peers.get(id); if (!pg) return;
    if (a === 'jiao' && Array.isArray(r)) throwBlocks(pg, r.slice(0, 2).map(Boolean));
    else if (a === 'lamp' && Array.isArray(r) && LW.slots[r[0]]) { pg.play('palms'); lightSlot(r[0] | 0, false); }
    else if (a === 'incense') { pg.play('incense'); setTimeout(() => plantIncense(3), 3700); }
    else if (a === 'qian') pg.play('shake');
    else if (a === 'kneel') pg.kneel = true;
    else if (a === 'muyu') { pg.mallet.visible = true; strike(pg, Math.max(0.15, 1 - pg.root.position.distanceTo(me.root.position) / 25)); }
    else if (['bai', 'palms'].includes(a)) pg.play(a);
  },
  onCount(n) { $('#count').textContent = `${n}/100`; },
});
function updatePeers(dt) {
  for (const pg of peers.values()) {
    const t = pg.target, pos = pg.root.position;
    const dx = t.x - pos.x, dz = t.z - pos.z, d = Math.hypot(dx, dz);
    if (d > 6) { pos.x = t.x; pos.z = t.z; pg.speed = 0; }
    else {
      const want = Math.min(MAX_SPEED, d * 4);                 // glide to the latest network position
      pg.speed = (pg.speed || 0) + (want - (pg.speed || 0)) * (1 - Math.exp(-dt * 8));
      const s = Math.min(d, pg.speed * dt);
      if (d > 0.001) { pos.x += dx / d * s; pos.z += dz / d * s; }
    }
    pg.walking = pg.speed > 0.25;
    const face = pg.walking ? Math.atan2(dx, dz) : t.ry;
    pg.root.rotation.y += angDiff(face, pg.root.rotation.y) * (1 - Math.exp(-dt * 8));
    pos.y = groundY(pos.x, pos.z) + (pg.kn || 0) * 0.22;
    pg.update(dt);
  }
}

// ---------------- rest mode (like Sansa: idle tabs leave the room) ----------------
let lastInput = performance.now(), hiddenAt = 0, resting = false;
function poke() { lastInput = performance.now(); }
addEventListener('keydown', poke); addEventListener('wheel', poke);
document.addEventListener('visibilitychange', () => { hiddenAt = document.hidden ? performance.now() : 0; });
setInterval(() => {
  const now = performance.now();
  if (!resting && !intro.on && ((hiddenAt && now - hiddenAt > 90000) || now - lastInput > 15 * 60000)) {   // never mid-intro: the clouds would freeze
    resting = true; net.close(); $('#rest').classList.add('on');
  }
}, 5000);
$('#wake').onclick = () => { resting = false; hiddenAt = 0; poke(); $('#rest').classList.remove('on'); net.open(); };

// ---------------- loop ----------------
const clock = new THREE.Clock();
let sendT = 0;
function frame() {
  requestAnimationFrame(frame);
  if (resting) return;
  if (shadowTick++ % (isMobile ? 4 : 3) === 0) renderer.shadowMap.needsUpdate = true;
  const dt = Math.min(clock.getDelta(), 0.05);
  for (const tw of tweens) {
    tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(k);
    if (k >= 1) { tweens.delete(tw); tw.res(); }
  }
  locomotion(dt);
  me.root.position.y = groundY(me.root.position.x, me.root.position.z) + (me.kn || 0) * 0.22 + (me.seatY || 0);
  me.update(dt);
  // camera follows
  followCam(dt, intro.on);           // during the intro: where the camera will end up (snapped), the flight eases toward it
  introTick(dt);
  for (let i = 0; i < benchIcons.length; i++) {               // only from the same side of the gate (labels draw over walls)
    const mp = me.root.position, sameSide = BENCHES[i].look === POND ? mp.z > GATE[1] : mp.z < GATE[0] && mp.z > HALL.front;
    benchIcons[i].visible = !seated && !intro.on && sameSide && Math.hypot(mp.x - BENCHES[i].x, mp.z - BENCHES[i].z) < 16;
  }
  for (const o of lampLabels) o.visible = me.root.position.x > 8 && me.root.position.z > -10 && me.root.position.z < 20;   // from the banyan side of the courtyard

  sendT += dt;
  if (sendT > 0.15) { sendT = 0; net.pos(me.root.position.x, me.root.position.z, me.root.rotation.y); }

  sfx.update(inHall(me.root.position.z), dt, me.root.position);
  // first step into the hall: the camera rises by the doorway and tilts slowly up the statues, so the first thing
  // you see is their whole height. Once per visit; any tap or drag hands the camera back.
  if (reveal.t < 0 && !intro.on && !director && !busy && inHall(me.root.position.z)) {
    reveal.t = 0; director = { pos: new THREE.Vector3(0, F + 3.2, -8.2), look: new THREE.Vector3(0, F + 2.5, -30), speed: 0.9 };
    addEventListener('pointerdown', () => { reveal.t = Math.max(reveal.t, 7.5); }, { once: true });
  }
  if (reveal.t >= 0 && reveal.t < 8) {
    reveal.t += dt;
    const u = THREE.MathUtils.smootherstep(reveal.t, 0.8, 6);
    director.pos.set(0, F + 3.2 + u * 1.6, -8.2 - u * 2.5); director.look.set(0, F + 2.5 + u * 10.5, -30);
    if (reveal.t >= 7.5) { director = null; reveal.t = 8; }
  }
  sfx.chant(me.kneel && me.praying && !seated && !atMuyu, dt);   // kneel, then Pray: the mantra; end the prayer or stand and it fades away
  updatePeers(dt);
  updateSmoke(dt);
  updateSticks();
  updateWisps(dt);
  const t = clock.elapsedTime;
  pondTick?.(dt); lakeTick?.(dt); bodhiTick?.(dt); banyanTick?.(dt); grassTick?.(dt); scenery.tick(dt);
  for (const l of world.lanterns) l.rotation.z = Math.sin(t * 0.8 + l.userData.swing) * 0.04;
  for (const f of flames) {
    const k = 1 + Math.sin(t * 13 + f.seed) * 0.07 + Math.sin(t * 29 + f.seed * 2) * 0.05 + Math.sin(t * 61 + f.seed) * 0.03;
    f.core.scale.set(0.07 * (2 - k), 0.15 * k, 1);
    f.core.position.x = f.base.x + Math.sin(t * 2.3 + f.seed) * 0.004;
    f.glow.material.opacity = 0.7 + (k - 1) * 1.5;
  }
  world.luLight.intensity = 7 + Math.sin(t * 7) * 0.8 + Math.sin(t * 13) * 0.5;
  LW.uT.value = t;                                   // blessed Buddhas shimmer
  // my lamps breathe
  for (const l of myLamps) { LW.cells.setColorAt(l.slot, lampCol.set(0xfff0c0).multiplyScalar(0.9 + Math.sin(t * 2 + l.slot) * 0.1)); }
  if (myLamps.length) LW.cells.instanceColor.needsUpdate = true;

  grade.uniforms.time.value = clock.elapsedTime;
  if (floorMirror) {
    // fade the reflection in/out near the doorway instead of switching it (switching blinks)
    const z = Math.min(me.root.position.z, camera.position.z);
    const u = floorMirror.material.uniforms.mirrorFade;
    u.value += (THREE.MathUtils.smoothstep(-z, 2, 8) - u.value) * (1 - Math.exp(-dt * 4));
    floorMirror.visible = u.value > 0.01;
  }
  composer.render();
  labels.render(scene, camera);
}
frame();
document.fonts?.ready.then(() => {});

// debug handle for testing in the console
// ---------------- light-bake export (dev only: run __temple.exportBake() in the console) ----------------
// role: 'bake' = static surface that gets a lightmap, 'occ' = casts shadows only, 'emit' = glows in the bake, 'skip' = ignored
me.root.userData.role = 'skip'; marker.userData.role = 'skip'; world.tube.userData.role = 'skip';
if (floorMirror) floorMirror.userData.role = 'skip';
world.lanterns.forEach((l) => (l.userData.role = 'emit'));
function bakeRole(o) {
  for (let p = o; p; p = p.parent) {
    if (!p.visible) return null;
    if (p.userData.role) return p.userData.role;
  }
  if (!o.isMesh) return null;
  if (o.isInstancedMesh) return 'occ';
  if (o.material?.isMeshBasicMaterial) return 'emit';
  if (o.geometry?.type === 'TubeGeometry') return 'occ';   // long spirals unwrap into atlas-wide strips
  return 'bake';
}
// fingerprint of the static geometry the bake depends on (tiny/random bits like fortune sticks are ignored)
function geomStamp() {
  const box = new THREE.Box3(), size = new THREE.Vector3(); let n = 0, sum = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.material?.isMeshBasicMaterial || o.geometry?.type === 'TubeGeometry') return;
    let role = null; for (let p = o; p && !role; p = p.parent) role = p.userData.role;   // like bakeRole, but ignores visibility:
    if (role && role !== 'bake') return;                                               // props swap in after load
    box.setFromObject(o); box.getSize(size); if (size.length() < 0.5) return;
    n++; sum += [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].reduce((a, v, i) => a + Math.round(v * 4) * (i + 1), 0);
  });
  return `${n}:${sum}`;
}
async function exportStamp() {
  await fetch('http://127.0.0.1:8817/upload?name=stamp.json', { method: 'POST', body: JSON.stringify({ stamp: geomStamp() }) });
}
async function exportBake() {
  await exportStamp();
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const root = new THREE.Scene(); let i = 0, counts = {};
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || o.parent?.userData.exportClone) return;
    const role = bakeRole(o); if (!role || role === 'skip') return;
    const c = o.isInstancedMesh ? new THREE.InstancedMesh(o.geometry, o.material, o.count) : new THREE.Mesh(o.geometry, o.material);
    if (o.isInstancedMesh) { c.instanceMatrix.copy(o.instanceMatrix); if (o.instanceColor) c.instanceColor = o.instanceColor.clone(); }
    o.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    c.name = `${role}_${i++}`; c.userData = { role };
    counts[role] = (counts[role] || 0) + 1;
    root.add(c);
  });
  const glb = await new GLTFExporter().parseAsync(root, { binary: true, maxTextureSize: 2048 });
  await fetch('http://127.0.0.1:8817/upload?name=static.glb', { method: 'POST', body: glb });
  return { counts, mb: +(glb.byteLength / 1e6).toFixed(1) };
}

// ---------------- baked lighting (Blender lightmaps) ----------------
// The static temple is replaced by the baked copy. Its materials keep live reflections (env + specular)
// but take diffuse light only from the lightmap, so nothing is lit twice.
const LM_GAIN = 3.3 * Math.PI;            // lightmaps are stored as value/4; three divides diffuse by π
// The bake was lit by amber lamps. For a calmer, daylit hall the baked light is pulled toward a neutral white
// (`neutral`, 0..1), lifted a little and given a soft floor so dark corners don't fall below ~15% of the walls.
const LM_LOOK = { hall: { neutral: 0.88, lift: 1.15, floor: 0.22 }, out: { neutral: 0.3, lift: 1.0, floor: 0.0 } };
function bakedMaterial(mat, lm, look = LM_LOOK.out) {
  const m2 = mat.clone();
  m2.lightMap = lm; m2.lightMapIntensity = LM_GAIN; m2.envMapIntensity = 0.5;
  const own = mat.onBeforeCompile, ownKey = own.toString();         // keep the live material's own shader tweaks (e.g. the paving's moss)
  m2.customProgramCacheKey = () => 'baked|' + ownKey;
  m2.onBeforeCompile = (sh) => {
    own(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_maps>',
      `irradiance = vec3(0.0); reflectedLight.directDiffuse = vec3(0.0);
       #include <lights_fragment_maps>
       float lmY = dot(irradiance, vec3(0.2126, 0.7152, 0.0722));
       irradiance = mix(irradiance, vec3(lmY) * vec3(1.0, 0.975, 0.94), ${look.neutral.toFixed(2)}) * ${look.lift.toFixed(2)}
                  + vec3(0.97, 0.98, 1.0) * ${look.floor.toFixed(2)};`);
  };
  m2.customProgramCacheKey = () => 'baked-' + look.neutral + look.floor;
  return m2;
}
const NO_BAKE = new URLSearchParams(location.search).has('nobake');
async function loadBaked() {
  if (NO_BAKE) return;
  const base = '/temple/assets/baked/';
  const [g, ...lms] = await Promise.all([
    gl.loadAsync(base + 'static.glb'),
    ...['hall', 'out'].map((n) => new THREE.TextureLoader().loadAsync(base + `lm_${n}.webp`)),
  ]);
  // never show a bake made from different geometry (e.g. statues floating on old pedestals): fall back to live light
  const stampNow = geomStamp();
  const saved = await fetch(base + 'stamp.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (saved && saved.stamp !== stampNow) { console.warn('baked lighting is out of date for this geometry; using live lighting'); return; }
  const LM = {};
  ['hall', 'out'].forEach((n, i) => { const t = lms[i]; t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.channel = 1; LM[n] = t; });
  const hide = [];
  scene.traverse((o) => { if (o.isMesh && bakeRole(o) === 'bake') hide.push(o); });
  // Each baked copy follows its live twin (matched by position): the twin's current material, and hidden if the twin
  // is hidden. Lightmaps hold light only, so restyling or removing pieces in code needs no rebake.
  const centre = (o) => { o.geometry.computeBoundingBox(); return o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).getCenter(new THREE.Vector3()); };
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const twins = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.material?.isMeshBasicMaterial || o.geometry?.type === 'TubeGeometry') return;
    let role = null; for (let p = o; p && !role; p = p.parent) role = p.userData.role;
    if (!role || role === 'bake') twins.push({ c: centre(o), o, on: shown(o) });
  });
  hide.forEach((o) => (o.visible = false));
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const which = o.userData.lm || o.parent?.userData.lm, c = centre(o);
    let twin = null, best = 0.03;
    for (const t of twins) { const d = t.c.distanceTo(c); if (d < best) { best = d; twin = t; } }
    if (twin) { o.material = twin.o.material; if (!twin.on) o.visible = false; }
    if (LM[which]) o.material = bakedMaterial(o.material, LM[which], LM_LOOK[which]);
    o.castShadow = true; o.receiveShadow = false;
  });
  g.scene.userData.role = 'skip';
  scene.add(g.scene);
}
const bakeDone = loadBaked().catch((e) => console.warn('baked lighting unavailable', e));

// ---------------- intro: you arrive in the clouds; when everything has loaded they part ----------------
// The camera waits high above the approach inside soft clouds, then glides down to its place behind your monk
// at the temple entrance while the clouds drift apart. Nothing is visible until all of it is ready.
const INTRO = { from: new THREE.Vector3(0, 30, 82), look: new THREE.Vector3(0, 6, 20), dur: 7 };
{
  // soft cloud puffs: fractal noise under a round falloff, lit from above (a few variants for variety)
  const puff = (seed) => canvasTex(256, 256, (c, w, h) => {
    let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const G = 9, grid = Array.from({ length: 5 }, (_, o) => { const n = G << o; return Array.from({ length: (n + 1) * (n + 1) }, rnd); });
    const noise = (x, y) => {
      let v = 0, a = 0.5;
      for (let o = 0; o < 5; o++) {
        const n = G << o, gx = x * n, gy = y * n, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, g = grid[o];
        const at = (i, j) => g[Math.min(n, j) * (n + 1) + Math.min(n, i)], sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        v += a * ((at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy); a *= 0.5;
      }
      return v;
    };
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h, r = Math.hypot(u - 0.5, (v - 0.55) * 1.25) * 2;
      const fall = Math.max(0, 1 - r * r) ** 1.5, d = noise(u, v);
      const a = Math.min(1, Math.max(0, (d * 1.4 - 0.45) * 2.6) * fall), shade = 0.52 + 0.48 * (1 - v) ** 1.2 + (d - 0.5) * 0.2;   // sunlit tops, blue-grey bellies
      const i = (y * w + x) * 4; img.data[i] = 255 * shade; img.data[i + 1] = 252 * shade; img.data[i + 2] = 246 * Math.min(1, shade + 0.06); img.data[i + 3] = 255 * a;
    }
    c.putImageData(img, 0, 0);
  });
  const maps = [puff(11), puff(29), puff(47)];
  let s = 99; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const group = new THREE.Group(); group.userData.role = 'skip';
  const dir = INTRO.look.clone().sub(INTRO.from).normalize(), side = new THREE.Vector3(1, 0, 0), up = side.clone().cross(dir).normalize();
  const n = isMobile ? 55 : 85;                                        // fewer, bigger puffs: same bank, far less overdraw
  for (let i = 0; i < n; i++) {
    const mat = new THREE.SpriteMaterial({ map: maps[i % 3], transparent: true, depthWrite: false, fog: false, opacity: 0.6 + rnd() * 0.35 });
    const sp = new THREE.Sprite(mat);
    // a thick bank ahead of the camera (it hides the world while it loads), thinner further down the flight path
    const along = i < n * 0.55 ? 7 + rnd() * 18 : 22 + rnd() * 45;      // a layered bank: separate puffs, no gaps through it
    const spread = 2.5 + along * 0.5;
    const p = INTRO.from.clone().addScaledVector(dir, along).addScaledVector(side, (rnd() - 0.5) * 2 * spread).addScaledVector(up, (rnd() - 0.5) * 1.4 * spread);
    sp.position.copy(p); sp.scale.setScalar((4 + rnd() * 6 + along * 0.2) * 1.25);
    mat.rotation = rnd() * 6.28;
    sp.userData = { p0: p.clone(), side: Math.sign(p.x - INTRO.from.x) || (rnd() < 0.5 ? -1 : 1), o0: mat.opacity, drift: rnd() * 6.28 };
    sp.renderOrder = 10;
    group.add(sp);
  }
  scene.add(group); noReflect.add(group);                             // the water needn't mirror the clouds
  intro.clouds = group;
}
let introLook = new THREE.Vector3();
function introTick(dt) {
  if (!intro.on || !intro.clouds) return;           // the first frame runs before the clouds are built
  const t = clock.elapsedTime;
  if (intro.parting) intro.k = Math.min(1, intro.k + dt / INTRO.dur);
  const k = intro.k, e = k * k * k * (k * (6 * k - 15) + 10);          // smootherstep: a slow start and a soft landing
  // clouds drift while you wait; as they part each one slides off to its side and thins away
  for (const c of intro.clouds.children) {
    const u = c.userData, open = Math.min(1, k * 1.6) ** 1.6;
    c.position.copy(u.p0);
    c.position.x += Math.sin(t * 0.12 + u.drift) * 3 + t * 0.25 * u.side + u.side * open * (30 + Math.abs(u.p0.x - INTRO.from.x));   // a slow, visible drift
    c.position.y += Math.sin(t * 0.09 + u.drift) * 0.8 + open * 6;
    c.material.rotation += dt * 0.01 * u.side;
    c.material.opacity = u.o0 * (1 - THREE.MathUtils.smoothstep(k, 0.35, 0.85));
  }
  // camera: from the sky to where the follow camera is this frame (followCam ran just before, snapped)
  const target = camera.position.clone(), look = camLook.clone();
  const sway = new THREE.Vector3(Math.sin(t * 0.11) * 1.2, Math.sin(t * 0.09) * 0.5, 0).multiplyScalar(1 - e);
  camera.position.lerpVectors(INTRO.from, target, e).add(sway);
  introLook.lerpVectors(INTRO.look, look, e);
  camera.lookAt(introLook);
  if (k >= 1) {
    intro.on = false;
    scene.remove(intro.clouds); noReflect.delete(intro.clouds); intro.clouds.children.forEach((c) => c.material.dispose());
    document.body.classList.remove('intro');
    $('#intro')?.remove();
  }
}

// Wait until no loader has been busy for half a second (loads chain: a model's callback can start another),
// plus the baked lighting swap, then compile every shader so nothing hitches as the clouds part.
async function partClouds() {
  const quiet = () => new Promise((res) => {
    const tick = () => (loadState.total && loadState.done >= loadState.total ? setTimeout(() => (loadState.done >= loadState.total ? res() : tick()), 500) : setTimeout(tick, 150));
    tick();
  });
  const loaded = Promise.race([Promise.all([quiet(), bakeDone]).then(quiet), new Promise((res) => setTimeout(res, 30000))]);   // never stuck loading
  // you part the clouds yourself: the click is also what lets the browser start the ambient sound
  // the Enter click is caught by a tiny script in the page (it may come before this module has loaded)
  const entered = window.__enter.then(() => {
    sfx.on = true; store.set('sound', true); $('#sound').textContent = '🔈';
    sfx.init(); sfx.ctx.resume?.(); sfx.master.gain.value = 1;
  });
  // loading screen: the doors stay shut until every file has arrived and every shader is compiled
  await loaded;
  try { await renderer.compileAsync(scene, camera); } catch {}
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  $('#gateBar').style.width = '100%'; $('#gatePct').textContent = '100%';
  document.querySelectorAll('.enterBtn').forEach((b) => { b.disabled = false; });
  $('#intro').classList.add('ready');
  $(EN ? '#enterEn' : '#enter').focus({ preventScroll: true });   // Enter / Space work too
  await entered;
  intro.parting = true;
  $('#intro').classList.add('out');
}
partClouds();

window.__temple = { sitBench, sfx, geomStamp, exportStamp, composer, get floorMirror() { return floorMirror; }, exportBake, me, walkTo, ACTS, peers, scene, camera, controls, renderer };
