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
| Scope | Core loop + level/speed curve | No lives, no high-score persistence |
| Length | 10 levels, then a victory screen | A run has an ending, rather than trailing off into a worm too long to survive |
| Finale | Level 10 drops back to level 1's speed and lays its asterisks out as a peace sign | The joke: the game builds to level 9's peak, then hands over a slow puzzle |
| Start | The game waits on a title screen; `S` starts play | Nothing moves until the player is ready |
| Help | `H` opens a help screen from anywhere, and freezes play while it is up | Reference for the relative-steering controls, which are unfamiliar today |
| Pause | `Space` pauses and resumes play | The worm never stops on its own, so there has to be a way to step away |

The only other addition beyond the core scope is a one-line `GAME OVER — press R to restart`
message, without which a death would leave the page unrecoverable.

## 3. Screen layout

The display is a fixed 80×25 character grid rendered in a single monospace block.

- Rows 0–22: the playfield, including its border ring.
- Row 23: blank.
- Row 24: the status line.

The wall is drawn with the CP437 full block `█` in every border cell, corners included — one solid
glyph filling the whole cell, so the rectangle reads as a thick wall rather than a thin line. There
are no corner pieces to special-case.

| Cell | Glyph |
| --- | --- |
| Wall | `█` |
| Worm head | `@` |
| Worm body | a box-drawing piece, chosen per segment — see §3.1 |
| Asterisk (food) | `*` |
| Exit opening | space (the wall character is erased) |
| Empty interior | space |

### 3.1 Worm body glyphs

The body is drawn as a continuous line in the CP437 double-line set, not as a run of repeated
characters. The walls being solid blocks (§3) keeps the two clearly distinct: nothing on screen
except the worm is made of line pieces. Each segment's glyph is chosen from the directions of the segments it
connects to — the one ahead of it toward the head, and the one behind it toward the tail — so the
worm bends visibly at every turn:

| Connects | Glyph |
| --- | --- |
| north + south | `║` |
| east + west | `═` |
| south + east | `╔` |
| south + west | `╗` |
| north + east | `╚` |
| north + west | `╝` |

The tail segment has only one neighbour, so it takes the straight piece for that axis: `║` if the
neighbour is north or south, `═` if it is east or west. The head is always `@`, so that the
direction of travel stays readable at speed.

A worm heading east, turning north (a left turn), then east again:

```
        ╔══@
        ║
 ═══════╝
```

Because the worm never reverses (§6.3) and dies on self-contact (§6.4), a segment can only ever
connect two distinct directions, so no other combinations arise.

Colours: background `#0b0f0a`, foreground `#33ff66`. The display is monochrome throughout, as it
would have been on a mono monitor of the period.

Mock-up (abbreviated to 30 columns for legibility; the real field is 80):

```
██████████████████████████████
█   *        *               █
█      ═════@       *        █
█  *                         █
█         *          *       █
██████████████████████████████

 Level 1   Score 40   Left 4
```

With the exit open on the right wall:

```
██████████████████████████████
█                            █
█              ═════@         
█                            █
██████████████████████████████
```

The title screen (§6.8) and help screen (§6.9) replace the playfield contents while they are up;
the border and the status line are always drawn.

```
██████████████████████████████
█          W O R M           █
█                            █
█   Eat every asterisk,      █
█   then escape.             █
█                            █
█   S  start     H  help     █
██████████████████████████████

 Press S to start    H for help
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
  phase: 'title' | 'playing' | 'paused' | 'cleared' | 'dead' | 'won' | 'help',
  resumePhase: 'title',  // the phase the help screen was opened from
  eaten: 0               // asterisks eaten on the current level, for the level 10 growth cap
}
```

The initial phase is `title`. Ticks run only while the phase is `playing`, so the worm does not
move on the title screen, on the help screen, while paused, during the level-complete pause, after
death, or on the victory screen.

## 6. Rules

### 6.1 Level setup

At the start of every level:

