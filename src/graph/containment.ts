import type { Note, Tag } from "../types.js";
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
export function tagLabel(tag: string): string {
    const last = tag.split("/").pop() ?? tag;
    return last.replace(/[-_]+/g, " ").trim() || tag;
}
export function buildTagSets(notes: Note[]): Map<string, Set<string>> {
    const sets = new Map<string, Set<string>>();
    for (const note of notes) {
        for (const tag of note.tags) {
            let set = sets.get(tag);
            if (!set)
                sets.set(tag, (set = new Set()));
            set.add(note.path);
        }
    }
    return sets;
}
export function isTagAncestor(a: string, b: string): boolean {
    return b.startsWith(`${a}/`);
}
function isSuperset(a: Set<string>, b: Set<string>): boolean {
    if (a.size < b.size)
        return false;
    for (const item of b)
        if (!a.has(item))
            return false;
    return true;
}
export interface Poset {
    descendants: Map<string, Set<string>>;
    children: Map<string, Set<string>>;
    parents: Map<string, Set<string>>;
    equivalents: Map<string, Set<string>>;
}
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
            if (a === b)
                continue;
            const setB = tagSets.get(b)!;
            if (!isSuperset(setA, setB))
                continue;
            if (setA.size === setB.size) {
                if (isTagAncestor(a, b))
                    descendants.get(a)!.add(b);
                else if (!isTagAncestor(b, a))
                    equivalents.get(a)!.add(b);
            }
            else {
                descendants.get(a)!.add(b);
            }
        }
    }
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
                if (b === c)
                    continue;
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
function relatedTags(tag: string, tagSets: Map<string, Set<string>>, poset: Poset, limit = 12): string[] {
    const own = tagSets.get(tag)!;
    const scored: Array<{
        tag: string;
        score: number;
    }> = [];
    for (const [other, set] of tagSets) {
        if (other === tag)
            continue;
        if (poset.descendants.get(tag)!.has(other))
            continue;
        if (poset.descendants.get(other)!.has(tag))
            continue;
        let shared = 0;
        for (const note of own)
            if (set.has(note))
                shared++;
        if (shared === 0)
            continue;
        const score = shared / (own.size + set.size - shared);
        scored.push({ tag: other, score });
    }
    scored.sort((x, y) => y.score - x.score || x.tag.localeCompare(y.tag));
    return scored.slice(0, limit).map((s) => s.tag);
}
export function buildTags(notes: Note[]): Map<string, Tag> {
    const tagSets = buildTagSets(notes);
    const poset = buildPoset(tagSets);
    const slugs = new Map<string, string>();
    const used = new Set<string>();
    for (const tag of [...tagSets.keys()].sort()) {
        let slug = tagSlug(tag) || "tag";
        if (used.has(slug)) {
            let n = 2;
            while (used.has(`${slug}-${n}`))
                n++;
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
