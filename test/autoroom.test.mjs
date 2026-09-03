/** Room generation: every tag gets a room, deterministically. */

import test from "node:test";
import assert from "node:assert/strict";
import { generateRoom, generateRooms, PLACEHOLDER_IMAGE } from "../dist/graph/autoroom.js";
import { buildTags } from "../dist/graph/containment.js";

const note = (path, tags, title = path) => ({
  path,
  slug: path.replace(/\.md$/, ""),
  title,
  tags,
  frontmatter: {},
  body: "",
  excerpt: "",
  links: [],
});

/** Build a minimal index from notes. */
function indexOf(notes, rooms = new Map()) {
  return {
    notes: new Map(notes.map((n) => [n.path, n])),
    tags: buildTags(notes),
    rooms,
    assets: new Set(),
    root: "/vault",
  };
}

/** Rectangles of a room's hotspots. */
const rects = (room) => room.hotspots.map((h) => ({ x: h.x, y: h.y, w: h.w, h: h.h }));

function overlappingPairs(list) {
  let count = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) count++;
    }
  }
  return count;
}

test("every tag gets a room, generated where none is authored", () => {
  const index = indexOf([note("a.md", ["x", "y"]), note("b.md", ["x"])]);
  const rooms = generateRooms(index);
  assert.deepEqual([...rooms.keys()].sort(), ["x", "y"]);
  for (const room of rooms.values()) {
    assert.equal(room.image, PLACEHOLDER_IMAGE, "generated rooms use the placeholder");
    assert.equal(room.source, "", "generated rooms have no source note");
  }
});

test("a generated room links to children, parents, siblings and its own notes", () => {
  const index = indexOf([
    note("cat.md", ["animal", "mammal"]),
    note("dog.md", ["animal", "mammal"]),
    note("bird.md", ["animal", "winged"]),
    note("rock.md", ["animal"]),
  ]);
  const room = generateRoom(index.tags.get("animal"), index, undefined);
  const targets = room.hotspots.map((h) => h.target).sort();
  // #mammal and #winged are sub-concepts, so their notes are reached through
  // those doors. Only rock.md, which no sub-concept claims, becomes an object.
  assert.deepEqual(targets, ["#mammal", "#winged", "[[rock]]"]);

  const child = room.hotspots.find((h) => h.target === "#mammal");
  const noteObj = room.hotspots.find((h) => h.target === "[[rock]]");
  assert.ok(child.w > noteObj.w, "sub-concepts are drawn larger than notes");
});

test("a sub-concept room links back up to its parent", () => {
  const index = indexOf([
    note("cat.md", ["animal", "mammal"]),
    note("bird.md", ["animal"]),
  ]);
  const room = generateRoom(index.tags.get("mammal"), index, undefined);
  assert.ok(
    room.hotspots.some((h) => h.target === "#animal"),
    "the broader concept is reachable from inside the narrower one",
  );
});

test("generated coordinates are stable across runs", () => {
  const notes = [note("a.md", ["t"]), note("b.md", ["t"]), note("c.md", ["t", "u"])];
  const first = generateRooms(indexOf(notes));
  const second = generateRooms(indexOf(notes));
  assert.deepEqual(
    JSON.stringify([...first.entries()]),
    JSON.stringify([...second.entries()]),
    "the same vault must always produce the same rooms",
  );
});

test("different tags scatter their objects differently", () => {
  const notes = [note("a.md", ["one", "two"]), note("b.md", ["one", "two"])];
  const rooms = generateRooms(indexOf(notes));
  assert.notDeepEqual(
    rects(rooms.get("one")),
    rects(rooms.get("two")),
    "two rooms with the same contents must not be laid out identically",
  );
});

