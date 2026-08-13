# Worm — Functional Specification

Version 1.0 · 2026-08-13

This document is the source of truth for the implementation in `index.html`. Any behaviour change
must be made here first.

---

## 1. Provenance

The game being recreated is one remembered from the early IBM-PC era, around 1984: a worm moving
continuously inside a walled rectangle, eating randomly scattered asterisks, steered with the arrow
keys, dying on contact with a wall or with itself, and — distinctively — escaping through a small
opening that appears in the wall once every asterisk has been eaten.

No preserved DOS title matches that description exactly. The mechanic set is the **Snake Byte**
formula (Sirius Software, 1982): eat all the apples, a gate opens in the wall, drive the snake out
through it to clear the level, with speed ramping level over level. Snake Byte shipped for the
Apple II, Atari 8-bit, VIC-20 and Commodore 64 — never for the IBM PC. The PC version people
remember was almost certainly one of the many ASCII clones that circulated between 1983 and 1985 as
BASIC type-ins, BBS uploads and user-group disk fillers. The best-documented survivor of that wave
is John Chenault's *Snake!* (1984, MS-DOS, ASCII graphics), but its scoring is survival-based
rather than exit-the-gate, so it is not the same game. The rest went uncatalogued, which is why the
title cannot be found in MobyGames or My Abandonware today.

This project rebuilds the game from the remembered design rather than attempting to recover a
binary.

References:

- Snake Byte — <https://en.wikipedia.org/wiki/Snake_Byte>
- John Chenault's Snake! (1984) — <https://archive.org/details/msdos_John_Chenaults_Snake_1984>

## 2. Design decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Platform | One self-contained `index.html` | No build step, no dependencies, runs by double-clicking |
| Presentation | Emulated 80×25 monochrome text screen | Matches the original's text-mode look |
| Steering | Relative turning only | `←`/`→` rotate the worm relative to its heading, as in the original |
| Scope | Core loop + level/speed curve | No lives, no high-score persistence, no title screen, no pause |

The only addition beyond that scope is a one-line `GAME OVER — press R to restart` message, without
which a death would leave the page unrecoverable.

## 3. Screen layout

The display is a fixed 80×25 character grid rendered in a single monospace block.

- Rows 0–22: the playfield, including its border ring.
- Row 23: blank.
- Row 24: the status line.

Border characters use the CP437 box-drawing set: `╔ ═ ╗ ║ ╚ ╝`.

| Cell | Glyph |
| --- | --- |
| Worm head | `@` |
| Worm body | `o` |
| Asterisk (food) | `*` |
| Exit opening | space (the wall character is erased) |
| Empty interior | space |

Colours: background `#0b0f0a`, foreground `#33ff66`. The display is monochrome throughout, as it
would have been on a mono monitor of the period.

Mock-up (abbreviated to 30 columns for legibility; the real field is 80):

```
╔════════════════════════════╗
║   *        *               ║
║      ooooo@       *        ║
║  *                         ║
║         *          *       ║
╚════════════════════════════╝

 Level 1   Score 40   Left 4
```

With the exit open on the right wall:

```
╔════════════════════════════╗
║                            ║
║               ooooo@        
║                            ║
╚════════════════════════════╝
```

## 4. Geometry

- Screen: 80 columns × 25 rows, coordinates `(x, y)` with the origin at the top-left.
- Playfield border ring: `x = 0` and `x = 79`; `y = 0` and `y = 22`.
- Playfield interior: `x ∈ [1, 78]`, `y ∈ [1, 21]` — 78 × 21 = 1638 cells.
- Status line: row 24.

## 5. Game state

```js
{
  worm: [{x, y}, …],     // index 0 is the head, last element is the tail
  heading: {dx, dy},     // one of (1,0) (0,1) (-1,0) (0,-1)
  pendingTurn: -1 | 0 | 1,
  growth: 0,             // segments still owed from eating
  food: Set<"x,y">,
  exit: null | {x, y},
  level: 1,
  score: 0,
  phase: 'playing' | 'cleared' | 'dead'
}
```

## 6. Rules

### 6.1 Level setup

At the start of every level:

1. The worm is reset to 5 segments, laid horizontally at the left-centre of the field, heading east.
2. `growth` is reset to 0, `pendingTurn` to 0, `exit` to `null`.
3. `foodCount(level)` asterisks are placed. Each is sampled from a uniformly random interior cell
   and rejected if it is occupied by the worm or by an already-placed asterisk, so no two asterisks
   share a cell and none spawns underneath the worm.
4. The tick interval is set to `tickMs(level)`.

`score` carries across levels; it resets only on a restart after death.

