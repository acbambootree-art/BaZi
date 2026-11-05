import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildWorld, canvasTex, HALL, flames } from './scene.js';
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
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { connectPresence } from './presence.js';

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
  enter: ['入 廟', 'Enter the temple'],
  endPray: ['結束', 'End prayer'],
  praying: ['雙手合十，靜靜祈禱。想結束時按「結束」或走開就好', 'Palms together. Pray as long as you like. Tap End prayer or walk away to finish.'],
  rest: ['你在廟裡歇著', 'You are resting in the temple'],
  wake: ['回到廟裡', 'Come back in'],
  acts: [['拜拜', '坐下', '上香', '擲筊', '求籤', '點燈', '木魚'], ['Pray', 'Kneel', 'Incense', 'Blocks', 'Fortune', 'Lamp', 'Muyu']],
  muyuHint: ['再點「木魚」或按空白鍵，敲一聲', 'Tap Muyu again (or press Space) to strike'],
  kneel: ['跪在拜墊上，靜靜待一會兒', 'Kneeling on the cushion. Stay as long as you like.'],
  bench: ['坐在池邊，看看水、看看魚。想走時動一下就好', 'Sitting by the pond. Watch the water and the koi. Move whenever you like to get up.'],
  toBurner: ['走到天公爐前…', 'Walking to the Heaven burner…'],
  incenseDone: [(n) => `香已插上，心意神明收到了（第 ${n} 炷）`, (n) => `Your incense is offered. The gods received it (stick no. ${n}).`],
  copied: ['已複製，貼給朋友吧', 'Link copied. Paste it to a friend.'],
  myLamp: ['我的燈', 'My lamp'],
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
  lampTitle: ['點一盞燈', 'Light a lamp'],
  lampIntro: ['為自己或家人點一盞燈，祈求 2027 丁未年光明平安。', 'Light a lamp for yourself or family, for a bright and peaceful 2027, Year of the Fire Goat.'],
  lampName: ['燈上的名字（可以只寫暱稱）', 'Name on the lamp (a nickname is fine)'],
  lampPh: ['例如：阿嬤、小明', 'e.g. Grandma, Ming'],
  birthYear: ['出生年（國曆生日在 2/4 立春前，請選前一年）', 'Birth year (born before Feb 4? pick the year before; that is when the zodiac year begins)'],
  light: ['點燈', 'Light it'],
  someone: ['有緣人', 'A friend'],
  kindGM: ['光明燈', 'Brightness Lamp 光明燈'],
  kindTS: ['太歲燈', 'Tai Sui Lamp 太歲燈'],
  lampLit: [(nm, k) => `${nm} 的${k}亮了`, (nm, k) => `${nm}'s ${k} is lit`],
  born: [(z, y) => `屬${z}・${y} 年生`, (z, y) => `Year of the ${z} · born ${y}`],
  clashText: ['丁未羊年你犯太歲，傳統會點太歲燈、安太歲，求一年平穩。變動多的年份，重要決定慢一點做。',
    'In 2027, the Year of the Fire Goat, your sign clashes with Tai Sui, the god of the year. Tradition is to light a Tai Sui lamp for a steady year. Expect change, and take big decisions slowly.'],
  okText: ['2027 丁未年你沒有犯太歲。點光明燈，祈求一年前途光明、諸事順利。',
    'Your sign does not clash with Tai Sui in 2027. A Brightness Lamp asks for a clear road and smooth year.'],
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
$('#enter').textContent = t('enter');
const intro = { on: true, parting: false, k: 0 };          // the cloud intro (built further down)
// every three.js loader reports to the default manager: the gates stay shut until all of it has arrived
const loadState = { done: 0, total: 0, idle: null };
THREE.DefaultLoadingManager.onProgress = (url, done, total) => {
  loadState.done = done; loadState.total = total;
  if (!intro.on) { (window.__lateLoads ||= []).push(url); return; }
  $('#gateBar').style.width = Math.max(parseFloat($('#gateBar').style.width) || 0, (done / total) * 92) + '%';   // never runs backwards
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
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.75 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
new THREE.TextureLoader().load('/temple/assets/sky.jpg', (t) => {
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t; scene.backgroundIntensity = 0.9;
});

const fovFor = (a) => (a < 0.8 ? 66 : 50); // wider lens on portrait phones
const camera = new THREE.PerspectiveCamera(fovFor(innerWidth / innerHeight), innerWidth / innerHeight, 0.1, 400);
// glow on lanterns, candles and lamps
const DBG = new URLSearchParams(location.search);   // ?nomsaa ?nomirror ?noao for performance checks
// multisampled target: post-processing otherwise drops the canvas MSAA and thin edges shimmer as you move
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(
  innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio(),
  { type: THREE.HalfFloatType, samples: DBG.has('nomsaa') ? 0 : isMobile ? 2 : 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight).multiplyScalar(isMobile ? 0.5 : 1), 0.1, 0.4, 0.98);   // barely any glow: halos read as glare, not calm
const HQ = !isMobile;
// (no screen-space AO: the baked lighting already has soft contact shadows, and AO crawled as you moved)
composer.addPass(bloom);
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
if (HQ && !DBG.has('nomirror')) {
  const fl = scene.getObjectByName('hallFloor');
  const p = fl.geometry.parameters;
  floorMirror = new Reflector(new THREE.PlaneGeometry(p.width, p.height), {
    textureWidth: innerWidth / 2, textureHeight: innerHeight / 2, clipBias: 0.003, multisample: 0,
  });
  floorMirror.material.transparent = true;
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
function placeScan(gltfScene, slot, height, yaw) {
  const m = gltfScene;
  m.rotation.y = yaw;
  m.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
  m.scale.multiplyScalar(height / size.y);
  m.updateMatrixWorld(true);
  box.setFromObject(m);
  const c = box.getCenter(new THREE.Vector3());
  const base = slot.position;                        // deity group sits on the dais; its throne is 0.9*scale tall
  m.position.add(new THREE.Vector3(base.x - c.x, base.y + slot.scale.y * 0.9 - box.min.y, base.z + 0.2 - c.z));
  m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.envMapIntensity = 1.4; } });
  m.userData.role = 'occ';
  slot.parent.add(m);
  // keep the procedural pedestal, hide the procedural figure and its backrest
  slot.children.forEach((ch, i) => { if (i > 0) ch.visible = false; });
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
    let detail = null;
    if (src) {
      const c = document.createElement('canvas'), w = Math.min(1024, src.width), h = Math.min(1024, src.height);
      c.width = w; c.height = h;
      const g = c.getContext('2d'); g.drawImage(src, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        const l = (0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]) / 255;
        const v = Math.round(255 * (0.6 + 0.4 * Math.pow(l, 0.55)));
        p[i] = p[i + 1] = p[i + 2] = v;
      }
      g.putImageData(d, 0, 0);
      detail = new THREE.CanvasTexture(c); detail.colorSpace = THREE.SRGBColorSpace; detail.flipY = o.material.map.flipY;
    }
    o.material = new THREE.MeshPhysicalMaterial({ color: 0xf0b545, map: detail, metalness: 1, roughness: 0.24, clearcoat: 0.35, clearcoatRoughness: 0.2, envMapIntensity: 1.5 });
  });
}

