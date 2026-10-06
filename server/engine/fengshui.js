'use strict';

// ============================================================
// Smart Luopan — Phase 1 feng shui rules.
//   * 24 mountains / 8 directions from a compass bearing
//   * Life Gua (命卦) + Eight Mansions (八宅) directions per person
//   * Annual flying stars (Lo Shu) + annual afflictions per solar year
//   * analyseConsult(): per-room verdicts with the rule ids that fired
// Pure functions, no I/O. Lineage defaults: docs/smart-luopan-rulebook.md.
// ============================================================

const A = require('./astro');
const FS = require('./flyingstar');
const Y = require('./yongshen');
const { computeChart } = require('./index');

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
// Clockwise from 子 (centred on 0°). index = floor(((bearing + 7.5) % 360) / 15)
const MOUNTAINS = [
  '子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙',
  '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬',
];
// Mountain index for each earthly branch (子=0 … 亥=11); used for Tai Sui.
const BRANCH_MOUNTAIN = { 0: 0, 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 14, 8: 16, 9: 18, 10: 20, 11: 22 };

function norm(deg) { return ((deg % 360) + 360) % 360; }

function mountainFor(bearing) {
  const b = norm(bearing);
  const mi = Math.floor(norm(b + 7.5) / 15);
  const di = Math.floor(norm(b + 22.5) / 45);
  const sub = (mi + 1) % 3 + 1;            // 1..3 within the 45° direction
  const centre = mi * 15;
  const offset = ((b - centre + 180) % 360 + 360) % 360 - 180; // -7.5..7.5
  return {
    bearing: Math.round(b * 10) / 10,
    mountain: MOUNTAINS[mi],
    mountainIndex: mi,
    direction: DIRS[di],
    label: `${DIRS[di]}${sub}`,
    distanceToBoundary: Math.round((7.5 - Math.abs(offset)) * 10) / 10,
    voidLine: 7.5 - Math.abs(offset) < 3,     // within 3° of a mountain edge
  };
}

function opposite(dir) { return DIRS[(DIRS.indexOf(dir) + 4) % 8]; }

// --- Life Gua (命卦) -----------------------------------------------------
// Standard last-two-digit method, year = BaZi (立春) year. 1900–2099 only.
function reduce9(n) { n = n % 9; return n === 0 ? 9 : n; }
function lifeGua(baziYear, gender) {
  if (baziYear < 1900 || baziYear > 2099) throw new RangeError('lifeGua: year must be 1900–2099');
  const yy = baziYear % 100;
  const r = reduce9(Math.floor(yy / 10) + (yy % 10));
  const after2000 = baziYear >= 2000;
  let k;
  if (gender === 'male') k = reduce9((after2000 ? 9 : 10) - r + 9);
  else k = reduce9(r + (after2000 ? 6 : 5));
  if (k === 5) k = gender === 'male' ? 2 : 8;
  return k;
}

// BaZi year from a civil birth date (year changes at 立春, SGT clock).
function baziYearOf(year, month, day, utcOffsetMinutes = 480) {
  const jd = A.jdAtMidnight(year, month, day) + (720 - utcOffsetMinutes) / 1440;
  return jd >= A.jieInstantUtc(year, 0) ? year : year - 1;
}

