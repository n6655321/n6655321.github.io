/**
 * Room definitions.
 *
 * A room is declared by an ordinary note in the vault carrying `room:` (or
 * `tag_page:`) in its frontmatter, naming the tag it decorates:
 *
 * ```yaml
 * ---
 * room: science/biology
 * image: assets/rooms/biology.png
 * objects:
 *   - target: "#science/biology/cell"
 *     asset: assets/objects/microscope.png
 *     x: 22
 *     y: 61
 *     w: 14
 *     h: 20
 *     label: The cell
 * ---
 * ```
 *
 * Coordinates are percentages of the background image (0-100), so swapping the
 * image for a higher-resolution version never invalidates a layout. `x`/`y` are
 * the object's top-left corner; `w`/`h` its size. Omitting `w`/`h` leaves the
 * size to the generator, which scales it to the room like any object it places
 * itself; an explicit size is always honoured exactly.
 *
 * Nothing here is required. Every tag gets a room whether or not one is
 * declared, and small screens fall back to the list layout regardless.
 */

import type { Note, RoomDefinition, RoomHotspot } from "../types.js";
import { normalizeTag } from "./tags.js";

/** Read a number from unknown frontmatter, rejecting junk. */
function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim().replace(/%$/, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Accept a CSS colour, rejecting anything that could break out of the `style`
 * attribute it is interpolated into.
 *
 * Deliberately a allowlist of shapes rather than a full CSS parser: hex, the
 * `rgb()`/`hsl()`/`oklch()` families, and bare keywords. Anything containing a
 * quote, semicolon, brace or `url(` is refused outright.
 */
function colour(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  if (raw.length > 64) return null;
  if (/[;{}"'<>\\]/.test(raw)) return null;
  if (/url\s*\(/i.test(raw)) return null;
  // #rgb, #rgba, #rrggbb, #rrggbbaa
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw;
  // A function form: name(...) with only numbers, separators and percent signs.
  if (/^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([0-9a-z0-9\s.,%/+-]*\)$/i.test(raw)) {
    return raw;
  }
  // A bare keyword: `white`, `rebeccapurple`, `transparent`, `currentColor`.
  if (/^[a-z]+$/i.test(raw)) return raw;
  return null;
}

/** Read a boolean flag, accepting YAML's booleans and the usual strings. */
function flag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return /^(true|yes|on|1)$/i.test(value.trim());
  return value === 1;
}

/**
 * Clamp a percentage into 0-100.
 *
 * Applied only once a value is known to be a percentage. Raw frontmatter is
 * left unclamped, because with `position: absolute` it is pixels — and a pixel
 * coordinate past 100 would be destroyed before it could be converted.
 */
function pct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** An explicit `tag:`/`note:` key states the kind; otherwise `#` marks a tag. */
function hotspotKind(entry: Record<string, unknown>, target: string): RoomHotspot["kind"] {
  if (str(entry.tag)) return "tag";
  if (str(entry.note)) return "note";
  if (target.startsWith("#")) return "tag";
  if (target.startsWith("[[")) return "note";
  return "auto";
}

/**
 * Read a polygon outline from a hotspot entry.
 *
 * Two spellings, because neither suits every case. Numbered pairs are easy to
 * write and tweak by hand for a handful of vertices:
 *
 * ```yaml
 * x1: 10   y1: 20
 * x2: 40   y2: 25
 * x3: 30   y3: 60
 * ```
 *
 * A `points:` list is better past a few, and survives reordering:
 *
 * ```yaml
 * points: [[10, 20], [40, 25], [30, 60]]
 * ```
 *
 * Fewer than three points is not a shape, so it is ignored and the object falls
 * back to a rectangle rather than rendering as a degenerate sliver.
 */
function parsePoints(entry: Record<string, unknown>): Array<{ x: number; y: number }> | null {
  const points: Array<{ x: number; y: number }> = [];

  // `points: [[x, y], ...]` or `points: [{x, y}, ...]`
  const list = entry.points ?? entry.polygon ?? entry.shape;
  if (Array.isArray(list)) {
    for (const item of list) {
      if (Array.isArray(item)) {
        const x = num(item[0]);
        const y = num(item[1]);
        if (x !== null && y !== null) points.push({ x, y });
      } else if (item && typeof item === "object") {
        const pair = item as Record<string, unknown>;
        const x = num(pair.x);
        const y = num(pair.y);
        if (x !== null && y !== null) points.push({ x, y });
      }
    }
  }

  // `x1`/`y1`, `x2`/`y2`, … read in order until a pair is missing.
  if (points.length === 0) {
    for (let i = 1; ; i++) {
      const x = num(entry[`x${i}`]);
      const y = num(entry[`y${i}`]);
      if (x === null || y === null) break;
      points.push({ x, y });
    }
  }

  return points.length >= 3 ? points : null;
}

/** True when a `size:`/`position:` value asks for pixels. */
function isAbsolute(value: unknown): boolean {
  return /^(abs(olute)?|px|pixels?)$/i.test(str(value) ?? "");
}

/**
 * How one hotspot's numbers should be read.
 *
 * `size:` and `position:` are independent and each default to `relative`
 * (percentages of the background). Either may be written on the room, as a
 * default for all its objects, or on a single object, which wins — different
 * objects in one room often want different units.
 */
interface Units {
  absolutePosition: boolean;
  absoluteSize: boolean;
  /** Native pixel dimensions of the background, or null when undeclared. */
  width: number | null;
  height: number | null;
}

/**
 * Parse one hotspot entry.
 *
 * `target` is either a tag (`#foo`, or bare `foo`) or a note reference
 * (`[[Note]]`). Resolution to a URL happens later, in the renderer, once the
 * whole index is known.
 */
function parseHotspot(raw: unknown, index: number, units: Units): RoomHotspot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;

  const target = str(entry.target) ?? str(entry.tag) ?? str(entry.note) ?? str(entry.link);
  if (!target) return null;

  // An object's own `size:`/`position:` overrides the room's default.
  const scalable = Boolean(units.width && units.height);
  const absPos =
    entry.position === undefined ? units.absolutePosition : isAbsolute(entry.position);
  const absSize = entry.size === undefined ? units.absoluteSize : isAbsolute(entry.size);
  // Pixels are only convertible when the room declared its native dimensions.
  const toX = (v: number, absolute: boolean) =>
    absolute && scalable ? (v / units.width!) * 100 : v;
  const toY = (v: number, absolute: boolean) =>
    absolute && scalable ? (v / units.height!) * 100 : v;

  const points = parsePoints(entry);

  // A polygon carries its own geometry, so `x`/`y`/`w`/`h` are derived from its
  // bounding box. Everything downstream — placement, crowding, the overlay —
  // then treats both shapes identically.
  if (points) {
    // A polygon's vertices are positions, so they follow `position:`. Its box is
    // then derived from them rather than scaled by `size:`, which would
    // double-convert.
    const scaled = points.map((p) => ({
      x: pct(toX(p.x, absPos)),
      y: pct(toY(p.y, absPos)),
    }));
    const xs = scaled.map((p) => p.x);
    const ys = scaled.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      target,
      kind: hotspotKind(entry, target),
      asset: str(entry.asset) ?? str(entry.image) ?? null,
      rasterize: flag(entry.rasterize ?? entry.pixelated),
      label: str(entry.label),
      x: minX,
      y: minY,
      w: Math.max(...xs) - minX,
      h: Math.max(...ys) - minY,
      points: scaled,
      order: index,
    };
  }

  const x = num(entry.x);
  const y = num(entry.y);
  if (x === null || y === null) return null;

  // A missing size is left null rather than defaulted here. The generator sizes
  // it alongside the objects it creates, so an author who gives only `x`/`y`
  // gets an object that shrinks with the room like any other — a hardcoded
  // default would stay stubbornly large in a crowded room.
  const w = num(entry.w) ?? num(entry.width);
  const h = num(entry.h) ?? num(entry.height);

  // Clamping happens only after conversion: a pixel coordinate past 100 is
  // legitimate, and clamping it first would silently move the object.
  return {
    target,
    kind: hotspotKind(entry, target),
    asset: str(entry.asset) ?? str(entry.image) ?? null,
    rasterize: flag(entry.rasterize ?? entry.pixelated),
    label: str(entry.label),
    x: pct(toX(x, absPos)),
    y: pct(toY(y, absPos)),
    w: w === null ? null : pct(Math.max(0, toX(w, absSize))),
    h: h === null ? null : pct(Math.max(0, toY(h, absSize))),
    points: null,
    order: index,
  };
}

/** Extract a room definition from a note, if it declares one. */
export function parseRoomNote(note: Note): RoomDefinition | null {
  const fm = note.frontmatter;
  const declared = str(fm.room) ?? str(fm.tag_page) ?? str(fm.tagPage);
  if (!declared) return null;

  const tag = normalizeTag(declared);
  if (!tag) return null;

  /*
   * `position:` and `size:` each choose a unit, independently, and both default
   * to `relative` (percentages of the background). `absolute` means pixels of
   * the background at its native size.
   *
   * Declared here they are the room's default; an individual object may
   * override either, which is common — a shape traced in an image editor comes
   * out in pixels while its neighbours are still hand-tuned percentages.
   *
   * Conversion happens per object, in `parseHotspot`. Everything downstream
   * sees percentages only, which is what keeps objects glued to the image at
   * any display size.
   */
  const width = num(fm.width) ?? null;
  const height = num(fm.height) ?? null;
  const units: Units = {
    absolutePosition: isAbsolute(fm.position),
    absoluteSize: isAbsolute(fm.size),
    width,
    height,
  };

  const rawObjects = fm.objects ?? fm.hotspots ?? fm.links;
  const hotspots: RoomHotspot[] = [];
  let wantedAbsolute = units.absolutePosition || units.absoluteSize;
  if (Array.isArray(rawObjects)) {
    rawObjects.forEach((entry, i) => {
      const hotspot = parseHotspot(entry, i, units);
      if (hotspot) hotspots.push(hotspot);
      // Track per-object requests too, so the warning below catches them.
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const own = entry as Record<string, unknown>;
        if (isAbsolute(own.position) || isAbsolute(own.size)) wantedAbsolute = true;
      }
    });
  }

  return {
    tag,
    source: note.path,
    image: str(fm.image) ?? null,
    // Flag a request that could not be honoured, rather than silently ignoring
    // it — the symptom is a wildly mispositioned room, not an obvious error.
    absoluteWithoutSize: wantedAbsolute && !(width && height),
    // `background` is a colour, not an image. It fills the letterbox around a
    // room whose aspect ratio does not match the viewport, and shows through
    // wherever the image is transparent.
    background: colour(fm.background) ?? colour(fm.bg) ?? colour(fm.color) ?? null,
    // The intrinsic size only sets the stage's aspect ratio; coordinates stay
    // in percentages regardless.
    width,
    height,
    hotspots,
  };
}

/** Collect every room definition in the vault, keyed by tag. */
export function collectRooms(notes: Note[]): Map<string, RoomDefinition> {
  const rooms = new Map<string, RoomDefinition>();
  for (const note of notes) {
    const room = parseRoomNote(note);
    if (!room) continue;
    // Two notes claiming the same tag: first by path wins, deterministically.
    const existing = rooms.get(room.tag);
    if (existing && existing.source <= room.source) continue;
    rooms.set(room.tag, room);
  }
  return rooms;
}
