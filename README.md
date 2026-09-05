# tektite

A static site generator for Obsidian vaults. Each tag becomes a room: an image
with clickable objects on it, linking to sub-concepts, broader concepts and
notes.

Anything that is not a note is a room, so every tag gets one. Rooms you have not
drawn are generated with a placeholder background and objects scattered across
it. Placement is seeded by the tag and target names, so rebuilds produce the same
output.

Rooms fill the viewport. Pages have no header, nav, breadcrumb or footer, and
navigation happens by clicking objects. The theme is greyscale with no accent
colour.

The site is static HTML with absolutely positioned links. The only script is
loaded on room pages, to make an object's label follow the cursor; without it the
label still appears on hover and focus.

## Install

```bash
npm install
npm run build
```

Then point it at your vault:

```bash
npm run dev -- /path/to/your/vault -o site --watch --serve
```

The `--` passes the arguments through npm to tektite.

## Where the vault goes

Anywhere. The vault is an argument, and nothing is written inside it. Output goes
to `--out`, which defaults to `./site`.

```bash
npm run dev -- "C:/Users/you/Documents/MyVault" -o site --watch --serve
```

`test/vault/` is the demo vault used by the tests. `npm run demo` builds and
serves it.

## Use

```bash
# Build a vault into ./site
node dist/cli.js build /path/to/vault

# Rebuild and reload the browser on every save
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

### Watch mode

Every save to the vault rebuilds the site and reloads any open tab. Rebuilds
cover the whole site and take a few hundred milliseconds, so nothing tracks which
pages a change affects.

A failed build prints the error and keeps watching. The live-reload client is
injected when serving, so the files on disk are what a deploy would publish.

## Authoring a room

Optional: a vault with no room notes still gets a full site. To draw one, write a
note with `room:` in its frontmatter naming the tag:

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

The file's name and location do not matter; `room:` is what binds it to a tag.
The note's body is ignored, since a room page is only the image and its objects.

Coordinates are percentages of the background image (0 to 100) unless you say
otherwise. `x`/`y` are the object's top-left corner, `w`/`h` its size. Being
percentages, they survive swapping the background for a larger version.

### Units

`position:` and `size:` each choose a unit, independently:

- `relative`, the default: percentages of the background image.
- `absolute`: pixels of the background at its native size, which is what an image
  editor reports. Needs `width:`/`height:` on the room to convert against;
  without them the build warns instead of mispositioning.

Either can sit on the room as a default, or on a single object, which wins. That
covers tracing one shape in an editor while its neighbours stay in percentages:

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
a polygon, written either as numbered pairs (`x1`/`y1`, `x2`/`y2`, and so on) or as a
`points:` list. Pointer events respect the clip, so the outline is the click
target rather than its bounding box.

### Authoring aids

Two URL parameters work on any room page:

- `?hitboxes` outlines every clickable region, polygons included.
- `?position` shows the cursor's coordinates beside the pointer, in the image's
  native pixels and in percentages.

With `--watch --serve` they form the placement loop: read a coordinate off the
image, write it into the note, see it land.

### Frontmatter reference

| Key | Meaning |
| --- | --- |
| `room:` (or `tag_page:`) | The tag this room decorates. Required |
| `image:` | Vault-relative path to the background |
| `background:` (or `bg:`, `color:`) | CSS colour behind the image, filling the letterbox around it |
| `width:` / `height:` | Intrinsic size; sets the aspect ratio so objects do not shift while the image loads |
| `objects[].target` | `#tag`, `[[Note]]`, or a bare name (tag tried first) |
| `objects[].x` / `.y` | Top-left corner. Required, unless the object is a polygon |
| `objects[].w` / `.h` | Size; omit to let the generator size it |
| `objects[].x1`/`y1`, `x2`/`y2`, ... | A polygon outline, three points or more |
| `objects[].points` | The same outline as a list: `[[10, 20], [40, 25], [30, 60]]` |
| `objects[].asset` | Vault-relative image; omit for a transparent region |
| `objects[].rasterize` | `true` renders the asset with hard pixel edges, for pixel art |
| `objects[].position` / `.size` | `relative` (default) or `absolute`; overrides the room's choice |
| `objects[].label` | Caption, shown beside the cursor on hover. Defaults to the target's title |

