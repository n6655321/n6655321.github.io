/**
 * Renders a room: a background image with clickable objects positioned on it.
 *
 * Every tag has a room — authored ones use their own image, the rest get a
 * placeholder with scattered objects. Both layouts are always emitted, the room
 * and the list, and CSS alone decides which is visible. That keeps the page
 * static, works without JavaScript, and avoids any layout shift.
 */

import type { RoomDefinition, RoomHotspot, Tag, VaultIndex } from "../types.js";
import { PLACEHOLDER_IMAGE } from "../graph/autoroom.js";
import { escapeHtml } from "./html.js";

/** What a hotspot points at, once resolved against the index. */
export interface ResolvedHotspot {
  hotspot: RoomHotspot;
  href: string;
  label: string;
  /** Site-root-relative URL of the object image, if it has one. */
  asset: string | null;
  /** `tag` or `note`, for styling and the accessible description. */
  kind: "tag" | "note";
}

/** Site URL of a vault asset, preserving its folder structure. */
export function assetHref(base: string, vaultPath: string): string {
  const clean = vaultPath.replace(/^\.?\//, "");
  // The generated placeholder ships with the theme, not with the vault.
  if (clean === PLACEHOLDER_IMAGE) return `${base}/assets/placeholder.svg`;
  return `${base}/vault/${clean.split("/").map(encodeURIComponent).join("/")}`;
}

/** Strip `[[…]]`, a leading `#`, and any alias from a raw target. */
function cleanTarget(target: string): { name: string; alias: string | null } {
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

/**
 * Resolve one hotspot to a URL.
 *
 * Returns null when the target names nothing in the vault: a room should not
 * emit dead links, and the build reports the miss so the author can fix it.
 */
export function resolveHotspot(
  hotspot: RoomHotspot,
  index: VaultIndex,
  base: string,
  tagHref: (base: string, tag: Tag) => string,
  noteHref: (base: string, note: { slug: string }) => string,
): ResolvedHotspot | null {
  const { name, alias } = cleanTarget(hotspot.target);
  if (!name) return null;
  const key = name.toLowerCase();

  const asTag = () => {
    const tag = index.tags.get(key);
    if (!tag) return null;
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

  if (hotspot.kind === "tag") return asTag();
  if (hotspot.kind === "note") return asNote();
  return asTag() ?? asNote();
}

/** Round to two decimals, keeping generated CSS readable. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * `clip-path` for a polygon hotspot.
 *
 * The element is its bounding box, so the points — which are percentages of the
 * whole image — have to be re-expressed as percentages of that box. A zero-width
 * or zero-height box would divide by zero, so those degenerate cases fall back
 * to no clip and the object stays a plain rectangle.
 */
function clipPath(h: RoomHotspot): string | null {
  if (!h.points || h.points.length < 3) return null;
  const w = h.w ?? 0;
  const ht = h.h ?? 0;
  if (w <= 0 || ht <= 0) return null;
  const pairs = h.points
    .map((p) => `${round(((p.x - h.x) / w) * 100)}% ${round(((p.y - h.y) / ht) * 100)}%`)
    .join(", ");
  return `polygon(${pairs})`;
}

/**
 * Render one clickable object.
 *
 * An object with an asset shows that image. One without is a transparent
 * region of exactly the declared shape — the background image is expected to
 * already depict whatever is there, so drawing anything over it would only
 * obscure the art. The label appears beside the cursor on hover, which is what
 * makes the region discoverable.
 */
function renderHotspot(resolved: ResolvedHotspot): string {
  const { hotspot: h, label } = resolved;
  // Percentages map straight onto the stage, which carries the image's ratio,
  // so objects track the background at every size without any script. Sizes are
  // always set by the generator before rendering; the fallback is defensive.
  const clip = clipPath(h);
  const style =
    `left:${h.x}%;top:${h.y}%;width:${h.w ?? 10}%;height:${h.h ?? 10}%` +
    // Clipping the element makes the polygon the actual click target, not just
    // its visual outline: pointer events respect `clip-path`.
    (clip ? `;clip-path:${clip}` : "");
  // `rasterize` keeps pixel art crisp when scaled up, instead of smoothing it.
  const pixelated = h.rasterize ? ' class="pixelated"' : "";
  const body = resolved.asset
    ? `<img${pixelated} src="${escapeHtml(
        resolved.asset,
      )}" alt="" loading="lazy" decoding="async">`
    : "";
  const bare = resolved.asset ? "" : " hotspot-bare";
  const shaped = clip ? " hotspot-poly" : "";
  // The outline is repeated as a data attribute so the hitbox overlay can draw
  // the real shape without re-parsing the clip-path.
  const outline = h.points
    ? ` data-points="${h.points.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}"`
    : "";
  return `<a class="hotspot hotspot-${resolved.kind}${bare}${shaped}" href="${escapeHtml(
    resolved.href,
  )}" style="${style}"${outline}>
      ${body}<span class="hotspot-label">${escapeHtml(label)}</span>
    </a>`;
}

export interface RoomRenderResult {
  html: string;
  /** Targets that resolved to nothing, for build-time reporting. */
  unresolved: string[];
}

/**
 * Render the room stage.
 *
 * Returns empty HTML only when there is no room at all — with generation on,
 * that happens for no tag.
 */
export function renderRoomStage(
  room: RoomDefinition | undefined,
  index: VaultIndex,
  base: string,
  tagHref: (base: string, tag: Tag) => string,
  noteHref: (base: string, note: { slug: string }) => string,
): RoomRenderResult {
  if (!room?.image) return { html: "", unresolved: [] };

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

  // The intrinsic ratio keeps the frame the right shape before the image loads,
  // so hotspots never sit briefly in the wrong place. Two forms are emitted:
  // `aspect-ratio` needs `w / h`, while the `calc()` that caps the width by
  // viewport height needs the same ratio as a plain number.
  const frameStyle =
    room.width && room.height
      ? ` style="--room-ratio:${room.width} / ${room.height};` +
        `--room-ratio-n:${Math.round((room.width / room.height) * 10000) / 10000}"`
      : "";

  // The colour paints the whole stage, so it fills the letterbox around an
  // image whose ratio differs from the viewport, not just the image's own box.
  // `colour()` in the parser guarantees this cannot escape the attribute.
  const stageStyle = room.background ? ` style="background:${room.background}"` : "";

  // The stage fills the viewport; the frame inside it holds the image's exact
  // box, so percentage-positioned objects stay glued to the background however
  // the window is shaped.
  //
  // The background carries `alt=""`: it is scenery, and everything meaningful
  // in the room is a link with its own text. Describing it again would only
  // make a screen reader announce decoration before the actual content.
  // The native pixel size is published so `?position` can report cursor
  // coordinates in the image's own pixels rather than in percentages.
  const dimensions =
    room.width && room.height
      ? ` data-width="${room.width}" data-height="${room.height}"`
      : "";

  const html = `<div class="room-stage"${stageStyle}>
    <div class="room-frame"${frameStyle}${dimensions}>
      <img class="room-bg" src="${escapeHtml(assetHref(base, room.image))}" alt=""${
    room.width ? ` width="${room.width}"` : ""
  }${room.height ? ` height="${room.height}"` : ""}>
      <div class="room-objects">
${objects.join("\n")}
      </div>
    </div>
  </div>`;

  return { html, unresolved };
}
