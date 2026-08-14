// Acceptance checks against SPEC.md section 11. Run with ./tests/run.sh — it extracts the
// script block from index.html and evaluates it alongside tests/browser-stubs.js.
//
// These cover the rules; requirement 8 (loads with no network) and the feel of the speed
// curve still need a human with a browser.
var pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; print("  ok   " + name); }
  else { fail++; print("  FAIL " + name + (extra !== undefined ? "  [" + extra + "]" : "")); }
}
function setWorm(cells, dx, dy) {
  state.worm = cells.map(function (c) { return { x: c[0], y: c[1] }; });
  state.heading = { dx: dx, dy: dy };
  state.growth = 0;
  state.pendingTurn = 0;
  state.phase = "playing";
}

print("Req 2 - relative steering");
restart();
setWorm([[10, 11], [9, 11], [8, 11], [7, 11], [6, 11]], 1, 0);
state.pendingTurn = -1; tick();
check("east + LEFT -> north", state.heading.dx === 0 && state.heading.dy === -1, JSON.stringify(state.heading));
setWorm([[10, 11], [9, 11], [8, 11], [7, 11], [6, 11]], 1, 0);
state.pendingTurn = 1; tick();
check("east + RIGHT -> south", state.heading.dx === 0 && state.heading.dy === 1, JSON.stringify(state.heading));
setWorm([[10, 11], [9, 11], [8, 11], [7, 11], [6, 11]], 1, 0);
state.pendingTurn = -1; state.pendingTurn = -1;   // two presses inside one tick
tick();
check("two LEFTs in one tick turn once, no reversal", state.heading.dx === 0 && state.heading.dy === -1);
check("turn buffer cleared after tick", state.pendingTurn === 0);
var seq = [];
setWorm([[10, 11], [9, 11], [8, 11], [7, 11], [6, 11]], 1, 0);
for (var i = 0; i < 4; i++) { state.pendingTurn = 1; tick(); seq.push(state.heading.dx + "," + state.heading.dy); }
check("four RIGHTs return to east", seq.join(" ") === "0,1 -1,0 0,-1 1,0", seq.join(" "));

print("Req 3 - growth and scoring");
restart();
setWorm([[10, 11], [9, 11], [8, 11], [7, 11], [6, 11]], 1, 0);
state.food.clear(); state.food.add("11,11"); state.food.add("40,5");
var len0 = state.worm.length, score0 = state.score, left0 = state.food.size;
tick();
check("eating scores 10", state.score === score0 + FOOD_POINTS, state.score);
check("Left decrements", state.food.size === left0 - 1);
for (var i = 0; i < 4; i++) tick();
check("worm gains exactly 4 segments", state.worm.length === len0 + 4, state.worm.length);
var lenAfter = state.worm.length;
for (var i = 0; i < 5; i++) tick();
check("no further growth once paid out", state.worm.length === lenAfter, state.worm.length);

print("Req 4 - death");
restart();
setWorm([[78, 11], [77, 11], [76, 11]], 1, 0);
state.food.add("40,5"); tick();
check("driving into right wall is fatal", state.phase === "dead", state.phase);
restart();
setWorm([[5, 5], [5, 6], [5, 7], [6, 7], [7, 7], [7, 6], [7, 5], [8, 5]], 0, 1);
state.food.add("40,5"); tick();
check("driving into own body is fatal", state.phase === "dead", state.phase);
state.level = 4; state.score = 999; restart();
check("restart resets to level 1 score 0", state.level === 1 && state.score === 0 && state.phase === "playing");

print("Req 5 - vacating tail");
restart();
setWorm([[5, 5], [5, 6], [6, 6], [6, 5]], 1, 0);   // next cell (6,5) is the tail
state.food.add("40,5"); tick();
check("head may enter the cell the tail vacates", state.phase === "playing", state.phase);
restart();
setWorm([[5, 5], [5, 6], [6, 6], [6, 5]], 1, 0);
state.growth = 2;                                   // tail stays put this tick
state.food.add("40,5"); tick();
check("same move is fatal while growing", state.phase === "dead", state.phase);

