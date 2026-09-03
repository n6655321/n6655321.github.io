/** Room definition parsing and hotspot resolution. */

import test from "node:test";
import assert from "node:assert/strict";
import { parseRoomNote, collectRooms } from "../dist/parse/rooms.js";
import { assetHref } from "../dist/render/room.js";

const noteWith = (frontmatter, path = "room.md") => ({
  path,
  slug: path.replace(/\.md$/, ""),
  title: path,
  tags: [],
  frontmatter,
  body: "",
  excerpt: "",
  links: [],
});

test("a note without a room key declares no room", () => {
  assert.equal(parseRoomNote(noteWith({ title: "x" })), null);
});

test("room note yields tag, image and hotspots", () => {
  const room = parseRoomNote(
    noteWith({
      room: "Science/Biology",
      image: "assets/bio.png",
      width: 1600,
      height: 900,
      objects: [
        { target: "#cell", asset: "a.png", x: 10, y: 20, w: 5, h: 6, label: "Bench" },
      ],
    }),
  );
  assert.equal(room.tag, "science/biology", "tag is normalised");
  assert.equal(room.image, "assets/bio.png");
  assert.equal(room.width, 1600);
  assert.equal(room.hotspots.length, 1);
  assert.deepEqual(
    { ...room.hotspots[0], order: undefined },
    {
      target: "#cell",
      kind: "tag",
      asset: "a.png",
      rasterize: false,
      label: "Bench",
      x: 10,
      y: 20,
      w: 5,
      h: 6,
      points: null,
      order: undefined,
    },
  );
});

test("hotspot kind is inferred from the target syntax", () => {
  const room = parseRoomNote(
    noteWith({
      room: "r",
      objects: [
        { target: "#tagged", x: 1, y: 1 },
        { target: "[[A Note]]", x: 2, y: 2 },
        { target: "ambiguous", x: 3, y: 3 },
        { tag: "explicit", x: 4, y: 4 },
        { note: "explicit", x: 5, y: 5 },
      ],
    }),
  );
  assert.deepEqual(
    room.hotspots.map((h) => h.kind),
    ["tag", "note", "auto", "tag", "note"],
  );
});

test("hotspots without coordinates are dropped; missing sizes stay null", () => {
  const room = parseRoomNote(
    noteWith({
      room: "r",
      objects: [
        { target: "#ok", x: 1, y: 2 },
        { target: "#nocoords" },
        { target: "#noy", x: 5 },
        "not an object",
        null,
      ],
    }),
  );
  assert.equal(room.hotspots.length, 1, "only the well-formed hotspot survives");
  // A null size defers to the generator, which scales it with the room.
  assert.equal(room.hotspots[0].w, null, "width is left unset");
  assert.equal(room.hotspots[0].h, null, "height is left unset");
});

test("percentages are clamped and string values accepted", () => {
  const room = parseRoomNote(
    noteWith({
      room: "r",
      objects: [{ target: "#a", x: "150", y: "-20", w: "12%", h: 8 }],
    }),
  );
  assert.equal(room.hotspots[0].x, 100, "x clamps to 100");
  assert.equal(room.hotspots[0].y, 0, "y clamps to 0");
  assert.equal(room.hotspots[0].w, 12, "percent suffix is stripped");
});

test("collectRooms keys by tag and resolves duplicates deterministically", () => {
  const rooms = collectRooms([
    noteWith({ room: "shared", image: "b.png" }, "b.md"),
    noteWith({ room: "shared", image: "a.png" }, "a.md"),
    noteWith({ room: "other", image: "c.png" }, "c.md"),
  ]);
  assert.equal(rooms.size, 2);
  assert.equal(rooms.get("shared").source, "a.md", "lowest path wins, stably");
});

test("tag_page is accepted as an alias for room", () => {
  assert.equal(parseRoomNote(noteWith({ tag_page: "alias" })).tag, "alias");
});

test("asset URLs are namespaced and encoded", () => {
  assert.equal(assetHref("", "assets/a b.png"), "/vault/assets/a%20b.png");
  assert.equal(assetHref("/wiki", "./assets/x.png"), "/wiki/vault/assets/x.png");
});

