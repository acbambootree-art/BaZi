# Product

> Scope: the Smart Luopan staff tool (`luopan.html`, served at `/luopan`). The consumer site at mingpan.live (`index.html`, `today.html`) is a separate, brand-register surface that this file does not describe yet.

## Register

product

## Users

In-house feng shui masters on a consult inside a client's home in Singapore. Some are older and some are not yet experts. They work standing, usually one-handed, moving between the main door, the rooms and a brass luopan, mostly on mid-range Android phones in daylight. Only the master looks at the screen; the client receives the printed or AI-written report afterwards.

## Product Purpose

A dummy-proof guided consult: household birth data, a compass facing reading with quality gates, a floor plan with room sectors, then a rules-based report (Flying Star, Eight Mansions, BaZi 用神) with classical citations, saved for senior review. Success means a non-expert produces an accurate reading on site, with no data-entry or compass mistakes.

## Brand Personality

Calm, precise, trustworthy. An instrument, not a showpiece: it should feel like a well-made measuring tool that quietly gets out of the way.

## Anti-references

- Decorative glassmorphism, animated backdrops and shimmering gradient text (the previous version; it also stalled mid-range Android GPUs).
- Fortune-teller kitsch: red-and-gold overload, dragons, ornamental frames.
- Free-text fields where a picker removes the chance of error (a typed birth hour, a typed house type).

## Design Principles

1. **Precision over decoration.** Gold marks actions and the numbers that matter; nothing else competes with the reading.
2. **One hand, one glance.** Primary actions live in the bottom bar within thumb reach; every screen answers "what do I do next" at a glance.
3. **Impossible to enter wrong.** Prefer pickers, toggles and visible labels over typing and placeholders.
4. **Speak the trade's language.** English first, with the Chinese terms masters actually use (时辰, 坐向, 用神) shown alongside.
5. **Readable in daylight by older eyes.** Large text, strong contrast, generous targets.

## Accessibility & Inclusion

- Body text at least 17px, labels at least 14px, WCAG AA contrast as the floor.
- Touch targets at least 44px; no hover-only affordances.
- Motion only to convey state, and none under `prefers-reduced-motion`.
- English UI with Chinese labels on fields and section headings.
