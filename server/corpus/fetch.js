'use strict';

// ============================================================
// Fetch public-domain classical texts from Chinese Wikisource into
// server/corpus/full-<slug>.md in the corpus format (see README.md).
//   node corpus/fetch.js            # fetch all
//   node corpus/fetch.js zangshu    # one slug
// Texts are public domain (pre-20th-century); Wikisource transcriptions
// are CC BY-SA, attributed in each file header.
// ============================================================

const fs = require('fs');
const path = require('path');

const API = 'https://zh.wikisource.org/w/api.php';
const UA = 'SmartLuopanCorpus/1.0 (mingpan.live; cj@360nightnday.com)';

// slug -> { source, era, pages[], tags }
const SOURCES = {
  zangshu:      { source: '葬書', era: '晉·郭璞 (attr.)', pages: ['葬書'], tags: '巒頭 風水 氣' },
  qingnangxu:   { source: '青囊序', era: '唐·曾文辿 (attr.)', pages: ['青囊序'], tags: '玄空 FS-STRUCTURE' },
  qingnangaoyu: { source: '青囊奧語', era: '唐·楊筠松 (attr.)', pages: ['青囊奧語'], tags: '玄空 FS-STRUCTURE' },
  tianyujing:   { source: '天玉經', era: '唐·楊筠松 (attr.)', pages: ['天玉經內傳', '天玉經外編'], tags: '玄空 FS-STRUCTURE' },
  xuanjifu:     { source: '玄機賦', era: 'Ming–Qing 玄空 classic', pages: ['玄機賦'], tags: '玄空 飛星 FS-COMBO' },
  zhaijing:     { source: '宅經', era: '黃帝宅經 (attr.), pre-Tang', pages: ['宅經/卷上', '宅經/卷下'], tags: '陽宅 EM-ROOM EM-DOOR' },
  yangzhaichanyao: { source: '陽宅闡要', era: 'Qing', pages: ['陽宅闡要'], tags: '陽宅 EM-ROOM EM-DOOR' },
  yangzhaizhinan:  { source: '陽宅指南', era: 'Qing', pages: ['陽宅指南'], tags: '陽宅 EM-ROOM EM-DOOR' },
  ditiansui:    { source: '滴天髓輯要', era: 'Ming·劉伯溫 (attr.), Qing·陳之遴 輯', pages: Array.from({ length: 42 }, (_, i) => `滴天髓/${String(i + 1).padStart(2, '0')}`), tags: 'BZ-RANK 命理' },
  ditiansuichanwei: { source: '滴天髓闡微', era: 'Qing·任鐵樵 commentary', pages: ['滴天髓闡微'], tags: 'BZ-RANK 命理' },
  yuanhaiziping: { source: '淵海子平', era: 'Song·徐大升 / Ming ed.', pages: ['淵海子平'], tags: 'BZ-RANK 命理' },
  shenfengtongkao: { source: '神峰通考', era: 'Ming·張神峰', pages: ['神峰通考'], tags: 'BZ-RANK 命理' },
  qiongtongbaojian: { source: '窮通寶鑑', era: 'Qing compilation (調候 classic)', pages: ['穷通宝鉴'], tags: '調候 BZ-RANK 命理' },
  dilibianzheng: { source: '地理辨正', era: 'Qing·蔣大鴻', pages: ['地理辨正'], tags: '玄空 FS-STRUCTURE' },
  tianyuanwuge: { source: '天元五歌', era: 'Qing·蔣大鴻', pages: ['天元五歌'], tags: '玄空 陽宅 FS-STRUCTURE' },
  qingnangjing: { source: '青囊經', era: 'attr. 黃石公 (Han)', pages: ['青囊經'], tags: '玄空 巒頭' },
  hanlongjing: { source: '撼龍經 / 疑龍經', era: 'Tang·楊筠松 (attr.)', pages: ['撼龍經', '撼龍經/疑龍經/上篇', '撼龍經/疑龍經/中篇', '撼龍經/疑龍經/下篇', '撼龍經/疑龍經/疑龍十問', '撼龍經/疑龍經/變星篇', '撼龍經/疑龍經/衛龍篇', '撼龍經/葬法倒杖/倒杖十二法', '撼龍經/葬法倒杖/二十四砂葬法', '撼龍經/葬法倒杖/倍八卦'], tags: '巒頭 龍 FM-CORRIDOR' },
  cuiguanpian: { source: '催官篇', era: 'Song·賴文俊 (賴布衣)', pages: ['催官篇 (四庫全書本)/卷1', '催官篇 (四庫全書本)/卷2'], tags: '理氣 巒頭 二十四山' },
  sanmingtonghui: { source: '三命通會', era: 'Ming·萬民英', pages: ['三命通會/卷一', '三命通會/卷二', '三命通會/卷三', '三命通會/卷四', '三命通會/卷五', '三命通會/卷六', '三命通會/卷七', '三命通會/卷八', '三命通會/卷九'], tags: 'BZ-RANK 命理' },
};

