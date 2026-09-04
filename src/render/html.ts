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
    description?: string;
    room?: boolean;
    body: string;
}
export function shell(opts: ShellOptions): string {
    const { base } = opts;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)} | ${escapeHtml(opts.siteTitle)}</title>
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
