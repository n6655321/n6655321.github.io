import MarkdownIt from "markdown-it";
import type { Note, Tag, VaultIndex } from "../types.js";
import { renderRoomStage, assetHref } from "./room.js";
import { attachmentKind, resolveAttachment } from "../parse/attachments.js";
import { encodePathSegment, escapeHtml, shell } from "./html.js";
const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
export function tagHref(base: string, tag: Tag): string {
    return `${base}/tags/${tag.slug}/`;
}
export function noteOutputPath(slug: string): string[] {
    const parts = slug.split("/").filter(Boolean);
    if (parts[0] === "notes")
        parts.shift();
    return ["notes", ...parts];
}
export function noteHref(base: string, note: {
    slug: string;
}): string {
    return `${base}/${noteOutputPath(note.slug).map(encodePathSegment).join("/")}/`;
}
function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
}
/**
 * Render one embedded file: an image inline, a PDF in a viewer.
 *
 * A PDF gets an `<object>` with a download link inside it, which is what shows
 * when a browser cannot display PDFs itself.
 */
function renderEmbed(url: string, file: string, alt: string): string {
    const kind = attachmentKind(file);
    if (kind === "pdf") {
        return `<span class="embed embed-pdf"><object data="${escapeHtml(url)}" type="application/pdf">` +
            `<a href="${escapeHtml(url)}">${escapeHtml(alt || file.split("/").pop() || "PDF")}</a>` +
            `</object></span>`;
    }
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
}

/**
 * Render a note body to HTML.
 *
 * Three things are rewritten before markdown-it sees the text, because none of
 * them are CommonMark: Obsidian's `![[embed]]` and `[[wikilink]]`, and the
 * relative paths in plain markdown images, which have to become site URLs.
 *
 * Files that an embed or image points at are recorded in `used`, so the build
 * copies exactly what the site references and nothing else.
 */
function renderBody(
    body: string,
    note: Note,
    index: VaultIndex,
    base: string,
    used?: Set<string>,
): string {
    const byTitle = new Map<string, Note>();
    const byBasename = new Map<string, Note>();
    for (const n of index.notes.values()) {
        byTitle.set(n.title.toLowerCase(), n);
        byBasename.set((n.slug.split("/").pop() ?? n.slug).toLowerCase(), n);
    }

    const attach = (reference: string): string | null => {
        const file = resolveAttachment(reference, note, index.files);
        if (file) used?.add(file);
        return file;
    };

    let resolved = body;

    resolved = resolved.replace(/!\[\[([^\]]+)\]\]/g, (_whole, inner: string) => {
        const [rawTarget = "", alias] = inner.split("|");
        const file = attach(rawTarget);
        if (!file) {
            const label = (alias ?? rawTarget).trim();
            return `<span class="broken-link" title="Unresolved embed">${escapeHtml(label)}</span>`;
        }
        return renderEmbed(assetHref(base, file), file, (alias ?? "").trim());
    });

    resolved = resolved.replace(/\[\[([^\]]+)\]\]/g, (_whole, inner: string) => {
        const [rawTarget = "", alias] = inner.split("|");
        const target = rawTarget.split("#")[0]!.trim();
        const label = (alias ?? target).trim();
        const key = target.toLowerCase();
        const hit = byBasename.get(key) ?? byTitle.get(key) ?? byBasename.get(key.replace(/\.md$/, ""));
        if (hit) return `[${label}](${noteHref(base, hit)})`;
        // Not a note: it may still be a file in the vault, linked rather than embedded.
        const file = attach(target);
        if (file) return `[${label}](${assetHref(base, file)})`;
        return `<span class="broken-link" title="Unresolved link">${escapeHtml(label)}</span>`;
    });

    resolved = resolved.replace(
        /!\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g,
        (whole, alt: string, src: string) => {
            const file = attach(src);
            if (!file) return whole;
            return renderEmbed(assetHref(base, file), file, alt);
        },
    );

    resolved = resolved.replace(
        /(^|[^!])\[([^\]]+)\]\(([^)\s]+)(\s+"[^"]*")?\)/g,
        (whole, before: string, label: string, href: string) => {
            if (/^[a-z][a-z0-9+.-]*:|^#|^\//i.test(href)) return whole;
            const file = attach(href);
            if (!file) return whole;
            return `${before}[${label}](${assetHref(base, file)})`;
        },
    );

    return md.render(resolved);
}

function tagRow(base: string, tag: Tag): string {
    return `<li><a href="${tagHref(base, tag)}"><span class="tag-name">#${escapeHtml(tag.name)}</span><span class="tag-count">${tag.notes.length}</span></a></li>`;
}
export interface TagPageResult {
    html: string;
    unresolved: string[];
}
export function renderTagPage(tag: Tag, index: VaultIndex, base: string, siteTitle: string): TagPageResult {
    const room = index.rooms.get(tag.name);
    const stage = renderRoomStage(room, index, base, tagHref, noteHref);
    const claimed = new Set<string>();
    for (const childName of tag.children) {
        for (const p of index.tags.get(childName)?.notes ?? [])
            claimed.add(p);
    }
    const directNotes = tag.notes.filter((p) => !claimed.has(p));
    const inheritedNotes = tag.notes.filter((p) => claimed.has(p));
    const childList = tag.children.length
        ? `<section class="panel">
  <h2>Sub-concepts</h2>
  <p class="panel-note">Every note tagged with these is also tagged <code>#${escapeHtml(tag.name)}</code>.</p>
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
    const noteRows = (paths: string[]) => paths
        .map((p) => {
        const n = index.notes.get(p)!;
        const excerpt = n.excerpt
            ? `<span class="note-excerpt">${escapeHtml(n.excerpt)}</span>`
            : "";
        return `<li><a href="${noteHref(base, n)}"><span class="note-title">${escapeHtml(n.title)}</span>${excerpt}</a></li>`;
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
  <p class="panel-note">Tagged <code>#${escapeHtml(tag.name)}</code> and also filed under a narrower concept.</p>
  <ul class="note-list">${noteRows(inheritedNotes)}</ul>
</section>`
        : "";
    const panels = childList + parentList + siblingList + noteList + inheritedList;
    const panelClass = stage.html ? "panels panels-fallback" : "panels";
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
            room: Boolean(stage.html),
            body,
        }),
        unresolved: stage.unresolved,
    };
}
export interface NotePageResult {
    html: string;
    /** Vault files this page references, for the build to copy. */
    used: string[];
}

export function renderNotePage(note: Note, index: VaultIndex, base: string, siteTitle: string): NotePageResult {
    const used = new Set<string>();
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
  <div class="prose">${renderBody(note.body, note, index, base, used)}</div>
</article>`;
    return {
        html: shell({
            title: note.title,
            siteTitle,
            base,
            description: note.excerpt,
            body,
        }),
        used: [...used],
    };
}
export function renderTagIndex(index: VaultIndex, base: string, siteTitle: string): string {
    const tags = [...index.tags.values()].sort((a, b) => b.notes.length - a.notes.length || a.name.localeCompare(b.name));
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
    <p class="lede">${plural(tags.length, "concept")} across ${plural(index.notes.size, "note")}. Broadest first.</p>
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
