# Performance and cost audit

Date: 2026-11-07. Tool: `scripts/audit.mjs` (real Chrome over the DevTools protocol, no packages). Raw results: `docs/audit/results.json` (also shown in the owner page, Feature audit tab). Limits: `scripts/audit-budgets.json`, checked with `node scripts/audit.mjs --check` or `--from docs/audit/results.json`.

## How it was measured

Every scenario loads the page fresh, then runs with the CPU throttled 4x (roughly a mid-range phone) in headless Chrome. Headless Chrome rasterises in software, so paint-heavy effects (blur, blend modes, big gradients) look slower here than on a phone with a GPU; treat the numbers as a way to compare and to catch regressions, and confirm anything important on a real device with `?audit=1` on the address (a live frame-rate meter that sends nothing). Frame times come from `requestAnimationFrame` gaps; "p95" is the slowest 5 percent of frames; 16.7 ms is 60 frames per second. Scenarios ran in light theme. Results vary from run to run, most for the canvas editions (see finding 4). The `Nodes` change figures after leaving an edition are noisy because of when the browser collects garbage; use the leak table instead.

## Summary

| | Result |
|---|---|
| First page load (default view) | 237 to 286 KB, 13 to 14 requests, of which 109 KB is script (uncompressed; Netlify compresses) |
| Idle default page | 59.6 fps, no long tasks |
| Swarm | cheap: 4.9 s at 1x, 2.1 s at 4x, 59 fps, one 50 ms task |
| Chat answer streaming | smooth: 59 fps while 80 chunks arrive |
| Leaks | none: five enter and leave cycles of each of the eight editions leave memory, DOM nodes and listeners unchanged |
| Particles page and the four lab pages | 60 fps |
| **Cosmos + (light theme)** | **8 to 17 fps on desktop at 4x CPU, 23 fps on a phone size: the one clear problem** |
| **Renaissance +** | **7 to 29 fps and 4.6 s to enter at 4x CPU: second problem** |

## Editions (4x CPU, scrolling the whole page)

| Edition | fps | p95 frame ms | long tasks | idle p95 ms | time to ready ms | first-entry KB |
|---|---|---|---|---|---|---|
| swiss-plus | 51 | 16.8 | 0 | 16.8 | 283 | 12 |
| editorial-plus | 53 | 33.3 | 0 | 16.7 | 1456 | 49 |
| brutalist-plus | 60 | 16.7 | 1 | 16.7 | 746 | 12 |
| bauhaus-plus | 60 | 16.8 | 0 | 16.7 | 162 | 15 |
| minimal-plus | 60 | 16.7 | 0 | 16.8 | 258 | 12 |
| neural-plus | 51 | 33.4 | 0 | 16.7 | 515 | 21 |
| **cosmos-plus** | **7** | **283** | **48** | **233** | 815 | 22 |
| neural-plus, phone size | 8 (one run), 54 (repeat) | 167 (repeat 33) | 19 (repeat 0) | 50 | 1398 | 21 |
| **cosmos-plus, phone size** | **9 to 23** | **67 to 133** | **42 to 50** | 100 | 910 | 22 |
| **renaissance-plus** | **7** | **217** | **36** | **83** | **4608** | 0 (already loaded) |

## Findings, most serious first

### 1. High: Cosmos + draws too much per frame (worst in the light theme)
Evidence: at 4x CPU the desktop edition runs 7 to 17 fps with 48 to 61 long tasks adding up to about 6.5 s in a 7 s sample. A controlled test (entering the edition, then switching one thing off) gave: normal 18 fps; **canvas hidden 59 fps**; glass blur off 13 fps; shadows off 9 fps; canvas at half size 13 fps. So the canvas is the cost, not the blur or shadows. The dark theme runs at 60 fps with the same code, so something in the light-theme draw is far more expensive in software rendering; the exact reason is not proven.
Suggested fix (effort: half a day): draw the static layers (the two big radial glows and the orbit rings) once into an offscreen canvas and copy it each frame, redraw only the stars and planets, cap the loop at 30 fps on phone-size screens, and pause it when the tab is hidden or the canvas is scrolled away. Re-measure; target p95 under 50 ms.

