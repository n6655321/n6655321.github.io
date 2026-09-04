import path from "node:path";
import type { Note } from "../types.js";

export const IMAGE_EXTENSIONS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".bmp", ".ico",
]);

export const EMBED_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ".pdf"]);

export function attachmentKind(file: string): "image" | "pdf" | null {
    const ext = path.extname(file).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) return "image";
    if (ext === ".pdf") return "pdf";
    return null;
}

/**
 * Resolve a reference written in a note to a vault-relative file path.
 *
 * Obsidian resolves an embed by shortest unique name, not by path, so
 * `![[photo.png]]` finds `attachments/photo.png` from anywhere in the vault.
 * A relative path is also tried, resolved against the referring note's folder,
 * which is what a plain markdown `![](…)` means.
 */
export function resolveAttachment(
    reference: string,
    fromNote: Note,
    files: Set<string>,
): string | null {
    const target = decodeURIComponent(reference.split("#")[0]!.split("?")[0]!.trim());
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return null;

    const candidates: string[] = [];
    if (target.startsWith("/")) {
        candidates.push(target.slice(1));
    } else {
        const dir = path.posix.dirname(fromNote.path);
        candidates.push(path.posix.normalize(dir === "." ? target : `${dir}/${target}`));
        candidates.push(target);
    }

    for (const candidate of candidates) {
        const clean = candidate.replace(/^\.\//, "");
        if (files.has(clean)) return clean;
    }

    const basename = path.posix.basename(target).toLowerCase();
    const matches = [...files].filter(
        (file) => path.posix.basename(file).toLowerCase() === basename,
    );
    return matches.sort()[0] ?? null;
}