print("Req 6 - exit");
restart();
setWorm([[10, 11], [9, 11], [8, 11], [7, 11], [6, 11]], 1, 0);
state.food.clear(); state.food.add("11,11");
check("no exit while food remains", state.exit === null);
tick();
check("exit opens when last asterisk is eaten", state.exit !== null);
var e = state.exit;
check("exit is on the border", isBorder(e.x, e.y), JSON.stringify(e));
var corner = (e.x === LEFT || e.x === RIGHT) && (e.y === TOP || e.y === BOTTOM);
check("exit is not a corner", !corner, JSON.stringify(e));
// exits land on every wall over many samples, and never on a corner
var walls = {}, cornerHits = 0;
for (var i = 0; i < 4000; i++) {
  state.exit = null; openExit();
  var x = state.exit.x, y = state.exit.y;
  if ((x === LEFT || x === RIGHT) && (y === TOP || y === BOTTOM)) cornerHits++;
  walls[y === TOP ? "top" : y === BOTTOM ? "bottom" : x === LEFT ? "left" : "right"] = true;
}
check("4000 samples never hit a corner", cornerHits === 0, cornerHits);
check("all four walls reachable", walls.top && walls.bottom && walls.left && walls.right, Object.keys(walls).join(","));
// walking into the gap clears the level; the neighbouring wall cell still kills
restart();
state.food.clear(); state.exit = { x: RIGHT, y: 11 };
setWorm([[77, 11], [76, 11], [75, 11]], 1, 0);
tick();
check("head reaches exit but is not through yet", state.phase === "playing");
var scoreBefore = state.score, lvl = state.level;
tick();
check("driving into the gap clears the level", state.phase === "cleared", state.phase);
check("level bonus is level x 100", state.score === scoreBefore + lvl * LEVEL_BONUS, state.score - scoreBefore);
restart();
state.food.clear(); state.exit = { x: RIGHT, y: 11 };
setWorm([[78, 12], [77, 12], [76, 12]], 1, 0);      // one row below the gap
tick();
check("border cell next to the gap is still fatal", state.phase === "dead", state.phase);

print("Req 7 - level and speed curve");
var expected = [[1, 5, 180], [2, 7, 165], [3, 9, 150], [4, 11, 135], [5, 13, 120],
                [6, 15, 105], [7, 17, 90], [8, 19, 75], [9, 21, 60]];
var curveOk = true, detail = "";
expected.forEach(function (row) {
  if (foodCount(row[0]) !== row[1] || tickMs(row[0]) !== row[2]) {
    curveOk = false;
    detail += " L" + row[0] + "=" + foodCount(row[0]) + "/" + tickMs(row[0]);
  }
});
check("food and tick tables match the spec", curveOk, detail);
restart();
check("level 1 places 5 asterisks", state.food.size === 5, state.food.size);
check("level 1 interval is 180ms", state.interval === 180, state.interval);
state.level = 2; startLevel();
check("level 2 places 7 asterisks and runs at 165ms", state.food.size === 7 && state.interval === 165);
var faster = true, detail2 = "";
for (var L = 1; L < 9; L++) {
  if (!(tickMs(L + 1) < tickMs(L))) { faster = false; detail2 += " L" + L + "->" + (L + 1); }
}
check("every level 1-9 is strictly faster than the last", faster, detail2);
check("the ramp lands exactly on the 60ms floor at level 9", tickMs(9) === 60 && tickMs(8) > 60);

