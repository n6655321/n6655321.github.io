/**
 * Room generation.
 *
 * Every tag is a room — anything that is not a note is a place you can walk
 * into. Where the author has written a room note, that definition is used as
 * given. Everywhere else a room is synthesised: a placeholder background, and
 * one object per connected concept and note, scattered across the floor.
 *
 * Placement is random but *deterministic*: positions come from a hash of the
 * tag and target names, so a vault always builds to the same rooms and a
 * rebuild produces no spurious diff. Authoring a real room note later replaces
 * the generated one without touching anything else.
 *
 * A partially authored room is completed rather than overridden: declared
 * objects keep their coordinates, and anything connected but unplaced is
 * scattered into the remaining space.
 */

import type { RoomDefinition, RoomHotspot, Tag, VaultIndex } from "../types.js";

/** Placeholder background used by every generated room. */
export const PLACEHOLDER_IMAGE = "__tektite__/placeholder.svg";

/** Intrinsic size of the placeholder, and so of a generated room's stage. */
export const PLACEHOLDER_WIDTH = 1600;
export const PLACEHOLDER_HEIGHT = 900;

/** Deterministic 32-bit hash, so a name always lands in the same place. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable pseudo-random stream seeded by a string. */
function seeded(seed: string): () => number {
  let state = hash(seed) || 1;
  return () => {
    // xorshift32: tiny, deterministic, good enough for scattering objects.
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

/** Footprint of a generated object, in percent of the background. */
interface Size {
  w: number;
  h: number;
}

const SIZES: Record<"child" | "parent" | "sibling" | "note", Size> = {
  // Sub-concepts are the point of the room, so they are the largest objects.
  child: { w: 13, h: 26 },
  parent: { w: 10, h: 20 },
  sibling: { w: 9, h: 18 },
  note: { w: 8, h: 14 },
};

/** Rectangle in percent coordinates. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.w + gap &&
    b.x < a.x + a.w + gap &&
    a.y < b.y + b.h + gap &&
    b.y < a.y + a.h + gap
  );
}

/** Total area `candidate` shares with anything already placed. */
function overlapArea(candidate: Rect, taken: Rect[]): number {
  let total = 0;
  for (const other of taken) {
    const dx = Math.min(candidate.x + candidate.w, other.x + other.w) - Math.max(candidate.x, other.x);
    const dy = Math.min(candidate.y + candidate.h, other.y + other.h) - Math.max(candidate.y, other.y);
    if (dx > 0 && dy > 0) total += dx * dy;
  }
  return total;
}

/**
 * Find a spot for one object.
 *
 * Rejection sampling with a shrinking gap finds a clear spot in the common
 * case. Once a room is genuinely too full for that — objects can cover a large
 * fraction of the floor — sampling alone reliably fails, so the last pass keeps
 * the candidate with the least overlap instead of taking a blind one. Objects
 * are never dropped: that would silently lose a link.
 */
function place(
  size: Size,
  taken: Rect[],
  rand: () => number,
  bounds: Rect,
): Rect {
  const maxX = Math.max(bounds.x, bounds.x + bounds.w - size.w);
  const maxY = Math.max(bounds.y, bounds.y + bounds.h - size.h);
  const sample = (): Rect => ({
    x: bounds.x + rand() * (maxX - bounds.x),
    y: bounds.y + rand() * (maxY - bounds.y),
    w: size.w,
    h: size.h,
  });

  for (const gap of [3, 1, 0]) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const candidate = sample();
      if (!taken.some((r) => overlaps(candidate, r, gap))) return candidate;
    }
  }

  // Crowded: settle for the least-bad position rather than a random one.
  let best = sample();
  let bestArea = overlapArea(best, taken);
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = sample();
    const area = overlapArea(candidate, taken);
    if (area < bestArea) {
      best = candidate;
      bestArea = area;
      if (area === 0) break;
    }
  }
  return best;
}

/** Round to two decimals, so generated coordinates stay readable in the HTML. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Everything a tag connects to, in the order objects should be placed. */
function connections(
  tag: Tag,
  index: VaultIndex,
): Array<{ target: string; kind: keyof typeof SIZES; label: string }> {
  const out: Array<{ target: string; kind: keyof typeof SIZES; label: string }> = [];

  for (const name of tag.children) {
    const child = index.tags.get(name);
    if (child) out.push({ target: `#${child.name}`, kind: "child", label: child.label });
  }
  for (const name of tag.parents) {
    const parent = index.tags.get(name);
    if (parent) out.push({ target: `#${parent.name}`, kind: "parent", label: parent.label });
  }
  for (const name of tag.siblings) {
    const sibling = index.tags.get(name);
    if (sibling) {
      out.push({ target: `#${sibling.name}`, kind: "sibling", label: sibling.label });
    }
  }

  // Notes filed under a sub-concept already have a door leading to them, so
  // only this tag's own notes become objects here.
  const claimed = new Set<string>();
  for (const childName of tag.children) {
    for (const p of index.tags.get(childName)?.notes ?? []) claimed.add(p);
  }
  for (const notePath of tag.notes) {
    if (claimed.has(notePath)) continue;
    const note = index.notes.get(notePath);
    if (note) out.push({ target: `[[${note.slug}]]`, kind: "note", label: note.title });
  }

  return out;
}

/**
 * Build the room for one tag, completing or replacing any authored definition.
 */
