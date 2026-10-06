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

The files shipped here are **seed excerpts** written from well-known lines. To add full texts, drop public-domain editions (e.g. from zh.wikisource.org or ctext.org) into this folder in the same format and restart the server; `corpus_chunks` is rebuilt from these files when the file set changes.
