#!/usr/bin/env python3
"""Oracle C for the BaZi validation dataset: sxtwl (寿星万年历).

A third, independently-implemented Chinese calendar (Xu Jianwei's
algorithms; C++ core, no shared code with lunar-javascript or lunisolar).

sxtwl's year/month ganzhi switch at DAY granularity (the whole term day
belongs to the new month), so this wrapper restores instant-exactness
using sxtwl's OWN exact term instants (getJieQiJD, CST-frame JD): when
the birth falls on a term day but before the term instant, the
previous day's year/month ganzhi apply.

The hour pillar is derived from the day stem by the standard 五鼠遁 rule
(not an independent data source - lunar-javascript/lunisolar cover that).

stdin:  JSON {"queries": [{id, cst: [y,m,d,h,min], local: [y,m,d,h,min],
                            ziHourMode, hourKnown}],
              "jieqiYears": [years...]}
stdout: JSON {"results": {id: {year, month, day, hour}},
              "jieqi": {year: [[y,m,d,h,min,sec_jd_cst]...]}}
"""
import sys
import json
import math
import sxtwl

GAN = '甲乙丙丁戊己庚辛壬癸'
ZHI = '子丑寅卯辰巳午未申酉戌亥'


def gz(g):
    return GAN[g.tg] + ZHI[g.dz]


def jd_midnight(y, m, d):
    if m <= 2:
        y -= 1
        m += 12
    a = y // 100
    b = 2 - a + a // 4
    return math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (m + 1)) + d + b - 1524.5


def day_at_offset(y, m, d, days):
    t = sxtwl.JD2DD(jd_midnight(y, m, d) + 0.5 + days)  # noon +/- N days
    return sxtwl.fromSolar(t.Y, t.M, t.D)


def pillars(q):
    cy, cm, cd, ch, cmin = q['cst']
    birth_jd_cst = jd_midnight(cy, cm, cd) + (ch * 60 + cmin) / 1440.0
    ref = sxtwl.fromSolar(cy, cm, cd)
    if ref.hasJieQi() and birth_jd_cst < ref.getJieQiJD():
        ref = day_at_offset(cy, cm, cd, -1)
    year_gz = gz(ref.getYearGZ())
    month_gz = gz(ref.getMonthGZ())

    ly, lm, ld, lh, lmin = q['local']
    d_for_pillar = sxtwl.fromSolar(ly, lm, ld)
    if q['hourKnown'] and lh * 60 + lmin >= 1380 and q['ziHourMode'] == 'rollover':
        d_for_pillar = day_at_offset(ly, lm, ld, 1)
    day_gz = gz(d_for_pillar.getDayGZ())

    hour_gz = None
    if q['hourKnown']:
        branch = (lh * 60 + lmin + 60) // 120 % 12
        tg = d_for_pillar.getDayGZ().tg
        pos = 12 if (lh >= 23 and q['ziHourMode'] == 'split') else branch
        hour_gz = GAN[((tg % 5) * 2 + pos) % 10] + ZHI[branch]

    return {'year': year_gz, 'month': month_gz, 'day': day_gz, 'hour': hour_gz}


def jieqi_instants(year):
    """All exact term instants (CST-frame JD) whose CST date falls in `year`."""
    out = []
    jd = jd_midnight(year, 1, 1) + 0.5
    end = jd_midnight(year, 12, 31) + 0.5
    while jd <= end:
        t = sxtwl.JD2DD(jd)
        day = sxtwl.fromSolar(t.Y, t.M, t.D)
        if day.hasJieQi():
            out.append(day.getJieQiJD())
        jd += 1
    return out


def main():
    req = json.load(sys.stdin)
    results = {}
    for q in req.get('queries', []):
        results[q['id']] = pillars(q)
    jieqi = {}
    for y in req.get('jieqiYears', []):
        jieqi[str(y)] = jieqi_instants(y)
    json.dump({'results': results, 'jieqi': jieqi}, sys.stdout, ensure_ascii=False)


if __name__ == '__main__':
    main()
