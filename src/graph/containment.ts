/**
 * Builds the tag poset.
 *
 * A tag A *strictly contains* B when every note tagged B is also tagged A and
 * A has at least one note B lacks. That is a partial order, so the raw relation
 * is transitive: if A ⊃ B ⊃ C then A ⊃ C is also true but redundant on the
 * page. We keep only the covering relations (the transitive reduction), which
 * is what a reader wants: the immediate sub-concepts, not every descendant.
 *
 * Tags with identical note sets are equivalent rather than nested. Neither
 * contains the other, so they are surfaced as siblings instead — otherwise
 * they would silently vanish from the hierarchy.
 */

import type { Note, Tag } from "../types.js";

/** Turn a tag into a filesystem- and URL-safe slug. */
export function tagSlug(tag: string): string {
  return tag
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\//g, "-")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Last hierarchy segment, with separators turned into spaces. */
export function tagLabel(tag: string): string {
  const last = tag.split("/").pop() ?? tag;
  return last.replace(/[-_]+/g, " ").trim() || tag;
}

/** Index of tag -> set of note paths carrying it. */
export function buildTagSets(notes: Note[]): Map<string, Set<string>> {
  const sets = new Map<string, Set<string>>();
  for (const note of notes) {
    for (const tag of note.tags) {
      let set = sets.get(tag);
      if (!set) sets.set(tag, (set = new Set()));
      set.add(note.path);
    }
  }
  return sets;
}

/** True when `a` is a hierarchy ancestor of `b`, e.g. `science` of `science/bio`. */
export function isTagAncestor(a: string, b: string): boolean {
  return b.startsWith(`${a}/`);
}

/** True when `a` ⊇ `b`. */
function isSuperset(a: Set<string>, b: Set<string>): boolean {
  if (a.size < b.size) return false;
  for (const item of b) if (!a.has(item)) return false;
  return true;
}

export interface Poset {
  /** tag -> tags it strictly contains, transitively. */
  descendants: Map<string, Set<string>>;
  /** tag -> tags it strictly contains, covering relations only. */
  children: Map<string, Set<string>>;
  /** tag -> tags that strictly contain it, covering relations only. */
  parents: Map<string, Set<string>>;
  /** tag -> tags with an identical note set. */
  equivalents: Map<string, Set<string>>;
}

/** Compute strict containment, its transitive reduction, and equivalences. */
export function buildPoset(tagSets: Map<string, Set<string>>): Poset {
  const tags = [...tagSets.keys()].sort();
  const descendants = new Map<string, Set<string>>();
  const equivalents = new Map<string, Set<string>>();
  for (const tag of tags) {
    descendants.set(tag, new Set());
    equivalents.set(tag, new Set());
  }

  for (const a of tags) {
    const setA = tagSets.get(a)!;
    for (const b of tags) {
      if (a === b) continue;
      const setB = tagSets.get(b)!;
      if (!isSuperset(setA, setB)) continue;
      if (setA.size === setB.size) {
        // Same note set. Set inclusion alone cannot order these, but Obsidian's
        // own `a/b` syntax is an explicit declaration of containment, so honour
        // it: `#science` contains `#science/physics` even when, in this vault,
        // every `#science` note happens to also be `#science/physics`. Without
        // this the whole hierarchy would collapse into a bag of equivalents.
        if (isTagAncestor(a, b)) descendants.get(a)!.add(b);
        else if (!isTagAncestor(b, a)) equivalents.get(a)!.add(b);
      } else {
        descendants.get(a)!.add(b);
      }
    }
  }

  // Transitive reduction: drop A -> C when some B has A -> B -> C.
  const children = new Map<string, Set<string>>();
  const parents = new Map<string, Set<string>>();
  for (const tag of tags) {
    children.set(tag, new Set());
    parents.set(tag, new Set());
  }
  for (const a of tags) {
    const desc = descendants.get(a)!;
    for (const c of desc) {
      let covered = false;
      for (const b of desc) {
        if (b === c) continue;
        if (descendants.get(b)!.has(c)) {
          covered = true;
          break;
        }
      }
      if (!covered) {
        children.get(a)!.add(c);
        parents.get(c)!.add(a);
      }
    }
  }

  return { descendants, children, parents, equivalents };
}

/**
 * Tags that overlap this one without either containing the other, plus its
 * equivalents. These are the "doors to adjacent rooms" in the rendered page.
 */
function relatedTags(
  tag: string,
  tagSets: Map<string, Set<string>>,
  poset: Poset,
  limit = 12,
): string[] {
  const own = tagSets.get(tag)!;
  const scored: Array<{ tag: string; score: number }> = [];
  for (const [other, set] of tagSets) {
    if (other === tag) continue;
    if (poset.descendants.get(tag)!.has(other)) continue;
    if (poset.descendants.get(other)!.has(tag)) continue;
    let shared = 0;
    for (const note of own) if (set.has(note)) shared++;
    if (shared === 0) continue;
    // Jaccard similarity keeps huge tags from dominating every room.
    const score = shared / (own.size + set.size - shared);
    scored.push({ tag: other, score });
  }
  scored.sort((x, y) => y.score - x.score || x.tag.localeCompare(y.tag));
  return scored.slice(0, limit).map((s) => s.tag);
}

/** Assemble the final `Tag` records from notes. */
export function buildTags(notes: Note[]): Map<string, Tag> {
  const tagSets = buildTagSets(notes);
  const poset = buildPoset(tagSets);
  const slugs = new Map<string, string>();

  // Slugs can collide (`a/b` and `a-b`); disambiguate deterministically.
  const used = new Set<string>();
  for (const tag of [...tagSets.keys()].sort()) {
    let slug = tagSlug(tag) || "tag";
    if (used.has(slug)) {
      let n = 2;
      while (used.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    used.add(slug);
    slugs.set(tag, slug);
  }

  const tags = new Map<string, Tag>();
  for (const [name, notesSet] of tagSets) {
    tags.set(name, {
      name,
      label: tagLabel(name),
      slug: slugs.get(name)!,
      notes: [...notesSet].sort(),
      children: [...poset.children.get(name)!].sort(),
      parents: [...poset.parents.get(name)!].sort(),
      siblings: relatedTags(name, tagSets, poset),
    });
  }
  return tags;
}
