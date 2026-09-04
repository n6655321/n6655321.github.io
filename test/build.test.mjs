/** End-to-end: build the demo vault and assert the output site is coherent. */

import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { build, indexVault } from "../dist/build.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const vault = path.join(here, "vault");

/** Build into a throwaway directory. */
async function buildTemp(overrides = {}) {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-test-"));
  const options = {
    vault,
    out,
    title: "Test Vault",
    base: "",
    ignoreTags: [],
    ignorePaths: [],
    breakpoint: 768,
    ...overrides,
  };
  const result = await build(options);
  return { out, result, options };
}

/** Every .html file under a directory. */
async function htmlFiles(root) {
  const found = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.name.endsWith(".html")) found.push(p);
    }
  }
  await walk(root);
  return found;
}

test("build emits a page per note, per tag, plus index and home", async () => {
  const { out, result } = await buildTemp();
  const index = await indexVault({
    vault, out, title: "t", base: "", ignoreTags: [], ignorePaths: [], breakpoint: 768,
  });
  assert.equal(result.notes, index.notes.size);
  assert.equal(result.tags, index.tags.size);
  // home + tag index + one per tag + one per note
  assert.equal(result.pages, 2 + index.tags.size + index.notes.size);
  await fs.rm(out, { recursive: true, force: true });
});