// --- Eight Mansions ------------------------------------------------------
const STARS = {
  shengQi: { zh: '生氣', name: 'Sheng Qi', good: true,  rank: 1, element: 'wood',  meaning: 'vitality, wealth, career' },
  tianYi:  { zh: '天醫', name: 'Tian Yi',  good: true,  rank: 2, element: 'earth', meaning: 'health, recovery' },
  yanNian: { zh: '延年', name: 'Yan Nian', good: true,  rank: 3, element: 'metal', meaning: 'relationships, longevity' },
  fuWei:   { zh: '伏位', name: 'Fu Wei',   good: true,  rank: 4, element: 'wood',  meaning: 'stability, self' },
  huoHai:  { zh: '禍害', name: 'Huo Hai',  good: false, rank: 5, element: 'earth', meaning: 'mishaps, small losses' },
  wuGui:   { zh: '五鬼', name: 'Wu Gui',   good: false, rank: 6, element: 'fire',  meaning: 'disputes, betrayal, fire' },
  liuSha:  { zh: '六煞', name: 'Liu Sha',  good: false, rank: 7, element: 'water', meaning: 'scandal, legal trouble' },
  jueMing: { zh: '絕命', name: 'Jue Ming', good: false, rank: 8, element: 'metal', meaning: 'severe loss, illness' },
};
// gua -> { star: direction }
const GUA_TABLE = {
  1: { shengQi: 'SE', tianYi: 'E',  yanNian: 'S',  fuWei: 'N',  huoHai: 'W',  wuGui: 'NE', liuSha: 'NW', jueMing: 'SW' },
  2: { shengQi: 'NE', tianYi: 'W',  yanNian: 'NW', fuWei: 'SW', huoHai: 'E',  wuGui: 'SE', liuSha: 'S',  jueMing: 'N'  },
  3: { shengQi: 'S',  tianYi: 'N',  yanNian: 'SE', fuWei: 'E',  huoHai: 'SW', wuGui: 'NW', liuSha: 'NE', jueMing: 'W'  },
  4: { shengQi: 'N',  tianYi: 'S',  yanNian: 'E',  fuWei: 'SE', huoHai: 'NW', wuGui: 'SW', liuSha: 'W',  jueMing: 'NE' },
  6: { shengQi: 'W',  tianYi: 'NE', yanNian: 'SW', fuWei: 'NW', huoHai: 'SE', wuGui: 'E',  liuSha: 'N',  jueMing: 'S'  },
  7: { shengQi: 'NW', tianYi: 'SW', yanNian: 'NE', fuWei: 'W',  huoHai: 'N',  wuGui: 'S',  liuSha: 'SE', jueMing: 'E'  },
  8: { shengQi: 'SW', tianYi: 'NW', yanNian: 'W',  fuWei: 'NE', huoHai: 'S',  wuGui: 'N',  liuSha: 'E',  jueMing: 'SE' },
  9: { shengQi: 'E',  tianYi: 'SE', yanNian: 'N',  fuWei: 'S',  huoHai: 'NE', wuGui: 'W',  liuSha: 'SW', jueMing: 'NW' },
};
const GUA_NAME = { 1: '坎 Kan', 2: '坤 Kun', 3: '震 Zhen', 4: '巽 Xun', 6: '乾 Qian', 7: '兌 Dui', 8: '艮 Gen', 9: '離 Li' };
const SITTING_GUA = { N: 1, SW: 2, E: 3, SE: 4, NW: 6, W: 7, NE: 8, S: 9 };

function eightMansions(gua) {
  const t = GUA_TABLE[gua];
  if (!t) throw new RangeError(`eightMansions: no table for gua ${gua}`);
  const byDirection = {};
  for (const [star, dir] of Object.entries(t)) byDirection[dir] = { key: star, ...STARS[star] };
  return {
    gua, name: GUA_NAME[gua],
    group: [1, 3, 4, 9].includes(gua) ? 'East' : 'West',
    directions: t, byDirection,
  };
}

// --- Annual stars + afflictions -----------------------------------------
// Centre star for solar year Y: 2026 -> 1, 2025 -> 2, 2027 -> 9.
function annualStars(year) {
  const c = ((2026 - year) % 9 + 9) % 9 + 1;
  const s = n => ((n - 1) % 9) + 1;
  // Lo Shu forward flight from the centre.
  return { centre: c, NW: s(c + 1), W: s(c + 2), NE: s(c + 3), S: s(c + 4), N: s(c + 5), SW: s(c + 6), E: s(c + 7), SE: s(c + 8) };
}

