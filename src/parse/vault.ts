import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { BuildOptions, Note } from "../types.js";
import { expandHierarchy, extractFrontmatterTags, extractInlineTags, } from "./tags.js";
const ALWAYS_SKIP = new Set([".obsidian", ".trash", ".git", "node_modules"]);
function toPosix(p: string): string {
    return p.split(path.sep).join("/");
}
export async function walkVault(root: string, ignorePaths: string[] = []): Promise<string[]> {
    return (await walkVaultFiles(root, ignorePaths)).notes;
}

/**
 * List the vault's markdown notes and every other file alongside them.
 *
 * Attachments have to be known before a note body can be rendered: an embed is
 * resolved against the set of real files, the way Obsidian resolves one.
 */
export async function walkVaultFiles(root: string, ignorePaths: string[] = []): Promise<{
    notes: string[];
    files: string[];
}> {
    const notes: string[] = [];
    const files: string[] = [];
    async function walk(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const abs = path.join(dir, entry.name);
            const rel = toPosix(path.relative(root, abs));
            if (ignorePaths.some((p) => rel === p || rel.startsWith(`${p}/`)))
                continue;
            if (entry.isDirectory()) {
                if (ALWAYS_SKIP.has(entry.name) || entry.name.startsWith("."))
                    continue;
                await walk(abs);
            }
            else if (entry.isFile()) {
                if (entry.name.toLowerCase().endsWith(".md")) notes.push(rel);
                else if (!entry.name.startsWith(".")) files.push(rel);
            }
        }
    }
    await walk(root);
    return { notes: notes.sort(), files: files.sort() };
}
function toPlainText(md: string): string {
    return md
        .replace(/^([ \t]*)(```|~~~)[\s\S]*?^\1?\2[ \t]*$/gm, "")
        .replace(/!\[\[[^\]]*\]\]/g, "")
        .replace(/\[\[([^\]|]*)\|?([^\]]*)\]\]/g, (_, a: string, b: string) => b || a)
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/^[ \t]{0,3}#{1,6}\s+/gm, "")
        .replace(/^[ \t]{0,3}>\s?/gm, "")
        .replace(/^[ \t]*[-*+]\s+/gm, "")
        .replace(/[*_~`]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function firstHeading(md: string): string | null {
    const m = /^[ \t]{0,3}#\s+(.+)$/m.exec(md);
    return m ? m[1]!.trim() : null;
}
function extractLinks(md: string): string[] {
    const out = new Set<string>();
    const re = /\[\[([^\]]+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(md))) {
        const target = m[1]!.split("|")[0]!.split("#")[0]!.trim();
        if (target)
            out.add(target);
    }
    return [...out];
}
export async function readNote(root: string, rel: string): Promise<Note> {
    const raw = await fs.readFile(path.join(root, rel), "utf8");
    let parsed: {
        data: Record<string, unknown>;
        content: string;
    };
    try {
        const result = matter(raw);
        parsed = { data: result.data as Record<string, unknown>, content: result.content };
    }
    catch {
        parsed = { data: {}, content: raw };
    }
    const { data: frontmatter, content: body } = parsed;
    const basename = path.basename(rel, ".md");
    const title = (typeof frontmatter.title === "string" && frontmatter.title.trim()) ||
        firstHeading(body) ||
        basename;
    const tags = expandHierarchy([
        ...extractFrontmatterTags(frontmatter),
        ...extractInlineTags(body),
    ]);
    const plain = toPlainText(body);
    return {
        path: rel,
        slug: rel.replace(/\.md$/i, ""),
        title,
        tags,
        frontmatter,
        body,
        excerpt: plain.length > 280 ? `${plain.slice(0, 277).trimEnd()}…` : plain,
        links: extractLinks(body),
    };
}
export async function readVault(options: BuildOptions): Promise<Note[]> {
    const files = await walkVault(options.vault, options.ignorePaths);
    const notes = await Promise.all(files.map((f) => readNote(options.vault, f)));
    if (options.ignoreTags.length === 0)
        return notes;
    const ignored = new Set(options.ignoreTags.map((t) => t.toLowerCase()));
    return notes.map((note) => ({
        ...note,
        tags: note.tags.filter((t) => !ignored.has(t)),
    }));
}
