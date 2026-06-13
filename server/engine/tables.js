'use strict';

// ============================================================
// Static BaZi data tables.
// Index conventions (match the client-side BZ tables in index.html):
//   Stems   0-9:  甲乙丙丁戊己庚辛壬癸
//   Branches 0-11: 子丑寅卯辰巳午未申酉戌亥
//   Sexagenary index 0-59: 0 = 甲子, i % 10 = stem, i % 12 = branch.
// ============================================================

const STEMS = [
  { zh: '甲', pinyin: 'Jia',  element: 'wood',  polarity: 'yang' },
  { zh: '乙', pinyin: 'Yi',   element: 'wood',  polarity: 'yin'  },
  { zh: '丙', pinyin: 'Bing', element: 'fire',  polarity: 'yang' },
  { zh: '丁', pinyin: 'Ding', element: 'fire',  polarity: 'yin'  },
  { zh: '戊', pinyin: 'Wu',   element: 'earth', polarity: 'yang' },
  { zh: '己', pinyin: 'Ji',   element: 'earth', polarity: 'yin'  },
  { zh: '庚', pinyin: 'Geng', element: 'metal', polarity: 'yang' },
  { zh: '辛', pinyin: 'Xin',  element: 'metal', polarity: 'yin'  },
  { zh: '壬', pinyin: 'Ren',  element: 'water', polarity: 'yang' },
  { zh: '癸', pinyin: 'Gui',  element: 'water', polarity: 'yin'  },
];

const BRANCHES = [
  { zh: '子', pinyin: 'Zi',   element: 'water', polarity: 'yang', animal: 'Rat' },
  { zh: '丑', pinyin: 'Chou', element: 'earth', polarity: 'yin',  animal: 'Ox' },
  { zh: '寅', pinyin: 'Yin',  element: 'wood',  polarity: 'yang', animal: 'Tiger' },
  { zh: '卯', pinyin: 'Mao',  element: 'wood',  polarity: 'yin',  animal: 'Rabbit' },
  { zh: '辰', pinyin: 'Chen', element: 'earth', polarity: 'yang', animal: 'Dragon' },
  { zh: '巳', pinyin: 'Si',   element: 'fire',  polarity: 'yin',  animal: 'Snake' },
  { zh: '午', pinyin: 'Wu',   element: 'fire',  polarity: 'yang', animal: 'Horse' },
  { zh: '未', pinyin: 'Wei',  element: 'earth', polarity: 'yin',  animal: 'Goat' },
  { zh: '申', pinyin: 'Shen', element: 'metal', polarity: 'yang', animal: 'Monkey' },
  { zh: '酉', pinyin: 'You',  element: 'metal', polarity: 'yin',  animal: 'Rooster' },
  { zh: '戌', pinyin: 'Xu',   element: 'earth', polarity: 'yang', animal: 'Dog' },
  { zh: '亥', pinyin: 'Hai',  element: 'water', polarity: 'yin',  animal: 'Pig' },
];

// Hidden stems (藏干) per branch — standard Ziping table, ordered
// main qi (本气), middle qi (中气), residual qi (余气).
// Same table the production client uses. Variants exist; see REPORT.md.
const HIDDEN_STEMS = [
  [9],         // 子: 癸
  [5, 9, 7],   // 丑: 己 癸 辛
  [0, 2, 4],   // 寅: 甲 丙 戊
  [1],         // 卯: 乙
  [4, 1, 9],   // 辰: 戊 乙 癸
  [2, 6, 4],   // 巳: 丙 庚 戊 (中气 庚 from the 巳酉丑 metal frame; some books print 丙戊庚)
  [3, 5],      // 午: 丁 己
  [5, 3, 1],   // 未: 己 丁 乙
  [6, 8, 4],   // 申: 庚 壬 戊
  [7],         // 酉: 辛
  [4, 7, 3],   // 戌: 戊 辛 丁
  [8, 0],      // 亥: 壬 甲
];

const HIDDEN_ROLES = ['main', 'middle', 'residual'];

// Production cycle: element -> the element it produces.
const PRODUCES = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
// Control cycle: element -> the element it controls.
const CONTROLS = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };

const TEN_GOD_NAMES = {
  '比肩': { en: 'Companion',         abbr: 'BJ' },
  '劫财': { en: 'Rob Wealth',        abbr: 'JC' },
  '食神': { en: 'Eating God',        abbr: 'SS' },
  '伤官': { en: 'Hurting Officer',   abbr: 'SG' },
  '偏财': { en: 'Indirect Wealth',   abbr: 'PC' },
  '正财': { en: 'Direct Wealth',     abbr: 'ZC' },
  '七杀': { en: 'Seven Killings',    abbr: 'QS' },
  '正官': { en: 'Direct Officer',    abbr: 'ZG' },
  '偏印': { en: 'Indirect Resource', abbr: 'PY' },
  '正印': { en: 'Direct Resource',   abbr: 'ZY' },
};

