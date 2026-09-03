/** A minimal static file server for previewing a build locally. */

import http from "node:http";
import path from "node:path";
import { promises as fs } from "node:fs";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};

/** Path of the server-sent events stream used by live reload. */
const RELOAD_PATH = "/__tektite__/reload";

/**
 * The live-reload client, injected into every page while watching.
 *
 * Only ever added by `--watch`; a published build ships no JavaScript at all.
 * `EventSource` reconnects on its own, so a rebuild that briefly interrupts the
 * stream does not need handling here.
 */
const RELOAD_CLIENT = `<script>
(function () {
  var source = new EventSource(${JSON.stringify(RELOAD_PATH)});
  source.addEventListener("reload", function () { location.reload(); });
})();
</script>`;

export interface ServeOptions {
  /** Serve the live-reload stream and inject its client into pages. */
  liveReload?: boolean;
}

export interface Server {
  url: string;
  /** Tell every connected browser to reload. */
  reload: () => void;
  close: () => Promise<void>;
}

/** Serve `root` on `port`, resolving once listening. */
export function serve(
  root: string,
  port: number,
  base = "",
  options: ServeOptions = {},
): Promise<Server> {
  /** Open event streams, one per browser tab. */
  const clients = new Set<http.ServerResponse>();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      let pathname = decodeURIComponent(url.pathname);

      // Strip the configured base path so previews match production URLs.
      if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
        pathname = pathname.slice(base.length) || "/";
      }

      if (options.liveReload && pathname === RELOAD_PATH) {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        res.write(": connected\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }

      // Resolve inside the root; reject anything that escapes it.
      const unsafe = path.join(root, pathname);
      const resolved = path.resolve(unsafe);
      const rootResolved = path.resolve(root);
      if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
        res.writeHead(403).end("Forbidden");
        return;
      }

      let target = resolved;
      const stat = await fs.stat(target).catch(() => null);
      if (stat?.isDirectory()) target = path.join(target, "index.html");
      else if (!stat && !path.extname(target)) target = path.join(target, "index.html");

      const body = await fs.readFile(target).catch(() => null);
      if (!body) {
        res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
        res.end("<h1>404</h1><p>Not found.</p>");
        return;
      }

      const type = TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream";

      // Inject the reload client at serve time rather than into the built file,
      // so the output on disk stays exactly what a deploy would publish.
      if (options.liveReload && type.startsWith("text/html")) {
        const html = body.toString("utf8").replace("</body>", `${RELOAD_CLIENT}</body>`);
        res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
        res.end(html);
        return;
      }

      res.writeHead(200, {
        "content-type": type,
        // Watching means assets change under the browser; never let it cache.
        "cache-control": options.liveReload ? "no-store" : "no-cache",
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500).end("Internal error");
      console.error(error);
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      // Port 0 asks the OS to pick a free one, so report what it actually bound.
      const address = server.address();
      const bound = typeof address === "object" && address ? address.port : port;
      resolve({
        url: `http://localhost:${bound}${base}/`,
        reload: () => {
          for (const client of clients) client.write("event: reload\ndata: 1\n\n");
        },
        close: () =>
          new Promise((done) => {
            for (const client of clients) client.end();
            clients.clear();
            server.close(() => done());
          }),
      });
    });
  });
}
