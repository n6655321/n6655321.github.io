# tektite

A static site generator for Obsidian vaults, in the spirit of Quartz, but built
around one idea: **every hashtag becomes a room you can walk into.**

**Everything that is not a note is a room.** Every tag gets one, whether or not
you have drawn it. A room is an image, and on top of it sit objects — regions
with an `x`, `y`, `w`, `h` and an image asset — each linking to a sub-concept, a
broader concept, or a note. Where one tag is *strictly a superset* of another,
its room links down into the narrower one.

Rooms you have not authored are generated: a neutral placeholder background and
one object per connected concept and note, scattered across the floor. Placement
is random but **deterministic** — seeded by the tag and target names — so a vault
always builds to the same rooms and a rebuild produces no spurious diff.

Rooms are **fullscreen**: the image fills the viewport, scaled to the largest
size that preserves its aspect ratio.

Pages carry no chrome: no header, nav, breadcrumb or footer. The article is the
whole page, and navigation happens by clicking objects in the room. The theme is
deliberately neutral: greyscale, no accent colour, every value a CSS custom
property in a single `:root` block.

The room is a background image with absolutely positioned links, and the
fallback switch is a CSS media query. The only JavaScript on the site is a small
script, loaded on room pages alone, that makes an object's label follow the
cursor; without it the label still appears on hover and focus.

## Install

```bash
npm install
npm run build
```

Then point it at your vault:

```bash
npm run dev -- /path/to/your/vault -o site --watch --serve
```

Note the `--` : it passes the arguments through npm to tektite.

## Where the vault goes

Anywhere. The vault is an argument, not a location the project owns — point
tektite at your real Obsidian folder wherever it already lives, and nothing is
written inside it. Output goes to `--out` (default `./site`).

```bash
npm run dev -- "C:/Users/you/Documents/MyVault" -o site --watch --serve
```

The `test/vault/` folder in this repo is only the demo vault, so the tests have
something to build; `npm run demo` builds and serves that one.

## Use

```bash
# Build a vault into ./site
node dist/cli.js build /path/to/vault

# Author a room: rebuild and reload the browser on every save
node dist/cli.js build /path/to/vault -o site --watch --serve

# Hosted under a subdirectory
node dist/cli.js build /path/to/vault --base /wiki
```

### Options

| Option | Meaning |
| --- | --- |
| `-o, --out <dir>` | Output directory (default `./site`) |
| `-t, --title <text>` | Site title (default: the vault folder name) |
| `-b, --base <path>` | Base path when hosted in a subdirectory |
| `--ignore-tag <tag>` | Exclude a tag entirely; repeatable |
| `--ignore-path <path>` | Skip a vault-relative path; repeatable |
| `--breakpoint <px>` | Width below which rooms fall back to lists (default `768`) |
| `-s, --serve [port]` | Serve the output after building (default port 4321) |
| `-w, --watch` | Rebuild on every change; with `--serve`, reload the browser too |

### Authoring loop

`--watch --serve` is the mode to author rooms in. Every save to the vault —
coordinates, assets, the background colour, a new note — rebuilds the site and
reloads any open tab. Rebuilds are whole-site and typically take a few hundred
milliseconds, so nothing tracks which pages a change affects.

A broken build prints the error and keeps watching; the next save usually fixes
it. The live-reload client is injected at serve time only, so the files on disk
stay exactly what a deploy would publish.

## Authoring a room

Authoring is entirely optional — a vault with no room notes still gets a
complete, navigable site. To take control of one, write an ordinary note with
`room:` in its frontmatter naming the tag it decorates:

```yaml
---
room: biology
image: assets/rooms/biology.jpg
background: "#1a1613"    # fills the letterbox around the image
width: 3600
height: 3000
objects:
  - target: "#cell"
    asset: assets/objects/microscope.png
    x: 12
    y: 48
    w: 18
    h: 34
    label: The microscope bench

  - target: "[[photosynthesis]]"
    asset: assets/objects/leaf.png
    x: 40
    y: 62
    w: 12
    h: 18
    label: A leaf on the desk

  - target: "#energy"        # no asset: a transparent region
    x: 84                    # no w/h: sized by the generator
    y: 20
    label: The window
---
```

The file's name and location are irrelevant — only `room:` in the frontmatter
binds it to a tag. Anything in the note's body is ignored: a room page is the
image and its objects, nothing else.

**Coordinates default to percentages of the background image** (0–100). `x`/`y`
are the object's top-left corner, `w`/`h` its size. Because they are
percentages, you can swap the background for a 2× version without touching a
single number.

### Units

`position:` and `size:` each choose a unit, independently:

- `relative` (the default) — percentages of the background image.
- `absolute` — pixels of the background at its native size, which is what an
  image editor reports. Requires `width:`/`height:` on the room to convert
  against; without them the build warns rather than silently mispositioning.

Either can sit on the room, as a default for all its objects, or on a single
object, which wins. Tracing one shape in an editor while hand-tuning its
neighbours in percentages is the common case:

```yaml
objects:
  - target: "#cell"          # percentages, the default
    x: 12
    y: 48
  - target: "#energy"        # pixels, just for this object
    position: absolute
    x1: 1242
    y1: 891
    x2: 1528
    y2: 749
    x3: 1242
    y3: 1308
```

### Shapes

An object is a rectangle by default. Give it three or more points and it becomes
an arbitrary polygon — either as numbered pairs (`x1`/`y1`, `x2`/`y2`, …) or as
a `points:` list. The outline is the actual click target, not just its outline:
pointer events respect the clip.

### Authoring aids

Two URL parameters, on any room page:

- **`?hitboxes`** outlines every clickable region, polygons included, so you can
  see where they actually are.