// Keyword -> tags added to any chunk containing the keyword.
const KEYWORD_TAGS = [
  ['五黃', 'AF-5Y FS-5M FS-5W FS-ANNUAL-STACK'], ['二黑', 'AF-2B FS-25 FS-23'], ['二五', 'FS-25'], ['三碧', 'AF-3J FS-23 FS-37'],
  ['鬥牛', 'FS-23'], ['七赤', 'FS-67 FS-79 FS-37'], ['九紫', 'FS-99 FS-89 FS-79'], ['八白', 'FS-88 FS-89 FS-68'],
  ['一白', 'FS-11 FS-14 FS-16'], ['四綠', 'FS-14'], ['六白', 'FS-16 FS-67 FS-68'], ['文昌', 'FS-14'],
  ['太歲', 'AF-TAISUI AF-ZODIAC'], ['三煞', 'AF-SANSHA'], ['歲破', 'AF-SUIPO'],
  ['生氣', 'EM-BED EM-ROOM'], ['天醫', 'EM-BED EM-ROOM'], ['延年', 'EM-BED EM-ROOM'], ['伏位', 'EM-BED EM-ROOM'],
  ['禍害', 'EM-ROOM EM-DOOR'], ['五鬼', 'EM-ROOM EM-DOOR'], ['六煞', 'EM-ROOM EM-DOOR'], ['絕命', 'EM-ROOM EM-DOOR'],
  ['東四', 'EM-ROOM EM-DOOR'], ['西四', 'EM-ROOM EM-DOOR'],
  ['用神', 'BZ-RANK BZ-CURE-VETO'], ['喜神', 'BZ-RANK'], ['忌神', 'BZ-RANK BZ-CURE-VETO'], ['調候', '調候 BZ-RANK'], ['寒暖', '調候'],
  ['從格', '從格'], ['從財', '從格'], ['從殺', '從格'], ['從兒', '從格'], ['從旺', '從格'], ['通關', '通關'],
  ['身強', '扶抑 BZ-RANK'], ['身旺', '扶抑 BZ-RANK'], ['身弱', '扶抑 BZ-RANK'], ['月令', 'BZ-RANK'],
  ['旺山旺向', 'prosperous-mountain-prosperous-water FS-STRUCTURE'], ['上山下水', 'reversed FS-STRUCTURE'], ['龍神', 'FS-STRUCTURE'],
  ['穿堂', 'FM-CORRIDOR'], ['橫樑', 'FM-BEAM'], ['梁', 'FM-BEAM'], ['鏡', 'FM-MIRROR'], ['灶', 'FM-STOVE'], ['廁', 'FM-TOILET'], ['門', 'EM-DOOR'],
];

async function api(params) {
  const url = API + '?' + new URLSearchParams({ ...params, format: 'json' });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function wikitext(title) {
  const d = await api({ action: 'parse', page: title, prop: 'wikitext', redirects: 1 });
  if (d.error) throw new Error(`${title}: ${d.error.info}`);
  let wt = d.parse.wikitext['*'];
  // Expand <pages index="X.pdf" from="a" to="b" /> transclusions (scanned-book pages).
  const tags = [...wt.matchAll(/<pages\s+index="([^"]+)"[^>]*?from="?(\d+)"?[^>]*?to="?(\d+)"?[^>]*\/>/g)];
  for (const m of tags) {
    const [tag, index, from, to] = m;
    const parts = [];
    for (let n = +from; n <= +to; n++) {
      try {
        const pd = await api({ action: 'parse', page: `Page:${index}/${n}`, prop: 'wikitext' });
        if (!pd.error) parts.push(pd.parse.wikitext['*'].replace(/<noinclude>[\s\S]*?<\/noinclude>/g, ''));
      } catch (e) { console.warn(`  page ${index}/${n}: ${e.message}`); }
      await new Promise(r => setTimeout(r, 150));
    }
    wt = wt.replace(tag, '\n' + parts.join('\n') + '\n');
  }
  return wt;
}

function stripTemplates(s) {
  // remove {{...}} with nesting
  let out = '', depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.startsWith('{{', i)) { depth++; i++; continue; }
    if (s.startsWith('}}', i) && depth) { depth--; i++; continue; }
    if (!depth) out += s[i];
  }
  return out;
}

