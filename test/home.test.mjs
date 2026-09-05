/** The front page: a room built from a synthetic `#home` tag. */

import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { build } from "../dist/build.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** A vault with two root concepts, optionally carrying a #home room note. */
async function fixture(homeNote) {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-home-"));
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-homeout-"));
  await fs.mkdir(path.join(vault, "assets"), { recursive: true });
  await fs.writeFile(path.join(vault, "assets", "bg.png"), PNG);
  await fs.writeFile(
    path.join(vault, "a.md"),
    ["---", "tags: [alpha, deep]", "---", "# A", ""].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(vault, "b.md"),
    ["---", "tags: [beta]", "---", "# B", ""].join("\n"),
    "utf8",
  );
  // A second #alpha note, so #alpha strictly contains #deep rather than merely
  // covering the same notes, which would make them equivalents and both roots.
  await fs.writeFile(
    path.join(vault, "c.md"),
    ["---", "tags: [alpha]", "---", "# C", ""].join("\n"),
    "utf8",
  );
  if (homeNote) await fs.writeFile(path.join(vault, "home.md"), homeNote, "utf8");

  const result = await build({
    vault, out, title: "The Site", base: "",
    ignoreTags: [], ignorePaths: [], breakpoint: 768,
  });
  const html = await fs.readFile(path.join(out, "index.html"), "utf8");
  return {
    html, out, result,
    cleanup: async () => {
      await fs.rm(vault, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    },
  };
}

/** Hrefs of the room objects on a page. */
const objects = (html) =>
  [...html.matchAll(/<a class="hotspot[^>]*href="([^"]+)"/g)].map((m) => m[1]);

test("the front page is a room, with the list as its fallback", async () => {
  const { html, cleanup } = await fixture();
  assert.match(html, /class="room-stage"/, "the home page carries a stage");
  assert.match(html, /class="panels panels-fallback"/, "the list is the fallback");
  assert.match(html, /class="fallback-title">The Site</, "the fallback names the site");
  await cleanup();
});

test("without a #home note the room holds the top-level concepts", async () => {
  const { html, cleanup } = await fixture();
  const hrefs = objects(html);
  // #alpha and #beta are roots; #deep is contained by #alpha, so it is not.
  assert.deepEqual(hrefs.sort(), ["/tags/alpha/", "/tags/beta/"]);
  assert.match(html, /class="room-bg" src="\/assets\/placeholder\.svg"/);
  await cleanup();
});

test("an authored #home room replaces the generated one entirely", async () => {
  const note = [
    "---", "room: home", "image: assets/bg.png", 'background: "#2a2320"',
    "width: 100", "height: 50", "objects:",
    '  - target: "#beta"', "    x: 10", "    y: 20", "    w: 15", "    h: 25",
    "    label: The only door",
    "---", "",
  ].join("\n");
  const { html, cleanup } = await fixture(note);

  // Only the authored object: the front door is a deliberate choice, so the
  // generator must not spill every root concept in beside it.
  assert.deepEqual(objects(html), ["/tags/beta/"]);
  assert.match(html, /class="room-bg" src="\/vault\/assets\/bg\.png"/);
  assert.match(html, /<div class="room-stage" style="background:#2a2320">/);
  assert.match(html, /left:10%;top:20%;width:15%;height:25%/);
  await cleanup();
});

test("a #home note counts as authored and raises no orphan warning", async () => {
  const note = [
    "---", "room: home", "image: assets/bg.png", "width: 100", "height: 50",
    "objects:", '  - target: "#alpha"', "    x: 5", "    y: 5",
    "---", "",
  ].join("\n");
  const { result, cleanup } = await fixture(note);
  // No note carries #home, but that is expected: it is the site's front page.
  assert.deepEqual(result.sizeWarnings, [], "the home room is not an orphan");
  assert.equal(result.authoredRooms, 1);
  await cleanup();
});

test("the home room does not become a tag page", async () => {
  const { out, result, cleanup } = await fixture();
  const exists = await fs
    .stat(path.join(out, "tags", "home"))
    .then(() => true, () => false);
  assert.equal(exists, false, "#home is synthetic, not a browsable tag");
  // It is still a room, so the count exceeds the number of real tags.
  assert.equal(result.rooms, result.tags + 1);
  await cleanup();
});

test("home room objects resolve, and unresolved ones are reported", async () => {
  const note = [
    "---", "room: home", "image: assets/bg.png", "width: 100", "height: 50",
    "objects:", '  - target: "#ghost"', "    x: 5", "    y: 5",
    "---", "",
  ].join("\n");
  const { result, cleanup } = await fixture(note);
  assert.deepEqual(result.unresolved, ["#home -> #ghost"]);
  await cleanup();
});

test("the front page loads the room script", async () => {
  const { html, cleanup } = await fixture();
  assert.match(html, /<script src="\/assets\/room\.js" defer><\/script>/);
  await cleanup();
});
