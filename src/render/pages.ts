/** Builds the three page types: tag rooms, note pages, and the tag index. */

import MarkdownIt from "markdown-it";
import type { Note, Tag, VaultIndex } from "../types.js";
import { renderRoomStage } from "./room.js";
import { escapeHtml, shell } from "./html.js";

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

/** URL of a tag's room page. */
export function tagHref(base: string, tag: Tag): string {
  return `${base}/tags/${tag.slug}/`;
}

/**
 * Path segments of a note page, relative to the site root.
 *
 * The single source of truth for the note URL scheme: `build` writes files here
 * and `noteHref` links here, so the two can never drift apart. Notes live under
 * `/notes/` to keep them out of `/tags/`, and the vault's own folder structure
 * is preserved below that so two notes sharing a basename keep distinct URLs.
 * A vault whose own top folder is already called `notes` must not end up at
 * `/notes/notes/…`, so that one duplicated segment is collapsed.
 */
export function noteOutputPath(slug: string): string[] {
  const parts = slug.split("/").filter(Boolean);
  if (parts[0] === "notes") parts.shift();
  return ["notes", ...parts];
}

/** URL of a note page. */
export function noteHref(base: string, note: { slug: string }): string {
  return `${base}/${noteOutputPath(note.slug).map(encodeURIComponent).join("/")}/`;
}

/** Plural helper: `1 note`, `3 notes`. */
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Render markdown body to HTML, resolving `[[wikilinks]]` to note pages. */
function renderBody(body: string, index: VaultIndex, base: string): string {
  // Resolve wikilinks before markdown-it sees them; `[[x]]` is not CommonMark.
  const byTitle = new Map<string, Note>();
  const byBasename = new Map<string, Note>();
  for (const n of index.notes.values()) {
    byTitle.set(n.title.toLowerCase(), n);
    byBasename.set((n.slug.split("/").pop() ?? n.slug).toLowerCase(), n);
  }
  const resolved = body.replace(/\[\[([^\]]+)\]\]/g, (_whole, inner: string) => {
    const [rawTarget = "", alias] = inner.split("|");
    const target = rawTarget.split("#")[0]!.trim();
    const label = (alias ?? target).trim();
    const key = target.toLowerCase();
    const hit =
      byBasename.get(key) ?? byTitle.get(key) ?? byBasename.get(key.replace(/\.md$/, ""));
    if (!hit) {
      return `<span class="broken-link" title="Unresolved link">${escapeHtml(label)}</span>`;
    }
    return `[${label}](${noteHref(base, hit)})`;
  });
  return md.render(resolved);
}

/** A link row in a side panel. */
function tagRow(base: string, tag: Tag): string {
  return `<li><a href="${tagHref(base, tag)}"><span class="tag-name">#${escapeHtml(
    tag.name,
  )}</span><span class="tag-count">${tag.notes.length}</span></a></li>`;
}

export interface TagPageResult {
  html: string;
  /** Hotspot targets in this room that resolved to nothing. */
  unresolved: string[];
}

/**
 * A tag's page: the room image where one is authored, plus the list layout.
 *
 * Both are always emitted. CSS shows the room on wide screens and the list on
 * narrow ones; a tag with no room note shows the list at every size.
 */
