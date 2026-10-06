# Smart Luopan — rulebook plan (priority order, favourable elements, cures)

Date: 2026-10-07. Companion to `smart-luopan-research.md`. Status: adopted defaults (no in-house master yet; the app itself is the master for junior consultants), nothing built.

Decisions already fixed: facing = main door; period = TOP year or major-renovation date; users = in-house masters; BaZi for every household member; company sells cures; floor plan = upload, sketch fallback; English.

---

## A. Conflict-priority rulebook

### A1. What the research says about mixing systems

- Classical Eight Mansions is a **door and direction** method, not a room method. Treating sectors as rooms was a late-20th-century extension. So: use it for where the main door is relative to the house gua, and for each person's bed-head / desk-facing / sleeping-room choice.
- Flying Star is a **sector and time** method. It says what a sector is good for and what element it needs now. It modulates Eight Mansions: a good Eight Mansions door with hostile stars reads badly, and the reverse.
- Practitioners who keep both agree the resolution is "weigh plus and minus", never "one wins always". An app cannot weigh by feel, so we need a fixed order with explicit overrides. That is what A2 encodes.

### A2. The order (each layer only narrows what the layers above allow)

| # | Layer | Decides | Can be overridden by |
|---|---|---|---|
| 1 | **Annual afflictions** (五黃, 太歲, 三煞, 歲破; monthly 五黃 as a warning) | Hard bans: no renovation, no digging, no loud works in that sector; don't sit with back to 三煞; don't face 太歲; bed/desk not in 五黃 this year if any alternative exists | Nothing |
| 2 | **Form checklist** (beam, door-to-door, door-to-toilet, mirror-to-bed, stove-sink, bed-under-window, sharp corner at bed/desk) | Physical vetoes and structural fixes. A bed under a beam is bad in every school | Nothing (a master can mark "accepted risk") |
| 3 | **Flying Star** (mountain + water + period, then annual) | What each sector is *for* (sleep, study, wealth activation, storage) and which element it needs | Layer 1 |
| 4 | **Eight Mansions per person** | Which family member gets which room, bed-head direction, desk facing, within what layer 3 allowed | Layers 1–3 |
| 5 | **BaZi favourable elements per person** | Tie-break between remaining options; choose the cure *material/colour*; veto a cure whose element is that person's 忌神 | Layers 1–4 |
| 6 | **House-level Eight Mansions** (door vs house gua, 陽宅三要) | Overall house verdict and the "big fix" recommendations (merge rooms, change master bedroom) | Reported, not enforced |

### A3. Rule table format (what the masters will edit)

Each rule is one row; the engine evaluates rows in order of layer then priority.

```
id            | layer | trigger (condition on computed facts)                     | action                               | severity | cure_tags        | source
AF-5Y-RENO    | 1     | sector.annualStar == 5                                     | ban: renovation, drilling            | hard     | metal            | 沈氏玄空
AF-5Y-BED     | 1     | room.use == 'bedroom' && sector.annualStar == 5 && altExists | move bed/room; else cure             | hard     | metal            | 沈氏玄空
AF-TAISUI     | 1     | desk.facing in taiSuiMountain                               | rotate desk                          | hard     | —                | 通書
AF-SANSHA     | 1     | seat.backTo in sanShaMountains                              | rotate seat                          | hard     | —                | 通書
FM-BEAM       | 2     | bed.underBeam                                               | move bed; else false ceiling/canopy  | hard     | structural       | 巒頭
FM-MIRROR     | 2     | mirror.facesBed                                             | remove/cover at night                | medium   | structural       | 巒頭
FS-25         | 3     | stars.pair in {25,52}                                       | no bedroom/stove; metal cure         | high     | metal            | 沈氏玄空
FS-23         | 3     | stars.pair in {23,32}                                       | no study/office; metal cure          | medium   | metal            | 沈氏玄空
FS-67         | 3     | stars.pair in {67,76}                                       | water cure; avoid metal objects      | medium   | water            | 沈氏玄空
FS-88         | 3     | stars.pair == 88 && period == 8                             | activate: door/activity              | boost    | activity         | 沈氏玄空
EM-BED        | 4     | person.gua → bedHead ∈ person.goodDirs                      | set bed head                         | advise   | —                | 八宅明鏡
EM-ROOM       | 4     | room.sector ∈ person.badDirs && alt room exists             | reassign room                        | advise   | —                | 八宅明鏡
BZ-CURE-VETO  | 5     | cure.element == person.jiShen                               | pick next cure in same effect class  | override | —                | 子平
BZ-RANK       | 5     | several bedHead options survive                             | order by person.yongShen direction   | advise   | —                | 子平
```

