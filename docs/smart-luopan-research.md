# Smart Luopan — research & product brief

Date: 2026-10-06. Status: Phase 1 built 2026-10-07 (`luopan.html`, `server/engine/fengshui.js`, `server/routes/luopan.js`); Phase 2 (Flying Star) and Phase 3 (用神 layer `server/engine/yongshen.js`, cure vetoes, AI client report via `server/services/luopanNarrative.js`) built 2026-10-07. AI-2 (classical corpus retrieval with citations, `server/corpus/*.md` + `server/services/corpus.js`, references card, ask-about-this-house endpoint) built 2026-10-07; corpus = 41 seed passages plus ~1,900 passages of full public-domain texts fetched from zh.wikisource.org (`server/corpus/fetch.js`). AI-3 (on-site chat per consult, stored in `luopan_chats`, cached audit context, citations) built 2026-10-07. The 用神 reference sets (69 + 45 classical worked examples) were built and measured 2026-10-07: ~50% agreement with the masters' explicit 用神, see rulebook B5. Corpus extended 2026-10-07 with 窮通寶鑑, 地理辨正, 天元五歌, 青囊經, 撼龍經/疑龍經, 催官篇 from Wikisource. Still unavailable in a redistributable public-domain transcription: 紫白訣, 八宅明鏡, 陽宅三要, 子平真詮, 沈氏玄空學, 飛星賦 (seed excerpts only). The master sign-off checklist is `docs/smart-luopan-signoff.md`; it needs a human master and is the only open item.

## 0. Verdict in five lines

1. **Build it as a web app (PWA), reusing the mingpan.live BaZi engine.** Phone compass access works in Safari and Chrome today; no native app needed for v1.
2. **The phone compass is the weak link, not the feng shui maths.** Indoors in an HDB/condo (rebar, steel doors, lift shafts) a phone is routinely 5–15° off; each luopan "mountain" is only 15° wide. The product must be designed around *reading quality*, not just displaying a pretty ring.
3. **Copy how masters actually work:** one careful facing reading at the main door (outside, repeated, cross-checked), then a floor-plan overlay for every room. Do NOT try to compass-read each room live.
4. **The "dummy-proof" part is a guided workflow + your masters' rulebook encoded as data.** The rulebook (which school, which priority when systems conflict, which cures) is the real product and only your masters can supply it.
5. **No competitor does guided, personalised advice.** Every existing luopan app is a digital ring for people who already know feng shui.

---

## 1. How a physical luopan (羅盤) works

