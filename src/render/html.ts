/** HTML escaping and the shared page shell. */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

export interface ShellOptions {
  title: string;
  siteTitle: string;
  base: string;
  /** Extra text for the `<meta name="description">`. */
  description?: string;
  /**
   * Load the room script. Only room pages need it, and it is the site's only
   * JavaScript — every other page ships none.
   */
  room?: boolean;
  body: string;
}

/**
 * Wrap page content in the document.
 *
 * There is deliberately no chrome — no header, nav, breadcrumb or footer. The
 * article is the whole page; navigation happens by clicking objects in the room.
 */
export function shell(opts: ShellOptions): string {
  const { base } = opts;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)} — ${escapeHtml(opts.siteTitle)}</title>
${opts.description ? `<meta name="description" content="${escapeHtml(opts.description)}">` : ""}
<link rel="stylesheet" href="${base}/assets/theme.css">
<link rel="stylesheet" href="${base}/assets/breakpoint.css">
</head>
<body>
${opts.body}
${opts.room ? `<script src="${base}/assets/room.js" defer></script>` : ""}
</body>
</html>
`;
}