test("a background colour is parsed and sanitised", () => {
  const bg = (value) => parseRoomNote(noteWith({ room: "r", background: value })).background;

  // Accepted shapes.
  assert.equal(bg("#e8e4dc"), "#e8e4dc");
  assert.equal(bg("#fff"), "#fff");
  assert.equal(bg("rgb(20 22 19 / 80%)"), "rgb(20 22 19 / 80%)");
  assert.equal(bg("oklch(0.7 0.1 220)"), "oklch(0.7 0.1 220)");
  assert.equal(bg("rebeccapurple"), "rebeccapurple");
  assert.equal(bg("transparent"), "transparent");

  // Anything that could escape the style attribute is refused.
  assert.equal(bg('red" onload="alert(1)'), null, "quotes are refused");
  assert.equal(bg("red;background:url(x)"), null, "semicolons are refused");
  assert.equal(bg("url(evil.png)"), null, "url() is refused");
  assert.equal(bg("</style><script>"), null, "markup is refused");
  assert.equal(bg("a".repeat(100)), null, "absurd lengths are refused");
  assert.equal(bg(""), null);
  assert.equal(bg(42), null);
});

test("background is a colour, not an image alias", () => {
  const room = parseRoomNote(
    noteWith({ room: "r", image: "bg.png", background: "#123456" }),
  );
  assert.equal(room.image, "bg.png");
  assert.equal(room.background, "#123456");
});

test("bg and color are accepted as aliases", () => {
  assert.equal(parseRoomNote(noteWith({ room: "r", bg: "#abc" })).background, "#abc");
  assert.equal(parseRoomNote(noteWith({ room: "r", color: "navy" })).background, "navy");
});

test("a polygon is read from numbered x1/y1 pairs", () => {
  const room = parseRoomNote(
    noteWith({
      room: "r",
      objects: [
        { target: "#a", x1: 10, y1: 20, x2: 40, y2: 25, x3: 30, y3: 60 },
      ],
    }),
  );
  const spot = room.hotspots[0];
  assert.deepEqual(spot.points, [
    { x: 10, y: 20 },
    { x: 40, y: 25 },
    { x: 30, y: 60 },
  ]);
  // The bounding box is derived, so placement and crowding still work.
  assert.deepEqual({ x: spot.x, y: spot.y, w: spot.w, h: spot.h }, { x: 10, y: 20, w: 30, h: 40 });
});

test("a polygon is read from a points list, in both spellings", () => {
  const pairs = parseRoomNote(
    noteWith({ room: "r", objects: [{ target: "#a", points: [[1, 2], [8, 3], [5, 9]] }] }),
  );
  assert.deepEqual(pairs.hotspots[0].points, [
    { x: 1, y: 2 },
    { x: 8, y: 3 },
    { x: 5, y: 9 },
  ]);

  const objects = parseRoomNote(
    noteWith({
      room: "r",
      objects: [{ target: "#a", points: [{ x: 1, y: 2 }, { x: 8, y: 3 }, { x: 5, y: 9 }] }],
    }),
  );
  assert.deepEqual(objects.hotspots[0].points, pairs.hotspots[0].points);
});

test("fewer than three points is not a polygon", () => {
  // Two points cannot enclose an area, so it falls back to the rectangle path —
  // which then needs x/y, and has none here.
  const room = parseRoomNote(
    noteWith({ room: "r", objects: [{ target: "#a", x1: 1, y1: 2, x2: 3, y2: 4 }] }),
  );
  assert.equal(room.hotspots.length, 0);

  const withBox = parseRoomNote(
    noteWith({ room: "r", objects: [{ target: "#a", x: 5, y: 5, x1: 1, y1: 2, x2: 3, y2: 4 }] }),
  );
  assert.equal(withBox.hotspots[0].points, null, "it stays a plain rectangle");
});

test("numbered pairs stop at the first gap", () => {
  const room = parseRoomNote(
    noteWith({
      room: "r",
      // x4/y4 is unreachable because x3/y3 is missing; that is the terminator.
      objects: [{ target: "#a", x1: 1, y1: 1, x2: 2, y2: 2, x3: 3, y3: 3, x5: 9, y5: 9 }],
    }),
  );
  assert.equal(room.hotspots[0].points.length, 3);
});

test("rasterize is read as a flag", () => {
  const raster = (value) =>
    parseRoomNote(noteWith({ room: "r", objects: [{ target: "#a", x: 1, y: 1, rasterize: value }] }))
      .hotspots[0].rasterize;
  assert.equal(raster(true), true);
  assert.equal(raster("true"), true);
  assert.equal(raster("yes"), true);
  assert.equal(raster(false), false);
  assert.equal(raster(undefined), false, "absent means smooth scaling");
});

