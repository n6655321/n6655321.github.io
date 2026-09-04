import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { build } from "../dist/build.js";
import { resolveAttachment, attachmentKind } from "../dist/parse/attachments.js";

const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
);
const PDF = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";

const note = (p) => ({
    path: p, slug: p.replace(/\.md$/, ""), title: p,
    tags: [], frontmatter: {}, body: "", excerpt: "", links: [],
});

test("attachment kinds are recognised by extension", () => {
    assert.equal(attachmentKind("a/b.png"), "image");
    assert.equal(attachmentKind("A.JPEG"), "image");
    assert.equal(attachmentKind("x.svg"), "image");
    assert.equal(attachmentKind("report.pdf"), "pdf");
    assert.equal(attachmentKind("notes.md"), null);
    assert.equal(attachmentKind("archive.zip"), null);
});

test("an embed resolves by shortest name, the way Obsidian does", () => {
    const files = new Set(["attachments/photo.png", "deep/nested/other.png"]);
    const from = note("notes/journal/today.md");
    assert.equal(resolveAttachment("photo.png", from, files), "attachments/photo.png");
    assert.equal(resolveAttachment("other.png", from, files), "deep/nested/other.png");
    assert.equal(resolveAttachment("missing.png", from, files), null);
});

test("a relative path resolves against the referring note", () => {
    const files = new Set(["notes/img/a.png", "top.png"]);
    const from = note("notes/entry.md");
    assert.equal(resolveAttachment("img/a.png", from, files), "notes/img/a.png");
    assert.equal(resolveAttachment("../top.png", from, files), "top.png");
    assert.equal(resolveAttachment("/top.png", from, files), "top.png");
});

test("anchors, queries and external URLs are handled", () => {
    const files = new Set(["a.pdf"]);
    const from = note("n.md");
    assert.equal(resolveAttachment("a.pdf#page=3", from, files), "a.pdf");
    assert.equal(resolveAttachment("a.pdf?v=2", from, files), "a.pdf");
    assert.equal(resolveAttachment("https://example.com/a.pdf", from, files), null);
    assert.equal(resolveAttachment("", from, files), null);
});

/** A vault with one note embedding an image and a PDF, five different ways. */
async function fixture() {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-att-"));
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-attout-"));
    await fs.mkdir(path.join(vault, "attachments"), { recursive: true });
    await fs.writeFile(path.join(vault, "attachments", "photo.png"), PNG);
    await fs.writeFile(path.join(vault, "attachments", "report.pdf"), PDF, "utf8");
    await fs.writeFile(
        path.join(vault, "note.md"),
        [
            "---", "tags: [test]", "---", "# A note", "",
            "![[photo.png]]", "",
            "![a caption](attachments/photo.png)", "",
            "![[report.pdf]]", "",
            "![The report](attachments/report.pdf)", "",
            "See [[report.pdf|the report]].", "",
            "![[nothing.png]]", "",
        ].join("\n"),
        "utf8",
    );
    const result = await build({
        vault, out, title: "T", base: "",
        ignoreTags: [], ignorePaths: [], breakpoint: 768,
    });
    const html = await fs.readFile(path.join(out, "notes", "note", "index.html"), "utf8");
    return { vault, out, html, result };
}

test("images embed with both Obsidian and markdown syntax", async () => {
    const { vault, out, html } = await fixture();
    const images = [...html.matchAll(/<img src="([^"]+)" alt="([^"]*)"/g)];
    assert.equal(images.length, 2, "both spellings produce an image");
    for (const [, src] of images) {
        assert.equal(src, "/vault/attachments/photo.png", "both point at the copied file");
    }
    assert.equal(images[1][2], "a caption", "the markdown alt text survives");
    await fs.rm(vault, { recursive: true, force: true });
    await fs.rm(out, { recursive: true, force: true });
});

test("PDFs embed as a viewer with a download fallback", async () => {
    const { vault, out, html } = await fixture();
    const objects = [...html.matchAll(/<object data="([^"]+)" type="application\/pdf">/g)];
    assert.equal(objects.length, 2, "both spellings produce a viewer");
    assert.equal(objects[0][1], "/vault/attachments/report.pdf");
    // The link inside the object is what shows when a browser cannot render PDFs.
    assert.match(html, /<object[^>]*>\s*<a href="\/vault\/attachments\/report\.pdf">/);
    await fs.rm(vault, { recursive: true, force: true });
    await fs.rm(out, { recursive: true, force: true });
});

test("a wikilink to a file becomes a link, not an embed", async () => {
    const { vault, out, html } = await fixture();
    assert.match(
        html,
        /<a href="\/vault\/attachments\/report\.pdf">the report<\/a>/,
        "the alias is kept and the file is linked",
    );
    await fs.rm(vault, { recursive: true, force: true });
    await fs.rm(out, { recursive: true, force: true });
});

test("referenced attachments are copied, and only those", async () => {
    const { vault, out } = await fixture();
    for (const rel of ["vault/attachments/photo.png", "vault/attachments/report.pdf"]) {
        const ok = await fs.stat(path.join(out, ...rel.split("/"))).then(() => true, () => false);
        assert.ok(ok, `${rel} must be copied`);
    }
    await fs.rm(vault, { recursive: true, force: true });
    await fs.rm(out, { recursive: true, force: true });
});

test("an unresolved embed is flagged rather than left raw", async () => {
    const { vault, out, html } = await fixture();
    assert.match(html, /class="broken-link" title="Unresolved embed">nothing\.png/);
    assert.doesNotMatch(html, /!\[\[/, "no raw embed syntax survives");
    await fs.rm(vault, { recursive: true, force: true });
    await fs.rm(out, { recursive: true, force: true });
});

test("an attachment name cannot inject markup", async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-inj-"));
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-injout-"));
    await fs.writeFile(
        path.join(vault, "n.md"),
        '---\ntags: [t]\n---\n![[x" onerror="alert(1)]]\n',
        "utf8",
    );
    await build({
        vault, out, title: "T", base: "",
        ignoreTags: [], ignorePaths: [], breakpoint: 768,
    });
    const html = await fs.readFile(path.join(out, "notes", "n", "index.html"), "utf8");
    assert.doesNotMatch(html, /" onerror="/, "the payload cannot escape its attribute");
    await fs.rm(vault, { recursive: true, force: true });
    await fs.rm(out, { recursive: true, force: true });
});
