# Classical corpus for Smart Luopan

Each `.md` file is one source. Format:

```
# source: 紫白訣
# era: Ming–Qing
# note: free text about the edition

## <section title> | tags: FS-25 二黑 五黃 | type: quote
<passage text, one or more paragraphs>
```

- `type: quote` = verbatim classical text (verify against a printed edition before relying on it).
- `type: note` = modern summary or practitioner commentary, not a classical quotation.
- `tags` are rule ids from `engine/fengshui.js` / `engine/flyingstar.js` and Chinese key terms. Retrieval matches tags first, then the passage text.

Two kinds of files:

- Hand-written seed files (`zibai-jue.md`, `bazhai.md`, `annual-sha.md`, `form-school.md`, `bazi-classics.md`, `xuankong-notes.md`): short well-known lines and practitioner notes, tagged by rule id. Covers texts not on Wikisource (紫白訣, 八宅明鏡, 陽宅三要, 子平真詮, 窮通寶鑑, 沈氏玄空學, 飛星賦).
- `full-*.md`: complete public-domain texts fetched from zh.wikisource.org by `node corpus/fetch.js` (青囊經, 青囊序, 青囊奧語, 天玉經, 玄機賦, 地理辨正, 天元五歌, 撼龍經/疑龍經, 催官篇, 宅經, 陽宅闡要, 陽宅指南, 滴天髓輯要, 滴天髓闡微, 窮通寶鑑, 淵海子平, 神峰通考, 三命通會; the Wikisource 葬書 page holds only a preface). Still not on Wikisource: 紫白訣, 八宅明鏡, 陽宅三要, 子平真詮, 沈氏玄空學, 飛星賦 — seed excerpts only. Chunks are ~360 characters and auto-tagged by keyword (see `KEYWORD_TAGS` in fetch.js). Re-run the fetch to refresh; edit `SOURCES` to add titles.

`corpus_chunks` is rebuilt from these files on server start whenever the file set changes.
