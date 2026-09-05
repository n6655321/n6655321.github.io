import type { RoomDefinition, RoomHotspot, Tag, VaultIndex } from "../types.js";
export const PLACEHOLDER_IMAGE = "__tektite__/placeholder.svg";
export const PLACEHOLDER_WIDTH = 1600;
export const PLACEHOLDER_HEIGHT = 900;
function hash(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function seeded(seed: string): () => number {
    let state = hash(seed) || 1;
    return () => {
        state ^= state << 13;
        state >>>= 0;
        state ^= state >> 17;
        state ^= state << 5;
        state >>>= 0;
        return state / 0x100000000;
    };
}
interface Size {
    w: number;
    h: number;
}
const SIZES: Record<"child" | "parent" | "sibling" | "note", Size> = {
    child: { w: 13, h: 26 },
    parent: { w: 10, h: 20 },
    sibling: { w: 9, h: 18 },
    note: { w: 8, h: 14 },
};
interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
function overlaps(a: Rect, b: Rect, gap: number): boolean {
    return (a.x < b.x + b.w + gap &&
        b.x < a.x + a.w + gap &&
        a.y < b.y + b.h + gap &&
        b.y < a.y + a.h + gap);
}
function overlapArea(candidate: Rect, taken: Rect[]): number {
    let total = 0;
    for (const other of taken) {
        const dx = Math.min(candidate.x + candidate.w, other.x + other.w) - Math.max(candidate.x, other.x);
        const dy = Math.min(candidate.y + candidate.h, other.y + other.h) - Math.max(candidate.y, other.y);
        if (dx > 0 && dy > 0)
            total += dx * dy;
    }
    return total;
}
function place(size: Size, taken: Rect[], rand: () => number, bounds: Rect): Rect {
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
            if (!taken.some((r) => overlaps(candidate, r, gap)))
                return candidate;
        }
    }
    let best = sample();
    let bestArea = overlapArea(best, taken);
    for (let attempt = 0; attempt < 200; attempt++) {
        const candidate = sample();
        const area = overlapArea(candidate, taken);
        if (area < bestArea) {
            best = candidate;
            bestArea = area;
            if (area === 0)
                break;
        }
    }
    return best;
}
function round(n: number): number {
    return Math.round(n * 100) / 100;
}
function connections(tag: Tag, index: VaultIndex): Array<{
    target: string;
    kind: keyof typeof SIZES;
    label: string;
}> {
    const out: Array<{
        target: string;
        kind: keyof typeof SIZES;
        label: string;
    }> = [];
    for (const name of tag.children) {
        const child = index.tags.get(name);
        if (child)
            out.push({ target: `#${child.name}`, kind: "child", label: child.label });
    }
    for (const name of tag.parents) {
        const parent = index.tags.get(name);
        if (parent)
            out.push({ target: `#${parent.name}`, kind: "parent", label: parent.label });
    }
    for (const name of tag.siblings) {
        const sibling = index.tags.get(name);
        if (sibling) {
            out.push({ target: `#${sibling.name}`, kind: "sibling", label: sibling.label });
        }
    }
    const claimed = new Set<string>();
    for (const childName of tag.children) {
        for (const p of index.tags.get(childName)?.notes ?? [])
            claimed.add(p);
    }
    for (const notePath of tag.notes) {
        if (claimed.has(notePath))
            continue;
        const note = index.notes.get(notePath);
        if (note)
            out.push({ target: `[[${note.slug}]]`, kind: "note", label: note.title });
    }
    return out;
}
export function generateRoom(tag: Tag, index: VaultIndex, authored: RoomDefinition | undefined): RoomDefinition {
    const rand = seeded(`room:${tag.name}`);
    const authoredSpots = authored?.hotspots ?? [];
    const key = (target: string): string => {
        const bare = target
            .replace(/^\[\[|\]\]$/g, "")
            .replace(/^#/, "")
            .split("|")[0]!
            .split("#")[0]!
            .trim()
            .toLowerCase();
        if (!bare)
            return "";
        if (index.tags.has(bare))
            return `tag:${bare}`;
        for (const note of index.notes.values()) {
            const slug = note.slug.toLowerCase();
            const basename = (note.slug.split("/").pop() ?? note.slug).toLowerCase();
            if (slug === bare || basename === bare || note.title.toLowerCase() === bare) {
                return `note:${note.path}`;
            }
        }
        return `raw:${bare}`;
    };
    const bounds: Rect = { x: 4, y: 30, w: 92, h: 62 };
    const placed = new Set(authoredSpots.map((h) => key(h.target)));
    const pending = connections(tag, index).filter((conn) => !placed.has(key(conn.target)));
    const fixed = authoredSpots.filter((h) => h.w !== null && h.h !== null);
    const flexible = authoredSpots.filter((h) => h.w === null || h.h === null);
    const budget = bounds.w * bounds.h * 0.28;
    const spent = fixed.reduce((sum, h) => sum + h.w! * h.h!, 0);
    const area = (kind: keyof typeof SIZES) => SIZES[kind].w * SIZES[kind].h;
    const wanted = pending.reduce((sum, c) => sum + area(c.kind), 0) + flexible.length * area("note");
    const room = Math.max(budget - spent, budget * 0.15);
    const scale = wanted > room ? Math.sqrt(room / wanted) : 1;
    const sized = (base: Size): Size => ({ w: base.w * scale, h: base.h * scale });
    const hotspots: RoomHotspot[] = [];
    const taken: Rect[] = [];
    for (const spot of fixed) {
        hotspots.push(spot);
        taken.push({ x: spot.x, y: spot.y, w: spot.w!, h: spot.h! });
    }
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
            points: null,
            order: authoredSpots.length + hotspots.length,
        });
    }
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
export function generateRooms(index: VaultIndex): Map<string, RoomDefinition> {
    const rooms = new Map<string, RoomDefinition>();
    for (const tag of index.tags.values()) {
        rooms.set(tag.name, generateRoom(tag, index, index.rooms.get(tag.name)));
    }
    return rooms;
}

export const HOME_TAG = "home";

/**
 * Build the room for the site's front page.
 *
 * `#home` is not a real tag: no note carries it, so there is nothing to derive
 * a room from. A synthetic tag is used instead, whose children are the
 * top-level concepts, which lets the front page go through exactly the same
 * generation and rendering as every other room.
 *
 * An authored `#home` note is taken as complete. Unlike an ordinary room the
 * generator adds nothing to it: the front door is a deliberate choice of which
 * concepts to expose, not a place to spill every root concept into.
 */
export function generateHomeRoom(index: VaultIndex, authored: RoomDefinition | undefined): RoomDefinition {
    const roots = [...index.tags.values()]
        .filter((tag) => tag.parents.length === 0)
        .sort((a, b) => b.notes.length - a.notes.length || a.name.localeCompare(b.name))
        .map((tag) => tag.name);

    const synthetic: Tag = {
        name: HOME_TAG,
        label: HOME_TAG,
        slug: HOME_TAG,
        notes: [],
        children: authored?.hotspots.length ? [] : roots,
        parents: [],
        siblings: [],
    };

    return generateRoom(synthetic, index, authored);
}
