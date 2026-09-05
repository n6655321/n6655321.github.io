import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BuildOptions, VaultIndex } from "./types.js";
import { readVault, walkVaultFiles } from "./parse/vault.js";
import { collectRooms } from "./parse/rooms.js";
import { HOME_TAG, PLACEHOLDER_IMAGE, generateHomeRoom, generateRooms } from "./graph/autoroom.js";
import { buildTags } from "./graph/containment.js";
import { noteHref, noteOutputPath, renderNotePage, renderTagIndex, renderTagPage, tagHref, } from "./render/pages.js";
import { renderRoomStage } from "./render/room.js";
import { escapeHtml, shell } from "./render/html.js";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export async function indexVault(options: BuildOptions): Promise<VaultIndex> {
    const { files: vaultFiles } = await walkVaultFiles(options.vault, options.ignorePaths);
    const notes = await readVault(options);
    const tags = buildTags(notes);
    const index: VaultIndex = {
        notes: new Map(notes.map((n) => [n.path, n])),
        tags,
        rooms: collectRooms(notes),
        assets: new Set<string>(),
        files: new Set(vaultFiles),
        authoredRooms: [...collectRooms(notes).values()],
        root: options.vault,
    };
    index.rooms = generateRooms(index);

    // The front page is a room too, built from a synthetic `#home` tag: no note
    // carries that tag, so there is nothing to derive one from otherwise.
    index.rooms.set(HOME_TAG, generateHomeRoom(index, collectRooms(notes).get(HOME_TAG)));
    for (const room of index.rooms.values()) {
        if (room.image && room.image !== PLACEHOLDER_IMAGE) {
            index.assets.add(room.image.replace(/^\.?\//, ""));
        }
        for (const hotspot of room.hotspots) {
            if (hotspot.asset)
                index.assets.add(hotspot.asset.replace(/^\.?\//, ""));
        }
    }
    return index;
}
async function writePage(outDir: string, relPath: string, html: string): Promise<void> {
    const target = path.join(outDir, relPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, html, "utf8");
}
async function copyAssets(outDir: string): Promise<void> {
    const src = path.join(HERE, "assets");
    const dest = path.join(outDir, "assets");
    await fs.mkdir(dest, { recursive: true });
    for (const file of await fs.readdir(src)) {
        await fs.copyFile(path.join(src, file), path.join(dest, file));
    }
}
async function copyVaultAssets(index: VaultIndex, outDir: string): Promise<string[]> {
    const missing: string[] = [];
    for (const rel of index.assets) {
        const from = path.join(index.root, rel);
        const to = path.join(outDir, "vault", ...rel.split("/"));
        try {
            await fs.mkdir(path.dirname(to), { recursive: true });
            await fs.copyFile(from, to);
        }
        catch {
            missing.push(rel);
        }
    }
    return missing.sort();
}
/**
 * The front page.
 *
 * Like a tag page it is a room with the list as its narrow-screen fallback.
 * The room comes from `#home`, a synthetic tag whose objects are the top-level
 * concepts unless a `#home` note places its own.
 */
function renderHome(index: VaultIndex, base: string, siteTitle: string): {
    html: string;
    unresolved: string[];
} {
    const room = index.rooms.get(HOME_TAG);

    // A room with no objects is a dead end: the list that would carry the only
    // links is hidden above the breakpoint, leaving nothing to click. That
    // happens on a vault with no tags at all, so fall back to the list at every
    // width rather than showing an empty picture.
    const stage = room?.hotspots.length
        ? renderRoomStage(room, index, base, tagHref, noteHref)
        : { html: "", unresolved: [] };

    const tags = [...index.tags.values()].sort((a, b) => b.notes.length - a.notes.length || a.name.localeCompare(b.name));
    const roots = tags.filter((t) => t.parents.length === 0).slice(0, 12);
    const cards = roots
        .map((t) => {
        const sub = t.children.length
            ? `<span class="tag-sub">${t.children.length} sub-concept${t.children.length === 1 ? "" : "s"}</span>`
            : "";
        return `<li class="tag-card"><a href="${tagHref(base, t)}">
      <span class="tag-name">#${escapeHtml(t.name)}</span>
      <span class="tag-count">${t.notes.length} note${t.notes.length === 1 ? "" : "s"}</span>
      ${sub}
    </a></li>`;
    })
        .join("");

    const panels = `<section class="panel">
    <h2>Start here</h2>
    <p class="panel-note">The broadest concepts, those no other concept contains.</p>
    <ul class="tag-grid">${cards}</ul>
  </section>
  <section class="panel">
    <h2>Everything</h2>
    <p class="panel-note"><a href="${base}/tags/">Browse all ${index.tags.size} concept${index.tags.size === 1 ? "" : "s"} →</a></p>
  </section>`;

    const panelClass = stage.html ? "panels panels-fallback" : "panels";
    const heading = `<h1 class="fallback-title">${escapeHtml(siteTitle)}</h1>`;

    const body = stage.html
        ? `<article class="index-page">
  ${stage.html}
  <div class="${panelClass}">
    ${heading}
    ${panels}
  </div>
</article>`
        : `<article class="index-page">
  <header class="page-head">
    <h1>${escapeHtml(siteTitle)}</h1>
    <p class="lede">${index.notes.size} note${index.notes.size === 1 ? "" : "s"}, ${index.tags.size} concept${index.tags.size === 1 ? "" : "s"}.</p>
  </header>
  <div class="${panelClass}">${panels}</div>
</article>`;

    return {
        html: shell({ title: "Home", siteTitle, base, room: Boolean(stage.html), body }),
        unresolved: stage.unresolved,
    };
}

export interface BuildResult {
    notes: number;
    tags: number;
    pages: number;
    rooms: number;
    authoredRooms: number;
    out: string;
    unresolved: string[];
    missingAssets: string[];
    sizeWarnings: string[];
}
async function writeBreakpoint(outDir: string, breakpoint: number): Promise<void> {
    const css = `/* Generated by tektite — the width below which rooms fall back to lists. */
@media (max-width: ${breakpoint - 1}px) {
  .room-stage {
    display: none;
  }
  .panels-fallback {
    display: grid;
  }
}
`;
    await fs.writeFile(path.join(outDir, "assets", "breakpoint.css"), css, "utf8");
}
export async function build(options: BuildOptions): Promise<BuildResult> {
    const index = await indexVault(options);
    const { out, base, title } = options;
    const authored = [...index.rooms.values()].filter((r) => r.source).length;
    await fs.mkdir(out, { recursive: true });
    let pages = 0;
    const unresolved: string[] = [];
    const home = renderHome(index, base, title);
    await writePage(out, "index.html", home.html);
    for (const target of home.unresolved) unresolved.push(`#${HOME_TAG} -> ${target}`);
    pages++;
    await writePage(out, path.join("tags", "index.html"), renderTagIndex(index, base, title));
    pages++;
    for (const tag of index.tags.values()) {
        const result = renderTagPage(tag, index, base, title);
        await writePage(out, path.join("tags", tag.slug, "index.html"), result.html);
        for (const target of result.unresolved)
            unresolved.push(`#${tag.name} -> ${target}`);
        pages++;
    }
    const sizeWarnings: string[] = [];
    for (const room of index.rooms.values()) {
        if (room.absoluteWithoutSize) {
            sizeWarnings.push(`#${room.tag}: absolute size/position needs width and height on the room note`);
        }
    }

    // A room note naming a tag no note carries decorates nothing, and would
    // otherwise be dropped without a word.
    for (const room of index.authoredRooms) {
        if (room.tag !== HOME_TAG && !index.tags.has(room.tag)) {
            sizeWarnings.push(`${room.source}: no note is tagged #${room.tag}, so this room is unused`);
        }
    }
    for (const note of index.notes.values()) {
        const page = renderNotePage(note, index, base, title);
        await writePage(out, path.join(...noteOutputPath(note.slug), "index.html"), page.html);
        // Attachments a note embeds or links are copied like a room's images.
        for (const file of page.used) index.assets.add(file);
        pages++;
    }
    await copyAssets(out);
    await writeBreakpoint(out, options.breakpoint);
    const missingAssets = await copyVaultAssets(index, out);
    return {
        notes: index.notes.size,
        tags: index.tags.size,
        rooms: index.rooms.size,
        authoredRooms: authored,
        pages,
        out,
        unresolved,
        missingAssets,
        sizeWarnings,
    };
}
