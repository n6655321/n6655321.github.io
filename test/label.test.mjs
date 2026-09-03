/**
 * The cursor-following label.
 *
 * The stage is a centring grid, so the label must be explicitly anchored at its
 * origin: laid out as a grid item it would start centred, and every transform
 * would then be measured from there — putting the label far from the cursor.
 * That was a real bug, so it is pinned here.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const css = await fs.readFile(path.join(here, "..", "src", "assets", "theme.css"), "utf8");
const js = await fs.readFile(path.join(here, "..", "src", "assets", "room.js"), "utf8");

/** The declarations inside one CSS rule. */
function rule(selector) {
  const at = css.indexOf(selector + " {");
  assert.notEqual(at, -1, `${selector} must exist`);
  return css.slice(at, css.indexOf("}", at));
}

test("the cursor label is anchored at the stage origin", () => {
  const body = rule(".room-cursor-label");
  assert.match(body, /position:\s*absolute/);
  // Without both of these the label inherits its centred grid position.
  assert.match(body, /\bleft:\s*0/, "left must be pinned");
  assert.match(body, /\btop:\s*0/, "top must be pinned");
});

test("the stage centres its children, which is why anchoring matters", () => {
  const body = rule(".room-stage");
  assert.match(body, /position:\s*relative/, "the label positions against the stage");
  assert.match(body, /place-items:\s*center/, "the stage centres — hence the anchor");
});

test("only opacity transitions, so the label tracks the pointer exactly", () => {
  const body = rule(".room-cursor-label");
  const transition = /transition:([^;]+);/.exec(body);
  assert.ok(transition, "a transition is declared");
  assert.doesNotMatch(transition[1], /transform|\ball\b/, "transform must never lag the cursor");
});

test("the label never intercepts the pointer", () => {
  assert.match(rule(".room-cursor-label"), /pointer-events:\s*none/);
});

test("pointermove reads the newest coordinates, not a captured event", () => {
  // Reading `event` inside the rAF callback would use whichever event scheduled
  // the frame, lagging the cursor during fast movement.
  const frame = /requestAnimationFrame\(function \(\) \{[\s\S]*?\}\)/.exec(js);
  assert.ok(frame, "the move handler coalesces with requestAnimationFrame");
  assert.doesNotMatch(frame[0], /event\./, "the frame must not read the captured event");
  assert.match(frame[0], /position\(lastX, lastY\)/, "it uses the latest recorded position");
});

test("the script suppresses the static labels it replaces", () => {
  assert.match(js, /setAttribute\("data-cursor-labels", "1"\)/);
  assert.match(
    css,
    /\.room-stage\[data-cursor-labels="1"\] \.hotspot:hover \.hotspot-label \{\s*opacity: 0/,
    "per-object labels are hidden once the floating one is live",
  );
});

test("hovering a region draws no box around it", () => {
  // A plain `.hotspot:hover` outline would frame the artwork; only keyboard
  // focus may draw a ring, since there is no cursor to anchor a label to.
  assert.doesNotMatch(css, /\.hotspot:hover,\s*\n\.hotspot:focus-visible \{/);
  assert.match(rule(".hotspot:focus-visible"), /outline:/, "focus still shows a ring");
});
