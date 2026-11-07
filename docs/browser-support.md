# Browser support

Target: the last five years of evergreen browsers (roughly Chrome and Edge 100+, Firefox 100+, Safari 15.4+). Older browsers get a readable, working page but not every effect.

Only Chromium has been tested (see [ROADMAP.md](ROADMAP.md)). Everything below is from reading the code against browser compatibility data, not from running those browsers.

## What the site relies on, and what happens without it

| Feature | Used for | Without it |
|---|---|---|
| CSS grid, custom properties, `position: sticky` | layout, themes | none expected inside the target |
| `aspect-ratio` (Chrome 88, Safari 15, Firefox 89) | image lab boxes, hero art direction | boxes collapse until images load (layout jumps) |
| `<dialog>` (Safari 15.4) | progress panel | the XP button is hidden |
| `:focus-visible` (Safari 15.4) | focus rings | default outlines |
| `IntersectionObserver` | reveal on scroll, nav highlight, XP | shim shows everything immediately, no highlight or section XP |
| CSS `mask` with `-webkit-mask` | skill level pips | the level shows as a continuous bar instead of pips |
| `color-mix()` (Chrome 111, Safari 16.2, Firefox 113) | swarm selection box tint | a grey tint is used instead |
| `loading="lazy"` (Safari 15.4) | product images | images load immediately |
| `fetch` response streaming, `TextDecoder` | streamed chat replies | the widget requests a normal JSON reply instead |
| `navigator.sendBeacon` | analytics | analytics silently off |
| `clip-path: polygon()`, `mix-blend-mode`, `svh` units (Chrome 106, Safari 15.4, Firefox 101) | Renaissance Edition torn edges, chapter index, full-height hero | straight edges, plain index, hero uses `vh` |
| JavaScript | themes, chat, XP, swarm, persona switching | content, links, contact form and the generated role pages still work; the JavaScript-only controls are hidden |

Replaced for older browsers already: the `inset` shorthand (now explicit `top/right/bottom/left`), `matchMedia().addEventListener` (falls back to `addListener`).

Internet Explorer is not supported.