function unwrapFormatting(s) {
  // {{+|X}}, {{color|red|X}}, {{大|X}}, {{字|X}} etc. keep X (last argument); repeat for nesting.
  const re = /\{\{(?:\+|color|colour|大|小|字|big|small|center|居中|lang|lang-zh|ruby|bold|b|font)\|(?:[^{}|]*\|)*([^{}]*)\}\}/g;
  let prev;
  do { prev = s; s = s.replace(re, '$1'); } while (s !== prev);
  return s;
}

function clean(wt) {
  let s = stripTemplates(unwrapFormatting(wt));
  s = s.replace(/<!--[\s\S]*?-->/g, '')
       .replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
       .replace(/<noinclude>[\s\S]*?<\/noinclude>/g, '').replace(/<includeonly>|<\/includeonly>/g, '')
       .replace(/\[\[(?:File|Image|檔案|文件|Category|分類):[^\]]*\]\]/g, '')
       .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1')
       .replace(/\[https?:[^\s\]]*\s?([^\]]*)\]/g, '$1')
       .replace(/'{2,}/g, '')
       .replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(?:div|span|p|center|poem|big|small|font|sup|sub|table|tr|td|th|section|onlyinclude)[^>]*>/gi, '\n')
       .replace(/^[*#:;]+\s?/gm, '').replace(/^\|.*$/gm, '').replace(/^-{4,}$/gm, '')
       .replace(/__TOC__|__NOTOC__/g, '')
       .replace(/\r/g, '');
  return s;
}

function sections(text, fallbackTitle) {
  const out = []; let cur = { title: fallbackTitle, lines: [] };
  for (const line of text.split('\n')) {
    const h = line.match(/^(=+)\s*(.+?)\s*\1\s*$/);
    if (h) { if (cur.lines.join('').trim()) out.push(cur); cur = { title: h[2].replace(/<[^>]+>/g, '').trim(), lines: [] }; continue; }
    cur.lines.push(line);
  }
  if (cur.lines.join('').trim()) out.push(cur);
  return out;
}

// Split a section's text into chunks of roughly <= 360 characters on paragraph / sentence boundaries.
function chunk(text, max = 360) {
  const paras = text.split(/\n\s*\n|\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(p => p.length >= 2);
  const chunks = []; let buf = '';
  const push = () => { if (buf.trim()) chunks.push(buf.trim()); buf = ''; };
  for (let p of paras) {
    while (p.length > max) {
      // cut at the last 。！？； before max
      let cut = Math.max(p.lastIndexOf('。', max), p.lastIndexOf('；', max), p.lastIndexOf('！', max), p.lastIndexOf('？', max));
      if (cut < max * 0.4) cut = max;
      else cut += 1;
      if (buf) push();
      chunks.push(p.slice(0, cut).trim()); p = p.slice(cut).trim();
    }
    if ((buf + p).length > max) push();
    buf += (buf ? '\n' : '') + p;
  }
  push();
  return chunks;
}

function tagsFor(text, base) {
  const t = new Set(base.split(/\s+/).filter(Boolean));
  for (const [kw, tags] of KEYWORD_TAGS) if (text.includes(kw)) tags.split(' ').forEach(x => t.add(x));
  return [...t].join(' ');
}

async function fetchSource(slug) {
  const src = SOURCES[slug];
  const parts = [`# source: ${src.source}`, `# era: ${src.era}`, `# note: fetched from zh.wikisource.org (${src.pages.join(', ')}) on ${new Date().toISOString().slice(0, 10)} by corpus/fetch.js; transcription CC BY-SA, text public domain`, ''];
  let n = 0;
  for (const page of src.pages) {
    let wt;
    try { wt = await wikitext(page); } catch (e) { console.warn(`  skip ${page}: ${e.message}`); continue; }
    const text = clean(wt);
    const novel = wt.match(/\{\{Novel\|[^|}]*\|([^|}]+)\|/);
    const fallback = novel ? novel[1].trim() : page.replace(/^.*\//, '');
    for (const sec of sections(text, fallback)) {
      const cs = chunk(sec.lines.join('\n'));
      cs.forEach((c, i) => {
        const title = `${sec.title}${cs.length > 1 ? ` (${i + 1})` : ''}`.replace(/\|/g, '/');
        parts.push(`## ${title} | tags: ${tagsFor(c, src.tags)} | type: quote`, c, '');
        n++;
      });
    }
    await new Promise(r => setTimeout(r, 300)); // be polite
  }
  const file = path.join(__dirname, `full-${slug}.md`);
  fs.writeFileSync(file, parts.join('\n'));
  console.log(`${slug}: ${n} passages -> ${path.basename(file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

(async () => {
  const only = process.argv.slice(2);
  for (const slug of Object.keys(SOURCES)) {
    if (only.length && !only.includes(slug)) continue;
    await fetchSource(slug);
  }
})().catch(e => { console.error(e); process.exit(1); });