### 2. High: Renaissance Edition is the heaviest page, and its grain overlay is the largest single cost
Evidence: 4.6 s to become ready at 4x CPU, 7 to 29 fps afterwards, 36 long tasks. Switching things off one at a time (light theme): normal 29 fps; **grain overlay off 57 fps**; blend modes off 17 fps; filters off 13 fps; canvases hidden 22 fps; shadows off 21 fps (the last four are within run-to-run noise, the grain result is not). The grain is a layer 140 percent of the viewport (`inset: -20%`) with `mix-blend-mode: overlay`, moved in five steps every 0.9 s (`.ren-art::after`, `ren-grain` in `styles.css`), which forces a large blended repaint on every step.
Suggested fix (effort: an hour): make the grain static with normal blending at low opacity (or a small tiled image), keep the movement only where the device can afford it (for example when frame times are healthy), and avoid `mix-blend-mode` on layers larger than a card. Then look at the 4.6 s entry time separately (building the stages and the scroll engine, not network: its files are already loaded).

### 3. Medium: every visitor downloads the Renaissance Edition although few open it
`edition.js` (30 KB) and `studio.js` (11 KB) are 41 KB of the 110 KB of script on every page, and the Renaissance block makes up a large part of `styles.css` (80 KB). The other seven editions already load on demand. Suggested fix (effort: half a day): load Renaissance the same way (the `LAZY` table in `editions-plus.js` already knows how) and move its CSS block to `edition-renaissance.css`. The default page would lose about a third of its script weight.

### 4. Medium: Neural + is moderate on desktop and unstable on a phone size
Evidence: 24 to 38 fps at 4x CPU in light theme depending on the run, p95 50 to 117 ms. Hiding the canvas, the blur or the text halo each changes little, so no single cause stands out. A phone-size run gave 8 fps with a 2.5 s stall once and 54 fps on repeat. Treat as a watch item: try it on a real phone with `?audit=1`; if it is slow there, cap the loop at 30 fps and lower the node count on small screens.

### 5. Low: the swarm is fine
4.9 s at 1x (2.1 s at 4x speed), 59 fps, one 50 ms long task, +8 nodes and +1 listener that are gone afterwards. It calls `getBoundingClientRect` per layer (149 ms of layout in total), which is acceptable. No action.

### 6. Low: no leaks, small constant leftovers
Five enter and leave cycles of each of the eight editions: heap +0.02 to 0.04 MB, nodes +0, listeners +0. After leaving, four listeners and 5 to 11 nodes remain (the two tags that load an edition's files, toasts and similar); they do not grow.

### 7. Low: one animation runs all the time on the default page
The pulsing dot beside the status line is an infinite CSS animation (`anim=1` while idle). Negligible, but it could stop when scrolled out of view.

### 8. Info: the chat
Browser side: streaming an 80-chunk answer costs 0.4 percent janky frames and one 52 ms task. Server side the per-visitor limit lives in one instance's memory (`chat.mjs` says so), so it did not cap total spend; that is now covered by a global daily token cap read from the shared counters (`CHAT_DAILY_TOKEN_CAP`, default 400,000 tokens), and the owner page shows tokens, outcomes and the cap. Costs can only be estimated once prices are supplied in `CHAT_PRICES`.

### 9. Not measured: web font
The first load fetches the Inter font from Google Fonts (47 KB). Self-hosting it would remove a third-party request and the connection to Google, and let the CSP drop the two Google hosts. Worth doing; not measured here.

## Budgets

`scripts/audit-budgets.json` sets: edition p95 frame time 50 ms, first-entry 60 KB, at most 12 nodes left behind; leak growth under 0.5 MB, 2 nodes and 2 listeners; swarm p95 34 ms and long tasks under 150 ms; idle and chat p95 34 ms; first-load script under 130 KB. Today the gate reports 8 breaches, all from findings 1, 2 and 4. When those are fixed the gate should pass; if a budget proves too tight for a real device, change it deliberately and say why.

## Re-running

```bash
node scripts/dev.mjs 8888                                   # in another terminal
node scripts/audit.mjs --out docs/audit/results.json       # full run, about 10 minutes
node scripts/audit.mjs --only editions --editions cosmos-plus   # one edition
node scripts/audit.mjs --check --quick                      # gate (3 leak cycles, shorter samples)
cp docs/audit/results.json ownerapp/audit.json              # refresh the owner page
```