1. The worm is reset to 5 segments, laid horizontally at the left-centre of the field, heading east.
2. `growth` is reset to 0, `pendingTurn` to 0, `exit` to `null`, `eaten` to 0.
3. Asterisks are placed:
   - **Levels 1–9:** `foodCount(level)` of them, each sampled from a uniformly random interior cell
     and rejected if it is occupied by the worm or by an already-placed asterisk, so no two share a
     cell and none spawns underneath the worm.
   - **Level 10:** the fixed peace-sign pattern of §6.11, not random placement.
4. The tick interval is set to `tickMs(level)`.

`score` carries across levels; it resets only on a restart after death or from the victory screen.

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
3. If `next` equals the exit cell → the level is complete (§6.6); stop here.
4. Else if `next` lies on the border ring → `phase = 'dead'`; stop here.
5. Else if `next` collides with the worm's own body → `phase = 'dead'`; stop here. The tail cell is
   **excluded** from this check when `growth === 0`, because that cell is vacated on this same tick;
   moving the head into it is legal.
6. Move: prepend `next` to `worm`; if `growth > 0` decrement it, otherwise remove the tail.
7. If `next` held an asterisk: remove it from `food`, increment `eaten`, add 10 to `score`, and add
   4 to `growth` — except on level 10, where only the first 10 asterisks grow the worm (§6.11).
8. If `food` is now empty and `exit` is still `null`: open the exit.

### 6.5 Opening the exit

The exit is a single cell chosen uniformly at random from the border ring, excluding the four
corners. The wall character at that cell is erased, leaving a visible gap. Every other border cell
remains lethal.

### 6.6 Completing a level

Driving the head into the exit cell completes the level. On completion, `level × 100` is added to
the score, and then:

- **Levels 1–9:** `LEVEL n COMPLETE` is displayed centred in the field for approximately 1.2
  seconds, after which `level` is incremented and level setup (§6.1) runs again.
- **Level 10:** the game is won — phase `won`, and the victory screen of §6.12 is shown.

### 6.7 Death and restart

Death displays `GAME OVER — press R to restart` centred in the field. Pressing `R` restarts at
level 1 with `score = 0`. No other key resumes play.

### 6.8 Title screen

The page opens on the title screen and nothing moves until the player starts the game. The
playfield is drawn empty — no worm, no asterisks — with the game's name and a one-line summary of
the objective centred in it, and the status line reads `Press S to start    H for help`.

Pressing `S` begins a new game: level 1, score 0, level setup per §6.1, phase `playing`. `S` has no
effect in any other phase. The title screen is reachable only at load; after a game over the
restart key is `R` (§6.7).

### 6.9 Help screen

`H` opens the help screen from any phase. It replaces the playfield contents with a summary of the
objective, the controls and the scoring, and sets the status line to `Press H or ESC to return`.

While the help screen is up the game is frozen: no ticks run, and no key other than `H` or `Escape`
has any effect. Pressing either returns to the phase help was opened from, stored in `resumePhase`.
On return:

- the tick accumulator is reset, so a long look at the help screen cannot bank up ticks and jump
  the worm forward on resume;
- if the phase being returned to is `cleared`, its display timer restarts, so the
  `LEVEL n COMPLETE` message is still readable for its full duration.

`H` pressed while the help screen is up closes it, making the key a toggle.

### 6.10 Pause

`Space` pressed while playing pauses the game: ticks stop and `PAUSED — press SPACE to resume` is
shown centred in the field. The playfield stays on screen, worm and asterisks included, and the
status line keeps showing level, score and asterisks remaining.

`Space` pressed while paused resumes play. As when leaving the help screen (§6.9), the tick
accumulator is reset on resume, so time spent paused cannot bank up ticks.

`Space` has no effect in any other phase, and no key other than `Space` or `H` does anything while
paused — in particular the arrow keys are ignored, so a turn cannot be queued up while the game is
frozen. `H` opens help from the paused state and returns to it.

### 6.11 Level 10, the finale

Level 10 breaks the curve deliberately, and the player is given no warning of it.

**Speed.** It runs at 180 ms per cell — exactly level 1's speed — after level 9 has peaked at the
60 ms floor.