print("Setup invariants");
for (var trial = 0; trial < 200; trial++) {
  state.level = 1 + (trial % 12); startLevel();
  var onWorm = 0, outside = 0;
  var occupied = {};
  state.worm.forEach(function (s) { occupied[s.x + "," + s.y] = true; });
  state.food.forEach(function (k) {
    if (occupied[k]) onWorm++;
    var p = k.split(",").map(Number);
    if (!isInterior(p[0], p[1])) outside++;
  });
  if (onWorm || outside) { check("food placement trial " + trial, false, "onWorm=" + onWorm + " outside=" + outside); break; }
}
check("food never spawns on the worm or outside the field (200 level setups)", true);
restart();
check("worm starts 5 segments heading east", state.worm.length === 5 && state.heading.dx === 1 && state.heading.dy === 0);

print("Req 1 - rendering");
restart();
render();
var out = __screen.textContent.split("\n");
check("screen is 25 rows", out.length === ROWS, out.length);
var widths = {}; out.forEach(function (r) { widths[[].concat(Array.from(r)).length] = true; });
check("every row is 80 characters", Object.keys(widths).length === 1 && widths[COLS], Object.keys(widths).join(","));
check("wall is solid block, corners included", out[0][0] === "█" && out[BOTTOM][RIGHT] === "█");
check("top wall is unbroken", out[TOP] === "█".repeat(COLS), out[TOP].slice(0, 8));
var wallBad = 0;
for (var y = TOP; y <= BOTTOM; y++) {
  for (var x = LEFT; x <= RIGHT; x++) {
    if (isBorder(x, y) && out[y][x] !== "█") wallBad++;
  }
}
check("every border cell is a full block", wallBad === 0, wallBad);
check("row 23 is blank", out[23].trim() === "", JSON.stringify(out[23]));
check("status line reads correctly", out[STATUS_ROW].trim() === "Level 1   Score 0   Left 5", JSON.stringify(out[STATUS_ROW].trim()));
var heads = (__screen.textContent.match(/@/g) || []).length;
var stars = (__screen.textContent.match(/\*/g) || []).length;
check("exactly one head drawn", heads === 1, heads);
check("five asterisks drawn", stars === 5, stars);
state.food.clear(); state.exit = { x: RIGHT, y: 11 }; render();
check("open exit erases the wall glyph", __screen.textContent.split("\n")[11][RIGHT] === " ");
state.phase = "dead"; render();
check("game over message is rendered", __screen.textContent.indexOf("GAME OVER") !== -1);

print("Req 1 - worm drawn as a bending line");
restart();
setWorm([[10, 11], [9, 11], [8, 11], [7, 11], [6, 11]], 1, 0);
state.food.clear(); render();
var rows = __screen.textContent.split("\n");
check("straight worm is drawn with horizontal pieces", rows[11].slice(6, 11) === "════@", rows[11].slice(6, 11));
// east, then a left turn to north, then east again: ╔══@ over ║ over ═══╝
setWorm([[12, 8], [11, 8], [10, 8], [10, 9], [10, 10], [9, 10], [8, 10]], 1, 0);
render();
rows = __screen.textContent.split("\n");
check("head stays @", rows[8][12] === "@", rows[8][12]);
check("horizontal run uses ═", rows[8][11] === "═" && rows[10][9] === "═", rows[8][11] + rows[10][9]);
check("bend from west to north uses ╔", rows[8][10] === "╔", rows[8][10]);
check("vertical run uses ║", rows[9][10] === "║", rows[9][10]);
check("bend from north to west uses ╝", rows[10][10] === "╝", rows[10][10]);
check("tail takes the straight piece for its axis", rows[10][8] === "═", rows[10][8]);
setWorm([[10, 12], [10, 11], [10, 10], [9, 10], [8, 10]], 0, 1);
render();
rows = __screen.textContent.split("\n");
check("bend from west to south uses ╗", rows[10][10] === "╗", rows[10][10]);
setWorm([[10, 8], [10, 9], [10, 10], [11, 10], [12, 10]], 0, -1);
render();
rows = __screen.textContent.split("\n");
check("bend from east to north uses ╚", rows[10][10] === "╚", rows[10][10]);
var field = rows.slice(0, BOTTOM + 1).join("\n");   // status line legitimately contains "Score"
check("no 'o' glyphs left in the playfield", field.indexOf("o") === -1);

