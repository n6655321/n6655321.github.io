/**
 * Watch mode.
 *
 * Rebuilds the site whenever the vault changes and tells open browsers to
 * reload. There is no bundler here — a build is fast enough (a few hundred
 * milliseconds on a large vault) that rebuilding the whole site beats tracking
 * which pages a change affects.
 *
 * The browser side is a few lines of `EventSource` injected only while
 * watching, so a published site still ships no JavaScript.
 */

import { promises as fs, watch as fsWatch, type FSWatcher } from "node:fs";
import path from "node:path";
import type { BuildOptions } from "./types.js";
import { build, type BuildResult } from "./build.js";

/** How long to wait for a burst of file events to settle. */
const DEBOUNCE_MS = 80;

/** Directories never worth watching. */
const SKIP = new Set([".obsidian", ".trash", ".git", "node_modules"]);

/**
 * Recursively watch a directory.
 *
 * Node's `recursive: true` works on Windows and macOS but not reliably on
 * Linux, so directories are walked and watched individually there. Both paths
 * funnel into the same callback.
 */
async function watchTree(root: string, onChange: (file: string) => void): Promise<FSWatcher[]> {
  const watchers: FSWatcher[] = [];

  if (process.platform === "win32" || process.platform === "darwin") {
    watchers.push(
      fsWatch(root, { recursive: true }, (_event, filename) => {
        if (filename) onChange(path.join(root, filename.toString()));
      }),
    );
    return watchers;
  }

  const dirs: string[] = [];
  async function walk(dir: string): Promise<void> {
    dirs.push(dir);
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (SKIP.has(entry.name) || entry.name.startsWith(".")) continue;
      await walk(path.join(dir, entry.name));
    }
  }
  await walk(root);

  for (const dir of dirs) {
    watchers.push(
      fsWatch(dir, (_event, filename) => {
        if (filename) onChange(path.join(dir, filename.toString()));
      }),
    );
  }
  return watchers;
}

/** True when a changed path should trigger a rebuild. */
function isRelevant(file: string, outDir: string): boolean {
  // Never react to our own output, or the loop never ends.
  const resolved = path.resolve(file);
  if (resolved === path.resolve(outDir) || resolved.startsWith(path.resolve(outDir) + path.sep)) {
    return false;
  }
  const name = path.basename(file);
  // Editors write swap and backup files constantly; they are not content.
  if (name.startsWith(".") || name.endsWith("~")) return false;
  if (/\.(swp|swx|tmp)$/i.test(name)) return false;
  return true;
}

/**
 * Rebuild `options` on every change under the vault.
 *
 * Rebuilds are serialised: if changes arrive while one is running, exactly one
 * more is queued afterwards, so a burst of saves cannot pile up builds.
 */
export async function watchVault(
  options: BuildOptions,
  handlers: {
    onBuild: (result: BuildResult, elapsedMs: number) => void;
    onError: (error: Error) => void;
  },
): Promise<{ close: () => void }> {
  let timer: NodeJS.Timeout | null = null;
  let building = false;
  let queued = false;

  async function rebuild(): Promise<void> {
    if (building) {
      queued = true;
      return;
    }
    building = true;
    const started = Date.now();
    try {
      handlers.onBuild(await build(options), Date.now() - started);
    } catch (error) {
      handlers.onError(error as Error);
    } finally {
      building = false;
      if (queued) {
        queued = false;
        void rebuild();
      }
    }
  }

  const watchers = await watchTree(options.vault, (file) => {
    if (!isRelevant(file, options.out)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void rebuild();
    }, DEBOUNCE_MS);
  });

  return {
    close: () => {
      if (timer) clearTimeout(timer);
      for (const w of watchers) w.close();
    },
  };
}
