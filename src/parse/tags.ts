/**
 * Tag extraction.
 *
 * Obsidian accepts tags in two places: the `tags` (or `tag`) frontmatter key,
 * and inline `#hashtags` in the body. Inline scanning has to avoid three
 * things that look like tags but are not: markdown headings (`# Title`),
 * fenced or inline code, and URL fragments (`example.com/page#section`).
 */

/** Characters Obsidian allows in a tag after the `#`. */
const TAG_BODY = /^[\p{L}\p{N}_/-]+/u;

/** Normalise a tag for indexing: strip `#`, trim slashes, lowercase. */
export function normalizeTag(raw: string): string | null {
  const trimmed = raw.trim().replace(/^#/, "").replace(/^\/+|\/+$/g, "");
  if (!trimmed) return null;
  // A tag made only of digits is a number, not a tag (Obsidian's rule).
  if (/^[\p{N}]+$/u.test(trimmed)) return null;
  if (!/^[\p{L}\p{N}_/-]+$/u.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/** Remove regions where a `#` cannot start a tag, preserving offsets. */
function maskNonTagRegions(body: string): string {
  let masked = body;
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  // Fenced code blocks (``` or ~~~).
  masked = masked.replace(/^([ \t]*)(```|~~~)[\s\S]*?^\1?\2[ \t]*$/gm, blank);
  // Unterminated fence: mask to end of document.
  masked = masked.replace(/^[ \t]*(```|~~~)[\s\S]*$/m, blank);
  // Inline code spans.
  masked = masked.replace(/`[^`\n]*`/g, blank);
  // Indented code blocks (4 spaces / a tab at line start).
  masked = masked.replace(/^(?: {4}|\t).*$/gm, blank);
  // ATX headings: mask only the leading `#` run so the text stays scannable.
  masked = masked.replace(/^[ \t]{0,3}#{1,6}(?=\s)/gm, blank);
  return masked;
}

/** Collect inline `#tags` from a markdown body. */
export function extractInlineTags(body: string): string[] {
  const masked = maskNonTagRegions(body);
  const found: string[] = [];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== "#") continue;
    // Must be at a boundary: start of text, or preceded by whitespace or an
    // opening bracket. This rejects `page#section` and `color: #fff` tails.
    const prev = i > 0 ? masked[i - 1]! : " ";
    if (!/[\s([{<'"]/.test(prev)) continue;
    const rest = masked.slice(i + 1);
    const m = TAG_BODY.exec(rest);
    if (!m) continue;
    const tag = normalizeTag(m[0]);
    if (tag) found.push(tag);
    i += m[0].length;
  }
  return found;
}

/** Collect tags from the `tags` / `tag` frontmatter keys. */
export function extractFrontmatterTags(fm: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ["tags", "tag"]) {
    const value = fm[key];
    if (typeof value === "string") {
      // Both `tags: a, b` and `tags: a b` appear in the wild.
      for (const piece of value.split(/[,\s]+/)) {
        const tag = normalizeTag(piece);
        if (tag) out.push(tag);
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item !== "string" && typeof item !== "number") continue;
        const tag = normalizeTag(String(item));
        if (tag) out.push(tag);
      }
    }
  }
  return out;
}

/**
 * Expand hierarchical tags so `#science/biology` also counts as `#science`.
 * Obsidian's tag pane does this, and it makes the containment graph richer.
 */
export function expandHierarchy(tags: Iterable<string>): string[] {
  const set = new Set<string>();
  for (const tag of tags) {
    const parts = tag.split("/");
    for (let i = 1; i <= parts.length; i++) {
      set.add(parts.slice(0, i).join("/"));
    }
  }
  return [...set].sort();
}
