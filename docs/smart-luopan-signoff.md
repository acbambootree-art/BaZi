# Smart Luopan — master sign-off checklist

For the day a feng shui master joins or reviews the tool. Everything below is already running with the defaults in `docs/smart-luopan-rulebook.md`; the master's job is to confirm or change them. Budget: one afternoon with the app open on `https://mingpan.live/luopan` and this file.

## 1. Reading procedure (15 min)
- [ ] Facing is taken from inside the unit, back to the main door, phone flat. Confirm or change to "outside, facing the door".
- [ ] Two readings within 3° are required. Confirm the tolerance.
- [ ] A bearing within 3° of a mountain boundary is flagged "re-measure" and no 替卦 replacement stars are used. Confirm, or ask for 替卦.
- [ ] Magnetic north is used (no declination). Confirm for Singapore.

## 2. Period and facing conventions (10 min)
- [ ] Period = block TOP year, or major renovation year when there was one. Confirm; name what counts as "major".
- [ ] Facing = unit main door, never the balcony. Confirm.

## 3. Priority order (20 min) — rulebook A2
- [ ] Annual afflictions override everything (no works, no facing 太歲, no back to 三煞).
- [ ] Form problems are hard vetoes (beam, mirror, door line, toilet, stove–sink, sharp corner, 穿堂).
- [ ] Flying Star decides room use and cure element.
- [ ] Eight Mansions decides each person's bed head and desk facing.
- [ ] BaZi only ranks the remaining options and vetoes cure elements. Confirm BaZi should not override anything above.
- [ ] House-level 陽宅三要 verdict is report-only. Confirm or make it block.

## 4. Flying Star readings (20 min)
Open a saved consult and check the 3×3 grid against the master's own chart for the same facing and period.
- [ ] Chart matches (mountain, water, period stars in every palace).
- [ ] Structure name matches (旺山旺向 / 雙星到向 / 雙星到坐 / 上山下水).
- [ ] Named combinations the app warns on: 2-5, 2-3, 6-7, 7-9, 5-9, 2-9, 3-7; boosts: 1-4, 1-6, 6-8, 8-9, 9-9, 1-1. Add or remove pairs.
- [ ] Timeliness in Period 9: 9 current, 1 and 2 future, 8 fading, others retired. Confirm 2 as "future" or treat as illness star only.

## 5. Eight Mansions (10 min)
- [ ] Life Gua formula (last two digits, 2000 boundary, 5 → 2 male / 8 female). Confirm.
- [ ] Direction table for all eight gua (rulebook 2a). Confirm.
- [ ] Bedroom order 天醫 > 延年 > 伏位 > 生氣; desk order 生氣 first. Confirm.

## 6. BaZi favourable elements (20 min)
- [ ] The engine agrees with classical masters about half the time (rulebook B5). Decide: keep as tie-break only (current), or switch off until a master-labelled set reaches 80%.
- [ ] Label 20 charts of the master's choice with 用神 / 忌神 and add them to `server/engine/validation/yongshen.json`; run `npm run validate:yongshen`.
- [ ] Confirm the 调候 rule: override only at peak months when the element is entirely absent.

## 7. Cures (15 min) — rulebook C2/C3
- [ ] For each trigger row: show structural fix only / also show item / hide.
- [ ] Veto any item considered non-classical. (Salt-water cure is already excluded.)
- [ ] Supply the product list with prices when ready.

## 8. AI writer and chat (10 min)
- [ ] Read one generated client report. Mark anything the master would not say.
- [ ] Ask the on-site assistant three questions. Mark any answer that goes beyond the audit facts.
- [ ] Confirm the wording "chart-based preference" for BaZi advice stays until item 6 is settled.

## 9. Corpus (5 min)
- [ ] The seed quotes in `server/corpus/*.md` (紫白訣, 八宅明鏡, 陽宅三要, 子平真詮, 沈氏玄空學 lines) were written from memory; verify each against a printed edition and correct.
- [ ] If the master owns editions of the titles Wikisource lacks, add them as `.md` files in the same folder.

When every box is ticked, change the status lines at the top of the research brief and the rulebook from "adopted defaults" to "master-confirmed", and record the master's name and date.