// ---- precious stones set on the carved crown, necklace and belt (found by casting rays onto the scan) ----
const GEM_GEO = new THREE.IcosahedronGeometry(1, 0).scale(1, 1, 0.55);
const BEZEL_GEO = new THREE.TorusGeometry(1.05, 0.2, 6, 18);
const GEM = {
  ruby: new THREE.MeshPhysicalMaterial({ color: 0xc8102e, roughness: 0.06, clearcoat: 1, emissive: 0x3a0008, envMapIntensity: 2.2 }),
  emerald: new THREE.MeshPhysicalMaterial({ color: 0x0f9a5a, roughness: 0.06, clearcoat: 1, emissive: 0x022a14, envMapIntensity: 2.2 }),
  sapphire: new THREE.MeshPhysicalMaterial({ color: 0x1f3fc4, roughness: 0.06, clearcoat: 1, emissive: 0x050c33, envMapIntensity: 2.2 }),
  pearl: new THREE.MeshPhysicalMaterial({ color: 0xf4eee2, roughness: 0.28, clearcoat: 1, sheen: 1, envMapIntensity: 1.6 }),
};
const BEZEL = new THREE.MeshPhysicalMaterial({ color: 0xf0b545, metalness: 1, roughness: 0.2, envMapIntensity: 1.5 });
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
const mandorlaTex = canvasTex(512, 640, (c, w, h) => {
  const path = () => { c.beginPath(); c.moveTo(w / 2, 6); c.bezierCurveTo(w * 0.98, h * 0.18, w * 0.99, h * 0.85, w / 2, h - 4); c.bezierCurveTo(w * 0.01, h * 0.85, w * 0.02, h * 0.18, w / 2, 6); };
  c.save(); path(); c.clip();
  const g = c.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.5, h * 0.55);
  g.addColorStop(0, 'rgba(255,236,170,0.95)'); g.addColorStop(0.45, 'rgba(255,190,80,0.55)'); g.addColorStop(1, 'rgba(255,140,30,0.05)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(255,230,160,0.35)'; c.lineWidth = 2;
  for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; c.beginPath(); c.moveTo(w / 2, h * 0.55); c.lineTo(w / 2 + Math.cos(a) * h, h * 0.55 + Math.sin(a) * h); c.stroke(); }
  c.restore();
  c.strokeStyle = 'rgba(255,215,120,0.9)'; c.lineWidth = 10; path(); c.stroke();             // gilded rim
  c.strokeStyle = 'rgba(255,160,60,0.6)'; c.lineWidth = 22; c.setLineDash([18, 14]); path(); c.stroke();   // flame tongues
});
const haloTex = canvasTex(256, 256, (c, w) => {
  const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,250,220,0.9)'); g.addColorStop(0.55, 'rgba(255,214,120,0.6)'); g.addColorStop(0.8, 'rgba(255,190,80,0.85)'); g.addColorStop(0.86, 'rgba(255,170,60,0.2)'); g.addColorStop(1, 'rgba(255,150,40,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, w);
});
function backlight(root) {
  const box = new THREE.Box3().setFromObject(root), H = box.max.y - box.min.y, W = box.max.x - box.min.x;
  const cx = (box.min.x + box.max.x) / 2, z = box.min.z + (box.max.z - box.min.z) * 0.18;
  const mat = (map, opacity) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const body = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.25, H * 1.08), mat(mandorlaTex, 0.75));
  body.position.set(cx, box.min.y + H * 0.56, z);
  if (!DEITY || H > DEITY.top - DEITY.base) DEITY = { x: cx, z: (box.min.z + box.max.z) / 2, base: box.min.y, top: box.min.y + H * 1.1, halfW: W * 0.63 };
  const head = new THREE.Mesh(new THREE.CircleGeometry(W * 0.3, 48), mat(haloTex, 0.9));
  head.position.set(cx, box.min.y + H * 0.86, z + 0.02);
  body.userData.role = head.userData.role = 'skip';
  scene.add(body, head);
}
const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// missing file → keep the procedural statues
gl.load(STATUE.url, (g) => placeScan(g.scene, world.altar.center, 9.0, STATUE.yaw), undefined, () => {});   // towering over the hall
gl.load('/temple/assets/statue_side.glb', (g) => {
  world.altar.sides.forEach((s, i) => {
    const m = i ? g.scene : g.scene.clone(true);
    if (!i) m.scale.x = -1;                           // mirror the left one so both lean toward the centre
    placeScan(m, s, 6.2, 0);
  });
}, undefined, () => {});

