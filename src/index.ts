/** Public entry point: parse a vault into an index, then render a site. */

export * from "./types.js";
export { readVault, walkVault, readNote } from "./parse/vault.js";
export {
  normalizeTag,
  extractInlineTags,
  extractFrontmatterTags,
  expandHierarchy,
} from "./parse/tags.js";
export { parseRoomNote, collectRooms } from "./parse/rooms.js";
export {
  buildTags,
  buildPoset,
  buildTagSets,
  tagSlug,
  tagLabel,
  isTagAncestor,
} from "./graph/containment.js";
export { renderRoomStage, resolveHotspot, assetHref } from "./render/room.js";
export { build, indexVault } from "./build.js";