- **`?position`** shows the cursor's coordinates beside the pointer, in the
  image's native pixels and in percentages.

Together with `--watch --serve` they are the placement loop: read a coordinate
off the image, write it into the note, watch it land.

| Key | Meaning |
| --- | --- |
| `room:` (or `tag_page:`) | The tag this room decorates — **required** |
| `image:` | Vault-relative path to the background |
| `background:` (or `bg:`, `color:`) | CSS colour painted behind the image, filling the letterbox around it |
| `width:` / `height:` | Intrinsic size; sets the stage's aspect ratio so hotspots never shift while the image loads |
| `objects[].target` | `#tag`, `[[Note]]`, or a bare name (tag tried first) |
| `objects[].x` / `.y` | Top-left corner — **required**, unless the object is a polygon |
| `objects[].w` / `.h` | Size; omit to let the generator size it |
| `objects[].x1`/`y1`, `x2`/`y2`, … | A polygon outline, three points or more |
| `objects[].points` | The same outline as a list: `[[10, 20], [40, 25], [30, 60]]` |
| `objects[].asset` | Vault-relative image; omit for a transparent region |
| `objects[].rasterize` | `true` renders the asset with hard pixel edges, for pixel art |
| `objects[].position` / `.size` | `relative` (default) or `absolute`; overrides the room's choice |
| `objects[].label` | Caption, shown beside the cursor on hover. Defaults to the target's own title |

Referenced images are copied into `/vault/` in the output, preserving their
paths. Targets that match no tag or note, and assets that do not exist, are
reported as build warnings rather than silently producing dead links.

**Authoring is partial by design.** Objects you place keep their exact
coordinates; anything the tag connects to that you have *not* placed is
scattered into the space left over. So you can position the two objects you care
about and let the rest fall where they may, then place more later.

Each field falls back independently:

- **A declared `w`/`h` is emitted verbatim**, however crowded the room gets. Its
  footprint is charged against the layout budget, so a large fixed object makes
  the generated ones give way rather than the reverse.
- **An omitted `w`/`h` is sized by the generator**, shrinking with the room
  exactly like an object it placed itself — while keeping your `x`/`y`.
- **An omitted `asset`** leaves a transparent region of exactly the declared
  size. The background image is expected to already depict whatever is there, so
  nothing is drawn over it — hovering shows the label beside the cursor, and
  keyboard focus draws a ring.

`background:` accepts hex, the `rgb()`/`hsl()`/`oklch()` families, and CSS
colour keywords. It is validated against an allowlist before being written into
the page, so a colour can never escape its `style` attribute.

## The list fallback

A room page carries nothing but the image and its clickable objects — no
heading, no link counts, no prose. The tag name still reaches the browser tab
and assistive technology through the document title.

Every tag page also contains a plain list layout: sub-concepts, broader
concepts, related concepts, and notes. That fallback *does* keep a heading,
since a bare list of links with no indication of which concept they belong to is
unreadable. CSS decides which is shown:

- **Wide enough** (≥ `--breakpoint`, default 768px) — the fullscreen room.
- **Narrower** — the list, since a room image would be too small to click.

## How containment is decided

A tag **A** strictly contains **B** when every note tagged `#B` is also tagged
`#A`, and `#A` has at least one note `#B` does not. That is a partial order, so
the raw relation is transitive — if `A ⊃ B ⊃ C` then `A ⊃ C` is true but
redundant. Pages show only the **covering relations** (the transitive
reduction): the immediate sub-concepts, not every descendant.

Two rules qualify that:

- **Equal note sets are equivalences, not nesting.** If `#physics` and
  `#thermodynamics` cover exactly the same notes, neither contains the other, so
  they are surfaced as related concepts instead of being silently dropped.
- **Obsidian's `a/b` syntax is an explicit declaration and wins ties.**
  `#science` contains `#science/physics` even when, in this particular vault,
  every `#science` note also happens to be `#science/physics`. Without this the
  hierarchy would collapse into a bag of equivalents.

Hierarchical tags are expanded, so a note tagged `#science/physics/quantum`
counts toward `#science` and `#science/physics` too — matching Obsidian's tag pane.

## Tag parsing

Tags are read from the `tags` / `tag` frontmatter keys (lists or delimited
strings) and from inline `#hashtags`. Inline scanning deliberately ignores
markdown headings, fenced and inline code, indented code blocks, and URL
fragments like `example.com/page#section`.

## Theming

`src/assets/theme.css` defines the entire palette as custom properties on
`:root`, with a `prefers-color-scheme: dark` block redefining the same tokens.
Restyling the site means editing that one block. The room/list breakpoint lives
in a generated `breakpoint.css`, since it is configurable per build.

## Tests

```bash
npm test
```

Covers the containment poset and its transitive reduction, tag extraction, room
definition parsing and hotspot resolution, colour sanitising, room generation
(determinism, objects staying inside the image, no overlap from 1 to 60 objects,
crowded rooms shrinking rather than piling up, declared sizes never being
scaled), watch mode (rebuild on add/edit/delete, debouncing, no rebuild loop from
the site's own output, live-reload events reaching a connected client),
HTML-attribute injection through labels and asset paths, and an end-to-end build
asserting that every internal link on every generated page resolves to a real
file.

## Layout

```
src/
  parse/      vault walking, frontmatter, tag extraction, room definitions
  graph/      the containment poset, room generation
  render/     room stage, HTML templates
  assets/     theme.css, room.js and the placeholder, copied into the output
  build.ts    the pipeline
  cli.ts      argument parsing
  watch.ts    rebuild-on-change
  serve.ts    local preview server, with live reload while watching
```