test("every internal link resolves to a real file", async () => {
  const { out } = await buildTemp();
  const files = await htmlFiles(out);
  const broken = new Set();
  let checked = 0;

  for (const file of files) {
    const html = await fs.readFile(file, "utf8");
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const href = match[1];
      if (/^(?:https?:|mailto:|#)/.test(href)) continue;
      checked++;
      let target = path.join(out, decodeURIComponent(href));
      if (href.endsWith("/")) target = path.join(target, "index.html");
      const ok = await fs.stat(target).then(() => true).catch(() => false);
      if (!ok) broken.add(`${path.relative(out, file)} -> ${href}`);
    }
  }

  assert.ok(checked > 20, `expected many links, checked ${checked}`);
  assert.deepEqual([...broken], [], "no internal link may 404");
  await fs.rm(out, { recursive: true, force: true });
});


const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * A self-contained vault with one hand-authored room.
 *
 * These tests used to read the demo vault's own room note, which broke every
 * time it was edited while authoring. The fixture owns its content instead.
 */
async function authoredFixture(overrides = {}) {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-auth-"));
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-authout-"));
  await fs.mkdir(path.join(vault, "assets"), { recursive: true });
  await fs.writeFile(path.join(vault, "assets", "bg.png"), PNG);
  await fs.writeFile(path.join(vault, "assets", "thing.png"), PNG);
  await fs.writeFile(
    path.join(vault, "a.md"),
    ["---", "tags: [room, sub]", "---", "# A", ""].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(vault, "b.md"),
    ["---", "tags: [room]", "---", "# B", ""].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(vault, "the-room.md"),
    [
      "---", "room: room", "image: assets/bg.png", 'background: "#123456"',
      "width: 1000", "height: 500", "objects:",
      '  - target: "#sub"', "    asset: assets/thing.png",
      "    x: 12", "    y: 48", "    w: 18", "    h: 34", "    label: A thing",
      '  - target: "[[b]]"', "    x1: 60", "    y1: 20", "    x2: 80", "    y2: 25",
      "    x3: 70", "    y3: 60", "    label: A shape",
      "---", "",
    ].join("\n"),
    "utf8",
  );
  const result = await build({
    vault, out, title: "T", base: "",
    ignoreTags: [], ignorePaths: [], breakpoint: 768,
    ...overrides,
  });
  const html = await fs.readFile(path.join(out, "tags", "room", "index.html"), "utf8");
  const cleanup = async () => {
    await fs.rm(vault, { recursive: true, force: true });
    await fs.rm(out, { recursive: true, force: true });
  };
  return { vault, out, html, result, cleanup };
}

test("an authored room renders its background and hotspots", async () => {
  const { html, result, cleanup } = await authoredFixture();

  assert.equal(result.authoredRooms, 1, "the fixture declares one room");
  assert.equal(result.rooms, result.tags, "every tag gets a room");
  assert.deepEqual(result.unresolved, [], "every hotspot target resolves");
  assert.deepEqual(result.missingAssets, [], "every referenced asset exists");

  assert.match(html, /class="room-bg" src="\/vault\/assets\/bg\.png"/);
  assert.match(html, /--room-ratio:1000 \/ 500/, "intrinsic ratio is set");

  // Every object in the room note reaches the page, positioned in percentages.
  const hotspots = [...html.matchAll(/<a class="hotspot hotspot-(?:tag|note)[^"]*" href="[^"]*" style="([^"]+)"/g)];
  assert.ok(hotspots.length >= 2, `expected several objects, got ${hotspots.length}`);
  for (const [, style] of hotspots) {
    assert.match(
      style,
      /^left:[\d.]+%;top:[\d.]+%;width:[\d.]+%;height:[\d.]+%/,
      "coordinates are emitted as percentages",
    );
  }
  await cleanup();
});

test("room images are copied into the output", async () => {
  const { out, html, result, cleanup } = await authoredFixture();

  // Whatever the room references must exist under /vault/ in the output.
  const referenced = [...html.matchAll(/src="\/(vault\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(referenced.length > 0, "the room references at least its background");
  for (const rel of new Set(referenced)) {
    const ok = await fs
      .stat(path.join(out, ...decodeURIComponent(rel).split("/")))
      .then(() => true, () => false);
    assert.ok(ok, `${rel} must be copied`);
  }
  assert.deepEqual(result.missingAssets, [], "and nothing is left dangling");
  await cleanup();
});

test("pages carry no chrome outside the article", async () => {
  const { out } = await buildTemp();
  for (const rel of [
    ["index.html"],
    ["tags", "biology", "index.html"],
    ["notes", "entropy", "index.html"],
  ]) {
    const html = await fs.readFile(path.join(out, ...rel), "utf8");
    const body = html
      .slice(html.indexOf("<body>") + 6, html.indexOf("</body>"))
      // The room script is the one thing allowed outside the article.
      .replace(/<script src="[^"]*" defer><\/script>/, "")
      .trim();
    assert.ok(body.startsWith("<article"), `${rel.join("/")} starts with the article`);
    assert.ok(body.endsWith("</article>"), `${rel.join("/")} ends with the article`);
    for (const chrome of ["site-header", "site-footer", "breadcrumbs", "site-nav"]) {
      assert.doesNotMatch(html, new RegExp(chrome), `${rel.join("/")} has no ${chrome}`);
    }
  }
  await fs.rm(out, { recursive: true, force: true });
});

test("every tag page is a room, with the list as its fallback", async () => {
  const { out, result } = await buildTemp();
  for (const slug of ["biology", "cell", "energy", "physics"]) {
    const html = await fs.readFile(path.join(out, "tags", slug, "index.html"), "utf8");
    assert.match(html, /class="room-stage"/, `#${slug} has a room`);
    assert.match(html, /class="panels panels-fallback"/, `#${slug} hides its panels`);
  }
  assert.ok(result.rooms > result.authoredRooms, "most rooms are generated");
  await fs.rm(out, { recursive: true, force: true });
});

test("a room page is only the image and its clickable objects", async () => {
  const { out } = await buildTemp();
  for (const slug of ["biology", "cell"]) {
    const html = await fs.readFile(path.join(out, "tags", slug, "index.html"), "utf8");
    const stage = html.slice(html.indexOf('<div class="room-stage"'), html.indexOf('<div class="panels'));

    // Inside the stage: the background, the objects, nothing else.
    assert.doesNotMatch(stage, /<h1|<header|class="lede"|class="prose"/, `#${slug} has no chrome`);
    assert.doesNotMatch(stage, /\d+ notes?/, `#${slug} shows no link count`);
    assert.match(stage, /<img class="room-bg" src="[^"]+" alt=""/, `#${slug} background has empty alt`);
  }
  await fs.rm(out, { recursive: true, force: true });
});

test("the narrow-screen fallback still names its concept", async () => {
  const { out } = await buildTemp();
  const html = await fs.readFile(path.join(out, "tags", "cell", "index.html"), "utf8");
  // The heading belongs to the fallback list, not the room.
  assert.match(html, /<h1 class="fallback-title">#cell<\/h1>/);
  assert.ok(
    html.indexOf('class="fallback-title"') > html.indexOf('class="room-stage"'),
    "the title comes after the room, inside the fallback",
  );
  await fs.rm(out, { recursive: true, force: true });
});

test("a declared object size reaches the page unchanged", async () => {
  // Built from a fixture rather than the demo vault, so editing that vault
  // while authoring cannot break this.
  const src = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-size-"));
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-sizeout-"));
  await fs.writeFile(path.join(src, "n.md"), "---\ntags: [t]\n---\n# N\n", "utf8");
  await fs.writeFile(
    path.join(src, "room.md"),
    [
      "---", "room: t", "image: bg.png", "width: 1000", "height: 1000", "objects:",
      '  - target: "[[n]]"', "    x: 12", "    y: 48", "    w: 18", "    h: 34",
      '  - target: "#t"', "    x: 60", "    y: 20",
      "---", "",
    ].join("\n"),
    "utf8",
  );
  await build({
    vault: src, out, title: "T", base: "", ignoreTags: [], ignorePaths: [], breakpoint: 768,
  });

  const html = await fs.readFile(path.join(out, "tags", "t", "index.html"), "utf8");
  assert.match(html, /href="\/notes\/n\/" style="left:12%;top:48%;width:18%;height:34%"/,
    "a declared size is emitted verbatim");
  const unsized = /href="\/tags\/t\/" style="left:60%;top:20%;width:([\d.]+)%/.exec(html);
  assert.ok(unsized, "the unsized object is still placed at its declared position");
  assert.ok(Number(unsized[1]) > 0, "and given a size by the generator");

  await fs.rm(out, { recursive: true, force: true });
  await fs.rm(src, { recursive: true, force: true });
});

test("an object with no asset is a bare transparent region", async () => {
  const { out } = await buildTemp();
  const html = await fs.readFile(path.join(out, "tags", "biology", "index.html"), "utf8");
  // The demo room declares #energy with an outline but no asset.
  const bare = /<a class="hotspot hotspot-tag hotspot-bare[^"]*" href="\/tags\/energy\/"[^>]*>\s*<span class="hotspot-label">/.exec(html);
  assert.ok(bare, "the assetless object renders with no image and no plate");
  await fs.rm(out, { recursive: true, force: true });
});

test("a polygon object is clipped to its outline", async () => {
  const { html, cleanup } = await authoredFixture();
  const poly = /<a class="hotspot[^"]*hotspot-poly" href="[^"]*" style="([^"]+)" data-points="([^"]+)">/.exec(html);
  assert.ok(poly, "the polygon object renders");

  // Points reach the page as percentages, whatever unit they were written in.
  const points = poly[2].split(" ").map((pair) => pair.split(",").map(Number));
  assert.ok(points.length >= 3, `a polygon needs three points, got ${points.length}`);
  for (const [x, y] of points) {
    assert.ok(x >= 0 && x <= 100, `x ${x} is a percentage`);
    assert.ok(y >= 0 && y <= 100, `y ${y} is a percentage`);
  }

  // The element is the bounding box; the clip re-expresses the outline inside it.
  const box = /left:([\d.]+)%;top:([\d.]+)%;width:([\d.]+)%;height:([\d.]+)%/.exec(poly[1]);
  assert.ok(box, "the box is emitted in percentages");
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  assert.equal(Math.round(Number(box[1]) * 100) / 100, Math.min(...xs), "box hugs the outline");
  assert.equal(Math.round(Number(box[3]) * 100) / 100,
    Math.round((Math.max(...xs) - Math.min(...xs)) * 100) / 100);
  assert.match(poly[1], /clip-path:polygon\(/, "and it is clipped to the shape");
  await cleanup();
});

test("a room's background colour reaches the stage", async () => {
  const { out, html, cleanup } = await authoredFixture();
  assert.match(html, /<div class="room-stage" style="background:#123456">/);
  // A generated room declares no colour, so it gets no inline style.
  const generated = await fs.readFile(path.join(out, "tags", "sub", "index.html"), "utf8");
  assert.match(generated, /<div class="room-stage">/);
  await cleanup();
});

test("the room script loads only on room pages", async () => {
  const { out } = await buildTemp();
  const room = await fs.readFile(path.join(out, "tags", "biology", "index.html"), "utf8");
  assert.match(room, /<script src="\/assets\/room\.js" defer><\/script>/);

  for (const rel of [["index.html"], ["tags", "index.html"], ["notes", "entropy", "index.html"]]) {
    const html = await fs.readFile(path.join(out, ...rel), "utf8");
    assert.doesNotMatch(html, /<script src=/, `${rel.join("/")} loads no script`);
  }
  await fs.rm(out, { recursive: true, force: true });
});

test("generated rooms use the shipped placeholder background", async () => {
  const { out } = await buildTemp();
  const html = await fs.readFile(path.join(out, "tags", "cell", "index.html"), "utf8");
  assert.match(html, /class="room-bg" src="\/assets\/placeholder\.svg"/);
  const ok = await fs
    .stat(path.join(out, "assets", "placeholder.svg"))
    .then(() => true, () => false);
  assert.ok(ok, "the placeholder is copied into the output");
  await fs.rm(out, { recursive: true, force: true });
});

test("a generated room links to every connected concept and note", async () => {
  const { out } = await buildTemp();
  const html = await fs.readFile(path.join(out, "tags", "cell", "index.html"), "utf8");
  // #cell is contained by #biology, overlaps #energy, and holds three notes.
  for (const href of [
    "/tags/biology/",
    "/notes/chloroplast/",
    "/notes/mitochondrion/",
    "/notes/photosynthesis/",
  ]) {
    assert.match(html, new RegExp(`href="${href.replace(/\//g, "\/")}"`), `links to ${href}`);
  }
  await fs.rm(out, { recursive: true, force: true });
});

test("builds are byte-identical across runs", async () => {
  const a = await buildTemp();
  const b = await buildTemp();
  const read = (dir) =>
    fs.readFile(path.join(dir, "tags", "energy", "index.html"), "utf8");
  assert.equal(await read(a.out), await read(b.out), "generation must be deterministic");
  await fs.rm(a.out, { recursive: true, force: true });
  await fs.rm(b.out, { recursive: true, force: true });
});

test("the breakpoint stylesheet reflects the configured width", async () => {
  const { out } = await buildTemp({ breakpoint: 1024 });
  const css = await fs.readFile(path.join(out, "assets", "breakpoint.css"), "utf8");
  assert.match(css, /max-width: 1023px/);
  assert.match(css, /\.room-stage\s*\{\s*display: none/);
  assert.match(css, /\.panels-fallback\s*\{\s*display: grid/);
  await fs.rm(out, { recursive: true, force: true });
});

test("the only shipped script is the room label helper", async () => {
  const { out } = await buildTemp();
  const assets = await fs.readdir(path.join(out, "assets"));
  assert.deepEqual(assets.sort(), ["breakpoint.css", "placeholder.svg", "room.js", "theme.css"]);
  await fs.rm(out, { recursive: true, force: true });
});

test("unresolved hotspot targets are reported, not silently dropped", async () => {
  const src = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-bad-"));
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-badout-"));
  await fs.writeFile(path.join(src, "note.md"), "---\ntags: [real]\n---\nbody\n", "utf8");
  await fs.writeFile(
    path.join(src, "room.md"),
    [
      "---",
      "room: real",
      "image: missing.png",
      "objects:",
      '  - target: "#ghost"',
      "    x: 1",
      "    y: 1",
      "---",
      "",
    ].join("\n"),
    "utf8",
  );
  const result = await build({
    vault: src, out, title: "T", base: "", ignoreTags: [], ignorePaths: [], breakpoint: 768,
  });
  assert.deepEqual(result.unresolved, ["#real -> #ghost"]);
  assert.deepEqual(result.missingAssets, ["missing.png"]);
  await fs.rm(out, { recursive: true, force: true });
  await fs.rm(src, { recursive: true, force: true });
});

test("note pages render wikilinks as working links", async () => {
  const { out } = await buildTemp();
  const html = await fs.readFile(
    path.join(out, "notes", "photosynthesis", "index.html"),
    "utf8",
  );
  assert.match(html, /href="\/notes\/chloroplast\/"/, "[[chloroplast]] resolves");
  assert.doesNotMatch(html, /\[\[/, "no raw wikilink syntax survives");
  await fs.rm(out, { recursive: true, force: true });
});

test("base path prefixes every generated link", async () => {
  const { out } = await buildTemp({ base: "/wiki" });
  const home = await fs.readFile(path.join(out, "index.html"), "utf8");
  assert.match(home, /href="\/wiki\/tags\//, "tag links carry the base");
  assert.match(home, /href="\/wiki\/assets\/theme\.css"/, "styles carry the base");
  await fs.rm(out, { recursive: true, force: true });

  // A room's own images carry the base too.
  const authored = await authoredFixture({ base: "/wiki" });
  assert.match(authored.html, /src="\/wiki\/vault\/assets\//, "room images carry the base");
  await authored.cleanup();
});

test("ignored tags are excluded from the site", async () => {
  const { out, result } = await buildTemp({ ignoreTags: ["energy"] });
  const exists = await fs
    .stat(path.join(out, "tags", "energy"))
    .then(() => true)
    .catch(() => false);
  assert.equal(exists, false, "#energy gets no room");
  assert.ok(result.tags >= 1);
  await fs.rm(out, { recursive: true, force: true });
});

test("output escapes HTML in note content", async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-esc-"));
  const src = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-vault-"));
  await fs.writeFile(
    path.join(src, "evil.md"),
    '---\ntitle: "<script>alert(1)</script>"\ntags: [danger]\n---\n\nbody\n',
    "utf8",
  );
  await build({
    vault: src, out, title: "T", base: "", ignoreTags: [], ignorePaths: [], breakpoint: 768,
  });
  const html = await fs.readFile(path.join(out, "tags", "danger", "index.html"), "utf8");
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/, "title is escaped in the room");
  assert.match(html, /&lt;script&gt;/);
  await fs.rm(out, { recursive: true, force: true });
  await fs.rm(src, { recursive: true, force: true });
});

test("room labels and asset paths cannot break out of their attributes", async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-inj-"));
  const src = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-injvault-"));
  await fs.writeFile(path.join(src, "n.md"), "---\ntags: [real]\n---\nbody\n", "utf8");
  await fs.writeFile(
    path.join(src, "room.md"),
    [
      "---",
      "room: real",
      'image: \'a" onerror="alert(1)\'',
      "objects:",
      '  - target: "#real"',
      `    label: '"><img src=x onerror=alert(1)>'`,
      "    x: 1",
      "    y: 1",
      "---",
      "",
    ].join("\n"),
    "utf8",
  );
  await build({
    vault: src, out, title: "T", base: "", ignoreTags: [], ignorePaths: [], breakpoint: 768,
  });
  const html = await fs.readFile(path.join(out, "tags", "real", "index.html"), "utf8");
  assert.doesNotMatch(html, /onerror=alert\(1\)>/, "label cannot inject an element");
  assert.doesNotMatch(html, /" onerror="/, "asset path cannot inject an attribute");
  assert.match(html, /&quot;|&gt;/, "the payload is escaped instead");
  await fs.rm(out, { recursive: true, force: true });
  await fs.rm(src, { recursive: true, force: true });
});
