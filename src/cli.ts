#!/usr/bin/env node
import path from "node:path";
import { promises as fs } from "node:fs";
import { build, type BuildResult } from "./build.js";
import { serve } from "./serve.js";
import { watchVault } from "./watch.js";
import type { BuildOptions } from "./types.js";
const USAGE = `tektite — render an Obsidian vault as rooms of concepts

Usage:
  tektite build <vault> [options]

Options:
  -o, --out <dir>        Output directory            (default: ./site)
  -t, --title <text>     Site title                  (default: vault folder name)
  -b, --base <path>      Base path when hosted in a subdirectory (default: "")
      --ignore-tag <t>   Exclude a tag; repeatable
      --ignore-path <p>  Skip a vault-relative path; repeatable
      --breakpoint <px>  Width below which rooms fall back to lists (default: 768)
  -s, --serve [port]     Serve the output after building (default port: 4321)
  -w, --watch            Rebuild on change; with --serve, reload the browser too
  -h, --help             Show this message
`;
interface ParsedArgs extends BuildOptions {
    serve: number | null;
    watch: boolean;
}
function parseArgs(argv: string[]): ParsedArgs | null {
    const args = argv.slice(2);
    if (args.length === 0 || args.includes("-h") || args.includes("--help"))
        return null;
    const command = args[0];
    if (command !== "build") {
        throw new Error(`Unknown command: ${command}. Expected "build".`);
    }
    let vault: string | null = null;
    let out: string | null = null;
    let title: string | null = null;
    let base = "";
    let breakpoint = 768;
    let serveOn: number | null = null;
    let watch = false;
    const ignoreTags: string[] = [];
    const ignorePaths: string[] = [];
    for (let i = 1; i < args.length; i++) {
        const arg = args[i]!;
        const next = () => {
            const value = args[++i];
            if (value === undefined)
                throw new Error(`Missing value for ${arg}`);
            return value;
        };
        switch (arg) {
            case "-o":
            case "--out":
                out = next();
                break;
            case "-t":
            case "--title":
                title = next();
                break;
            case "-b":
            case "--base":
                base = next();
                break;
            case "--ignore-tag":
                ignoreTags.push(next());
                break;
            case "--ignore-path":
                ignorePaths.push(next());
                break;
            case "--breakpoint": {
                const value = Number(next());
                if (!Number.isFinite(value) || value <= 0) {
                    throw new Error(`--breakpoint must be a positive number`);
                }
                breakpoint = Math.round(value);
                break;
            }
            case "-w":
            case "--watch":
                watch = true;
                break;
            case "-s":
            case "--serve": {
                const peek = args[i + 1];
                serveOn = peek && /^\d+$/.test(peek) ? Number(args[++i]) : 4321;
                break;
            }
            default:
                if (arg.startsWith("-"))
                    throw new Error(`Unknown option: ${arg}`);
                if (vault !== null)
                    throw new Error(`Unexpected argument: ${arg}`);
                vault = arg;
        }
    }
    if (vault === null)
        throw new Error("Missing <vault> argument.");
    const vaultAbs = path.resolve(vault);
    return {
        vault: vaultAbs,
        out: path.resolve(out ?? "site"),
        title: title ?? path.basename(vaultAbs),
        base: base ? `/${base.replace(/^\/+|\/+$/g, "")}` : "",
        ignoreTags,
        ignorePaths: ignorePaths.map((p) => p.replace(/^\/+|\/+$/g, "")),
        breakpoint,
        serve: serveOn,
        watch,
    };
}
async function main(): Promise<void> {
    let options: ParsedArgs | null;
    try {
        options = parseArgs(process.argv);
    }
    catch (error) {
        console.error(`tektite: ${(error as Error).message}\n`);
        console.error(USAGE);
        process.exitCode = 1;
        return;
    }
    if (!options) {
        console.log(USAGE);
        return;
    }
    const stat = await fs.stat(options.vault).catch(() => null);
    if (!stat?.isDirectory()) {
        console.error(`tektite: vault not found: ${options.vault}`);
        process.exitCode = 1;
        return;
    }
    function report(result: BuildResult, elapsed: number): void {
        const generated = result.rooms - result.authoredRooms;
        const rooms = result.rooms
            ? `, ${result.rooms} rooms (${result.authoredRooms} authored, ${generated} generated)`
            : "";
        console.log(`tektite: ${result.notes} notes, ${result.tags} concepts${rooms}, ` +
            `${result.pages} pages in ${elapsed}ms`);
        for (const miss of result.unresolved) {
            console.warn(`         warning: unresolved room object ${miss}`);
        }
        for (const asset of result.missingAssets) {
            console.warn(`         warning: missing asset ${asset}`);
        }
    }
    const started = Date.now();
    const result = await build(options);
    report(result, Date.now() - started);
    console.log(`         → ${result.out}`);
    const server = options.serve !== null
        ? await serve(result.out, options.serve, options.base, { liveReload: options.watch })
        : null;
    if (server)
        console.log(`         serving at ${server.url}`);
    if (!options.watch)
        return;
    const watcher = await watchVault(options, {
        onBuild: (next, elapsed) => {
            report(next, elapsed);
            server?.reload();
        },
        onError: (error) => {
            console.error(`tektite: build failed — ${error.message}`);
        },
    });
    console.log(`         watching ${options.vault}${server ? " — live reload on" : ""}`);
    const stop = () => {
        watcher.close();
        void server?.close().then(() => process.exit(0));
        if (!server)
            process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
}
main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
