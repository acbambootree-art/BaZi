'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../fengshui');

test('24 mountains: bearing -> mountain / direction / void line', () => {
  assert.equal(F.mountainFor(0).mountain, '子');
  assert.equal(F.mountainFor(0).label, 'N2');
  assert.equal(F.mountainFor(7.4).mountain, '子');
  assert.equal(F.mountainFor(7.6).mountain, '癸');
  assert.equal(F.mountainFor(180).mountain, '午');
  assert.equal(F.mountainFor(180).direction, 'S');
  assert.equal(F.mountainFor(45).mountain, '艮');
  assert.equal(F.mountainFor(45).direction, 'NE');
  assert.equal(F.mountainFor(337.5).mountain, '壬');
  assert.equal(F.mountainFor(337.5).direction, 'N');     // 壬 = N1
  assert.equal(F.mountainFor(337.4).direction, 'NW');
  assert.equal(F.mountainFor(350).direction, 'N');
  assert.equal(F.mountainFor(6).voidLine, true);
  assert.equal(F.mountainFor(0).voidLine, false);
});

test('life gua: standard reference years', () => {
  assert.equal(F.lifeGua(1975, 'male'), 7);
  assert.equal(F.lifeGua(1975, 'female'), 8);
  assert.equal(F.lifeGua(1990, 'male'), 1);
  assert.equal(F.lifeGua(1990, 'female'), 8);   // 5 -> 8
  assert.equal(F.lifeGua(1984, 'male'), 7);
  assert.equal(F.lifeGua(2000, 'male'), 9);
  assert.equal(F.lifeGua(2000, 'female'), 6);
  assert.equal(F.lifeGua(1986, 'male'), 2);     // 5 -> 2
  assert.equal(F.lifeGua(2004, 'male'), 2);     // 9-4=5 -> 2
});

test('bazi year changes at 立春', () => {
  assert.equal(F.baziYearOf(1990, 1, 15), 1989);
  assert.equal(F.baziYearOf(1990, 2, 10), 1990);
  assert.equal(F.baziYearOf(2026, 2, 4), 2026);   // 立春 04:02 SGT, noon is after
  assert.equal(F.baziYearOf(2026, 2, 3), 2025);
});

test('eight mansions: Kan (1) and Qian (6) tables', () => {
  const k = F.eightMansions(1);
  assert.equal(k.group, 'East');
  assert.deepEqual(k.directions, { shengQi: 'SE', tianYi: 'E', yanNian: 'S', fuWei: 'N', huoHai: 'W', wuGui: 'NE', liuSha: 'NW', jueMing: 'SW' });
  const q = F.eightMansions(6);
  assert.equal(q.group, 'West');
  assert.equal(q.byDirection.S.key, 'jueMing');
  assert.equal(q.byDirection.W.key, 'shengQi');
  // every gua: 8 distinct directions
  for (const g of [1, 2, 3, 4, 6, 7, 8, 9]) {
    assert.equal(new Set(Object.values(F.eightMansions(g).directions)).size, 8, `gua ${g}`);
  }
});

test('annual stars 2024–2027 and 2026 afflictions', () => {
  assert.equal(F.annualStars(2024).centre, 3);
  assert.equal(F.annualStars(2025).centre, 2);
  assert.deepEqual(F.annualStars(2026), { centre: 1, NW: 2, W: 3, NE: 4, S: 5, N: 6, SW: 7, E: 8, SE: 9 });
  assert.equal(F.annualStars(2027).centre, 9);
  const a = F.afflictions(2026);
  assert.equal(a.animal, 'Horse');
  assert.equal(a.fiveYellow, 'S');
  assert.equal(a.taiSui.mountain, '午');
  assert.equal(a.taiSui.direction, 'S');
  assert.equal(a.suiPo.mountain, '子');
  assert.equal(a.sanSha.direction, 'N');
  assert.equal(a.sanSha.doNotFace, 'S');
  assert.deepEqual(a.offendingZodiacs.slice().sort(), ['Horse', 'Ox', 'Rabbit', 'Rat'].sort());
  const b = F.afflictions(2025); // 蛇 year: Tai Sui SE3 巳, San Sha East
  assert.equal(b.taiSui.mountain, '巳');
  assert.equal(b.taiSui.direction, 'SE');
  assert.equal(b.sanSha.direction, 'E');
  assert.deepEqual(b.offendingZodiacs.slice().sort(), ['Snake', 'Pig', 'Tiger', 'Monkey'].sort());
});

test('analyseConsult: 2026, south-facing flat, bedroom in S for a Gua 6 male', () => {
  const r = F.analyseConsult({
    year: 2026,
    facing: { bearing: 180, spread: 1, confidence: 'high' },
    people: [{ id: 'p1', name: 'Tan', birthYear: 1975, birthMonth: 6, birthDay: 1, gender: 'male' }],
    rooms: [
      { id: 'r1', name: 'Master', use: 'bedroom', sector: 'S', occupants: ['p1'], form: { beamOverBed: true } },
      { id: 'r2', name: 'Study', use: 'study', sector: 'E', occupants: ['p1'], form: {} },
    ],
  });
  assert.equal(r.houseGua.gua, 1);                   // sitting N -> Kan house
  assert.equal(r.people[0].gua, 7);
  const master = r.rooms[0];
  assert.equal(master.annualStar, 5);
  assert.ok(master.why.includes('AF-5Y'));
  assert.ok(master.why.includes('AF-TAISUI'));
  assert.ok(master.why.includes('FM-BEAM'));
  assert.equal(master.verdict, 'poor');
  assert.equal(master.occupants[0].sectorStar.key, 'wuGui');   // Gua 7: S = 五鬼
  assert.equal(master.occupants[0].bedHead.direction, 'SW');    // 天醫 for Gua 7
  assert.ok(master.cures.some(c => c.element === 'Metal'));
  const study = r.rooms[1];
  assert.equal(study.occupants[0].deskFacing.direction, 'NW');  // 生氣 for Gua 7
  assert.ok(!r.rooms.some(room => room.occupants.some(o => o.deskFacing && o.deskFacing.direction === 'S'))); // S banned in 2026
  assert.ok(r.notes.some(n => n.id === 'EM-DOOR'));             // door S is 五鬼 for Gua 7
});