export function generateRoom(
  tag: Tag,
  index: VaultIndex,
  authored: RoomDefinition | undefined,
): RoomDefinition {
  const rand = seeded(`room:${tag.name}`);
  const authoredSpots = authored?.hotspots ?? [];

  /**
   * Identify what a target *points at*, not how it was written.
   *
   * Comparing raw text is not enough: an author writes `[[readme]]` while this
   * module generates `[[notes/readme]]` for the same note, and a naive
   * comparison then places the object twice. Resolving both to the note's path
   * (or the tag's name) makes the two spellings the same thing.
   */
  const key = (target: string): string => {
    const bare = target
      .replace(/^\[\[|\]\]$/g, "")
      .replace(/^#/, "")
      .split("|")[0]!
      .split("#")[0]!
      .trim()
      .toLowerCase();
    if (!bare) return "";
    // A tag: its name is already canonical.
    if (index.tags.has(bare)) return `tag:${bare}`;
    // A note, matched the way the renderer resolves links — full slug, then
    // basename, then title.
    for (const note of index.notes.values()) {
      const slug = note.slug.toLowerCase();
      const basename = (note.slug.split("/").pop() ?? note.slug).toLowerCase();
      if (slug === bare || basename === bare || note.title.toLowerCase() === bare) {
        return `note:${note.path}`;
      }
    }
    // Unresolvable: fall back to the literal text so it is at least stable.
    return `raw:${bare}`;
  };

  // Objects sit in the lower two thirds: the top of a placeholder reads as
  // wall, and a real background usually puts its floor there too.
  const bounds: Rect = { x: 4, y: 30, w: 92, h: 62 };

  const placed = new Set(authoredSpots.map((h) => key(h.target)));
  const pending = connections(tag, index).filter((conn) => !placed.has(key(conn.target)));

  /*
   * Shrink objects as a room fills up. At default sizes a dozen objects cover
   * most of the floor, and no amount of sampling finds clear spots; scaling by
   * the square root of the crowding keeps the total footprint roughly constant
   * so rooms stay legible whether they hold three objects or fifty.
   *
   * Only objects whose size this code chooses are scaled. An author who wrote
   * `w`/`h` gets exactly that, at any density — the room adapts around their
   * object, never to it. Their footprint is charged against the budget, so
   * adding a large fixed object makes the generated ones give way.
   */
  const fixed = authoredSpots.filter((h) => h.w !== null && h.h !== null);
  const flexible = authoredSpots.filter((h) => h.w === null || h.h === null);

  const budget = bounds.w * bounds.h * 0.28;
  const spent = fixed.reduce((sum, h) => sum + h.w! * h.h!, 0);
  const area = (kind: keyof typeof SIZES) => SIZES[kind].w * SIZES[kind].h;
  // Unsized authored objects are sized like a note; nothing better is known.
  const wanted =
    pending.reduce((sum, c) => sum + area(c.kind), 0) + flexible.length * area("note");
  const room = Math.max(budget - spent, budget * 0.15);
  const scale = wanted > room ? Math.sqrt(room / wanted) : 1;

  const sized = (base: Size): Size => ({ w: base.w * scale, h: base.h * scale });

  // Fixed objects hold their ground; everything else fills in around them.
  const hotspots: RoomHotspot[] = [];
  const taken: Rect[] = [];
  for (const spot of fixed) {
    hotspots.push(spot);
    taken.push({ x: spot.x, y: spot.y, w: spot.w!, h: spot.h! });
  }

  // An authored object without a size keeps its position and is sized here.
  for (const spot of flexible) {
    const size = sized(SIZES.note);
    const w = spot.w ?? size.w;
    const h = spot.h ?? size.h;
    hotspots.push({ ...spot, w: round(w), h: round(h) });
    taken.push({ x: spot.x, y: spot.y, w, h });
  }

  for (const conn of pending) {
    const rect = place(sized(SIZES[conn.kind]), taken, rand, bounds);
    taken.push(rect);
    hotspots.push({
      target: conn.target,
      kind: conn.target.startsWith("#") ? "tag" : "note",
      asset: null,
      rasterize: false,
      label: conn.label,
      x: round(rect.x),
      y: round(rect.y),
      w: round(rect.w),
      h: round(rect.h),
      // Generated objects are rectangles; polygons are hand-authored.
      points: null,
      // Generated objects follow every authored one in document order.
      order: authoredSpots.length + hotspots.length,
    });
  }

  // Authored objects were split into fixed and flexible groups above; restore
  // the order the note declared them in, with generated objects after.
  hotspots.sort((a, b) => a.order - b.order);

  return {
    tag: tag.name,
    source: authored?.source ?? "",
    image: authored?.image ?? PLACEHOLDER_IMAGE,
    background: authored?.background ?? null,
    absoluteWithoutSize: authored?.absoluteWithoutSize ?? false,
    width: authored?.width ?? (authored?.image ? null : PLACEHOLDER_WIDTH),
    height: authored?.height ?? (authored?.image ? null : PLACEHOLDER_HEIGHT),
    hotspots,
  };
}

/** Build a room for every tag in the index. */
export function generateRooms(index: VaultIndex): Map<string, RoomDefinition> {
  const rooms = new Map<string, RoomDefinition>();
  for (const tag of index.tags.values()) {
    rooms.set(tag.name, generateRoom(tag, index, index.rooms.get(tag.name)));
  }
  return rooms;
}
