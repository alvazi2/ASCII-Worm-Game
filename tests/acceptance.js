// Acceptance checks against SPEC.md section 10. Run with ./tests/run.sh — it extracts the
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
var expected = [[1, 5, 180], [2, 7, 160], [3, 9, 140], [4, 11, 120], [5, 13, 100], [6, 15, 80], [7, 17, 60], [8, 19, 60], [10, 23, 60], [20, 43, 60]];
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
check("level 2 places 7 asterisks and runs at 160ms", state.food.size === 7 && state.interval === 160);

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

print("");
print(fail === 0 ? "ALL " + pass + " CHECKS PASSED" : pass + " passed, " + fail + " FAILED");
