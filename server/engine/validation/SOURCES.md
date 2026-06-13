# Validation dataset — sources & methodology

This documents where every expected value in `charts.json` comes from, so the
dataset can be audited without trusting the engine under test.

## Core principle

**No expected value is ever produced by the engine being tested.** Expected
pillars come from independent reference implementations, cross-checked against
each other; rows where the applicable references disagree are rejected at
generation time (the run that produced the committed `charts.json` had **zero
rejections** across 269 rows).

## Reference implementations (oracles)

| | Implementation | Origin | What it verifies |
|---|---|---|---|
| A | [`lunar-javascript`](https://github.com/6tail/lunar-javascript) | 6tail (JS, own astronomy) | all four pillars, both zi-hour schools (sect 1/2), luck pillars, ten gods, hidden stems |
| B | [`lunisolar`](https://github.com/waterbeside/lunisolar) + `@lunisolar/plugin-char8ex` | waterbeside (independent JS codebase) | pillars, where its conventions apply (see caveats) |
| C | [`sxtwl` 寿星万年历](https://github.com/sxwnl/sxtwl_cpp) | Xu Jianwei's algorithms (C++ core, Python binding) | year/month/day pillars + **exact solar-term instants** |

These are three unrelated codebases with independently implemented
astronomy. Their term instants agree with each other (and with this engine)
to within ~33 seconds worst-case over 1850–2100.

### Oracle caveats discovered and handled

- **lunisolar** switches month/year ganzhi at *day* granularity (the whole
  term day belongs to the new month) and parses input in the *system*
  timezone. It is therefore only consulted when the system zone offset is
  exactly UTC+8 at the relevant instants (pre-1982 Singapore wall times are
  +7/+7:30 in IANA data) and, for month/year, when the birth's CST civil date
  contains no solar term. The generator enforces both conditions and asserts
  it runs on a UTC+8 system clock.
- **sxtwl** is also day-granular for month/year ganzhi, but it exposes exact
  term instants (`getJieQiJD`). `sxtwl_oracle.py` restores instant-exact
  switching using *sxtwl's own* instants (births on a term day before the
  instant take the previous day's month/year ganzhi) — so oracle C remains
  fully independent of this engine.
- **lunisolar valid range** is ~1901–2099; outside it, rows are verified by
  oracles A + C only (`verification.method: "dual-oracle"`).

## Frame conventions

All three oracles interpret input wall time as China Standard Time (UTC+8)
for solar-term comparisons. The engine's documented convention is:

- **year/month pillars**: absolute birth instant vs. term instant
  (timezone-independent);
- **day/hour pillars**: local civil time (optionally corrected to true solar
  time).

So each oracle is queried twice per row: once with the birth's local wall
time (day/hour), once with the birth instant converted to UTC+8 (year/month).
For true-solar-time rows the day/hour query uses wall time + (longitude −
zone meridian) × 4 min; the year/month query is *not* shifted — this is the
convention under test, stated in each row's `source`.

## Hand-verifiable anchors (`category: "anchor"`)

Each anchor row's `source` field spells out the published facts and the
classical rules that let a human verify it end-to-end, e.g.:

- **1949-10-01 was a 甲子 day** (widely published almanac fact; the engine's
  whole day-pillar sequence is anchored to it: index = (JDN + 49) mod 60).
- **1984 and 1924 are 甲子 years** (sexagenary cycle starts; `(year − 4) mod 60`).
- **2000-01-01 was a 戊午 day** (published in any 万年历).
- 立春-relative month rules verified by the 五虎遁 rhyme; hour stems by 五鼠遁.

## Term instants (`term-instants-sample.json`)

All 24 term instants for 13 sample years (1850–2100), exported from sxtwl
(CST-frame JD → UTC ISO). The unit test suite pins the engine's astronomy to
these within 90 seconds. Measured agreement of the engine:

- vs **sxtwl**: mean 7.7 s, max 32.8 s (312 instants, 1850–2100)
- vs **lunar-javascript**: mean ~11 s, max ~32 s (1,212 instants, 1900–2100)

The engine computes apparent solar longitude from a truncated VSOP87D Earth
series (201 terms; provenance: Bretagnon & Francou 1988, extracted from the
`astronomia` package by `extract-vsop.js`; worst-case truncation 0.48″),
plus IAU-1980 nutation (4 principal terms), annual aberration, and ΔT from
the Espenak–Meeus polynomials. Residual differences of tens of seconds
between any two implementations are dominated by ΔT-model and
nutation-truncation choices and are far below the 6-minute margin used for
boundary test cases.

## Luck pillars

Expected direction/sequence/start-age come from oracle A's `getYun(gender,
sect=2)` (exact-minutes school), queried in the CST frame so term distances
are absolute durations. The start age is also hand-verifiable: days from
birth to the adjacent jie term ÷ 3 (3 days = 1 year). The test tolerance is
±0.1 years (lunar-javascript reports whole days; 1 day = ~0.0009 y… rounding
plus its day-count conventions produce sub-0.05 y differences in practice).

## Ten gods & hidden stems

Attached to a subset of rows from oracle A (`getYearShiShenGan()` etc. /
`ZHI_HIDE_GAN`). Note: generating this dataset exposed a real bug — the
hidden-stem table this project's web client used for 巳 listed 丙戊庚, while
both oracle tables (and the 生地-branch systematic 寅甲丙戊 / 巳丙庚戊 /
申庚壬戊) order it 丙**庚**戊, which matters because middle vs. residual qi
carry different weights. The engine uses 丙庚戊.

## Reproducing

```bash
cd server
npm install                # installs JS oracles (devDependencies)
pip3 install --user sxtwl  # Python oracle
npm run gen:validation     # regenerates charts.json + term-instants-sample.json
npm test
```

The generator is deterministic (seeded RNG) and must run on a UTC+8 system
clock (it asserts this; lunisolar parses in the system zone).