// ---------------- photoscanned props (replace the code-built stand-ins once loaded) ----------------
function placeProp(src, { x, y = 0, z, h, yaw = 0, mirror = false }) {
  const m = src.clone(true);
  m.rotation.y = yaw; if (mirror) m.scale.x = -1;
  m.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
  m.scale.multiplyScalar(h / size.y);
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
    placeProp(g.scene, { x: s.x, y: s.y, z: s.z, h: s.h, yaw: -Math.PI / 2, mirror: s.x < 0 });
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
gl.load('/temple/assets/env/broadleaf.glb', (g) => {
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
  const keep = spots.filter(([x, z]) => !inPond(x, z, 1.6) && Math.hypot(x - 13, z - 31) > 2.5 && Math.hypot(x + 12, z - 30) > 2.5);
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

// ---------------- 放生池: a stone-edged lotus pond on the plaza, right of the approach ----------------
const POND = { x: 11.6, z: 34.0, rx: 4.3, rz: 2.5, y: 0.3 };
const pondK = (a) => 1 + 0.07 * Math.sin(3 * a + 1.3) + 0.04 * Math.sin(5 * a + 0.4);           // organic, not an ellipse
const pondAt = (a, k = 1) => [POND.x + Math.cos(a) * POND.rx * pondK(a) * k, POND.z + Math.sin(a) * POND.rz * pondK(a) * k];
const inPond = (x, z, k = 1) => { const a = Math.atan2((z - POND.z) / POND.rz, (x - POND.x) / POND.rx), K = pondK(a) * k; return ((x - POND.x) / (POND.rx * K)) ** 2 + ((z - POND.z) / (POND.rz * K)) ** 2 < 1; };
let pondTick = null, pondBank = null;
const KOI_YAW = Math.PI / 2;    // the koi model's head points along -x (tall tail fin at +x)
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
  water.material.uniforms.size.value = 6;
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
  // koi: each swims a slow loop under the surface; the body flexes in a travelling wave (vertex shader), tail most
  gl.load(PD + 'koi.glb', (g) => {
    const flex = { value: 0 };
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.onBeforeCompile = (sh) => {
        sh.uniforms.uFlex = flex;
        sh.vertexShader = 'uniform float uFlex;\n' + sh.vertexShader.replace('#include <begin_vertex>',
          `#include <begin_vertex>
           float along = clamp((transformed.x + 0.45) / 0.95, 0.0, 1.0);            // 0 head .. 1 tail
           transformed.z += sin(uFlex * 6.0 - along * 5.0) * 0.06 * along * along;`);
      };
    });
    const fish = [];
    for (let i = 0; i < 5; i++) {
      const f = put(g.scene, 0.4 + (i % 3) * 0.06, POND.x, 0.06 + (i % 2) * 0.03, POND.z);   // the pond is ~27 cm deep: stay under
      fish.push({ f, ph: i * 1.27, sp: 0.09 + i * 0.012, ru: 0.55 - (i % 3) * 0.12, rv: 0.5 - (i % 2) * 0.12, dir: i % 2 ? 1 : -1 });
    }
    let T = 0;
    ticks.push((dt) => {
      T += dt; flex.value = T;
      for (const k of fish) {
        const a = T * k.sp * k.dir + k.ph, w = 1 + 0.15 * Math.sin(T * 0.3 + k.ph);
        const x = POND.x + Math.cos(a) * POND.rx * k.ru * w, z = POND.z + Math.sin(a) * POND.rz * k.rv * w;
        const dx = x - k.f.position.x, dz = z - k.f.position.z;
        if (dx || dz) k.f.rotation.y = Math.atan2(dx, dz) + KOI_YAW;
        k.f.position.x = x; k.f.position.z = z;
      }
    });
  }, undefined, () => {});
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
      im.castShadow = im.receiveShadow = true; im.userData.role = 'skip';
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
    const m = parts[0].mat; pondBank.material = new THREE.MeshStandardMaterial({ map: m.map, normalMap: m.normalMap, roughness: 1, color: 0x9a9a90 });
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
const BENCHES = [-1.9, 2.55].map((a) => {
  const [x, z] = pondAt(a, 1.5);
  return { x, z, yaw: Math.atan2(POND.x - x, POND.z - z) };     // facing the middle of the pond
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
// over-the-shoulder view across the pond, breathing very slowly
function pondView(t) {
  if (!seated) return null;
  if (me.walking) { seated = null; me.seatY = 0; return null; }      // got up
  const b = seated, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), rx = fz, rz = -fx;
  const pos = new THREE.Vector3(b.x - fx * 2.8 + rx * 1.1 + Math.sin(t * 0.07) * 0.25, 2.35 + Math.sin(t * 0.05) * 0.06, b.z - fz * 2.8 + rz * 1.1);
  const look = new THREE.Vector3(POND.x + Math.sin(t * 0.04) * 0.8, POND.y - 0.6, POND.z + 0.4);
  return { pos, look };
}

function scatter(url, count, place, scaleRange, role = 'skip') {
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
      im.castShadow = true; im.receiveShadow = true; im.userData.role = role;
      scene.add(im);
    });
  }, undefined, () => {});
}
const outsideWalls = (rnd) => {
  const x = (rnd() - 0.5) * 120, z = -90 + rnd() * 150;
  if (Math.abs(x) < 21 && z > -40 && z < 20) return null;            // temple
  if (Math.abs(x) < 5 && z > 20) return null;                        // keep the approach path clear
  if (inPond(x, z, 1.4)) return null;
  return [x, z];
};
scatter('/temple/assets/env/fern.glb', 260, outsideWalls, [0.8, 1.6]);
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
const SFX_FILES = { muyu: 'muyu', bowl: 'bowl', clack1: 'clack1', clack2: 'clack2', sticks: 'sticks', birds: 'birds_stream' };
const sfx = {
  ctx: null, on: store.get('sound', true), buf: {},
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.on ? 1 : 0;
    this.master.connect(this.ctx.destination);
    // ambience bus: louder and open outdoors, softer and muffled inside the hall
    this.ambLP = this.ctx.createBiquadFilter(); this.ambLP.type = 'lowpass'; this.ambLP.frequency.value = 18000;
    this.ambGain = this.ctx.createGain(); this.ambGain.gain.value = 0;
    this.ambLP.connect(this.ambGain).connect(this.master);
    for (const [k, f] of Object.entries(SFX_FILES)) {
      fetch(`/temple/assets/sfx/${f}.mp3`).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b))
        .then((buf) => { this.buf[k] = buf; if (k === 'birds') this.ambient(); }).catch(() => {});
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
  // called every frame: birds fade a little and turn muffled once you're inside the hall
  update(inside, dt) {
    if (!this.ctx) return;
    const k = 1 - Math.exp(-dt * 1.5);
    this.ambGain.gain.value += ((inside ? 0.07 : 0.18) - this.ambGain.gain.value) * k;   // a quiet bed under everything, not a soundtrack
    this.ambLP.frequency.value += ((inside ? 1400 : 18000) - this.ambLP.frequency.value) * k;
  },
};
$('#sound').textContent = sfx.on ? '🔈' : '🔇';
$('#sound').onclick = () => { sfx.init(); sfx.toggle(); };
addEventListener('pointerdown', () => { sfx.init(); if (sfx.ctx.state === 'suspended') sfx.ctx.resume(); }, { once: false });

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
function plantIncense(n = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.55;
    const g = jossStick();
    g.position.set(world.luPos.x + Math.cos(a) * r, world.luPos.y, world.luPos.z + Math.sin(a) * r);
    g.rotation.set((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2);
    g.userData.born = performance.now();
    scene.add(g); sticks.push(g);
  }
  while (sticks.length > 90) scene.remove(sticks.shift());
  luSmoke.rate = Math.min(14, 2.5 + sticks.length * 0.35);
}
function updateSticks() {
  const now = performance.now();
  for (let i = sticks.length - 1; i >= 0; i--) {
    const k = (now - sticks[i].userData.born) / 180000;
    if (k >= 1) { scene.remove(sticks[i]); sticks.splice(i, 1); continue; }
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
    this.skirt.add(lathe([[0, 0.02], [0.3, 0.02], [0.33, 0.06], [0.3, 0.2], [0.25, 0.36], [0, 0.36]], robe));
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
      const sleeve = M(new THREE.CylinderGeometry(0.06, 0.1, 0.17, 12, 1, true), robe, 0, -0.085, 0);
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
    const spd = this.speed ?? (this.walking ? 3 : 0);
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
    this.spine.position.y = 0.34 - this.kn * 0.16;
    this.feet.forEach((f, i) => { f.position.z = 0.16 + Math.sin(ph + i * Math.PI) * 0.07 * w - this.kn * 0.3; f.visible = this.kn < 0.6; });
  }
  get handPos() {
    return this.root.localToWorld(new THREE.Vector3(0, 0.95, 0.4));
  }
}