print("Req 9 - start on demand");
showTitle();
check("initial phase is the title screen", state.phase === "title", state.phase);
render();
var title = __screen.textContent;
check("title screen names the game", title.indexOf("W O R M") !== -1);
check("no asterisks drawn on the title screen", (title.match(/\*/g) || []).length === 0);
check("no worm drawn on the title screen", title.indexOf("@") === -1);
check("title status line prompts for S", title.split("\n")[STATUS_ROW].trim() === "Press S to start    H for help",
      JSON.stringify(title.split("\n")[STATUS_ROW].trim()));
var head0 = JSON.stringify(state.worm[0]);
lastFrame = 0; frame(5000); frame(10000);
check("no ticks run on the title screen", JSON.stringify(state.worm[0]) === head0 && state.phase === "title");
check("arrow keys do nothing before the game starts", handleKey("ArrowLeft") === false && state.pendingTurn === 0);
state.level = 6; state.score = 4321;
check("S starts the game", handleKey("s") === true && state.phase === "playing");
check("S starts at level 1, score 0", state.level === 1 && state.score === 0);
check("S places level 1 asterisks", state.food.size === 5, state.food.size);
lastFrame = 0; frame(0); frame(400);
check("the worm moves once started", JSON.stringify(state.worm[0]) !== head0);
check("S is ignored once playing", handleKey("s") === false);
showTitle();
check("uppercase S also starts", handleKey("S") === true && state.phase === "playing");

print("Req 10 - help screen");
showTitle();
check("H opens help from the title screen", handleKey("h") === true && state.phase === "help");
render();
var help = __screen.textContent;
check("help screen is titled", help.indexOf("H E L P") !== -1);
check("help explains relative steering", help.indexOf("relative") !== -1);
check("help lists the start and restart keys", help.indexOf("start") !== -1 && help.indexOf("restart") !== -1);
check("help status line prompts for H or ESC", help.split("\n")[STATUS_ROW].trim() === "Press H or ESC to return",
      JSON.stringify(help.split("\n")[STATUS_ROW].trim()));
check("H toggles help closed, back to title", handleKey("h") === true && state.phase === "title");
restart();
setWorm([[10, 11], [9, 11], [8, 11], [7, 11], [6, 11]], 1, 0);
handleKey("h");
check("H opens help from play", state.phase === "help" && state.resumePhase === "playing");
var headHelp = JSON.stringify(state.worm[0]);
lastFrame = 0; frame(1000); frame(60000); frame(120000);
check("no ticks run while help is up", JSON.stringify(state.worm[0]) === headHelp, state.worm[0]);
check("arrow keys ignored while help is up", handleKey("ArrowLeft") === false && state.pendingTurn === 0);
check("Escape closes help back to play", handleKey("Escape") === true && state.phase === "playing");
frame(120010);
check("resuming does not bank up ticks", JSON.stringify(state.worm[0]) === headHelp, state.worm[0]);
frame(120200);
check("play resumes normally after help", JSON.stringify(state.worm[0]) !== headHelp);
restart();
setWorm([[78, 11], [77, 11], [76, 11]], 1, 0);
state.food.add("40,5"); tick();
check("dead before opening help", state.phase === "dead");
handleKey("h");
check("H opens help after a game over", state.phase === "help" && state.resumePhase === "dead");
handleKey("h");
check("closing help returns to the game over screen", state.phase === "dead");
check("R still restarts from there", handleKey("r") === true && state.phase === "playing" && state.level === 1);

