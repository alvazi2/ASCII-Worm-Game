# Worm

A recreation of a text-mode worm game from the early IBM-PC days, around 1984.

You steer a worm that never stops moving around a walled rectangle, eating the asterisks scattered
inside it. Every asterisk you eat makes the worm longer. Hit a wall or cross your own body and it is
over. Once the last asterisk is gone, a small opening appears somewhere in the wall — drive the worm
out through it to finish the level. Each level has more asterisks and moves faster.

## Play

**[Play it here](https://alvazi2.github.io/ASCII-Worm-Game/)**

Or run it locally — it is one self-contained HTML file, with no install, no build and no network:

```sh
open index.html
```

It opens on a title screen and nothing moves until you press `S`.

| Key | Action |
| --- | --- |
| `S` | Start the game, from the title screen |
| `←` | Turn left (90° counter-clockwise) |
| `→` | Turn right (90° clockwise) |
| `Space` | Pause, or resume when paused |
| `H` | Open the help screen — or close it again. Play is frozen while it is up |
| `Esc` | Close the help screen |
| `R` | Restart, after a game over |

The arrows turn the worm *relative to the direction it is already travelling*, as the original did —
they do not steer it to an absolute compass point. If the worm is heading east, `←` sends it north.

## About the original

The game this recreates was played on IBM PCs around 1984, but no preserved DOS title matches it.
The design is the **Snake Byte** formula — Sirius Software, 1982: eat every apple, a gate opens in
the wall, escape through it to clear the level, with the speed ramping as you go. Snake Byte was
published for the Apple II, Atari 8-bit, VIC-20 and Commodore 64, and never for the IBM PC. The PC
version people remember was almost certainly one of the ASCII clones that circulated between 1983
and 1985 as BASIC type-ins, BBS uploads and user-group disk fillers — a wave of programs that went
largely uncatalogued, which is why the title cannot be found in the usual archives today.

- Snake Byte — <https://en.wikipedia.org/wiki/Snake_Byte>
- John Chenault's *Snake!* (1984), the best-documented survivor of the PC clone wave —
  <https://archive.org/details/msdos_John_Chenaults_Snake_1984>

## Repository

- `SPEC.md` — the functional specification. Authoritative for all game behaviour.
- `index.html` — the whole game.
- `tests/` — headless acceptance checks for the rules in `SPEC.md` §10; run `./tests/run.sh`.
- `CLAUDE.md` — notes for Claude Code.

## License

MIT — see [LICENSE](LICENSE).