- **Needle = magnetic north.** Classical luopan work is done against magnetic north, not true north. In Singapore declination is ~0.2°, irrelevant. If you serve overseas clients, store both.
- **Rings.** A full luopan has 20–40 rings; a working master uses 3–5. The core is the **24 Mountains (二十四山)**: 360° ÷ 24 = **15° each**, grouped 3 per compass direction (N1 壬, N2 子, N3 癸 …). Every formula addresses a mountain, not a degree.
- **Three plates (San He luopan):** Earth plate 地盤正針 (needle north; used for sitting/facing and Eight Mansions / Flying Star), Human plate 人盤中針 (−7.5°; used for mountains/landforms), Heaven plate 天盤縫針 (+7.5°; used for water). San Yuan luopans drop the ±7.5° plates and add 64-hexagram rings instead.
- **Reading procedure masters follow** (this becomes the app's guided steps):
  1. Stand inside, back to the main door, 1–2 m away, not touching it. Hold level at waist height.
  2. Remove phone cases with magnets, watches, keys, belts with buckles.
  3. Read the bearing on the far side (facing). Sitting = facing + 180°.
  4. Repeat at 2–3 spots (just inside, just outside, on the threshold). If readings disagree by more than a few degrees → interference; move away from metal (gate, shoe cabinet, DB box) and retake.
  5. Note if the bearing sits within ~3° of a mountain boundary ("void line" 空亡). Masters treat those houses specially; software must flag them.

## 2. The analysis engines (what turns a bearing into advice)

Three systems are in common Singapore use. Your masters will tell you which they trust; most combine them.

### 2a. Eight Mansions 八宅 (Ba Zhai) — simplest, most personal

- **Life Gua (命卦)** from birth year (year starts at 立春, not 1 Jan — the mingpan engine already gets this right) and gender.
  Digit-sum the year to one digit *s*. Male born <2000: 10 − s; ≥2000: 9 − s. Female <2000: s + 5; ≥2000: s + 6. Reduce to one digit; 5 → male 2, female 8.
- East group: 1, 3, 4, 9. West group: 2, 6, 7, 8.
- Each gua gets 4 good directions (生氣 Sheng Qi – wealth/vitality, 天醫 Tian Yi – health, 延年 Yan Nian – relationships, 伏位 Fu Wei – stability) and 4 bad (禍害, 五鬼, 六煞, 絕命).

| Gua | 生氣 | 天醫 | 延年 | 伏位 |
|---|---|---|---|---|
| 1 坎 | SE | E | S | N |
| 2 坤 | NE | W | NW | SW |
| 3 震 | S | N | SE | E |
| 4 巽 | N | S | E | SE |
| 6 乾 | W | NE | SW | NW |
| 7 兌 | NW | SW | NE | W |
| 8 艮 | SW | NW | W | NE |
| 9 離 | E | SE | N | S |

(Have your masters confirm this table before it ships.)

- **House Gua** from the sitting direction; the main-door / master-bedroom / stove relationship (陽宅三要) gives the house verdict.
- Direct outputs: bed head direction, desk facing, which room each household member should occupy, stove/door placement.

### 2b. Flying Stars 玄空飛星 — what most pros use for "energy flow"

- Inputs: **construction period** (20-year cycle; we are in **Period 9, 2024–2043**) and **facing mountain** (one of 24). Output: 9 palaces × (mountain star, water star, period star).
- Overlay **annual** and **monthly** stars for time-based advice. The annual chart changes at 立春 (4 Feb 2026 04:02 SGT this year).
- **2026 (丙午 Fire Horse) annual chart:** centre 1; SE 9, S 5, SW 7, E 8, W 3, NE 4, N 6, NW 2.
  - 五黃 Five Yellow: **South** (worst sector; no renovation, no digging, metal cure).
  - 太歲 Tai Sui: **S2 午 (172.5–187.5°)**; don't face it, don't disturb it.
  - 歲破 Sui Po: **N2 子**.
  - 三煞 Three Killings: **North (N1–N3, 337.5–22.5°)**; you may face it but not sit with your back to it; no works.
- Edge cases a correct engine must handle (good checklist from an API vendor's spec): period vs year input; forward/reverse flight by mountain polarity; replacement stars for void-line facings; the four chart structures (double-facing, double-sitting, prosperous mountain & water, reversed); flag bearings within ~3° of a boundary; exact 立春 changeover; support all 9 periods (old HDB blocks are Period 6/7/8).
- **Open question for your masters:** for an apartment, period = block TOP date, or unit renovation date, or move-in? And facing = unit main door, or the block's/balcony facing? Different lineages answer differently; the app must pick one and say so.

### 2c. BaZi 用神 (favourable elements) — your differentiator

- Map favourable element → direction/colour/material: Wood E/SE, Fire S, Earth NE/SW/centre, Metal W/NW, Water N.
- Use it to (a) rank the Eight Mansions good directions for *this* person, (b) veto a Flying Star cure that uses an element the person's chart cannot take (e.g. don't prescribe red/fire cures to a Fire-averse chart), (c) pick room assignment per family member.
- **Gap:** the validated engine in `server/engine` emits raw pillars and element counts only; it does **not** compute day-master strength or favourable elements. The legacy client has its own (unvalidated) logic. Deciding whose method to encode is a prerequisite.

### 2d. Form school sanity checks (no compass needed)

Bed under beam, bed/door alignment, mirror facing bed, stove opposite sink, toilet facing main door, long corridor to door. Pure checklist with photos — cheap to build and makes the report feel complete.

### 2e. Conflict resolution = the rulebook

When Eight Mansions says "bedroom is Jue Ming for him" but Flying Stars says "8-8 wealth stars there", a master decides from lineage. Encode as an ordered rule table your masters own (e.g. 1. annual afflictions override all; 2. Flying Star for room function; 3. Eight Mansions for bed/desk direction within the room; 4. BaZi to tie-break and to choose cure elements). This table is where the "precise, accurate advice" promise lives — not in the compass.

## 3. Technical: getting a heading from a phone in a web page

### Works today
- **iOS Safari (13+):** `DeviceOrientationEvent.requestPermission()` must be called from a tap, on HTTPS. Then `event.webkitCompassHeading` (0–360, clockwise, magnetic north) and `event.webkitCompassAccuracy` (degrees of estimated error; −1 = uncalibrated).
- **Android Chrome:** listen to `deviceorientationabsolute`; heading = `(360 − event.alpha) % 360`. No accuracy field; infer from variance.
- Both: compensate for screen rotation, and read `beta`/`gamma` to refuse readings when the phone isn't held level (a tilted phone skews heading badly).
- Not available: raw magnetometer (Chrome only behind a flag, Safari never). You get the OS-fused heading and nothing else. That's fine for v1.

```js
async function startCompass(onHeading) {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    if (await DeviceOrientationEvent.requestPermission() !== 'granted') throw new Error('denied');
  }
  const evName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(evName, e => {
    const h = e.webkitCompassHeading ?? (e.absolute ? (360 - e.alpha) % 360 : null);
    if (h == null) return;
    const level = Math.abs(e.beta) < 15 && Math.abs(e.gamma) < 15;
    onHeading({ heading: h, accuracy: e.webkitCompassAccuracy ?? null, level });
  });
}
```

### Accuracy reality
- Outdoors, calibrated: ±1–3°. Indoors near steel: studies show ~9° average error, single readings up to 25° off. A 15° mountain is lost at that point.
- Mitigations (all cheap, all mandatory):
  1. Sample for 3–5 s, use the median, show the spread. Reject if spread > 4°.
  2. Require two readings at two positions (inside/outside door) that agree within 3°; otherwise walk the user to the corridor and retake.
  3. Show "calibrate" (figure-8) when iOS accuracy > 10° or variance is high.
  4. Flag void lines: bearing within 3° of a mountain boundary → "borderline, confirm with physical luopan".
  5. Always allow manual bearing entry (master types what the brass luopan says) and keep the photo of the physical reading as evidence.
  6. Ask the user to remove magnetic phone cases (MagSafe wallets are a real problem).

### Floor plan
- v1: upload a photo of the HDB/condo floor plan (every Singapore unit has one). User taps the main door and the unit's centre; app rotates an 8-sector pie (and/or 9-palace grid) to the measured facing and lets the user tap-label rooms. Irregular units: use bounding-box centre and flag missing sectors.
- Later: LiDAR room scanning (Apple RoomPlan) needs a native wrapper (Capacitor). Not worth it for v1.

### Other plumbing
- Geolocation → magnetic declination (any WMM library; `geomagnetism` on npm) and address on the report.
- Store each consult (client, bearings, photos, chart, advice) so a senior master can review a junior's job.
- PWA install prompt; iOS standalone mode supports the permission API.

## 4. The dummy-proof workflow (what a non-expert sees)

1. **Client** — name, DOB/time/gender (BaZi + Life Gua computed instantly via existing engine); optional family members.
2. **House** — address, type (HDB/condo/landed), TOP year, renovation year → period. Upload floor plan photo.
3. **Facing reading** — on-screen coach: "Stand here, hold flat, wait…" → big number, mountain name, confidence badge (green / amber "retake" / red "interference").
4. **Confirm** — app shows the floor plan with sectors overlaid; user labels main door, bedrooms, kitchen, study.
5. **Report** — per room: verdict, who should sleep there, bed/desk direction, cure (element + object + placement), annual warnings (2026: South no-renovation, North no-sitting-against), form-school checklist with photo prompts.
6. **Export/share** — PDF + link, in the same style as the Decision Reading.
Every verdict has a "why" expander that cites the rule (e.g. "Eight Mansions: Gua 3 → Sheng Qi S"), so masters trust it and juniors learn.

## 5. Competitors

| App | What it does | Gap |
|---|---|---|
| Joey Yap iLuoPan / iLuoPan Pro (iOS, old) | Full digital rings, audio pronunciation of 24 mountains | Reference tool for trained users; no advice |
| "Feng-Shui Compass" (9 Earth LLC, Android 4.6★/192, iOS 5★) | Bearing, flying star calc for house/door/desk | Still expects you to interpret |
| "Luopan: Feng Shui Compass" (iOS, 2024) | Ring styles, photo overlay ruler, map compass, Flying Star | No BaZi, no guidance |
| LuoPan Compass (Payakorn), EACOMM Luopan | Basic ring | Low quality |
| roxyapi Feng Shui API | Flying Star as a paid API | Could save engine work; verify lineage |

None does: personalised BaZi layer, guided reading with quality gates, floor-plan overlay with room verdicts, or a report. That is the whole product.

## 6. Risks

- **Wrong facing → wrong everything.** Mitigated by quality gates + manual override, never eliminated. Reports must say "reading confidence".
- **No master to arbitrate lineage disputes.** The rulebook encodes mainstream Shen-school Flying Star + Eight Mansions + 子平 defaults; validation leans on published classical examples and an independent model grader. Revisit when a master joins.
- **Favourable-element method isn't in the validated engine yet.**
- **iOS permission UX** (tap required, HTTPS, works in PWA; users who tapped "Don't allow" must reset via Settings).
- **Liability wording** on renovation/no-dig advice.

## 7. Suggested phasing

| Phase | Scope | Effort |
|---|---|---|
| 1 | Compass reading with quality gates, Eight Mansions, 2026 annual afflictions, per-person bed/desk directions, simple report | ~2–3 weeks |
| 2 | Flying Star engine (Period 6–9), floor-plan photo overlay, per-room verdicts, cure catalogue | ~3–4 weeks |
| 3 | BaZi favourable-element layer, masters' conflict rule table, monthly stars, consult history/review | ~3 weeks |

## 8. Decisions so far (2026-10-07)

- **Facing** = unit main door. **Period** = block TOP year, unless a major renovation happened, then renovation date. (Report must record which rule fired.)
- **Users** = in-house masters only. No customer self-serve in v1; no payment flow needed.
- **BaZi** = every household member; each room verdict names who should use it.
- **Cures** = recommend company products. Needs a cure catalogue: SKU, element, star/affliction it treats, placement rule, price.
- **School**: see section 9. Proposed core = Xuan Kong Flying Star + Form, Eight Mansions for personal directions, BaZi to rank and to pick cure elements. Awaiting masters' confirmation.

## 9. Which method is "the imperial / most ancient" one?

Short answer: there is no single imperial method, and ancient is not the same as best. The lineages, oldest first:

| Era | Method | Notes |
|---|---|---|
| Han–Jin (c. 200 BC–300 AD) | **Form school 巒頭** (landform, Guo Pu's 葬書) | Oldest. No compass. Still the first thing every master checks. Used for palace and tomb siting throughout. |
| Tang (9th c.) | **San He 三合** (Yang Yunsong 楊筠松, court geomancer) | Oldest compass school; the three-plate luopan is San He. Imperial-tomb and water-method work. Weak for apartments: it is about land, water and mountains, not units in a block. |
| Tang attribution, Qing text | **Eight Mansions 八宅** (八宅明鏡) | Personal-direction system; simple, widely used, often dismissed by purists as too coarse on its own. |
| Ming–Qing (17th–19th c.) | **Xuan Kong Flying Star 玄空飛星** (Jiang Dahong 蔣大鴻 → Shen Zhureng 沈竹礽) | Youngest, but it is what the Qing-era Imperial Astronomical Bureau (欽天監) era practitioners refined and what nearly every professional in Singapore, HK and Taiwan uses for interiors today. Time-based, so it gives annual/monthly advice. |

Where the "imperial" claim actually lives: the Forbidden City and Ming/Qing tombs were sited with Form school plus Luoshu/Hetu numerology, and the court's geomancers were San He trained. Nobody used Flying Star to lay out a palace; it came later and was popularised for ordinary houses.

Recommendation for an app aimed at HDB/condo units: **Flying Star (San Yuan Xuan Kong) + Form checklist as the core**, Eight Mansions for each person's bed/desk direction, BaZi to rank directions and choose cure elements. Skip San He water methods in v1; add them if your masters do landed-property work.

## 10. Proposed conflict-priority order (for masters to confirm)

1. Annual afflictions (五黃, 太歲, 三煞, 歲破) override everything: no works, no sitting against, no disturbing.
2. Flying Star mountain/water stars decide what a room is good for (sleep, work, wealth) and what cure element it needs.
3. Eight Mansions decides each person's bed-head and desk-facing direction inside that room.
4. BaZi favourable elements rank the surviving options between family members and veto any cure whose element the person's chart cannot take.
5. Form-school checklist flags physical problems regardless of the above (beam, mirror, door alignment).

## 11. Open questions remaining

Items 1–4 are now planned in `smart-luopan-rulebook.md` (priority order, 用神 algorithm, cure catalogue, floor plan = upload with sketch fallback). Language = English.

Decided 2026-10-07: Singapore only (magnetic north, no declination step; 立春 on SGT clock). Every consult is stored (client, bearings, photos, chart, rules fired, advice, master overrides) for senior review.

No in-house master yet: rulebook defaults are adopted as written; the app is the master for junior consultants. Cures are generic suggestions, no SKUs or prices for now.

## 12. "Super AI feng shui master" — feasible, with one correction

**Wrong target: "everything on the web".** Web feng shui is mostly marketing copy, contradicts itself across lineages, and an AI fed all of it averages the contradictions into confident mush. The right target is **a curated corpus + the deterministic engine + your masters' own judgments**, with the model doing explanation, Q&A, drafting and cross-checking. It never computes charts or bearings itself.

### What it is

1. **Facts layer (code, not AI):** BaZi engine, compass reading, Flying Star / Eight Mansions / annual-star calculators, rule engine. Deterministic, testable.
2. **Knowledge layer (retrieval):** classical texts, public domain, in Chinese: 沈氏玄空學, 八宅明鏡, 陽宅三要, 葬書, 青囊奧語, 天玉經, 穷通宝鉴, 滴天髓, 子平真诠, 三命通會; plus your masters' notes, the rulebook, and every stored consult with its master overrides. Chunked and indexed; the model cites which passage supports each statement.
3. **Reasoning layer (Claude Opus 5.5, adaptive thinking):** given the computed facts and retrieved passages, it writes the report, answers a junior's "why", flags when two systems disagree and which rule won, drafts client-facing wording, and checks a draft for contradictions. Web search is on only for time-sensitive lookups (通書 dates, this month's stars) and only against an allow-list of sources.
4. **Learning loop:** every master override on a report becomes a labelled example. Monthly, run the eval set (section B5 of the rulebook) and re-tune prompts and rules. This is the only honest way the AI gets "better than the web": it learns your house style.

### Guardrails
- Model may only cite facts the engine computed; any number in the output is checked against the engine output before the report is shown.
- Structured output for the report (JSON schema) so the UI, PDF and audit trail stay consistent.
- Low-confidence charts and void-line facings still route to a human master.

### Reuse
mingpan.live already runs server-side Claude for daily forecasts (Haiku) and Decision Reading fulfilment (Opus). Same server, same key, same caching pattern; add the retrieval index and the report schema.

### Phasing
- AI-1 (with Phase 2 of the app): report writer + "why" explainer over engine facts and rulebook. ~1 week.
- AI-2: classical corpus retrieval with citations. Corpus prep is the work (OCR/cleanup of texts). ~2–3 weeks.
- AI-3: junior-master chat assistant during a site visit (ask anything about this house), fed by the consult record. ~1 week after AI-2.
- Ongoing: override-driven eval and tuning.

## Sources

- Luopan structure: https://en.wikipedia.org/wiki/Luopan , https://www.goldenhoard.net/luopan.htm
- Taking a facing reading: https://www.skillon.com/house-facing.cfm , https://fengshuitoday.com/?p=17127
- Eight Mansions: https://fengshuitoday.com/the-much-neglected-eight-mansions-method/ , https://www.yellowbridge.com/mysticism/fengshui-wiz1.php
- 2026 annual chart & afflictions: https://www.masterseanchan.com/fengshui-2026-flying-star-chart/ , https://fengshuitoday.com/feng-shui-for-the-bing-fire-horse-year-2026/
- Flying Star edge cases: https://roxyapi.com/blogs/feng-shui-api-evaluation-checklist , https://www.skillon.com/feng-shui-calculator.cfm
- HDB facing convention: https://www.masterseanchan.com/feng-shui-modern-templated-apartments/
- Sector overlay: https://en.wikipedia.org/wiki/Flying_Star_Feng_Shui
- Browser compass APIs: https://developer.mozilla.org/docs/Web/API/DeviceOrientationEvent , https://developer.chrome.com/blog/device-orientation-changes , https://dev.to/toolswebs1/building-a-compass-in-the-browser-how-the-deviceorientation-api-actually-works-3f37 , https://lists.w3.org/Archives/Public/public-geolocation/2024Jan/0035.html
- Generic Sensor / magnetometer status: https://developer.chrome.com/docs/capabilities/web-apis/generic-sensor
- Phone compass accuracy indoors: https://docs.blindsquare.com/m/31663/l/714003-is-the-compass-on-the-smartphone-smart-enough-when-traveling-indoors , https://hackaday.io/project/158795/log/148477 , https://arxiv.org/pdf/2006.02251
- Declination libraries: https://www.npmjs.com/package/geomag , https://classic.yarnpkg.com/en/package/geomagnetism
- Competitors: https://apps.apple.com/us/app/luopan-feng-shui-compass/id6736584559 , https://play.google.com/store/apps/details?id=com.earth.fengshui , https://appadvice.com/app/iluopan-pro-san-yuan/385701685
- Room scanning: https://developer.apple.com/augmented-reality/roomplan , https://github.com/laanlabs/openPlan3D