const SAN_SHA = { // year-branch triad -> direction of the Three Killings
  0: 'S', 4: 'S', 8: 'S',    // 申子辰 -> 巳午未
  2: 'N', 6: 'N', 10: 'N',   // 寅午戌 -> 亥子丑
  1: 'E', 5: 'E', 9: 'E',    // 巳酉丑 -> 寅卯辰
  3: 'W', 7: 'W', 11: 'W',   // 亥卯未 -> 申酉戌
};
const BRANCH_ZH = '子丑寅卯辰巳午未申酉戌亥';
const HARM  = { 0: 7, 7: 0, 1: 6, 6: 1, 2: 5, 5: 2, 3: 4, 4: 3, 8: 11, 11: 8, 9: 10, 10: 9 };   // 六害
const BREAK = { 0: 9, 9: 0, 1: 4, 4: 1, 2: 11, 11: 2, 3: 6, 6: 3, 5: 8, 8: 5, 7: 10, 10: 7 };  // 六破
const ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];

function afflictions(year) {
  const branch = ((year - 4) % 12 + 12) % 12;
  const stars = annualStars(year);
  const find = n => DIRS.find(d => stars[d] === n) || null;
  const taiSuiMi = BRANCH_MOUNTAIN[branch];
  const suiPoMi = (taiSuiMi + 12) % 24;
  const sanSha = SAN_SHA[branch];
  // Zodiacs that offend Tai Sui: same (值), clash (冲), harm (害), break (破) — the four most 通書 list.
  const offend = [...new Set([branch, (branch + 6) % 12, HARM[branch], BREAK[branch]])];
  return {
    year, yearBranch: BRANCH_ZH[branch], animal: ANIMALS[branch],
    stars,
    fiveYellow: find(5), twoBlack: find(2), threeJade: find(3),
    taiSui: { mountain: MOUNTAINS[taiSuiMi], direction: DIRS[Math.floor(taiSuiMi / 3 + 0.34) % 8], index: taiSuiMi },
    suiPo:  { mountain: MOUNTAINS[suiPoMi],  direction: DIRS[Math.floor(suiPoMi / 3 + 0.34) % 8],  index: suiPoMi },
    sanSha: { direction: sanSha, doNotFace: opposite(sanSha) },
    offendingZodiacs: offend.map(b => ANIMALS[b]),
  };
}

// --- Cures (generic items; docs/smart-luopan-rulebook.md C3) --------------
const CURES = {
  metal: { element: 'Metal', items: 'brass wu lou, six-coin string, 6-rod brass wind chime or a solid brass object', placement: 'in the affected sector, waist height or higher, away from the bed head' },
  water: { element: 'Water', items: 'glass bowl of still clean water (changed weekly) or a glass vase', placement: 'in the affected sector, not beside the bed' },
  fire:  { element: 'Fire',  items: 'red lamp kept on in the evening, or a red mat or cushion', placement: 'in the affected sector; never where 5 Yellow or 2 Black sits' },
  earth: { element: 'Earth', items: 'ceramic pot, natural stone, citrine or quartz, yellow or beige textile', placement: 'low in the affected sector' },
  wood:  { element: 'Wood',  items: 'live plant with round leaves, or a wooden board or screen', placement: 'in the sector or between the conflicting items' },
};
const DRAIN = { metal: 'water', fire: 'earth', water: 'wood', earth: 'metal', wood: 'fire' };