print("Req 11 - pause");
restart();
setWorm([[10, 11], [9, 11], [8, 11], [7, 11], [6, 11]], 1, 0);
// Fixed asterisks, all clear of row 11: the centred PAUSED banner overwrites that row, so
// randomly placed food there would make the visible count vary.
state.food.clear();
["20,4", "30,6", "50,17", "60,19", "70,8"].forEach(function (k) { state.food.add(k); });
check("SPACE pauses play", handleKey(" ") === true && state.phase === "paused", state.phase);
var headPaused = JSON.stringify(state.worm[0]);
lastFrame = 0; frame(1000); frame(60000); frame(300000);
check("no ticks run while paused", JSON.stringify(state.worm[0]) === headPaused, state.worm[0]);
render();
var paused = __screen.textContent;
check("PAUSED message is shown", paused.indexOf("PAUSED — press SPACE to resume") !== -1);
check("the field stays visible while paused", paused.indexOf("@") !== -1 && (paused.match(/\*/g) || []).length === 5);
check("status line still shows level and score", paused.split("\n")[STATUS_ROW].trim() === "Level 1   Score 0   Left 5",
      JSON.stringify(paused.split("\n")[STATUS_ROW].trim()));
check("arrow keys are ignored while paused", handleKey("ArrowLeft") === false && state.pendingTurn === 0);
check("R does nothing while paused", handleKey("r") === false && state.phase === "paused");
check("SPACE resumes play", handleKey(" ") === true && state.phase === "playing");
frame(300010);
check("resuming does not bank up ticks", JSON.stringify(state.worm[0]) === headPaused, state.worm[0]);
frame(300200);
check("the worm moves again after resuming", JSON.stringify(state.worm[0]) !== headPaused);
handleKey(" ");
check("H opens help from paused", handleKey("h") === true && state.phase === "help" && state.resumePhase === "paused");
check("closing help returns to paused, not play", handleKey("h") === true && state.phase === "paused");
handleKey(" ");
check("still resumable after a detour through help", state.phase === "playing");
showTitle();
check("SPACE does nothing on the title screen", handleKey(" ") === false && state.phase === "title");
restart();
setWorm([[78, 11], [77, 11], [76, 11]], 1, 0);
state.food.add("40,5"); tick();
check("SPACE does nothing after a game over", handleKey(" ") === false && state.phase === "dead");
showTitle(); handleKey("h"); render();
check("help screen lists the pause key", __screen.textContent.indexOf("SPACE") !== -1);

print("Req 12/13 - the finale and the victory screen");
check("level 10 runs at level 1's speed", tickMs(FINAL_LEVEL) === tickMs(1) && tickMs(1) === 180);
check("level 10 has far more asterisks than level 9", foodCount(FINAL_LEVEL) > 5 * foodCount(9),
      foodCount(FINAL_LEVEL) + " vs " + foodCount(9));
restart(); state.level = FINAL_LEVEL; startLevel();
check("level 10 places the peace sign, not random cells", state.food.size === PEACE_SIGN.size, state.food.size);
var sameEveryTime = true;
var first = Array.from(state.food).sort().join("|");
for (var t = 0; t < 20; t++) { startLevel(); if (Array.from(state.food).sort().join("|") !== first) sameEveryTime = false; }
check("the pattern is identical on every setup", sameEveryTime);
// the pattern is a centred, left-right symmetric shape clear of the walls
var xs = [], ys = [], mirrored = 0;
state.food.forEach(function (k) {
  var p = k.split(",").map(Number);
  xs.push(p[0]); ys.push(p[1]);
  if (state.food.has((78 - p[0]) + "," + p[1])) mirrored++;
});
check("every pattern cell is inside the field", Math.min.apply(null, xs) >= 1 && Math.max.apply(null, xs) <= 78 &&
      Math.min.apply(null, ys) >= 1 && Math.max.apply(null, ys) <= 21);
check("the pattern is symmetric about the centre column", mirrored === state.food.size, mirrored + "/" + state.food.size);
check("no pattern cell sits on the starting worm", state.worm.every(function (s) { return !state.food.has(key(s.x, s.y)); }));

