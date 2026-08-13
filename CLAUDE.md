# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A recreation of a text-mode worm/snake game remembered from the IBM PC circa 1984 — the Snake Byte
formula: eat every asterisk in a walled rectangle, then escape through an opening that appears in
the wall to clear the level. `SPEC.md` §1 records the provenance research behind the design.

## SPEC.md is authoritative

`SPEC.md` is the source of truth for all game behaviour: geometry, the tick sequence, collision
rules, the level/speed tables, scoring, and numbered acceptance requirements. Any behaviour change
must be made in `SPEC.md` first, then in the code. If the code and the spec disagree, the spec is
right and the code is a bug.

Details in the spec that are easy to get wrong and are deliberate:

- **Relative steering** (§6.3). `←`/`→` rotate the worm relative to its current heading; they do not
  set an absolute direction. At most one turn is buffered per tick, so two fast presses cannot
  compound into a 180° reversal.
- **The vacating tail** (§6.4 step 5). Moving the head into the cell the tail leaves on the same
  tick is legal when the worm is not growing. Excluding the tail from the self-collision check is
  intentional, not an oversight.
- **Exit ordering** (§6.4 steps 3–4). The exit cell is tested before the border, so the gap is
  passable while every other border cell stays fatal.

## Architecture

Single self-contained `index.html` — markup, CSS and JS inline. No build step, no package manager,
no dependencies, no network access at runtime.

The display emulates an 80×25 monochrome text screen: a character array is rewritten each tick and
written to one `<pre>` element in a single assignment. There is no per-cell DOM and no canvas.
Anything that changes the rendering goes through that array, not the DOM.

The clock is `requestAnimationFrame` with a time accumulator compared against the current level's
`tickMs`, so a level's speed change takes effect without tearing down and recreating timers.

## Running it

```sh
open index.html      # play
./tests/run.sh       # acceptance checks
```

`tests/run.sh` extracts the `<script>` block from `index.html` with `awk` and evaluates it in a
headless engine (macOS `jsc` by default, `node` as a fallback, override with `JSC=`) alongside
`tests/browser-stubs.js`, which stubs the handful of browser globals the game touches. Because of
that extraction, game logic must stay inside the single `<script>` block and must not depend on
browser APIs beyond those stubs.

`tests/acceptance.js` maps to the numbered requirements in `SPEC.md` §10 and drives `tick()`,
`render()` and the state object directly. Add a check there for any rule you add to the spec.
Requirement 8 and the feel of the speed curve are the only things still needing a human with a
browser.
