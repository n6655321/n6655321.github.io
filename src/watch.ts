import { promises as fs, watch as fsWatch, type FSWatcher } from "node:fs";
import path from "node:path";
import type { BuildOptions } from "./types.js";
import { build, type BuildResult } from "./build.js";
const DEBOUNCE_MS = 80;
const SKIP = new Set([".obsidian", ".trash", ".git", "node_modules"]);
async function watchTree(root: string, onChange: (file: string) => void): Promise<FSWatcher[]> {
    const watchers: FSWatcher[] = [];
    if (process.platform === "win32" || process.platform === "darwin") {
        watchers.push(fsWatch(root, { recursive: true }, (_event, filename) => {
            if (filename)
                onChange(path.join(root, filename.toString()));
        }));
        return watchers;
    }
    const dirs: string[] = [];
    async function walk(dir: string): Promise<void> {
        dirs.push(dir);
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
            if (!entry.isDirectory())
                continue;
            if (SKIP.has(entry.name) || entry.name.startsWith("."))
                continue;
            await walk(path.join(dir, entry.name));
        }
    }
    await walk(root);
    for (const dir of dirs) {
        watchers.push(fsWatch(dir, (_event, filename) => {
            if (filename)
                onChange(path.join(dir, filename.toString()));
        }));
    }
    return watchers;
}
function isRelevant(file: string, outDir: string): boolean {
    const resolved = path.resolve(file);
    if (resolved === path.resolve(outDir) || resolved.startsWith(path.resolve(outDir) + path.sep)) {
        return false;
    }
    const name = path.basename(file);
    if (name.startsWith(".") || name.endsWith("~"))
        return false;
    if (/\.(swp|swx|tmp)$/i.test(name))
        return false;
    return true;
}
export async function watchVault(options: BuildOptions, handlers: {
    onBuild: (result: BuildResult, elapsedMs: number) => void;
    onError: (error: Error) => void;
}): Promise<{
    close: () => void;
}> {
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
        }
        catch (error) {
            handlers.onError(error as Error);
        }
        finally {
            building = false;
            if (queued) {
                queued = false;
                void rebuild();
            }
        }
    }
    const watchers = await watchTree(options.vault, (file) => {
        if (!isRelevant(file, options.out))
            return;
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            void rebuild();
        }, DEBOUNCE_MS);
    });
    return {
        close: () => {
            if (timer)
                clearTimeout(timer);
            for (const w of watchers)
                w.close();
        },
    };
}