test("objects stay inside the image and do not overlap", () => {
  for (const count of [1, 5, 20, 60]) {
    const notes = Array.from({ length: count }, (_, i) => note(`n${i}.md`, ["big"]));
    const index = indexOf(notes);
    const room = generateRoom(index.tags.get("big"), index, undefined);
    const list = rects(room);
    assert.equal(list.length, count, `${count}: every note becomes an object`);
    assert.equal(overlappingPairs(list), 0, `${count}: no two objects overlap`);
    for (const r of list) {
      assert.ok(r.x >= -0.01 && r.y >= -0.01, `${count}: object inside top-left`);
      assert.ok(r.x + r.w <= 100.01, `${count}: object inside right edge`);
      assert.ok(r.y + r.h <= 100.01, `${count}: object inside bottom edge`);
    }
  }
});

test("crowded rooms shrink their objects instead of piling up", () => {
  const small = indexOf(Array.from({ length: 3 }, (_, i) => note(`n${i}.md`, ["t"])));
  const large = indexOf(Array.from({ length: 40 }, (_, i) => note(`n${i}.md`, ["t"])));
  const a = generateRoom(small.tags.get("t"), small, undefined).hotspots[0];
  const b = generateRoom(large.tags.get("t"), large, undefined).hotspots[0];
  assert.ok(b.w < a.w, "a fuller room uses smaller objects");
});

test("an authored room keeps its coordinates and gains the rest", () => {
  const index = indexOf([
    note("cat.md", ["animal", "mammal"]),
    note("bird.md", ["animal"]),
  ]);
  const authored = {
    tag: "animal",
    source: "rooms/animal.md",
    image: "assets/animal.png",
    width: 1200,
    height: 800,
    hotspots: [
      {
        target: "#mammal",
        kind: "tag",
        asset: "assets/m.png",
        label: "Mammals",
        x: 10,
        y: 20,
        w: 15,
        h: 25,
        order: 0,
      },
    ],
  };
  const room = generateRoom(index.tags.get("animal"), index, authored);

  assert.equal(room.image, "assets/animal.png", "the authored image is kept");
  assert.equal(room.source, "rooms/animal.md");

  const mammal = room.hotspots.find((h) => h.target === "#mammal");
  assert.deepEqual(
    { x: mammal.x, y: mammal.y, w: mammal.w, h: mammal.h },
    { x: 10, y: 20, w: 15, h: 25 },
    "authored coordinates are untouched",
  );
  assert.equal(mammal.asset, "assets/m.png");

  assert.ok(
    room.hotspots.some((h) => h.target === "[[bird]]"),
    "the unplaced note is added",
  );
  assert.equal(
    room.hotspots.filter((h) => h.target === "#mammal").length,
    1,
    "an authored target is not duplicated",
  );
});

test("an authored image suppresses the placeholder ratio", () => {
  const index = indexOf([note("a.md", ["t"])]);
  const authored = {
    tag: "t",
    source: "r.md",
    image: "bg.png",
    width: null,
    height: null,
    hotspots: [],
  };
  const room = generateRoom(index.tags.get("t"), index, authored);
  assert.equal(room.image, "bg.png");
  assert.equal(room.width, null, "no ratio is invented for an unmeasured image");
});

test("a declared size is never scaled, however crowded the room", () => {
  const notes = Array.from({ length: 30 }, (_, i) => note(`n${i}.md`, ["dense"]));
  const index = indexOf(notes);
  const authored = {
    tag: "dense",
    source: "r.md",
    image: "bg.png",
    width: 1600,
    height: 900,
    hotspots: [
      { target: "[[n0]]", kind: "note", asset: null, label: "Fixed",
        x: 5, y: 35, w: 25, h: 40, order: 0 },
      { target: "[[n1]]", kind: "note", asset: null, label: "Unsized",
        x: 70, y: 35, w: null, h: null, order: 1 },
    ],
  };
  const room = generateRoom(index.tags.get("dense"), index, authored);

  const fixed = room.hotspots.find((h) => h.target === "[[n0]]");
  assert.equal(fixed.w, 25, "a declared width survives crowding");
  assert.equal(fixed.h, 40, "a declared height survives crowding");

  const unsized = room.hotspots.find((h) => h.target === "[[n1]]");
  assert.equal(unsized.x, 70, "an unsized object keeps its declared position");
  assert.equal(unsized.y, 35);
  assert.ok(unsized.w < 8, `an unsized object shrinks with the room (got ${unsized.w})`);

  const generated = room.hotspots.find((h) => h.target === "[[n5]]");
  assert.ok(
    Math.abs(generated.w - unsized.w) < 0.01,
    "unsized authored objects are sized exactly like generated ones",
  );
});