// growth cap: eat 15 asterisks off the pattern and check only the first 10 lengthened the worm
restart(); state.level = FINAL_LEVEL; startLevel();
var grown = 0, len = state.worm.length;
for (var i = 0; i < 15; i++) {
  state.eaten = i;                       // pretend i have already been eaten
  var before = state.growth;
  state.food.add(key(state.worm[0].x + 1, state.worm[0].y));
  tick();
  if (state.growth > before) grown++;
}
check("only the first 10 asterisks grow the worm on level 10", grown === 10, grown);
restart(); state.level = 9; startLevel();
state.eaten = 12; var before9 = state.growth;
state.food.add(key(state.worm[0].x + 1, state.worm[0].y)); tick();
check("levels 1-9 still grow on every asterisk", state.growth > before9);

// clearing level 10 wins the game
restart(); state.level = FINAL_LEVEL; startLevel();
state.food.clear(); state.exit = { x: RIGHT, y: 11 };
setWorm([[77, 11], [76, 11], [75, 11]], 1, 0);
var scoreBefore10 = state.score;
tick(); tick();
check("clearing level 10 wins instead of advancing", state.phase === "won" && state.level === FINAL_LEVEL, state.phase);
check("the final level bonus is still awarded", state.score === scoreBefore10 + FINAL_LEVEL * LEVEL_BONUS);
state.score = 4820; render();
var won = __screen.textContent;
check("victory screen is shown", won.indexOf("Y O U   W I N") !== -1);
check("victory screen reports the final score", won.indexOf("4820") !== -1);
check("victory status line prompts for R", won.split("\n")[STATUS_ROW].trim() === "Press R to play again",
      JSON.stringify(won.split("\n")[STATUS_ROW].trim()));
lastFrame = 0; frame(1000); frame(90000);
check("no ticks run on the victory screen", state.phase === "won");
check("H opens help from the victory screen", handleKey("h") === true && state.resumePhase === "won");
check("closing help returns to the victory screen", handleKey("h") === true && state.phase === "won");
check("R starts a new game", handleKey("r") === true && state.phase === "playing" &&
      state.level === 1 && state.score === 0);

print("Req 14 - test mode");
// the query string parser
[["", null], [undefined, null], ["?", null],
 ["?level=1", 1], ["?level=7", 7], ["?level=10", 10],
 ["?level=0", null], ["?level=11", null], ["?level=99", null],
 ["?level=abc", null], ["?level=", null], ["?level", null], ["?level=3.5", null],
 ["?level=-2", null], ["?foo=1&level=3", 3], ["?level=3&foo=1", 3], ["?other=5", null],
].forEach(function (c) {
  var got = parseTestLevel(c[0]);
  check("parseTestLevel(" + JSON.stringify(c[0]) + ") = " + c[1], got === c[1], got);
});

// off unless activated
state.testMode = false; state.startAtLevel = 1; state.invincible = false;
restart();
setWorm([[10, 11], [9, 11], [8, 11], [7, 11], [6, 11]], 1, 0);
check("test keys are inert without test mode",
      handleKey("+") === false && handleKey("-") === false && handleKey("i") === false);
check("no level change from an inert test key", state.level === 1);
check("invulnerability cannot be switched on", state.invincible === false);
render();
check("no TEST marker in a normal game", __screen.textContent.indexOf("TEST") === -1);
showTitle(); render();
check("no TEST marker on a normal title screen", __screen.textContent.indexOf("TEST") === -1);

// activated
enableTestMode(parseTestLevel("?level=9"));
check("enableTestMode sets the starting level", state.testMode === true && state.startAtLevel === 9);
showTitle(); render();
check("title screen names the level under test",
      __screen.textContent.split("\n")[STATUS_ROW].trim() === "Press S to start    H for help    TEST level 9",
      JSON.stringify(__screen.textContent.split("\n")[STATUS_ROW].trim()));