**Layout.** Its asterisks are not placed randomly. They spell out a peace sign centred in the
field: an ellipse of radius 17 × 8.5 cells (which reads as a circle, character cells being about
twice as tall as wide), a vertical stroke down its full diameter, and two strokes from the centre
to the lower left and lower right. Those two run 2 cells horizontally per 1 cell vertically, so
they read as 45° on screen, and each is drawn 2 cells wide so it has the same visual weight as the
vertical. Every stroke is clipped to the circle. The pattern comes to roughly 140 asterisks; the
exact count is whatever the geometry produces, and `foodCount(10)` reports it.

Any pattern cell that would fall on the starting worm is dropped, though with the worm starting at
the far left and the circle centred, none does.

**Growth.** Only the first 10 asterisks eaten on level 10 grow the worm; the remaining ~130 score
normally but add nothing. The worm therefore finishes the level at about 45 segments instead of the
~565 that uncapped growth would produce. Level 10 is a lap of honour, not a survival test — the
point is to trace the shape, and a worm long enough to trap itself would ruin that.

### 6.12 Victory screen

Clearing level 10 wins the game. The victory screen replaces the playfield with `Y O U   W I N`,
the number of levels cleared and the final score, and the status line reads
`Press R to play again`.

`R` starts a new game at level 1 with score 0. As in every other non-playing phase, no ticks run.
`H` opens help from here and returns to it.

## 7. Level and speed tables

The game is 10 levels long. Levels 1–9 ramp; level 10 is the finale of §6.11.

- `foodCount(level) = 3 + 2 × level` for levels 1–9; for level 10, the size of the peace-sign
  pattern (~140).
- `tickMs(level) = max(60, 195 − 15 × level)` for levels 1–9; for level 10, `180`.

| Level | Asterisks | Tick (ms) | Grows the worm |
| ---: | ---: | ---: | :--- |
| 1 | 5 | 180 | every asterisk |
| 2 | 7 | 165 | every asterisk |
| 3 | 9 | 150 | every asterisk |
| 4 | 11 | 135 | every asterisk |
| 5 | 13 | 120 | every asterisk |
| 6 | 15 | 105 | every asterisk |
| 7 | 17 | 90 | every asterisk |
| 8 | 19 | 75 | every asterisk |
| 9 | 21 | **60** | every asterisk |
| 10 | ~140 (peace sign) | **180** | first 10 only |

The ramp is sized so that level 9 lands exactly on the 60 ms floor — the peak arrives at the last
ramping level rather than partway up, and every level before it is genuinely faster than the one
before. Level 10 then drops back to level 1's speed, which is the surprise.

Because the interval falls linearly while speed is its reciprocal, the felt acceleration grows: the
step from level 1 to 2 is +9% speed, the step from 8 to 9 is +25%.

## 8. Controls

| Key | Effect | Active in phase |
| --- | --- | --- |
| `←` | Turn the worm 90° counter-clockwise | `playing` |
| `→` | Turn the worm 90° clockwise | `playing` |
| `S` | Start a new game at level 1 | `title` |
| `Space` | Pause, or resume if already paused | `playing`, `paused` |
| `R` | Restart at level 1 | `dead`, `won` |
| `H` | Open the help screen, or close it if it is already open | any |
| `Escape` | Close the help screen | `help` |
| `+` | Jump forward one level — **test mode only** (§10) | `playing` |
| `-` | Jump back one level — **test mode only** (§10) | `playing` |
| `I` | Toggle invulnerability — **test mode only** (§10) | `playing` |

The arrow keys and `Space` call `preventDefault()` unconditionally so the page never scrolls during
play, as does any other key the current phase acts on. Keys carrying a Cmd, Ctrl or Alt modifier are
passed through to the browser untouched.

Key handling is a single pure-ish function taking a key name and dispatching on `state.phase`, so
the acceptance checks can drive the keyboard without a browser.

## 9. Scoring

| Event | Points |
| --- | --- |
| Eating an asterisk | 10 |
| Completing a level | level × 100 |

## 10. Test mode

The game is hard, and the upper levels are the hardest to reach — which makes them the hardest to
look at in a browser. Test mode exists so the speed ramp, the finale and the victory screen can be
inspected without playing eight levels first. It is a development tool, not a feature: it is
documented here and in `CLAUDE.md`, and deliberately not in the README.

### 10.1 Activation

