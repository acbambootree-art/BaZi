# BaZi engine — coverage & ambiguity report

Module: `server/engine` (zero runtime dependencies, CommonJS).
API: `computeChart(input) → chart` — see the JSDoc in [`index.js`](index.js).
Validated by 269 oracle-derived charts + 26 unit/property tests
(`npm test`, 295 passing). Dataset methodology: [`validation/SOURCES.md`](validation/SOURCES.md).

## What is covered (and explicitly tested)

| Area | Coverage |
|---|---|
| Year/month pillars at solar-term instants | 96 month-boundary rows (±6 min around 48 jie instants, 1900–2033) + 16 立春 rows (±7 min). Term astronomy pinned to an independent ephemeris within 90 s; test margins are 6–7 min. |
| Solar-term astronomy | Truncated VSOP87D + nutation + aberration + ΔT. Agreement with two independent ephemerides: ≤ 33 s worst-case, 1850–2100. |
| Day pillar | Continuous sexagenary count anchored at 1949-10-01 = 甲子; 500-date sweep vs oracle, 0 mismatches; exercised by every row. |
| Hour pillar incl. zi-hour split | 12 dedicated rows covering 23:00/23:30/23:59/00:00/00:30/00:59 in **both** zi-hour schools, plus unit tests. |
| True solar time | 12 rows (Urumqi, Lhasa, Singapore, Madrid, Tokyo) where the longitude correction flips the hour pillar and, across midnight, the day pillar. Year/month pillars proven invariant under the correction. |
| Timezones & date line | IANA zone resolution (incl. half-hour zones, historical offsets, China DST 1986–91); 11 date-line rows proving same-instant births share year/month pillars while day pillars differ; the Samoa 2011 skipped-day case. |
| Leap months | 16 rows inside/adjacent to 闰月 (1903–2023) proving lunar leap months never affect pillars (they are solar-term defined). |
| Luck pillars (大運) | Direction (all four gender × year-polarity combos), sequence from the month pillar, start age (3 days = 1 year, exact arithmetic) — cross-checked on ~70 rows ±0.1 y. |
| Ten Gods / hidden stems / five elements | Ten-god table verified against oracle on anchor + sampled rows and by completeness properties; hidden-stem table verified branch-by-branch against two oracles. |
| Unknown birth hour | Supported (null hour pillar; 6-character element counts); 4 rows. |
| Historic range | Rows from 1850; engine accepts 1700–2200 (ΔT model degrades gracefully outside 1800–2150). |

## What is NOT covered

- **Interpretation layers**: day-master strength, favorable elements,
  combinations/clashes (合冲刑害), 神煞 stars, 纳音 meanings — the engine emits
  raw 纳音 names only. The existing client keeps its own logic for these.
- **小運 / 流年 / 流月** (annual and pre-luck cycles): not part of the output.
- **Births at extreme polar latitudes**: latitude is accepted but unused;
  no school adjusts pillars for latitude, but "true solar time" is
  meaningless near the poles in winter. Unvalidated.
- **Sub-minute birth times**: input granularity is one minute. Births within
  ~1 minute of a term instant are genuinely ambiguous across ephemerides
  (ΔT differences); the engine emits a `solar-term-boundary` warning inside
  30 minutes rather than pretending to certainty.
- **Pre-1850 / post-2100 dates**: computable but outside the validated and
  ΔT-calibrated range.
- **Julian calendar inputs**: all dates are proleptic Gregorian.
- **19th-century local mean time**: historical China used local apparent
  time; the engine charts whatever civil clock you state (use
  `trueSolarTime` to make old charts sun-referenced).

## Ambiguities where schools disagree — and what this engine does

1. **Zi-hour day rollover** (the big one) — `options.ziHourMode`
   - `'rollover'` **(default)**: the day pillar advances at 23:00 local
     (子初换日). Matches lunar-javascript sect 1, lunisolar, and most
     modern practitioner software.
   - `'split'`: 夜子时 school — 23:00–23:59 keeps the current civil day's
     pillar; the hour pillar takes the *next* day's zi stem (both schools
     agree on the hour stem).
   - ⚠️ The existing web client ([index.html](../../index.html)) computes the
     day pillar from the civil date with *no* 23:00 handling and derives the
     late-zi hour stem from the *current* day — a third, non-standard variant.
     Worth aligning when the client adopts this engine.

2. **Year/month boundary frame for non-China births.** Some software
   compares the birth's *local wall clock* against term times published in
   CST — effectively shifting term instants by the zone difference. This
   engine compares **absolute instants** (the astronomically defensible
   reading, used by location-aware professional software): a birth's
   year/month pillars are the same wherever on Earth it happens; only
   day/hour pillars are local. Documented per-row in the dataset.

3. **True solar time.** Most casual software charts the civil clock;
   most serious practitioners correct longitude. Engine default is **off**
   (`trueSolarTime: false`) to match the existing product; turn it on per
   chart. The equation-of-time refinement (±16 min seasonal) is a further
   flag (`equationOfTime`), off by default — schools that correct longitude
   are themselves split on EoT.

4. **DST.** Practitioners agree charts should use standard time, but
   software differs on who removes the DST hour. This engine charts the
   civil clock it is given; with an IANA `timeZone` the true historical
   offset (incl. China's 1986–91 DST) feeds the absolute instant, and
   `trueSolarTime` fully sun-references the day/hour pillars. If you have a
   DST-era birth certificate time and want standard-time charting without
   TST, subtract the hour upstream.

5. **巳 hidden stems ordering**: 丙庚戊 (中气 庚) per both reference
   implementations and the 生地 systematic; some books print 丙戊庚. Only
   the middle/residual *roles* (and therefore element weights) differ, not
   membership.

6. **Five-element weighting.** No canonical standard exists. The engine
   reports `visible` (raw count of the 8 characters) and `weighted` (stems
   1.0; hidden stems 0.6/0.3/0.1 by role — 0.7/0.3 for two-stem branches).
   The weights are presentational, documented, and deliberately not a
   config flag until a product need appears.

7. **Luck-pillar start-age rounding.** Classical texts truncate to
   whole years/months (3 days = 1 year, 1 day = 4 months); some software
   rounds by hours. The engine computes the exact fractional distance to
   the adjacent jie term and reports both `decimalYears` and a
   years/months/days breakdown — display rounding is the caller's choice.
   Ages are western (实岁) decimals from birth, not 虚岁.

## Stability

`engineVersion` is embedded in every output. The output shape is locked by
a unit test; breaking changes require a version bump. The validation
dataset is committed and regeneration is deterministic, so any behavioral
drift fails 269 tests immediately.