check("S starts at the level under test", handleKey("s") === true && state.level === 9);
check("that level's own asterisk count and interval are used",
      state.food.size === foodCount(9) && state.interval === tickMs(9), state.food.size + "/" + state.interval);
render();
check("TEST marker shows during play", __screen.textContent.split("\n")[STATUS_ROW].indexOf("TEST") !== -1);

// R returns to the level under test, not level 1
setWorm([[78, 11], [77, 11], [76, 11]], 1, 0);
state.food.add("40,5"); tick();
check("died on level 9", state.phase === "dead");
check("R returns to the level under test", handleKey("r") === true && state.level === 9 && state.score === 0);

// + and - step and clamp
setWorm([[10, 11], [9, 11], [8, 11], [7, 11], [6, 11]], 1, 0);
var scoreBeforeJump = state.score;
check("+ steps up a level", handleKey("+") === true && state.level === 10);
check("the board is rebuilt at the new level", state.food.size === foodCount(10));
check("no bonus is awarded for a jump", state.score === scoreBeforeJump);
check("+ clamps at the final level", handleKey("+") === true && state.level === FINAL_LEVEL);
check("- steps back down", handleKey("-") === true && state.level === 9);
check("= behaves like +", handleKey("=") === true && state.level === 10);
check("_ behaves like -", handleKey("_") === true && state.level === 9);
while (state.level > 1) handleKey("-");
check("- clamps at level 1", handleKey("-") === true && state.level === 1, state.level);

// invulnerability
check("I toggles invulnerability on", handleKey("i") === true && state.invincible === true);
render();
check("NODIE marker shows while invulnerable", __screen.textContent.indexOf("TEST NODIE") !== -1);
setWorm([[78, 11], [77, 11], [76, 11]], 1, 0);
state.invincible = true; state.food.clear(); state.food.add("40,5");
var headAtWall = JSON.stringify(state.worm[0]);
tick(); tick();
check("a wall refuses the move instead of killing",
      state.phase === "playing" && JSON.stringify(state.worm[0]) === headAtWall, state.phase);
check("turning away from the wall works again",
      (function () { state.pendingTurn = -1; tick(); return state.worm[0].y === 10; })(), state.worm[0]);
setWorm([[5, 5], [5, 6], [5, 7], [6, 7], [7, 7], [7, 6], [7, 5], [8, 5]], 0, 1);
state.invincible = true; tick();
check("self-contact is survivable while invulnerable", state.phase === "playing", state.phase);
setWorm([[5, 5], [5, 6], [5, 7], [6, 7], [7, 7], [7, 6], [7, 5], [8, 5]], 0, 1);
state.invincible = false; tick();
check("self-contact still kills with it off", state.phase === "dead", state.phase);
restart(); state.invincible = true;
setWorm([[10, 11], [9, 11], [8, 11], [7, 11], [6, 11]], 1, 0);
check("I toggles back off", handleKey("i") === true && state.invincible === false);
// deliberately sticky: dying should not cost you god mode while iterating on a level
state.invincible = true; restart();
check("invulnerability survives a restart", state.invincible === true);

// the finale is unaffected by arriving there through test mode
enableTestMode(parseTestLevel("?level=10"));
restart();
check("level 10 under test mode still lays out the peace sign", state.food.size === PEACE_SIGN.size);
state.food.clear(); state.exit = { x: RIGHT, y: 11 };
setWorm([[77, 11], [76, 11], [75, 11]], 1, 0);
tick(); tick();
check("level 10 under test mode still wins on exit", state.phase === "won", state.phase);
// leave the module in its default state for anything that runs after
state.testMode = false; state.startAtLevel = 1; state.invincible = false;

print("");
print(fail === 0 ? "ALL " + pass + " CHECKS PASSED" : pass + " passed, " + fail + " FAILED");