export function renderTagPage(
  tag: Tag,
  index: VaultIndex,
  base: string,
  siteTitle: string,
): TagPageResult {
  const room = index.rooms.get(tag.name);
  const stage = renderRoomStage(room, index, base, tagHref, noteHref);

  // Notes filed under a sub-concept are listed separately, so a broad concept
  // still shows everything it contains without burying its own direct notes.
  const claimed = new Set<string>();
  for (const childName of tag.children) {
    for (const p of index.tags.get(childName)?.notes ?? []) claimed.add(p);
  }
  const directNotes = tag.notes.filter((p) => !claimed.has(p));
  const inheritedNotes = tag.notes.filter((p) => claimed.has(p));

  const childList = tag.children.length
    ? `<section class="panel">
  <h2>Sub-concepts</h2>
  <p class="panel-note">Every note tagged with these is also tagged <code>#${escapeHtml(
    tag.name,
  )}</code>.</p>
  <ul class="tag-list">${tag.children
    .map((name) => tagRow(base, index.tags.get(name)!))
    .join("")}</ul>
</section>`
    : "";

  const parentList = tag.parents.length
    ? `<section class="panel">
  <h2>Part of</h2>
  <ul class="tag-list">${tag.parents
    .map((name) => tagRow(base, index.tags.get(name)!))
    .join("")}</ul>
</section>`
    : "";

  const siblingList = tag.siblings.length
    ? `<section class="panel">
  <h2>Related</h2>
  <ul class="tag-list">${tag.siblings
    .map((name) => tagRow(base, index.tags.get(name)!))
    .join("")}</ul>
</section>`
    : "";

  const noteRows = (paths: string[]) =>
    paths
      .map((p) => {
        const n = index.notes.get(p)!;
        const excerpt = n.excerpt
          ? `<span class="note-excerpt">${escapeHtml(n.excerpt)}</span>`
          : "";
        return `<li><a href="${noteHref(base, n)}"><span class="note-title">${escapeHtml(
          n.title,
        )}</span>${excerpt}</a></li>`;
      })
      .join("");

  const noteList = directNotes.length
    ? `<section class="panel">
  <h2>Notes here</h2>
  <ul class="note-list">${noteRows(directNotes)}</ul>
</section>`
    : "";

  const inheritedList = inheritedNotes.length
    ? `<section class="panel">
  <h2>Notes in sub-concepts</h2>
  <p class="panel-note">Tagged <code>#${escapeHtml(
    tag.name,
  )}</code> and also filed under a narrower concept.</p>
  <ul class="note-list">${noteRows(inheritedNotes)}</ul>
</section>`
    : "";

  const panels = childList + parentList + siblingList + noteList + inheritedList;

  // With a room present the panels are the small-screen fallback; without one
  // they are the page itself and must show at every width.
  const panelClass = stage.html ? "panels panels-fallback" : "panels";

  /*
   * A room is the image and its clickable objects, nothing else — no heading,
   * no counts, no prose. The tag name still reaches assistive technology and
   * the browser tab through the document title.
   *
   * The narrow-screen fallback keeps a heading, because a bare list of links
   * with no indication of which concept they belong to is unreadable.
   */
  const body = stage.html
    ? `<article class="tag-page">
  ${stage.html}
  <div class="${panelClass}">
    <h1 class="fallback-title">#${escapeHtml(tag.name)}</h1>
    ${panels}
  </div>
</article>`
    : `<article class="tag-page">
  <header class="page-head">
    <h1>#${escapeHtml(tag.name)}</h1>
  </header>
  <div class="${panelClass}">${panels}</div>
</article>`;

  return {
    html: shell({
      title: `#${tag.name}`,
      siteTitle,
      base,
      // The cursor-following label is the only thing the site uses JS for.
      room: Boolean(stage.html),
      body,
    }),
    unresolved: stage.unresolved,
  };
}

/** A single note's page. */
export function renderNotePage(
  note: Note,
  index: VaultIndex,
  base: string,
  siteTitle: string,
): string {
  const tags = note.tags
    .map((name) => index.tags.get(name))
    .filter((t): t is Tag => Boolean(t));

  const chips = tags.length
    ? `<ul class="tag-chips">${tags
        .map((t) => `<li><a href="${tagHref(base, t)}">#${escapeHtml(t.name)}</a></li>`)
        .join("")}</ul>`
    : "";

  const body = `<article class="note-page">
  <header class="page-head">
    <h1>${escapeHtml(note.title)}</h1>
    ${chips}
  </header>
  <div class="prose">${renderBody(note.body, index, base)}</div>
</article>`;

  return shell({
    title: note.title,
    siteTitle,
    base,
    description: note.excerpt,
    body,
  });
}

/** The index of every tag, broadest first. */
export function renderTagIndex(index: VaultIndex, base: string, siteTitle: string): string {
  const tags = [...index.tags.values()].sort(
    (a, b) => b.notes.length - a.notes.length || a.name.localeCompare(b.name),
  );
  const roots = tags.filter((t) => t.parents.length === 0);

  const card = (t: Tag) => {
    const sub = t.children.length
      ? `<span class="tag-sub">${plural(t.children.length, "sub-concept")}</span>`
      : "";
    return `<li class="tag-card">
  <a href="${tagHref(base, t)}">
    <span class="tag-name">#${escapeHtml(t.name)}</span>
    <span class="tag-count">${plural(t.notes.length, "note")}</span>
    ${sub}
  </a>
</li>`;
  };

  const body = `<article class="index-page">
  <header class="page-head">
    <h1>Concepts</h1>
    <p class="lede">${plural(tags.length, "concept")} across ${plural(
      index.notes.size,
      "note",
    )}. Broadest first.</p>
  </header>
  <section class="panel">
    <h2>Top-level concepts</h2>
    <p class="panel-note">Concepts that no other concept contains.</p>
    <ul class="tag-grid">${roots.map(card).join("")}</ul>
  </section>
  <section class="panel">
    <h2>Every concept</h2>
    <ul class="tag-grid">${tags.map(card).join("")}</ul>
  </section>
</article>`;

  return shell({
    title: "Concepts",
    siteTitle,
    base,
    description: `Index of ${plural(tags.length, "concept")}.`,
    body,
  });
}