Referenced images are copied into `/vault/` in the output, keeping their paths.
Targets matching no tag or note, and assets that do not exist, are reported as
build warnings instead of producing dead links.

### Partial authoring

Objects you place keep their coordinates. Anything the tag connects to that you
have not placed is scattered into the space left over, so you can position the
two objects you care about and add the rest later.

Each field falls back on its own:

- A declared `w`/`h` is emitted as written, however crowded the room. Its
  footprint counts against the layout budget, so a large fixed object makes the
  generated ones give way.
- An omitted `w`/`h` is sized by the generator and shrinks with the room, while
  keeping your `x`/`y`.
- An omitted `asset` leaves a transparent region at the declared size, on the
  assumption the background already shows what is there. Hovering gives the label
  beside the cursor, keyboard focus a ring.

`background:` accepts hex, the `rgb()`/`hsl()`/`oklch()` families, and colour
keywords. It is checked against an allowlist before reaching the page, so a
colour cannot escape its `style` attribute.

## The list fallback

A room page holds the image and its objects, with no heading or link counts. The
tag name reaches the browser tab and assistive technology through the document
title.

Every tag page also carries a plain list: sub-concepts, broader concepts, related
concepts and notes. The list keeps a heading, since links with no indication of
which concept they belong to are hard to read. CSS picks between them:

- At or above `--breakpoint` (768px by default), the room.
- Below it, the list, since a room image would be too small to click.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds the site and publishes it. It runs on
demand: open the Actions tab, pick "Deploy to GitHub Pages", and press Run
workflow.

Enable Pages first, once: Settings, Pages, and set Source to GitHub Actions.

Three optional inputs, each with a default:

| Input | Default | Meaning |
| --- | --- | --- |
| `vault` | `test/vault` | Which vault to build, relative to the repository root |
| `title` | `tektite` | Site title |
| `base` | detected | Base path; see below |

The base path is worked out from the repository name. A repository called
`<owner>.github.io` is a user site served from the domain root and gets no base
path; anything else is a project site served from `/<repo>/` and gets that, since
unprefixed links would otherwise resolve to the wrong place. Set the `base` input
to override the detection, for a custom domain for instance.

The workflow runs `npm test` before building, so a failure stops the deploy
rather than publishing a broken site. It also writes a `.nojekyll` file, without
which Pages would drop the files whose names begin with an underscore.

## How containment is decided

Tag A strictly contains B when every note tagged `#B` is also tagged `#A`, and
`#A` has at least one note `#B` does not. The relation is a partial order and so
transitive: if `A ⊃ B ⊃ C` then `A ⊃ C` holds but adds nothing. Pages show only
the covering relations, that is the transitive reduction, which are the
immediate sub-concepts rather than every descendant.

Two rules qualify that:

- Equal note sets are equivalences rather than nesting. If `#physics` and
  `#thermodynamics` cover the same notes, neither contains the other, and they
  appear as related concepts instead of disappearing.
- Obsidian's `a/b` syntax is an explicit declaration and wins ties. `#science`
  contains `#science/physics` even where every `#science` note also happens to
  carry `#science/physics`; otherwise the hierarchy collapses into a set of
  equivalents.

Hierarchical tags are expanded, so a note tagged `#science/physics/quantum`
counts toward `#science` and `#science/physics`, matching Obsidian's tag pane.

## Tag parsing

Tags come from the `tags` / `tag` frontmatter keys, as lists or delimited
strings, and from inline `#hashtags`. Inline scanning skips markdown headings,
fenced and inline code, indented code blocks, and URL fragments such as
`example.com/page#section`.

## Theming

`src/assets/theme.css` holds the palette as custom properties on `:root`, with a
`prefers-color-scheme: dark` block redefining the same tokens. Restyling means
editing that block. The room/list breakpoint is in a generated `breakpoint.css`,
since it changes per build.

## Tests

```bash
npm test
```

Covers the containment poset and its transitive reduction, tag extraction, room
parsing and hotspot resolution, colour sanitising, room generation (determinism,
objects staying inside the image, no overlap from 1 to 60 objects, crowded rooms
shrinking, declared sizes never scaled), watch mode (rebuild on add/edit/delete,
debouncing, no rebuild loop from the site's own output, live-reload events
reaching a client), HTML-attribute injection through labels and asset paths, and
an end-to-end build checking that every internal link resolves to a real file.

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