test("a large fixed object squeezes the generated ones", () => {
  const notes = Array.from({ length: 12 }, (_, i) => note(`n${i}.md`, ["t"]));
  const index = indexOf(notes);
  const base = {
    tag: "t", source: "r.md", image: "bg.png", width: 1600, height: 900,
  };
  const without = generateRoom(index.tags.get("t"), index, { ...base, hotspots: [] });
  const withBig = generateRoom(index.tags.get("t"), index, {
    ...base,
    hotspots: [
      { target: "[[n0]]", kind: "note", asset: null, label: "Big",
        x: 5, y: 35, w: 40, h: 50, order: 0 },
    ],
  });
  const gen = (room) => room.hotspots.find((h) => h.target === "[[n7]]").w;
  assert.ok(gen(withBig) < gen(without), "the fixed footprint is charged to the budget");
});

test("every object still fits inside the image with a fixed one present", () => {
  const notes = Array.from({ length: 25 }, (_, i) => note(`n${i}.md`, ["t"]));
  const index = indexOf(notes);
  const room = generateRoom(index.tags.get("t"), index, {
    tag: "t", source: "r.md", image: "bg.png", width: 1600, height: 900,
    hotspots: [
      { target: "[[n0]]", kind: "note", asset: null, label: "Fixed",
        x: 5, y: 35, w: 30, h: 45, order: 0 },
    ],
  });
  for (const h of room.hotspots) {
    assert.ok(h.x >= -0.01 && h.y >= -0.01, `${h.target} inside top-left`);
    assert.ok(h.x + h.w <= 100.01, `${h.target} inside right edge`);
    assert.ok(h.y + h.h <= 100.01, `${h.target} inside bottom edge`);
  }
});

test("an authored target is matched however it is spelled", () => {
  // The generator emits a note's full slug (`[[notes/readme]]`), while an author
  // naturally writes the basename (`[[readme]]`). Comparing the raw text placed
  // the same note twice; targets must be resolved before being compared.
  const index = indexOf([
    note("notes/readme.md", ["biology"], "Readme"),
    note("notes/other.md", ["biology"]),
  ]);
  const base = {
    tag: "biology", source: "r.md", image: "bg.png",
    background: null, absoluteWithoutSize: false, width: 100, height: 100,
  };

  for (const spelling of ["[[readme]]", "[[notes/readme]]", "[[Readme]]", "[[readme|Aliased]]"]) {
    const room = generateRoom(index.tags.get("biology"), index, {
      ...base,
      hotspots: [
        { target: spelling, kind: "note", asset: null, rasterize: false, label: null,
          x: 10, y: 10, w: 10, h: 10, points: null, order: 0 },
      ],
    });
    const readme = room.hotspots.filter((h) => /readme/i.test(h.target));
    assert.equal(readme.length, 1, `${spelling} must not be duplicated`);
    assert.equal(readme[0].target, spelling, "the authored spelling is kept");
    assert.equal(readme[0].x, 10, "and so are its coordinates");
  }
});

test("a tag target is matched whether or not it carries a #", () => {
  const index = indexOf([note("a.md", ["animal", "mammal"]), note("b.md", ["animal"])]);
  const base = {
    tag: "animal", source: "r.md", image: "bg.png",
    background: null, absoluteWithoutSize: false, width: 100, height: 100,
  };
  for (const spelling of ["#mammal", "mammal", "#MAMMAL"]) {
    const room = generateRoom(index.tags.get("animal"), index, {
      ...base,
      hotspots: [
        { target: spelling, kind: "tag", asset: null, rasterize: false, label: null,
          x: 5, y: 5, w: 10, h: 10, points: null, order: 0 },
      ],
    });
    assert.equal(
      room.hotspots.filter((h) => /mammal/i.test(h.target)).length,
      1,
      `${spelling} must not be duplicated`,
    );
  }
});
