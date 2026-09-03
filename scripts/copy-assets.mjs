/** Copies src/assets into dist/assets after tsc runs (tsc only emits .js/.d.ts). */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, "src", "assets");
const dest = path.join(root, "dist", "assets");

// Mirror rather than merge, so a deleted source asset never lingers in dist.
await fs.rm(dest, { recursive: true, force: true });
await fs.mkdir(dest, { recursive: true });
for (const file of await fs.readdir(src)) {
  await fs.copyFile(path.join(src, file), path.join(dest, file));
}
console.log(`copied assets → ${path.relative(root, dest)}`);