### 6.2 Movement

The worm moves one cell per tick and never stops. It cannot be halted, only turned.

### 6.3 Turning

`←` sets `pendingTurn = -1` (counter-clockwise), `→` sets `pendingTurn = +1` (clockwise). Up and
down arrows do nothing. The turn is applied at the start of the next tick, then cleared:

- clockwise: `{dx, dy} → {-dy, dx}`
- counter-clockwise: `{dx, dy} → {dy, -dx}`

At most one turn is buffered per tick. Two keypresses arriving inside a single tick must not
compound into a 180° reversal — the second press overwrites the first rather than queueing behind
it.

### 6.4 Tick sequence

Each tick, in order:

1. Apply and clear `pendingTurn`.
2. Compute `next = head + heading`.
3. If `next` equals the exit cell → `phase = 'cleared'`; stop here.
4. Else if `next` lies on the border ring → `phase = 'dead'`; stop here.
5. Else if `next` collides with the worm's own body → `phase = 'dead'`; stop here. The tail cell is
   **excluded** from this check when `growth === 0`, because that cell is vacated on this same tick;
   moving the head into it is legal.
6. Move: prepend `next` to `worm`; if `growth > 0` decrement it, otherwise remove the tail.
7. If `next` held an asterisk: remove it from `food`, add 4 to `growth`, add 10 to `score`.
8. If `food` is now empty and `exit` is still `null`: open the exit.

### 6.5 Opening the exit

The exit is a single cell chosen uniformly at random from the border ring, excluding the four
corners. The wall character at that cell is erased, leaving a visible gap. Every other border cell
remains lethal.

### 6.6 Completing a level

Driving the head into the exit cell completes the level. On completion:

1. Add `level × 100` to the score.
2. Display `LEVEL n COMPLETE` centred in the field for approximately 1.2 seconds.
3. Increment `level` and run level setup (§6.1) again.

### 6.7 Death and restart

Death displays `GAME OVER — press R to restart` centred in the field. Pressing `R` restarts at
level 1 with `score = 0`. No other key resumes play.

## 7. Level and speed tables

- `foodCount(level) = 3 + 2 × level`
- `tickMs(level) = max(60, 200 − 20 × level)`

| Level | Asterisks | Tick (ms) |
| ---: | ---: | ---: |
| 1 | 5 | 180 |
| 2 | 7 | 160 |
| 3 | 9 | 140 |
| 4 | 11 | 120 |
| 5 | 13 | 100 |
| 6 | 15 | 80 |
| 7 | 17 | 60 |
| 8 | 19 | 60 |
| 9 | 21 | 60 |
| 10 | 23 | 60 |

Asterisk count grows without bound; speed is floored at 60 ms per tick from level 7 onward, so
levels beyond that get harder only through density.

## 8. Controls

| Key | Effect |
| --- | --- |
| `←` | Turn the worm 90° counter-clockwise |
| `→` | Turn the worm 90° clockwise |
| `R` | Restart at level 1 (only while dead) |

Arrow keys call `preventDefault()` so the page never scrolls during play.

## 9. Scoring

| Event | Points |
| --- | --- |
| Eating an asterisk | 10 |
| Completing a level | level × 100 |

## 10. Acceptance requirements

Numbered to be checked off directly against a running build. Requirements 2–7 are covered by the
automated checks in `tests/acceptance.js` (`./tests/run.sh`); 1 is partly covered there (grid shape,
glyphs, status line) and 8 is verified by a human in a browser.

1. **Render** — opening `index.html` shows an 80×25 text screen with the border, worm, asterisks
   and status line. The page does not scroll horizontally.
2. **Relative steering** — with the worm heading east, `←` sends it north and `→` sends it south.
   Two rapid `←` presses within one tick produce exactly one turn, never a reversal.
3. **Growth** — eating one asterisk lengthens the worm by 4 segments, adds 10 to `Score`, and
   decrements `Left` in the status line.
4. **Death** — driving into a wall ends the game; driving into the middle of the body ends the
   game; `R` then restarts at level 1 with score 0.
5. **Vacating tail** — when `growth === 0`, driving the head into the cell the tail occupies this
   tick is survivable, not fatal.
6. **Exit** — after the last asterisk on a level is eaten, a one-cell gap opens at a random
   non-corner border position. Every other border cell is still fatal. Driving the head into the gap
   advances to the next level and awards `level × 100`.
7. **Level curve** — level 2 has 7 asterisks and runs visibly faster than level 1; from level 7
   onward the tick interval stops decreasing.
8. **Self-contained** — the file loads and plays with no network access and no external assets.
