import type { RoomDefinition, RoomHotspot, Tag, VaultIndex } from "../types.js";
import { PLACEHOLDER_IMAGE } from "../graph/autoroom.js";
import { escapeHtml } from "./html.js";
export interface ResolvedHotspot {
    hotspot: RoomHotspot;
    href: string;
    label: string;
    asset: string | null;
    kind: "tag" | "note";
}
export function assetHref(base: string, vaultPath: string): string {
    const clean = vaultPath.replace(/^\.?\//, "");
    if (clean === PLACEHOLDER_IMAGE)
        return `${base}/assets/placeholder.svg`;
    return `${base}/vault/${clean.split("/").map(encodeURIComponent).join("/")}`;
}
function cleanTarget(target: string): {
    name: string;
    alias: string | null;
} {
    let name = target.trim();
    let alias: string | null = null;
    const wiki = /^\[\[(.+)\]\]$/.exec(name);
    if (wiki) {
        const [rawName = "", rawAlias] = wiki[1]!.split("|");
        name = rawName.split("#")[0]!.trim();
        alias = rawAlias?.trim() ?? null;
    }
    name = name.replace(/^#/, "").trim();
    return { name, alias };
}
export function resolveHotspot(hotspot: RoomHotspot, index: VaultIndex, base: string, tagHref: (base: string, tag: Tag) => string, noteHref: (base: string, note: {
    slug: string;
}) => string): ResolvedHotspot | null {
    const { name, alias } = cleanTarget(hotspot.target);
    if (!name)
        return null;
    const key = name.toLowerCase();
    const asTag = () => {
        const tag = index.tags.get(key);
        if (!tag)
            return null;
        return {
            hotspot,
            href: tagHref(base, tag),
            label: alias ?? hotspot.label ?? `#${tag.name}`,
            asset: hotspot.asset ? assetHref(base, hotspot.asset) : null,
            kind: "tag" as const,
        };
    };
    const asNote = () => {
        for (const note of index.notes.values()) {
            const basename = (note.slug.split("/").pop() ?? note.slug).toLowerCase();
            if (basename === key || note.title.toLowerCase() === key || note.slug.toLowerCase() === key) {
                return {
                    hotspot,
                    href: noteHref(base, note),
                    label: alias ?? hotspot.label ?? note.title,
                    asset: hotspot.asset ? assetHref(base, hotspot.asset) : null,
                    kind: "note" as const,
                };
            }
        }
        return null;
    };
    if (hotspot.kind === "tag")
        return asTag();
    if (hotspot.kind === "note")
        return asNote();
    return asTag() ?? asNote();
}
function round(n: number): number {
    return Math.round(n * 100) / 100;
}
function clipPath(h: RoomHotspot): string | null {
    if (!h.points || h.points.length < 3)
        return null;
    const w = h.w ?? 0;
    const ht = h.h ?? 0;
    if (w <= 0 || ht <= 0)
        return null;
    const pairs = h.points
        .map((p) => `${round(((p.x - h.x) / w) * 100)}% ${round(((p.y - h.y) / ht) * 100)}%`)
        .join(", ");
    return `polygon(${pairs})`;
}
function renderHotspot(resolved: ResolvedHotspot): string {
    const { hotspot: h, label } = resolved;
    const clip = clipPath(h);
    const style = `left:${h.x}%;top:${h.y}%;width:${h.w ?? 10}%;height:${h.h ?? 10}%` +
        (clip ? `;clip-path:${clip}` : "");
    const pixelated = h.rasterize ? ' class="pixelated"' : "";
    const body = resolved.asset
        ? `<img${pixelated} src="${escapeHtml(resolved.asset)}" alt="" loading="lazy" decoding="async">`
        : "";
    const bare = resolved.asset ? "" : " hotspot-bare";
    const shaped = clip ? " hotspot-poly" : "";
    const outline = h.points
        ? ` data-points="${h.points.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}"`
        : "";
    return `<a class="hotspot hotspot-${resolved.kind}${bare}${shaped}" href="${escapeHtml(resolved.href)}" style="${style}"${outline}>
      ${body}<span class="hotspot-label">${escapeHtml(label)}</span>
    </a>`;
}
export interface RoomRenderResult {
    html: string;
    unresolved: string[];
}
export function renderRoomStage(room: RoomDefinition | undefined, index: VaultIndex, base: string, tagHref: (base: string, tag: Tag) => string, noteHref: (base: string, note: {
    slug: string;
}) => string): RoomRenderResult {
    if (!room?.image)
        return { html: "", unresolved: [] };
    const unresolved: string[] = [];
    const objects: string[] = [];
    for (const hotspot of room.hotspots) {
        const resolved = resolveHotspot(hotspot, index, base, tagHref, noteHref);
        if (!resolved) {
            unresolved.push(hotspot.target);
            continue;
        }
        objects.push(renderHotspot(resolved));
    }
    const frameStyle = room.width && room.height
        ? ` style="--room-ratio:${room.width} / ${room.height};` +
            `--room-ratio-n:${Math.round((room.width / room.height) * 10000) / 10000}"`
        : "";
    const stageStyle = room.background ? ` style="background:${room.background}"` : "";
    const dimensions = room.width && room.height
        ? ` data-width="${room.width}" data-height="${room.height}"`
        : "";
    const html = `<div class="room-stage"${stageStyle}>
    <div class="room-frame"${frameStyle}${dimensions}>
      <img class="room-bg" src="${escapeHtml(assetHref(base, room.image))}" alt=""${room.width ? ` width="${room.width}"` : ""}${room.height ? ` height="${room.height}"` : ""}>
      <div class="room-objects">
${objects.join("\n")}
      </div>
    </div>
  </div>`;
    return { html, unresolved };
}
