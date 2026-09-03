/** Inline a built page's CSS and images so it renders as one standalone file. */
import { promises as fs } from "node:fs";
import path from "node:path";

const [, , pagePath, outPath] = process.argv;
if (!pagePath || !outPath) {
  console.error("usage: node scripts/preview.mjs <built-page.html> <out.html>");
  process.exit(1);
}

// Walk up from the page to the site root, which is where /assets lives.
let root = path.dirname(path.resolve(pagePath));
while (root !== path.dirname(root)) {
  const hit = await fs.stat(path.join(root, "assets")).then(() => true, () => false);
  if (hit) break;
  root = path.dirname(root);
}

let html = await fs.readFile(pagePath, "utf8");
const styles = [];
for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)) {
  styles.push(await fs.readFile(path.join(root, m[1]), "utf8"));
}
html = html
  .replace(/<link rel="stylesheet"[^>]*>/g, "")
  .replace("</head>", `<style>${styles.join("\n")}</style></head>`);

const mime = { ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg" };
const inlined = new Map();
for (const m of html.matchAll(/src="(\/[^"]+\.(?:png|svg|jpe?g))"/g)) {
  if (inlined.has(m[1])) continue;
  const file = path.join(root, decodeURIComponent(m[1]));
  const data = await fs.readFile(file);
  const type = mime[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  inlined.set(m[1], `data:${type};base64,${data.toString("base64")}`);
}
for (const [url, data] of inlined) html = html.split(`src="${url}"`).join(`src="${data}"`);

await fs.writeFile(outPath, html, "utf8");
console.log(`wrote ${outPath} (${html.length} bytes, ${inlined.size} images inlined)`);