// ---------------- walkable area ----------------
// outside plaza (z>24.5) → gate door bays → courtyard → stairs → hall floor (y = HALL.floor)
const F = HALL.floor, DOORS = [-6, 0, 6], GATE = [19.4, 24.6];
const OBSTACLES = [
  [0, 8, 2.4],                                                         // 天公爐 (planPath relies on index 0)
  ...[-11, -5.5, 5.5, 11].flatMap((x) => [-8, -14].filter((z) => z === -8 || Math.abs(x) > 8).map((z) => [x, z, z === -8 && Math.abs(x) < 6 ? 1.35 : 0.8])),   // scanned dragon pillars have wide bases; no columns nearer the altar
  ...[-10, -7.4, -4.6, -1.6, 1.6, 4.6, 7.4, 10].map((x) => [x, 24.2, Math.abs(x) < 2 ? 0.7 : 0.5]),
  [-12, 30, 1.3], [13, 31, 1.1], [-13.5, 12, 1.1],
  [13.5, -2, 0.8],
  [3.0, -25.6, 0.5],                                                   // 木魚
  [-3.1, 26.2, 1.1], [3.1, 26.2, 1.1],                                  // stone lions
  ...[28, 33].flatMap((z) => [[-6, z, 0.3], [6, z, 0.3]]),
];
BENCHES.forEach((b) => OBSTACLES.push([b.x, b.z, 0.6]));            // you walk round the pond benches, not through them
const inHall = (z) => z < HALL.front;
const nearestDoor = (x) => DOORS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
function clampWalk(p) {
  const C = THREE.MathUtils.clamp;
  if (p.z < -4.5) { p.x = C(p.x, -14.3, 14.3); p.z = Math.max(p.z, Math.abs(p.x) < 5 ? -26 : -27.6); }
  else if (p.z <= GATE[0]) p.x = C(p.x, -15.6, 15.6);
  else if (p.z < GATE[1]) { const d = nearestDoor(p.x); p.x = C(p.x, d - 1.05, d + 1.05); }
  else { p.x = C(p.x, -18, 18); p.z = Math.min(p.z, 37); }
  for (const [ox, oz, r] of OBSTACLES) {
    const dx = p.x - ox, dz = p.z - oz, d = Math.hypot(dx, dz);
    if (d < r && d > 1e-4) { p.x = ox + dx / d * r; p.z = oz + dz / d * r; }
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
function planPath(from, to) {
  const a = { x: from.x, z: from.z }, pts = [];
  const side = (z) => (z >= GATE[1] ? 1 : z <= GATE[0] ? -1 : 0);
  const sa = side(a.z), sb = side(to.z);
  if (sa !== sb) {                                     // pass through the nearest gate door
    const d = nearestDoor((a.x + to.x) / 2);
    const out = { x: d, z: GATE[1] + 0.6 }, inn = { x: d, z: GATE[0] - 0.6 };
    if (sa >= 0 && sb <= 0) pts.push(...(sa === 1 ? [out] : []), inn);
    else pts.push(...(sa === -1 ? [inn] : []), out);
  }
  pts.push({ x: to.x, z: to.z });
  // go around the big burner instead of through it
  const res = [];
  let prev = a;
  for (const p of pts) {
    const [cx, cz, r] = OBSTACLES[0];
    const dx = p.x - prev.x, dz = p.z - prev.z, L2 = dx * dx + dz * dz || 1;
    const t = THREE.MathUtils.clamp(((cx - prev.x) * dx + (cz - prev.z) * dz) / L2, 0, 1);
    if (Math.hypot(prev.x + dx * t - cx, prev.z + dz * t - cz) < r + 0.2) {
      const s = Math.sign(prev.x + p.x) || 1;
      res.push({ x: cx + s * (r + 0.8), z: cz + (prev.z > cz ? 1.4 : -1.4) }, { x: cx + s * (r + 0.8), z: cz + (p.z > cz ? 1.4 : -1.4) });
    }
    res.push(p); prev = p;
  }
  return res;
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
  path = planPath(me.root.position, t);
  return new Promise((res) => { arrive = () => { if (faceRy !== undefined) turnTo(faceRy); res(); }; });
}
async function turnTo(ry) {
  const from = me.root.rotation.y;
  let d = ((ry - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  await animate(0.35, (k) => { me.root.rotation.y = from + d * ease(k); });
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
  } else if (path.length) {
    const p = path[0], dx = p.x - pos.x, dz = p.z - pos.z, d = Math.hypot(dx, dz), last = path.length === 1;
    if (last && d < 0.05) {
      pos.x = p.x; pos.z = p.z; path.shift(); loco.vx = loco.vz = 0;
      const a = arrive; arrive = null; a?.();
    } else if (!last && d < 0.45) path.shift();               // round corners instead of stopping at them
    else {
      const s = MAX_SPEED * (last ? Math.min(1, 0.25 + d / 1.1) : 1);   // ease in to the stop
      wx = dx / d * s; wz = dz / d * s;
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
    if (!manual && path.length && loco.speed > 0.15) me.root.rotation.y   // face the way tap-to-walk goes; never spin round after backing up += angDiff(Math.atan2(loco.vx, loco.vz), me.root.rotation.y) * (1 - Math.exp(-dt * 9));
  }
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
  if (frame) {
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
  for (let d = 2.2; d <= 9; d += 0.3) {                                  // nearest spot behind you that fits it all
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

// ---------------- lamps ----------------
const LW = world.lamps;
const lampLabels = [];
const myLamps = store.get('lamps', []);
const lampCol = new THREE.Color();
function lightSlot(i, mine, name) {
  LW.slots[i].lit = true; LW.slots[i].mine = mine;
  LW.cells.setColorAt(i, lampCol.set(mine ? 0xffffff : 0xffe2b8));
  LW.cells.instanceColor.needsUpdate = true;
  if (mine) {
    const tag = document.createElement('div');
    tag.className = 'nametag'; tag.textContent = '🏮 ' + (name || t('myLamp'));
    const o = new CSS2DObject(tag);
    lampLabels.push(o);
    o.position.copy(lampWorld(i)).add(new THREE.Vector3(-LW.slots[i].side * 0.2, 0.38, 0));
    scene.add(o);
  }
}
function freeSlot() {
  const free = LW.slots.map((s, i) => (!s.lit ? i : -1)).filter((i) => i >= 0);
  if (!free.length) { const i = Math.random() * LW.slots.length | 0; return i; }
  const eye = (i) => Math.abs(LW.slots[i].pos.y - (F + 2.4)) + Math.random() * 0.8;
  free.sort((a, b) => eye(a) - eye(b));
  return free[Math.random() * Math.min(12, free.length) | 0];
}
const lampWorld = (i) => LW.slots[i].pos.clone();
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
    plantIncense(3);
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
    const side = LW.slots[slot].side, lz = THREE.MathUtils.clamp(p.z, -27, -10);
    SHOTS.lamp(side, lz);
    await walkTo(p.x - side * 1.5, lz, side * Math.PI / 2);
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
  if (!resting && ((hiddenAt && now - hiddenAt > 90000) || now - lastInput > 15 * 60000)) {
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
  for (const o of lampLabels) o.visible = inHall(me.root.position.z);

  sendT += dt;
  if (sendT > 0.15) { sendT = 0; net.pos(me.root.position.x, me.root.position.z, me.root.rotation.y); }

  sfx.update(inHall(me.root.position.z), dt);
  updatePeers(dt);
  updateSmoke(dt);
  updateSticks();
  updateWisps(dt);
  const t = clock.elapsedTime;
  pondTick?.(dt);
  for (const l of world.lanterns) l.rotation.z = Math.sin(t * 0.8 + l.userData.swing) * 0.04;
  for (const f of flames) {
    const k = 1 + Math.sin(t * 13 + f.seed) * 0.07 + Math.sin(t * 29 + f.seed * 2) * 0.05 + Math.sin(t * 61 + f.seed) * 0.03;
    f.core.scale.set(0.07 * (2 - k), 0.15 * k, 1);
    f.core.position.x = f.base.x + Math.sin(t * 2.3 + f.seed) * 0.004;
    f.glow.material.opacity = 0.7 + (k - 1) * 1.5;
  }
  world.luLight.intensity = 7 + Math.sin(t * 7) * 0.8 + Math.sin(t * 13) * 0.5;
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
  m2.onBeforeCompile = (sh) => {
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
  const n = isMobile ? 90 : 150;
  for (let i = 0; i < n; i++) {
    const mat = new THREE.SpriteMaterial({ map: maps[i % 3], transparent: true, depthWrite: false, fog: false, opacity: 0.5 + rnd() * 0.35 });
    const sp = new THREE.Sprite(mat);
    // a thick bank ahead of the camera (it hides the world while it loads), thinner further down the flight path
    const along = i < n * 0.55 ? 7 + rnd() * 18 : 22 + rnd() * 45;      // a layered bank: separate puffs, no gaps through it
    const spread = 2.5 + along * 0.5;
    const p = INTRO.from.clone().addScaledVector(dir, along).addScaledVector(side, (rnd() - 0.5) * 2 * spread).addScaledVector(up, (rnd() - 0.5) * 1.4 * spread);
    sp.position.copy(p); sp.scale.setScalar(4 + rnd() * 6 + along * 0.2);
    mat.rotation = rnd() * 6.28;
    sp.userData = { p0: p.clone(), side: Math.sign(p.x - INTRO.from.x) || (rnd() < 0.5 ? -1 : 1), o0: mat.opacity, drift: rnd() * 6.28 };
    sp.renderOrder = 10;
    group.add(sp);
  }
  scene.add(group);
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
    scene.remove(intro.clouds); intro.clouds.children.forEach((c) => c.material.dispose());
    document.body.classList.remove('intro');
    $('#intro').remove();
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
  const entered = new Promise((res) => {
    const go = () => {
      sfx.on = true; store.set('sound', true); $('#sound').textContent = '🔈';
      sfx.init(); sfx.ctx.resume?.(); sfx.master.gain.value = 1;
      $('#intro').classList.add('waiting');                 // swap the button for the quiet progress line
      res();
    };
    $('#enter').addEventListener('click', go, { once: true });
  });
  $('#enter').focus({ preventScroll: true });                // Enter / Space work too
  await Promise.all([loaded, entered]);
  $('#gateBar').style.width = '100%';
  try { await renderer.compileAsync(scene, camera); } catch {}
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  intro.parting = true;
  $('#intro').classList.add('out');
}
partClouds();

window.__temple = { sitBench, sfx, geomStamp, exportStamp, composer, get floorMirror() { return floorMirror; }, exportBake, me, walkTo, ACTS, peers, scene, camera, controls, renderer };
