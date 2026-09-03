const TAG_BODY = /^[\p{L}\p{N}_/-]+/u;
export function normalizeTag(raw: string): string | null {
    const trimmed = raw.trim().replace(/^#/, "").replace(/^\/+|\/+$/g, "");
    if (!trimmed)
        return null;
    if (/^[\p{N}]+$/u.test(trimmed))
        return null;
    if (!/^[\p{L}\p{N}_/-]+$/u.test(trimmed))
        return null;
    return trimmed.toLowerCase();
}
function maskNonTagRegions(body: string): string {
    let masked = body;
    const blank = (m: string) => m.replace(/[^\n]/g, " ");
    masked = masked.replace(/^([ \t]*)(```|~~~)[\s\S]*?^\1?\2[ \t]*$/gm, blank);
    masked = masked.replace(/^[ \t]*(```|~~~)[\s\S]*$/m, blank);
    masked = masked.replace(/`[^`\n]*`/g, blank);
    masked = masked.replace(/^(?: {4}|\t).*$/gm, blank);
    masked = masked.replace(/^[ \t]{0,3}#{1,6}(?=\s)/gm, blank);
    return masked;
}
export function extractInlineTags(body: string): string[] {
    const masked = maskNonTagRegions(body);
    const found: string[] = [];
    for (let i = 0; i < masked.length; i++) {
        if (masked[i] !== "#")
            continue;
        const prev = i > 0 ? masked[i - 1]! : " ";
        if (!/[\s([{<'"]/.test(prev))
            continue;
        const rest = masked.slice(i + 1);
        const m = TAG_BODY.exec(rest);
        if (!m)
            continue;
        const tag = normalizeTag(m[0]);
        if (tag)
            found.push(tag);
        i += m[0].length;
    }
    return found;
}
export function extractFrontmatterTags(fm: Record<string, unknown>): string[] {
    const out: string[] = [];
    for (const key of ["tags", "tag"]) {
        const value = fm[key];
        if (typeof value === "string") {
            for (const piece of value.split(/[,\s]+/)) {
                const tag = normalizeTag(piece);
                if (tag)
                    out.push(tag);
            }
        }
        else if (Array.isArray(value)) {
            for (const item of value) {
                if (typeof item !== "string" && typeof item !== "number")
                    continue;
                const tag = normalizeTag(String(item));
                if (tag)
                    out.push(tag);
            }
        }
    }
    return out;
}
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