const FORM_ISSUES = {
  beamOverBed:   { id: 'FM-BEAM',   severity: 'hard',   text: 'Beam over the bed or desk: move it out from under the beam; otherwise fit a false ceiling or canopy.' },
  mirrorFacesBed:{ id: 'FM-MIRROR', severity: 'medium', text: 'Mirror faces the bed: remove it or cover it at night.' },
  bedInLineWithDoor: { id: 'FM-DOORLINE', severity: 'medium', text: 'Bed in line with the door: move the bed so the door is visible but not aligned with the body (command position).' },
  doorFacesToilet:{ id: 'FM-TOILET', severity: 'medium', text: 'Door faces a toilet: keep the toilet door closed; add a screen or curtain.' },
  stoveFacesSink: { id: 'FM-STOVE',  severity: 'medium', text: 'Stove opposite the sink or fridge: reposition; otherwise place a wooden board or plant between them.' },
  sharpCorner:   { id: 'FM-CORNER', severity: 'low',    text: 'Sharp corner points at the bed or desk: reposition; otherwise soften with a plant or cloth.' },
  longCorridor:  { id: 'FM-CORRIDOR', severity: 'medium', text: 'Main door opens onto a long straight corridor or window (穿堂煞): add a screen or console at the entrance.' },
};

const USE_ORDER = {
  bedroom: ['tianYi', 'yanNian', 'fuWei', 'shengQi'],
  study:   ['shengQi', 'tianYi', 'yanNian', 'fuWei'],
  default: ['shengQi', 'tianYi', 'yanNian', 'fuWei'],
};

/**
 * @param {object} c consult
 * @param {number} c.year  solar year for annual stars (default: current SGT year, 立春-aware)
 * @param {{bearing:number}} c.facing  main-door facing bearing (degrees, magnetic)
 * @param {Array<{id,name,birthYear,birthMonth,birthDay,gender}>} c.people
 * @param {Array<{id,name,use,sector,occupants:[],form:{}}>} c.rooms  sector in DIRS or 'C'
 * @param {number} [c.period]  construction period 1..9 (from TOP / major renovation year); enables Flying Star
 */