The engine output per room: `verdict`, `who`, `bedHead`/`deskFacing`, `cures[]` (each with product SKU or structural step), `warnings[]`, and `why[]` listing the rule ids that fired. Masters see the ids; the report shows plain English.

### A4. Adopted defaults (no master to consult; revisit when one joins)

1. Bed-head direction with no good option in the room: least-bad (祸害) with a 泄 cure, and the report says "consider swapping rooms".
2. Period 9 charts: Shen school reading (prosperous star at sitting → health; at facing → wealth). No 替卦 replacement stars in v1. Void-line facings (within 3° of a boundary) produce a report marked "borderline facing, re-measure"; the app still gives advice for both neighbouring mountains and highlights where they differ.
3. Monthly stars: warning only.
4. Layer 6 (house gua, 陽宅三要): report only.
5. Salt-water cure: excluded. Objects are offered as element carriers after the structural fix.

---

## B. Favourable-element (用神) algorithm

### B1. Why we need to choose one

The validated engine stops at pillars, hidden stems, ten gods and element counts. Everything above that is interpretation, and practitioners genuinely differ. The plan: encode the mainstream 子平 method (扶抑 first, 调候 as an override, 通关 when two elements are at war, 从格 for extreme charts), emit a confidence score, and route low-confidence charts to a master.

### B2. Step 1 — day-master strength score

Use the published quantified method (position points, month branch doubled, hidden-stem grades). It is simple, auditable, and matches how most Chinese BaZi software scores.

Points per character:

| Character | Points |
|---|---|
| Year / month / hour stem | 5 each |
| Hidden stems in a branch | principal 5, middle 2, residual 1 (pure branches 子卯酉 = 8; 午 = 5 丁 + 3 己; 亥 = 5 壬 + 3 甲) |
| Month branch | hidden-stem points × 2 |
| Day branch | hidden-stem points × 1.2 (sits under the day master) |
| Rooted stem bonus | +2 when a stem has the same element in any branch's principal or middle stem (通根) |

Classify each scored stem relative to the day master: **same class** = 比劫 (same element) + 印 (element that produces the DM); **different class** = 官杀, 财, 食伤.

`score = Σ sameClass − Σ differentClass`, `total = Σ all`. Then:

