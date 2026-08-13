// Minimal browser stubs so the game script can run under jsc.
var __screen = { textContent: "" };
var document = { getElementById: function () { return __screen; } };
var window = { addEventListener: function () {} };
var performance = { now: function () { return 0; } };
function requestAnimationFrame() { return 0; }