// Ten God of `otherIdx` stem relative to the day master stem `dmIdx`.
function tenGod(dmIdx, otherIdx) {
  const dm = STEMS[dmIdx];
  const ot = STEMS[otherIdx];
  const same = dm.polarity === ot.polarity;
  if (dm.element === ot.element) return same ? '比肩' : '劫财';
  if (PRODUCES[dm.element] === ot.element) return same ? '食神' : '伤官';
  if (CONTROLS[dm.element] === ot.element) return same ? '偏财' : '正财';
  if (CONTROLS[ot.element] === dm.element) return same ? '七杀' : '正官';
  return same ? '偏印' : '正印'; // ot produces dm
}

// NaYin (纳音) — one entry per sexagenary pair, indexed floor(sexIdx / 2).
const NAYIN = [
  { zh: '海中金', element: 'metal' }, { zh: '炉中火', element: 'fire' },
  { zh: '大林木', element: 'wood' },  { zh: '路旁土', element: 'earth' },
  { zh: '剑锋金', element: 'metal' }, { zh: '山头火', element: 'fire' },
  { zh: '涧下水', element: 'water' }, { zh: '城头土', element: 'earth' },
  { zh: '白蜡金', element: 'metal' }, { zh: '杨柳木', element: 'wood' },
  { zh: '泉中水', element: 'water' }, { zh: '屋上土', element: 'earth' },
  { zh: '霹雳火', element: 'fire' },  { zh: '松柏木', element: 'wood' },
  { zh: '长流水', element: 'water' }, { zh: '沙中金', element: 'metal' },
  { zh: '山下火', element: 'fire' },  { zh: '平地木', element: 'wood' },
  { zh: '壁上土', element: 'earth' }, { zh: '金箔金', element: 'metal' },
  { zh: '覆灯火', element: 'fire' },  { zh: '天河水', element: 'water' },
  { zh: '大驿土', element: 'earth' }, { zh: '钗钏金', element: 'metal' },
  { zh: '桑拓木', element: 'wood' },  { zh: '大溪水', element: 'water' },
  { zh: '沙中土', element: 'earth' }, { zh: '天上火', element: 'fire' },
  { zh: '石榴木', element: 'wood' },  { zh: '大海水', element: 'water' },
];

// The 12 "jie" (节) month-boundary terms, in BaZi month order.
// Month n (1 = 寅月) begins when the sun's apparent longitude reaches
// (315 + 30*(n-1)) mod 360 degrees.
const JIE_TERMS = [
  { zh: '立春', en: 'Start of Spring',  longitude: 315 },
  { zh: '惊蛰', en: 'Awakening of Insects', longitude: 345 },
  { zh: '清明', en: 'Clear and Bright', longitude: 15 },
  { zh: '立夏', en: 'Start of Summer',  longitude: 45 },
  { zh: '芒种', en: 'Grain in Ear',     longitude: 75 },
  { zh: '小暑', en: 'Minor Heat',       longitude: 105 },
  { zh: '立秋', en: 'Start of Autumn',  longitude: 135 },
  { zh: '白露', en: 'White Dew',        longitude: 165 },
  { zh: '寒露', en: 'Cold Dew',         longitude: 195 },
  { zh: '立冬', en: 'Start of Winter',  longitude: 225 },
  { zh: '大雪', en: 'Major Snow',       longitude: 255 },
  { zh: '小寒', en: 'Minor Cold',       longitude: 285 },
];

const ELEMENTS = ['wood', 'fire', 'earth', 'metal', 'water'];

function sexagenaryIndex(stemIdx, branchIdx) {
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stemIdx && i % 12 === branchIdx) return i;
  }
  throw new Error(`Invalid stem/branch pairing: stem ${stemIdx}, branch ${branchIdx}`);
}

function ganZhi(sexIdx) {
  return STEMS[sexIdx % 10].zh + BRANCHES[sexIdx % 12].zh;
}

module.exports = {
  STEMS, BRANCHES, HIDDEN_STEMS, HIDDEN_ROLES,
  PRODUCES, CONTROLS, TEN_GOD_NAMES, NAYIN, JIE_TERMS, ELEMENTS,
  tenGod, sexagenaryIndex, ganZhi,
};