test("size and position choose units independently", () => {
  const build = (fm) =>
    parseRoomNote(
      noteWith({
        room: "r",
        image: "b.png",
        width: 1000,
        height: 500,
        objects: [{ target: "#a", x: 250, y: 400, w: 200, h: 100 }],
        ...fm,
      }),
    ).hotspots[0];

  // Both default to relative: nothing is converted.
  assert.deepEqual(pick(build({})), { x: 100, y: 100, w: 100, h: 100 },
    "relative values are clamped percentages, untouched by conversion");

  // Position only: x/y become percentages, w/h stay as written.
  assert.deepEqual(pick(build({ position: "absolute" })), { x: 25, y: 80, w: 100, h: 100 });

  // Size only: w/h become percentages, x/y stay as written.
  assert.deepEqual(pick(build({ size: "absolute" })), { x: 100, y: 100, w: 20, h: 20 });

  // Both.
  assert.deepEqual(pick(build({ size: "absolute", position: "absolute" })),
    { x: 25, y: 80, w: 20, h: 20 });
});

/** The four geometry fields of a hotspot. */
function pick(spot) {
  return { x: spot.x, y: spot.y, w: spot.w, h: spot.h };
}

test("absolute pixels are not clamped before they are converted", () => {
  // A coordinate past 100 is legitimate in pixels; clamping it first would
  // silently move the object. This was a real bug.
  const room = parseRoomNote(
    noteWith({
      room: "r",
      image: "b.png",
      position: "absolute",
      width: 3600,
      height: 3000,
      objects: [{ target: "#a", x: 2700, y: 1500 }],
    }),
  );
  assert.deepEqual({ x: room.hotspots[0].x, y: room.hotspots[0].y }, { x: 75, y: 50 });
});

test("a polygon's vertices follow position, and its box is recomputed", () => {
  const room = parseRoomNote(
    noteWith({
      room: "r",
      image: "b.png",
      position: "absolute",
      width: 1000,
      height: 1000,
      objects: [{ target: "#a", x1: 100, y1: 200, x2: 500, y2: 200, x3: 300, y3: 600 }],
    }),
  );
  const spot = room.hotspots[0];
  assert.deepEqual(spot.points, [
    { x: 10, y: 20 },
    { x: 50, y: 20 },
    { x: 30, y: 60 },
  ]);
  assert.deepEqual(pick(spot), { x: 10, y: 20, w: 40, h: 40 },
    "the box tracks the converted vertices, never double-converted");
});

test("an object overrides the room's unit choice", () => {
  const room = parseRoomNote(
    noteWith({
      room: "r",
      image: "b.png",
      width: 1000,
      height: 1000,
      // The room says pixels; the second object opts back out.
      position: "absolute",
      objects: [
        { target: "#a", x: 250, y: 500 },
        { target: "#b", x: 25, y: 50, position: "relative" },
      ],
    }),
  );
  assert.deepEqual(
    room.hotspots.map((h) => ({ x: h.x, y: h.y })),
    [{ x: 25, y: 50 }, { x: 25, y: 50 }],
    "both land in the same place, written in different units",
  );
});

test("an object may ask for pixels in an otherwise relative room", () => {
  const room = parseRoomNote(
    noteWith({
      room: "r",
      image: "b.png",
      width: 3600,
      height: 3000,
      objects: [
        { target: "#a", x: 10, y: 10 },
        { target: "#b", position: "absolute", x1: 1242, y1: 891, x2: 1528, y2: 749, x3: 1242, y3: 1308 },
      ],
    }),
  );
  assert.deepEqual(pick(room.hotspots[0]), { x: 10, y: 10, w: null, h: null },
    "the relative object is untouched");
  const poly = room.hotspots[1];
  assert.equal(Math.round(poly.points[0].x * 10) / 10, 34.5, "1242 / 3600 = 34.5%");
  assert.equal(Math.round(poly.points[0].y * 10) / 10, 29.7, "891 / 3000 = 29.7%");
});

test("a per-object absolute request without dimensions is flagged", () => {
  const room = parseRoomNote(
    noteWith({
      room: "r",
      image: "b.png",
      objects: [{ target: "#a", size: "absolute", x: 1, y: 1, w: 10, h: 10 }],
    }),
  );
  assert.equal(room.absoluteWithoutSize, true, "a per-object request counts too");
});

test("absolute units without room dimensions are flagged", () => {
  const room = parseRoomNote(
    noteWith({ room: "r", image: "b.png", size: "absolute", objects: [{ target: "#a", x: 1, y: 1 }] }),
  );
  assert.equal(room.absoluteWithoutSize, true, "the request could not be honoured");

  const ok = parseRoomNote(
    noteWith({ room: "r", image: "b.png", size: "absolute", width: 10, height: 10, objects: [] }),
  );
  assert.equal(ok.absoluteWithoutSize, false);
});
