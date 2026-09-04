export interface Note {
    path: string;
    slug: string;
    title: string;
    tags: string[];
    frontmatter: Record<string, unknown>;
    body: string;
    excerpt: string;
    links: string[];
}
export interface Tag {
    name: string;
    label: string;
    slug: string;
    notes: string[];
    children: string[];
    parents: string[];
    siblings: string[];
}
export interface RoomHotspot {
    target: string;
    kind: "tag" | "note" | "auto";
    asset: string | null;
    rasterize: boolean;
    label: string | null;
    x: number;
    y: number;
    w: number | null;
    h: number | null;
    points: Array<{
        x: number;
        y: number;
    }> | null;
    order: number;
}
export interface RoomDefinition {
    tag: string;
    source: string;
    image: string | null;
    absoluteWithoutSize: boolean;
    background: string | null;
    width: number | null;
    height: number | null;
    hotspots: RoomHotspot[];
}
export interface VaultIndex {
    notes: Map<string, Note>;
    tags: Map<string, Tag>;
    rooms: Map<string, RoomDefinition>;
    assets: Set<string>;
    files: Set<string>;
    /** Room notes as written, including any that decorate no existing tag. */
    authoredRooms: RoomDefinition[];
    root: string;
}
export interface BuildOptions {
    vault: string;
    out: string;
    title: string;
    base: string;
    ignoreTags: string[];
    ignorePaths: string[];
    breakpoint: number;
}
