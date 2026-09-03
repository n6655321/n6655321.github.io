/** Core data model shared by the parse, graph and render stages. */

/** A single markdown note read from the vault. */
export interface Note {
  /** Vault-relative path, POSIX separators, e.g. `notes/photosynthesis.md`. */
  path: string;
  /** Slug used in output URLs, e.g. `notes/photosynthesis`. */
  slug: string;
  /** Display title: frontmatter `title`, else first H1, else file basename. */
  title: string;
  /** Tags attached to this note, normalised (no leading `#`, lowercased). */
  tags: string[];
  /** Frontmatter values, untouched. */
  frontmatter: Record<string, unknown>;
  /** Markdown body with frontmatter stripped. */
  body: string;
  /** Plain-text excerpt for cards and previews. */
  excerpt: string;
  /** Targets of `[[wikilinks]]` found in the body, as raw link text. */
  links: string[];
}

/** A tag plus everything the renderer needs to draw its room. */
export interface Tag {
  /** Normalised tag, e.g. `science/biology`. */
  name: string;
  /** Human label, e.g. `biology` (last hierarchy segment, prettified). */
  label: string;
  /** Slug used in output URLs, e.g. `science-biology`. */
  slug: string;
  /** Paths of notes carrying this tag, sorted. */
  notes: string[];
  /** Tags strictly contained by this one (direct children in the poset). */
  children: string[];
  /** Tags strictly containing this one (direct parents in the poset). */
  parents: string[];
  /** Tags sharing notes without either containing the other. */
  siblings: string[];
}

/** One clickable object placed on a room's background image. */
export interface RoomHotspot {
  /** Raw target as written: `#tag`, `[[Note]]`, or a bare name. */
  target: string;
  /** How to resolve `target`; `auto` tries a tag first, then a note. */
  kind: "tag" | "note" | "auto";
  /** Vault-relative path of the object's image, or null for a bare region. */
  asset: string | null;
  /**
   * Render the asset with hard pixel edges instead of smoothing, for pixel art
   * and low-resolution sprites that should not be blurred when scaled up.
   */
  rasterize: boolean;
  /** Visible caption; falls back to the resolved target's own title. */
  label: string | null;
  /** Position as percentages of the background image. */
  x: number;
  y: number;
  /**
   * Size as percentages, or null to let the generator size it. A declared size
   * is emitted verbatim; a null one is scaled to how crowded the room is.
   *
   * For a polygon these hold its bounding box, so placement, crowding and the
   * hitbox overlay all work the same for both shapes.
   */
  w: number | null;
  h: number | null;
  /**
   * An arbitrary clickable outline, as percentages of the background image.
   * Null means the object is a plain rectangle. At least three points.
   */
  points: Array<{ x: number; y: number }> | null;
  /** Declaration order, used as a stable tiebreak. */
  order: number;
}

/** A hand-authored room for one tag, declared by a note in the vault. */
export interface RoomDefinition {
  /** The tag this room decorates. */
  tag: string;
  /** Vault path of the note that declared it. */
  source: string;
  /** Vault-relative path of the background image. */
  image: string | null;
  /**
   * True when the note asked for `size: absolute` but declared no `width`/
   * `height` to convert against, so the request could not be honoured.
   */
  absoluteWithoutSize: boolean;
  /** CSS colour painted behind the image, filling the letterbox around it. */
  background: string | null;
  /** Intrinsic image size; only sets the stage aspect ratio. */
  width: number | null;
  height: number | null;
  hotspots: RoomHotspot[];
}

/** The whole vault, parsed and indexed. */
export interface VaultIndex {
  notes: Map<string, Note>;
  tags: Map<string, Tag>;
  /** Hand-authored rooms, keyed by tag. */
  rooms: Map<string, RoomDefinition>;
  /** Vault-relative paths of every asset referenced by a room. */
  assets: Set<string>;
  /** Vault root on disk. */
  root: string;
}

/** Options accepted by the build pipeline. */
export interface BuildOptions {
  vault: string;
  out: string;
  /** Site title shown in the header. */
  title: string;
  /** Base path when hosted in a subdirectory, e.g. `/wiki`. */
  base: string;
  /** Tags to exclude from the site entirely. */
  ignoreTags: string[];
  /** Vault-relative glob-ish prefixes to skip while walking. */
  ignorePaths: string[];
  /** Viewport width below which every room falls back to the list layout. */
  breakpoint: number;
}