Test mode is on **if and only if** the page URL carries a `level` query parameter that parses to an
integer in `1..10`. There is no other way to enable it.

`parseTestLevel(search)` takes a query string and returns that integer, or `null`. It returns
`null` for an absent, empty, non-numeric or out-of-range value, and a `null` result means an
entirely ordinary game — a malformed parameter must never produce a broken one. The function takes
the query string as an argument rather than reading `location` itself, so the acceptance checks can
exercise it without a browser.

| Query string | Result |
| --- | --- |
| *(none)*, `""` | `null` — normal game |
| `?level=1` … `?level=10` | that level, test mode on |
| `?level=0`, `?level=11` | `null` — out of range |
| `?level=abc`, `?level=` | `null` — unparseable |
| `?foo=1&level=3` | `3` — position in the query string does not matter |

`?level=1` counts as test mode: the game starts at level 1 as usual, but with the test keys live,
so a clean run can be stepped upward.

### 10.2 State

Test mode adds three fields to the state of §5:

- `testMode` — set once at activation, never toggled at runtime.
- `startAtLevel` — the level a new game begins at, `1` normally. `restart()` uses this rather than a
  hardcoded 1, so `R` after a death returns to the level under test.
- `invincible` — toggled by `I`.

### 10.3 Keys

`+`, `-` and `I` do nothing at all unless `testMode` is set — they report the key as unhandled, so
the browser's own default is not even suppressed. A player who has not activated test mode cannot
tell they exist.

- `+` and `-` while `playing` step the level by ±1, clamped to `1..10`, then run level setup (§6.1)
  to rebuild the board. **No level bonus is awarded** — a jump is not a completion.
- `=` is accepted as a synonym for `+` (it is the same physical key unshifted) and `_` for `-`.
- `I` while `playing` toggles `invincible`.

### 10.4 Invulnerability

While `invincible` is set, neither fatal collision of §6.4 kills, but they differ:

- **Self-collision** is skipped entirely — the worm passes through its own body.
- **A move into the wall is refused.** The worm keeps its heading but does not advance, idling
  against the wall until it is turned. It is not allowed onto the border, which would draw the worm
  over the wall glyphs and could carry it out of the field.

The exit check still runs first, so levels can still be completed with invulnerability on.

Invulnerability is sticky across `restart()`: dying should not cost it while iterating on a level.
It is cleared only by pressing `I` again, or by reloading the page.

### 10.5 Display

The status line carries a marker so a screenshot can never be mistaken for a real run: `TEST` while
test mode is on, and `TEST NODIE` while invulnerable. On the title screen it also names the level
that will start — `Press S to start    H for help    TEST level 9` — so the parameter can be
confirmed to have taken effect before play begins.

## 11. Acceptance requirements

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
9. **Start on demand** — the page opens on the title screen with the worm stationary; ticks do not
   run and no asterisks are drawn. `S` starts level 1 at score 0; arrow keys do nothing until then.
10. **Help** — `H` opens the help screen from the title screen, from play, and after a game over;
    `H` or `Escape` returns to exactly the phase it was opened from. No ticks run while it is up,
    and resuming does not jump the worm forward however long it was open.
11. **Pause** — `Space` freezes play with the field still visible and `PAUSED` shown; `Space` again
    resumes without banking up ticks. Arrow keys are ignored while paused, `Space` does nothing on
    the title or game-over screens, and `H` opens help from the paused state and returns to it.
12. **Ten levels** — the speed ramp reaches the 60 ms floor exactly at level 9, every level 1–8 is
    strictly faster than the one before it, and level 10 runs at 180 ms, level 1's speed.
13. **The finale** — level 10's asterisks form the peace sign rather than random positions, only
    its first 10 asterisks grow the worm, and clearing it shows the victory screen with the final
    score instead of advancing to level 11. `R` there starts a new game at level 1, score 0.
14. **Test mode** — without the parameter the game is untouched and `+`, `-` and `I` do nothing;
    with a valid one the game starts at that level, `+`/`-` step and clamp, `I` makes walls refuse
    the move and self-contact harmless, `R` returns to the level under test, and the status line
    carries the `TEST` marker throughout.