function analyseConsult(c) {
  const year = c.year || baziYearOf(...sgTodayParts());
  const facing = mountainFor(c.facing.bearing);
  const sitting = mountainFor(c.facing.bearing + 180);
  const houseGua = eightMansions(SITTING_GUA[sitting.direction]);
  const ann = afflictions(year);
  const fsChart = c.period ? FS.chart(c.period, facing.mountainIndex) : null;

  const people = (c.people || []).map(p => {
    const by = baziYearOf(p.birthYear, p.birthMonth, p.birthDay);
    const gua = lifeGua(by, p.gender);
    const em = eightMansions(gua);
    let bazi = null;
    try {
      const chart = computeChart({ year: p.birthYear, month: p.birthMonth, day: p.birthDay, hour: p.birthHour ?? null, minute: 0, timeZone: 'Asia/Singapore', gender: p.gender });
      bazi = { ...Y.analyse(chart.pillars), pillars: ['year', 'month', 'day', 'hour'].map(k => chart.pillars[k] ? chart.pillars[k].ganZhi : null), hourKnown: chart.pillars.hour != null };
    } catch (e) { bazi = null; }
    return { id: p.id, name: p.name, gender: p.gender, baziYear: by, gua, guaName: em.name, group: em.group, directions: em.directions,
      doorStar: em.byDirection[facing.direction], bazi };
  });
  const byId = Object.fromEntries(people.map(p => [p.id, p]));

  const bannedFacing = new Set([ann.taiSui.direction, ann.sanSha.doNotFace]);
  const bannedSleepSectors = new Set([ann.fiveYellow]);

  const rooms = (c.rooms || []).map(r => {
    const why = [];
    const warnings = [];
    const cures = [];
    const sector = r.sector === 'C' ? null : r.sector;
    const star = sector ? ann.stars[sector] : ann.stars.centre;

    // Layer 1: annual
    if (sector && sector === ann.fiveYellow) {
      warnings.push({ id: 'AF-5Y', severity: 'hard', text: `5 Yellow sits in the ${sector} this year: no renovation, drilling or hammering here; keep it quiet. ${r.use === 'bedroom' ? 'Avoid sleeping here if another room is possible.' : ''}`.trim() });
      cures.push({ id: 'AF-5Y', ...CURES.metal, reason: '5 Yellow (Earth) is drained by Metal' });
      why.push('AF-5Y');
    }
    if (sector && sector === ann.twoBlack) {
      warnings.push({ id: 'AF-2B', severity: 'medium', text: `2 Black (illness star) sits in the ${sector} this year: not ideal for the elderly or unwell to sleep here.` });
      cures.push({ id: 'AF-2B', ...CURES.metal, reason: '2 Black (Earth) is drained by Metal' });
      why.push('AF-2B');
    }
    if (sector && sector === ann.threeJade) {
      warnings.push({ id: 'AF-3J', severity: 'low', text: `3 Jade (dispute star) sits in the ${sector} this year: keep this room quiet, avoid arguments and meetings here.` });
      cures.push({ id: 'AF-3J', ...CURES.fire, reason: '3 Jade (Wood) is drained by Fire' });
      why.push('AF-3J');
    }
    if (sector && sector === ann.taiSui.direction) {
      warnings.push({ id: 'AF-TAISUI', severity: 'hard', text: `Tai Sui (${ann.taiSui.mountain}) sits in the ${sector} this year: no works; do not sit or sleep facing ${sector}.` });
      why.push('AF-TAISUI');
    }
    if (sector && sector === ann.sanSha.direction) {
      warnings.push({ id: 'AF-SANSHA', severity: 'hard', text: `Three Killings sit in the ${sector} this year: no works; never sit with your back to the ${sector} (i.e. do not face ${ann.sanSha.doNotFace}).` });
      why.push('AF-SANSHA');
    }
    if (sector && sector === ann.suiPo.direction && ann.suiPo.direction !== ann.sanSha.direction) {
      warnings.push({ id: 'AF-SUIPO', severity: 'medium', text: `Year Breaker (${ann.suiPo.mountain}) sits in the ${sector}: keep still, no digging or drilling.` });
      why.push('AF-SUIPO');
    }

    // Layer 3: Flying Star natal chart (sector palace, period + annual overlay)
    let flyingStar = null;
    if (fsChart) {
      const pal = fsChart.palaces[sector || 'C'];
      flyingStar = FS.assessPalace(pal, fsChart.period, star, r.use);
      for (const w of flyingStar.warnings) warnings.push(w);
      for (const cu of flyingStar.cures) cures.push({ id: cu.id, ...CURES[cu.element], reason: cu.reason });
      why.push(...flyingStar.why);
    }

    // Layer 2: form checklist
    for (const [k, v] of Object.entries(r.form || {})) {
      if (v && FORM_ISSUES[k]) { warnings.push({ id: FORM_ISSUES[k].id, severity: FORM_ISSUES[k].severity, text: FORM_ISSUES[k].text }); why.push(FORM_ISSUES[k].id); }
    }

    // Layer 4: Eight Mansions per occupant
    const occupants = (r.occupants || []).map(id => byId[id]).filter(Boolean).map(p => {
      const sectorStar = sector ? p.directions && eightMansions(p.gua).byDirection[sector] : null;
      const order = USE_ORDER[r.use] || USE_ORDER.default;
      let options = order.map(k => ({ star: STARS[k].zh, name: STARS[k].name, direction: p.directions[k], meaning: STARS[k].meaning, element: Y.elementOfDirection(p.directions[k]) }));
      // Layer 5: BaZi tie-break — favourable element first, 忌神 last, Eight Mansions order otherwise.
      if (p.bazi) {
        const tier = o => o.element === p.bazi.yongShen ? 0 : o.element === p.bazi.xiShen ? 1 : p.bazi.jiShen.includes(o.element) ? 3 : 2;
        options = options.map((o, i) => ({ ...o, i })).sort((a, b) => tier(a) - tier(b) || a.i - b.i).map(({ i, ...o }) => ({ ...o, baziFit: tier(o) <= 1 ? 'favourable' : tier(o) === 3 ? 'avoid' : 'neutral' }));
        why.push('BZ-RANK');
      }
      const facingOptions = options.filter(o => !bannedFacing.has(o.direction));
      const bedHead = options[0];
      const o = { id: p.id, name: p.name, gua: p.gua, guaName: p.guaName, sectorStar,
        bedHead: r.use === 'bedroom' ? bedHead : null,
        deskFacing: facingOptions[0] || null,
        deskFacingBanned: options.filter(o => bannedFacing.has(o.direction)).map(o => o.direction),
      };
      if (sectorStar && !sectorStar.good) {
        warnings.push({ id: 'EM-ROOM', severity: 'advise', person: p.name, text: `${p.name} (Gua ${p.gua}): the ${sector} is ${sectorStar.zh} ${sectorStar.name} (${sectorStar.meaning}). Prefer another room if one is free; otherwise sleep with the head toward ${bedHead.direction} (${bedHead.star}).` });
        let cureEl = DRAIN[sectorStar.element], note = '';
        if (p.bazi && p.bazi.jiShen.includes(cureEl)) {
          const control = Object.keys(DRAIN).find(k => DRAIN[DRAIN[k]] === sectorStar.element && k !== sectorStar.element) || Y.CONTROLLED_BY[sectorStar.element];
          if (!p.bazi.jiShen.includes(control)) { note = ` (${CURES[cureEl].element} is ${p.name}'s 忌神, so the controlling element is used instead)`; cureEl = control; why.push('BZ-CURE-VETO'); }
          else note = ` (note: ${CURES[cureEl].element} is also ${p.name}'s 忌神; keep the item small)`;
        }
        cures.push({ id: 'EM-DRAIN', ...CURES[cureEl], reason: `${sectorStar.zh} is ${sectorStar.element}; treated with ${CURES[cureEl].element}${note}`, person: p.name });
        why.push('EM-ROOM');
      }
      if (p.bazi && sector) {
        const secEl = Y.elementOfDirection(sector);
        if (p.bazi.jiShen.includes(secEl)) warnings.push({ id: 'BZ-SECTOR', severity: 'low', person: p.name, text: `${p.name}: this ${sector} sector is ${Y.ZH[secEl]} ${secEl}, their 忌神. Decorate inside with ${p.bazi.colours.favourable} (${p.bazi.zh.yongShen}${p.bazi.zh.xiShen}) rather than ${secEl} colours.` });
        else if ([p.bazi.yongShen, p.bazi.xiShen].includes(secEl)) warnings.push({ id: 'BZ-SECTOR', severity: 'boost', person: p.name, text: `${p.name}: this ${sector} sector is ${Y.ZH[secEl]} ${secEl}, a favourable element for them.` });
      }
      why.push('EM-BED');
      return o;
    });

    // Layer 5: room cures vs occupants' 忌神 (annual / Flying Star cures have no person)
    const occJi = new Set(occupants.flatMap(o => (byId[o.id] && byId[o.id].bazi) ? byId[o.id].bazi.jiShen : []));
    for (const cu of cures) {
      if (cu.person) continue;
      const el = cu.element.toLowerCase();
      if (occJi.has(el)) { cu.reason += ` — ${cu.element} is a 忌神 for someone sleeping here: use the smallest effective item, metal-coloured rather than massed`; if (!why.includes('BZ-CURE-NOTE')) why.push('BZ-CURE-NOTE'); }
    }

    const verdictScore = warnings.reduce((s, w) => s + ({ hard: 3, medium: 2, low: 1, advise: 1, boost: -1 }[w.severity] || 0), 0);
    const verdict = verdictScore <= 0 ? 'good' : verdictScore <= 2 ? 'fair' : 'poor';
    if (r.use === 'bedroom' && sector && bannedSleepSectors.has(sector)) why.push('AF-5Y-BED');

    return { id: r.id, name: r.name, use: r.use, sector: sector || 'Centre', annualStar: star, flyingStar, verdict, occupants, warnings, cures: dedupe(cures), why: [...new Set(why)] };
  });

  // Facing / house-level notes
  const notes = [];
  if (facing.voidLine) notes.push({ id: 'RD-VOID', text: `Facing ${facing.bearing}° is within ${facing.distanceToBoundary}° of a mountain boundary (${facing.mountain}). Re-measure before finalising; neighbouring mountain readings differ.` });
  if (c.facing.spread != null && c.facing.spread > 4) notes.push({ id: 'RD-SPREAD', text: `Compass readings varied by ${c.facing.spread}°: likely metal interference. Re-take from the corridor or just outside the door.` });
  if (c.facing.confidence === 'low') notes.push({ id: 'RD-LOW', text: 'Reading confidence is low. Advice below assumes the recorded bearing is correct.' });
  for (const p of people) {
    if (p.doorStar && !p.doorStar.good) notes.push({ id: 'EM-DOOR', text: `Main door (${facing.direction}) is ${p.doorStar.zh} ${p.doorStar.name} for ${p.name} (Gua ${p.gua}).` });
    if (ann.offendingZodiacs.includes(ANIMALS[((p.baziYear - 4) % 12 + 12) % 12])) notes.push({ id: 'AF-ZODIAC', text: `${p.name} (${ANIMALS[((p.baziYear - 4) % 12 + 12) % 12]}) offends Tai Sui in ${year}: consider 安太歲 at a temple after 立春.` });
  }

  let flyingStar = null;
  if (fsChart) {
    const grid = {};
    for (const d of [...DIRS, 'C']) grid[d] = { ...fsChart.palaces[d], annual: d === 'C' ? ann.stars.centre : ann.stars[d], ...pick(FS.assessPalace(fsChart.palaces[d], fsChart.period, d === 'C' ? ann.stars.centre : ann.stars[d], null), ['verdict', 'bestUse']) };
    const structureText = {
      'prosperous-mountain-prosperous-water': 'Prosperous mountain and water: people and money both supported. Keep the sitting side solid and the facing side open.',
      'double-facing': 'Both prosperous stars at the facing: good for money, weaker for health and people. Add a solid feature (hill, wall, tall furniture) at the facing side behind water, and keep the sitting side quiet.',
      'double-sitting': 'Both prosperous stars at the sitting: good for health and people, weaker for wealth. Keep the sitting side solid and bring activity or water to the facing side if the layout allows.',
      'reversed': 'Reversed chart (上山下水): mountain star at the facing, water star at the sitting. Needs careful placement: open space at the sitting, solid at the facing.',
      'other': 'Mixed chart.',
    }[fsChart.structure];
    flyingStar = { period: fsChart.period, structure: fsChart.structure, structureZh: fsChart.structureZh, structureText, grid,
      bestSectors: DIRS.filter(d => grid[d].verdict === 'good' && grid[d].annual !== 5 && d !== ann.taiSui.direction),
      worstSectors: DIRS.filter(d => grid[d].verdict === 'poor'),
      restThisYear: DIRS.filter(d => grid[d].verdict === 'good' && (grid[d].annual === 5 || d === ann.taiSui.direction)) };
    if (facing.voidLine) notes.push({ id: 'FS-VOID', text: 'Facing is on a mountain boundary: the Flying Star chart could belong to either neighbouring mountain. Re-measure before relying on it.' });
  }

  return {
    year, facing, sitting, houseGua: { gua: houseGua.gua, name: houseGua.name, group: houseGua.group },
    annual: ann, flyingStar, people, rooms, notes,
  };
}

function pick(o, keys) { const r = {}; for (const k of keys) r[k] = o[k]; return r; }

function dedupe(arr) {
  const seen = new Set();
  return arr.filter(c => { const k = c.id + '|' + c.element + '|' + (c.person || ''); if (seen.has(k)) return false; seen.add(k); return true; });
}

function sgTodayParts() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

module.exports = {
  DIRS, MOUNTAINS, STARS, FORM_ISSUES,
  mountainFor, lifeGua, baziYearOf, eightMansions, annualStars, afflictions, analyseConsult,
};
