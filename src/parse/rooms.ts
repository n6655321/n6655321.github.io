import type { Note, RoomDefinition, RoomHotspot } from "../types.js";
import { normalizeTag } from "./tags.js";
function num(value: unknown): number | null {
    if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
        const parsed = Number.parseFloat(value.trim().replace(/%$/, ""));
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function str(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function colour(value: unknown): string | null {
    const raw = str(value);
    if (!raw)
        return null;
    if (raw.length > 64)
        return null;
    if (/[;{}"'<>\\]/.test(raw))
        return null;
    if (/url\s*\(/i.test(raw))
        return null;
    if (/^#[0-9a-f]{3,8}$/i.test(raw))
        return raw;
    if (/^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([0-9a-z0-9\s.,%/+-]*\)$/i.test(raw)) {
        return raw;
    }
    if (/^[a-z]+$/i.test(raw))
        return raw;
    return null;
}
function flag(value: unknown): boolean {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string")
        return /^(true|yes|on|1)$/i.test(value.trim());
    return value === 1;
}
function pct(value: number): number {
    return Math.min(100, Math.max(0, value));
}
function hotspotKind(entry: Record<string, unknown>, target: string): RoomHotspot["kind"] {
    if (str(entry.tag))
        return "tag";
    if (str(entry.note))
        return "note";
    if (target.startsWith("#"))
        return "tag";
    if (target.startsWith("[["))
        return "note";
    return "auto";
}
function parsePoints(entry: Record<string, unknown>): Array<{
    x: number;
    y: number;
}> | null {
    const points: Array<{
        x: number;
        y: number;
    }> = [];
    const list = entry.points ?? entry.polygon ?? entry.shape;
    if (Array.isArray(list)) {
        for (const item of list) {
            if (Array.isArray(item)) {
                const x = num(item[0]);
                const y = num(item[1]);
                if (x !== null && y !== null)
                    points.push({ x, y });
            }
            else if (item && typeof item === "object") {
                const pair = item as Record<string, unknown>;
                const x = num(pair.x);
                const y = num(pair.y);
                if (x !== null && y !== null)
                    points.push({ x, y });
            }
        }
    }
    if (points.length === 0) {
        for (let i = 1;; i++) {
            const x = num(entry[`x${i}`]);
            const y = num(entry[`y${i}`]);
            if (x === null || y === null)
                break;
            points.push({ x, y });
        }
    }
    return points.length >= 3 ? points : null;
}
function isAbsolute(value: unknown): boolean {
    return /^(abs(olute)?|px|pixels?)$/i.test(str(value) ?? "");
}
interface Units {
    absolutePosition: boolean;
    absoluteSize: boolean;
    width: number | null;
    height: number | null;
}
function parseHotspot(raw: unknown, index: number, units: Units): RoomHotspot | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return null;
    const entry = raw as Record<string, unknown>;
    const target = str(entry.target) ?? str(entry.tag) ?? str(entry.note) ?? str(entry.link);
    if (!target)
        return null;
    const scalable = Boolean(units.width && units.height);
    const absPos = entry.position === undefined ? units.absolutePosition : isAbsolute(entry.position);
    const absSize = entry.size === undefined ? units.absoluteSize : isAbsolute(entry.size);
    const toX = (v: number, absolute: boolean) => absolute && scalable ? (v / units.width!) * 100 : v;
    const toY = (v: number, absolute: boolean) => absolute && scalable ? (v / units.height!) * 100 : v;
    const points = parsePoints(entry);
    if (points) {
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
    if (x === null || y === null)
        return null;
    const w = num(entry.w) ?? num(entry.width);
    const h = num(entry.h) ?? num(entry.height);
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
export function parseRoomNote(note: Note): RoomDefinition | null {
    const fm = note.frontmatter;
    const declared = str(fm.room) ?? str(fm.tag_page) ?? str(fm.tagPage);
    if (!declared)
        return null;
    const tag = normalizeTag(declared);
    if (!tag)
        return null;
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
            if (hotspot)
                hotspots.push(hotspot);
            if (entry && typeof entry === "object" && !Array.isArray(entry)) {
                const own = entry as Record<string, unknown>;
                if (isAbsolute(own.position) || isAbsolute(own.size))
                    wantedAbsolute = true;
            }
        });
    }
    return {
        tag,
        source: note.path,
        image: str(fm.image) ?? null,
        absoluteWithoutSize: wantedAbsolute && !(width && height),
        background: colour(fm.background) ?? colour(fm.bg) ?? colour(fm.color) ?? null,
        width,
        height,
        hotspots,
    };
}
export function collectRooms(notes: Note[]): Map<string, RoomDefinition> {
    const rooms = new Map<string, RoomDefinition>();
    for (const note of notes) {
        const room = parseRoomNote(note);
        if (!room)
            continue;
        const existing = rooms.get(room.tag);
        if (existing && existing.source <= room.source)
            continue;
        rooms.set(room.tag, room);
    }
    return rooms;
}