- `ratio = score / total` (range −1…+1)
- `ratio > +0.65` → 从强 / 专旺 candidate (very strong): treat the dominant element as 用神 (follow, don't fight)
- `+0.10 … +0.65` → strong
- `−0.10 … +0.10` → balanced (low confidence; master review flag)
- `−0.65 … −0.10` → weak
- `ratio < −0.65` → 从弱 candidate (very weak): follow the strongest different-class element
- 从格 confirmation rule: no rooted 比劫 or 印 (for 从弱), or no rooted different-class stem (for 从强); otherwise downgrade to plain strong/weak.

Adjustments (v1 keeps these small and explicit): 天干五合 that transforms removes both stems from their original class; 地支六冲 on the month branch halves its points; 三合/三会 of a full set adds +5 to that element. Nothing else in v1.

### B3. Step 2 — choose 用神 / 喜神 / 忌神

Order of methods:

1. **调候 override** (from 穷通宝鉴 logic). Month branch in 亥子丑 and the chart has no Fire stem or principal hidden Fire → 用神 = Fire regardless of strength. Month in 巳午未 with no Water → 用神 = Water. Otherwise 调候 is only a 喜神 (secondary).
2. **扶抑 (balance)** — the default:
   - Strong DM: if strong because of many 比劫 → 用神 = 食伤 (drain), 喜神 = 财; if strong because of many 印 → 用神 = 财 (exhaust the 印), 喜神 = 官杀; if 官杀 present and rooted → 用神 = 官杀 (control). 忌神 = 印 and 比劫.
   - Weak DM: if weak because of 官杀/食伤 → 用神 = 印, 喜神 = 比劫; if weak because of 财 → 用神 = 比劫, 喜神 = 印. 忌神 = whichever class is heaviest among 官杀/财/食伤.
3. **通关 (mediation)**: if the two heaviest classes are in a controlling pair (e.g. heavy 财 vs heavy 比劫) and the mediating element exists in the chart, promote it to 喜神.
4. **从格**: 用神 = the followed element; 忌神 = anything that opposes it.

Output: `{ yongShen, xiShen, jiShen[], strengthRatio, method: 'fuyi'|'tiaohou'|'cong', confidence }`. `confidence` = high if |ratio| > 0.3 and no 调候 conflict; medium if 0.1–0.3 or 调候 and 扶抑 disagree; low if balanced or 从格 borderline → "master review" badge on the report.

### B4. Map to feng shui

| Element | Direction (24-mountain groups) | Colours | Materials / objects |
|---|---|---|---|
| Wood | E (甲卯乙), SE (辰巽巳) | green, teal | live plants, wood furniture, tall shapes |
| Fire | S (丙午丁) | red, purple, orange | lamps, red textiles, triangular shapes |
| Earth | NE (丑艮寅), SW (未坤申), centre | yellow, beige, brown | ceramics, stone, crystals, square shapes |
| Metal | W (庚酉辛), NW (戌乾亥) | white, gold, silver, grey | brass, pewter, round shapes, metal chimes |
| Water | N (壬子癸) | black, navy | still water, glass, wavy shapes |

Use: bed-head/desk-facing ranking (用神 direction first, 喜神 second, never 忌神), cure material choice (A2 layer 5), room colour advice, which family member takes which room.

### B5. Validation plan (no master available)

1. Build a **50-chart reference set from published analyses**: worked examples in 滴天髓, 子平真诠 and 穷通宝鉴 commentaries, plus modern practitioner write-ups that state birth data and 用神. Store as `validation/yongshen.json` with the source per row.
2. Run the algorithm; target ≥ 80% agreement on 用神. Disagreements are reviewed one by one: fix the rule if the source's reasoning is classical, mark "irreducible" if it is lineage-specific.
3. Second opinion: Claude Opus 5.5 with the classical passages in context grades each chart independently; three-way disagreements get the "master review" badge.
4. Ship with the confidence badge. The consultant can override 用神 with a reason; overrides are logged and become the next calibration set.

Effort: algorithm ~3 days; reference set ~2 days of collection.

---

## C. Cures catalogue (products + rituals)

### C1. An honest note before the list

Classical texts prescribe **placement, orientation, element/material and structure**, not objects. Some respected Singapore practitioners reject trinkets outright and only prescribe structural changes (move bed, swap rooms, merge rooms, align door–bedroom–stove). Others, and most retail feng shui, use objects as carriers of an element (brass = Metal, water bowl = Water). The salt-water cure in particular is a 1990s Western invention with no classical source.

Adopted: the app always gives the **structural/placement fix first**, then the **element carrier** as a practical fallback, then a ritual where one applies. Each is tagged `classical`, `modern` or `ritual` so the report can say which is which. No SKUs or prices for now; the report names generic items and quantities.

### C2. Cure map (trigger → structural fix → element → product → ritual)

**Annual afflictions (2026 positions in brackets)**

| Trigger | Structural / behavioural | Element | Product (suggested) | Ritual / service |
|---|---|---|---|---|
| 五黃 Five Yellow [S] | No renovation, drilling, hammering; keep quiet and still; no red, no candles, no fire | Metal (drain Earth) | Brass 葫蘆 wu lou; 6 emperor coins on red/yellow cord; 6-rod brass wind chime; brass bell | Annual 立春 re-audit |
| 太歲 Tai Sui [S2 午, 172.5–187.5°] | Don't face it when seated or sleeping; no works | — | 貔貅 Pi Yao pair facing the Tai Sui sector; 太歲符 amulet | 安太歲 at temple for Horse, Rat, Ox, Rabbit (2026) and anyone whose bed/desk must stay in S |
| 三煞 Three Killings [N] | Face it, never sit with back to it; no works | — | 三麒麟 three Qilin / 三獅 facing N | — |
| 歲破 Year Breaker [N2 子] | Keep still; no digging | — | (covered by 三麒麟) | — |
| 二黑 Illness star [NW in 2026] | No sick/elderly sleeping there if avoidable | Metal | Brass wu lou by the bed; metal calabash | — |
| 三碧 Dispute star [W in 2026] | Keep sector quiet, no arguments/meetings there | Fire (drain Wood) | Red lamp, red mat | — |

**Flying Star combinations (mountain-water, both orders)**

| Pair | Effect | Structural | Element | Product |
|---|---|---|---|---|
| 2-5 / 5-2 | Serious illness, loss | No bedroom, no stove; use as store | Metal | Brass wu lou + 6 coins; salt-free brass bowl |
| 2-3 / 3-2 (斗牛煞) | Quarrels, lawsuits, stomach | No study/office, no meetings | Metal (Earth→Metal→controls Wood) | 6-rod metal wind chime |
| 6-7 / 7-6 | Theft, fights, surgery | No sharp metal décor | Water (drain Metal) | Still water bowl, glass vase |
| 7-9 / 9-7 | Fire hazard, mouth/throat | No stove/candles here | Water / Earth | Water bowl; ceramic |
| 5-9 / 9-5 | Fire feeds 5 Earth: misfortune | Remove red/fire items | Metal | Brass bell |
| 1-4 / 4-1 | Romance, study, fame | Study/desk here | Wood/Water support | Plant, small water |
| 8-8 (Period 8 legacy) / 9-9 (Period 9) | Wealth | Main activity, door use | Activate with movement/light | Lamp, moving water (Period 9: light/fire activation) |

**Eight Mansions bad sectors (drain the star's element)**

| Sector type | Star element | Drain with | Product |
|---|---|---|---|
| 絕命 Jue Ming | Metal (破軍) | Water | Water bowl |
| 五鬼 Wu Gui | Fire (廉貞) | Earth | Ceramic, crystal, yellow |
| 六煞 Liu Sha | Water (文曲) | Wood | Live plant |
| 禍害 Huo Hai | Earth (祿存) | Metal | Brass object |

**Form school (always structural; product only as patch)**

| Problem | Fix | Patch |
|---|---|---|
| Beam over bed/desk | Move; false ceiling or canopy | Two bamboo flutes / 葫蘆 on beam (modern) |
| Door faces toilet / kitchen | Keep toilet door shut; screen | Curtain, plant |
| Mirror faces bed | Remove or cover | — |
| Bed head to window / door in line | Move bed to command position | Headboard, screen |
| Stove opposite sink / fridge | Reposition; wooden board between | Plant between (Wood mediates) |
| Sharp corner / 尖角煞 at bed | Reposition; round the corner | Plant, cloth |
| Long corridor to main door (穿堂煞) | Screen or console at entrance | Curtain, bead screen |

**Rituals / services (sellable as bookings)**

| Service | When | What the master does |
|---|---|---|
| 拜四角 Four-corners ritual | Before renovation / moving in | Offerings at the four corners + centre; incense; ask old occupants/spirits to leave |
| 入伙 Housewarming | Move-in date selected by 通書 | Date selection; rice/salt/pineapple; stove first lighting; tea offering |
| 淨宅 Space clearing | After a death, illness, or long vacancy | Sea salt, incense, sound (bell/singing bowl) |
| 安太歲 | After 立春 each year | Temple registration for affected zodiacs (2026: Horse, Rat, Ox, Rabbit) |
| 立春 annual re-audit | Every February | Re-run annual stars; move/retire cures |
| Renovation date & 動土 blessing | Before works | Date avoiding 五黃/太歲/三煞 sectors; ground-breaking rite |

### C3. Suggested cure items (generic, no SKUs or prices yet)

The report recommends by element and effect, one item per affected sector. Items are described so a consultant can buy or supply any equivalent.

| Element / effect | Items (any one) | Placement rule |
|---|---|---|
| Metal (for 2, 5, 2-5, 2-3, 5-9, Huo Hai) | brass 葫蘆 wu lou; six-coin string; 6-rod brass wind chime; brass bell; any solid brass or pewter object of hand size or larger | In the affected sector, at or above waist height, away from the bed head |
| Water (for 6-7, 7-9, Jue Ming) | glass bowl of still clean water, changed weekly; glass vase; dark-blue or black textile | In the affected sector, never in the bedroom if avoidable |
| Fire (for 3 dispute star, Period 9 activation) | red lamp kept on in the evening; red mat or cushion; warm-white lighting | In the sector; never in 五黃 or 2-5 sectors |
| Earth (for Wu Gui, grounding) | ceramic pot; natural stone; yellow or beige textile; citrine or quartz | In the sector, low placement |
| Wood (for Liu Sha, stove-sink conflict) | live plant with round leaves; wooden board or screen | Between conflicting items or in the sector |
| Symbolic guardians (Tai Sui, Three Killings) | Pi Yao pair facing the Tai Sui sector; three Qilin facing the Three Killings sector | Facing outward toward the affliction, not toward the bed |
| Structural | screen or console at entrance; false ceiling or canopy over beam; curtain over mirror; headboard | As the form rule states |
| Rituals (bookable services, pricing later) | 拜四角 before works; 入伙 date and rite; 淨宅 clearing; 安太歲 at a temple for affected zodiacs; 立春 re-audit | By 通書 date selection |


---

## D. Floor plan input (decided)

1. Upload photo/PDF of the HDB/condo plan → mark centre + main door → sectors overlay.
2. Fallback: on-screen sketch — drag rectangles for rooms on a grid, label each, mark door. Enough for sector assignment; no measurements needed.

## E. Language: English. Keep rule ids and Chinese terms in the data for the masters; report text English.

## F. Status

No in-house master exists yet, so the defaults in A4, B2/B3 and C are adopted as written. When a master joins, A4, the B5 reference set and the C2 provenance tags are the three things to review. SKUs and prices are deferred.

## Sources

- Mixing systems: https://fengshuitoday.com/the-much-neglected-eight-mansions-method/ , https://skillon.com:443/BaZi_FengShui_Q.cfm/2003/Flying-stars-vs-Eight-mansion , https://www.skillon.com:443/Bazi_FengShui.cfm/topic/How_to_apply_Eight_Mansions_Feng_Shui_(Part_1)_
- Strength scoring: https://www.cnblogs.com/mzbdadou/p/17072820.html , https://fengshuiocd.com/strength-of-daymaster/ , https://zhuanlan.zhihu.com/p/609578253 , https://www.suanzhun.net/article/2459.html , https://minglifenxi.cn/article/rizhu-qiangruo
- 调候: https://www.163.com/dy/article/K81K1AV10548D4FR.html
- Flying Star combinations & cures: https://www.skillon.com/bazi-feng-shui.cfm/topic/Flying-Stars-combinations-in-FengShui , https://www.skillon.com/bazi-feng-shui.cfm/topic/203/Various-approaches-to-feng-shui-cures-(1) , https://fengshuitoday.com/?p=17389
- 2026 afflictions: https://fengshuitoday.com/?p=18764 , https://www.masterseanchan.com/fengshui-2026-flying-star-chart/ , https://www.bowtie.com.hk/blog/en/hot-topics/offending-tai-sui/
- Classical-vs-retail cures: https://www.masterseanchan.com/es/blog/que-es-realmente-un-remedio-feng-shui/ , https://www.masterseanchan.com/feng-shui-salt-water-cure-myth/ , https://fengshuibyjen.com/tips-educational/what-is-a-feng-shui-wu-lou/
- Rituals: https://shopee.sg/blog/moving-house-feng-shui-rituals/ , https://www.99.co/singapore/insider/auspicious-housewarming-dates/ , https://thesmartlocal.com/read/home-blessing-rituals/
