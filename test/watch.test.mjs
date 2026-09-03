/** Watch mode and the live-reload server. */

import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { watchVault } from "../dist/watch.js";
import { serve } from "../dist/serve.js";
import { build } from "../dist/build.js";

/** A throwaway vault with one note, plus its output directory. */
async function scratch() {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-w-"));
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "tektite-wo-"));
  await fs.writeFile(path.join(vault, "one.md"), "---\ntags: [alpha]\n---\n# One\n", "utf8");
  const options = {
    vault, out, title: "W", base: "",
    ignoreTags: [], ignorePaths: [], breakpoint: 768,
  };
  return {
    options,
    cleanup: async () => {
      await fs.rm(vault, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    },
  };
}

/** Resolve once `predicate` holds, or reject after `timeout`. */
async function until(predicate, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error("timed out waiting for condition");
}

test("editing a note triggers a rebuild", async () => {
  const { options, cleanup } = await scratch();
  const builds = [];
  const watcher = await watchVault(options, {
    onBuild: (result) => builds.push(result),
    onError: (error) => builds.push(error),
  });

  try {
    await fs.writeFile(
      path.join(options.vault, "one.md"),
      "---\ntags: [alpha, beta]\n---\n# One\n",
      "utf8",
    );
    await until(() => builds.length > 0);
    assert.equal(builds[0].tags, 2, "the new tag is picked up");
    // The new tag's page must actually be on disk, not merely counted.
    const ok = await fs
      .stat(path.join(options.out, "tags", "beta", "index.html"))
      .then(() => true, () => false);
    assert.ok(ok, "the new tag page is written");
  } finally {
    watcher.close();
    await cleanup();
  }
});

test("adding and deleting a note both rebuild", async () => {
  const { options, cleanup } = await scratch();
  const builds = [];
  const watcher = await watchVault(options, {
    onBuild: (r) => builds.push(r),
    onError: () => {},
  });

  try {
    await fs.writeFile(path.join(options.vault, "two.md"), "---\ntags: [alpha]\n---\n# Two\n", "utf8");
    await until(() => builds.some((b) => b.notes === 2));

    await fs.rm(path.join(options.vault, "two.md"));
    await until(() => builds.some((b) => b.notes === 1));
  } finally {
    watcher.close();
    await cleanup();
  }
});

test("a burst of saves collapses into few rebuilds", async () => {
  const { options, cleanup } = await scratch();
  let count = 0;
  const watcher = await watchVault(options, {
    onBuild: () => count++,
    onError: () => {},
  });

  try {
    for (let i = 0; i < 12; i++) {
      await fs.writeFile(
        path.join(options.vault, "one.md"),
        `---\ntags: [alpha]\n---\n# Edit ${i}\n`,
        "utf8",
      );
    }
    await until(() => count > 0);
    // Let any queued rebuild finish before counting.
    await new Promise((r) => setTimeout(r, 400));
    assert.ok(count <= 3, `12 rapid saves caused ${count} rebuilds, expected few`);
  } finally {
    watcher.close();
    await cleanup();
  }
});

test("writing into the output directory does not loop", async () => {
  const { options, cleanup } = await scratch();
  let count = 0;
  const watcher = await watchVault(options, {
    onBuild: () => count++,
    onError: () => {},
  });

  try {
    // A build writes many files; if those re-triggered the watcher it would
    // never settle. Nudge the vault once, then confirm it stops.
    await fs.writeFile(path.join(options.vault, "one.md"), "---\ntags: [alpha]\n---\n# X\n", "utf8");
    await until(() => count > 0);
    await new Promise((r) => setTimeout(r, 600));
    const settled = count;
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(count, settled, "rebuilds stop once the vault stops changing");
  } finally {
    watcher.close();
    await cleanup();
  }
});

test("closing the watcher stops rebuilds", async () => {
  const { options, cleanup } = await scratch();
  let count = 0;
  const watcher = await watchVault(options, {
    onBuild: () => count++,
    onError: () => {},
  });
  watcher.close();

  try {
    await fs.writeFile(path.join(options.vault, "one.md"), "---\ntags: [z]\n---\n# Z\n", "utf8");
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(count, 0, "a closed watcher rebuilds nothing");
  } finally {
    await cleanup();
  }
});

test("live reload injects a client and pushes reload events", async () => {
  const { options, cleanup } = await scratch();
  await build(options);
  const server = await serve(options.out, 0, "", { liveReload: true });
  const port = Number(new URL(server.url).port);

  try {
    const page = await fetch(`http://localhost:${port}/tags/alpha/`).then((r) => r.text());
    assert.match(page, /EventSource/, "the reload client is injected");
    assert.match(page, /__tektite__\/reload/, "and points at the stream");

    // Open the stream, then push a reload and read it back.
    const controller = new AbortController();
    const response = await fetch(`http://localhost:${port}/__tektite__/reload`, {
      signal: controller.signal,
    });
    assert.equal(response.headers.get("content-type"), "text/event-stream");

    const reader = response.body.getReader();
    await reader.read(); // the ": connected" preamble
    setTimeout(() => server.reload(), 50);
    const { value } = await reader.read();
    assert.match(new TextDecoder().decode(value), /event: reload/);
    controller.abort();
  } finally {
    await server.close();
    await cleanup();
  }
});

test("a served build without live reload ships no script", async () => {
  const { options, cleanup } = await scratch();
  await build(options);
  const server = await serve(options.out, 0, "");
  const port = Number(new URL(server.url).port);

  try {
    const page = await fetch(`http://localhost:${port}/tags/alpha/`).then((r) => r.text());
    // The room script is part of the build; the reload client must not be.
    assert.doesNotMatch(page, /EventSource/, "a normal serve injects no reload client");
    assert.doesNotMatch(page, /__tektite__/, "and no reload endpoint");
    const stream = await fetch(`http://localhost:${port}/__tektite__/reload`);
    assert.equal(stream.status, 404, "the reload endpoint is absent");
  } finally {
    await server.close();
    await cleanup();
  }
});
