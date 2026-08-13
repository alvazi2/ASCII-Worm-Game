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
check("top-left corner glyph", out[0][0] === "╔");
check("bottom-right corner glyph", out[BOTTOM][RIGHT] === "╝");
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

print("");
print(fail === 0 ? "ALL " + pass + " CHECKS PASSED" : pass + " passed, " + fail + " FAILED");
