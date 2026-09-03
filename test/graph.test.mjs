import test from "node:test";
import assert from "node:assert/strict";
import { buildTags, buildPoset, buildTagSets } from "../dist/graph/containment.js";
import { extractInlineTags, extractFrontmatterTags, expandHierarchy, normalizeTag } from "../dist/parse/tags.js";

const note = (path, tags) => ({
  path, slug: path.replace(/\.md$/, ""), title: path, tags,
  frontmatter: {}, body: "", excerpt: "", links: [],
});

test("strict superset is detected by note-set inclusion", () => {
  // animal ⊃ mammal ⊃ cat, plus animal has a note none of the others have.
  const notes = [
    note("cat.md", ["animal", "mammal", "cat"]),
    note("dog.md", ["animal", "mammal"]),
    note("bird.md", ["animal"]),
  ];
  const sets = buildTagSets(notes);
  const poset = buildPoset(sets);
  assert.ok(poset.descendants.get("animal").has("cat"), "animal ⊃ cat transitively");
  assert.ok(poset.descendants.get("animal").has("mammal"), "animal ⊃ mammal");
  assert.ok(poset.descendants.get("mammal").has("cat"), "mammal ⊃ cat");
  assert.ok(!poset.descendants.get("cat").has("animal"), "containment is not symmetric");
});

test("transitive reduction keeps only covering relations", () => {
  const notes = [
    note("cat.md", ["animal", "mammal", "cat"]),
    note("dog.md", ["animal", "mammal"]),
    note("bird.md", ["animal"]),
  ];
  const poset = buildPoset(buildTagSets(notes));
  assert.deepEqual([...poset.children.get("animal")], ["mammal"],
    "animal links to mammal only, not straight to cat");
  assert.deepEqual([...poset.children.get("mammal")], ["cat"]);
  assert.deepEqual([...poset.parents.get("cat")], ["mammal"]);
});

test("equal note sets are equivalences, not containment", () => {
  const notes = [note("a.md", ["foo", "bar"]), note("b.md", ["foo", "bar"])];
  const poset = buildPoset(buildTagSets(notes));
  assert.equal(poset.descendants.get("foo").size, 0);
  assert.ok(poset.equivalents.get("foo").has("bar"));
  assert.ok(poset.equivalents.get("bar").has("foo"));
});

test("overlapping but non-nested tags become siblings", () => {
  const notes = [
    note("a.md", ["red", "blue"]),
    note("b.md", ["red"]),
    note("c.md", ["blue"]),
  ];
  const tags = buildTags(notes);
  assert.deepEqual(tags.get("red").children, []);
  assert.deepEqual(tags.get("red").siblings, ["blue"]);
});

test("disjoint tags are unrelated", () => {
  const notes = [note("a.md", ["x"]), note("b.md", ["y"])];
  const tags = buildTags(notes);
  assert.deepEqual(tags.get("x").children, []);
  assert.deepEqual(tags.get("x").siblings, []);
});

test("inline tags skip code, headings and url fragments", () => {
  const body = [
    "# Heading not a tag",
    "Real #alpha here.",
    "Visit https://example.com/page#anchor now.",
    "Inline `#incode` span.",
    "```",
    "#fenced",
    "```",
    "Bracketed (#beta) counts.",
  ].join("\n");
  const tags = extractInlineTags(body);
  assert.deepEqual(tags.sort(), ["alpha", "beta"]);
});

test("hierarchical tags expand to their ancestors", () => {
  assert.deepEqual(expandHierarchy(["science/biology/cell"]),
    ["science", "science/biology", "science/biology/cell"]);
});

test("frontmatter tags accept lists and delimited strings", () => {
  assert.deepEqual(extractFrontmatterTags({ tags: ["A", "b"] }).sort(), ["a", "b"]);
  assert.deepEqual(extractFrontmatterTags({ tags: "a, b c" }).sort(), ["a", "b", "c"]);
  assert.deepEqual(normalizeTag("#Foo/Bar"), "foo/bar");
  assert.equal(normalizeTag("#123"), null, "pure numbers are not tags");
});

test("obsidian tag hierarchy breaks ties when note sets are equal", () => {
  // Both notes carry the full chain, so set inclusion alone sees three
  // equivalent tags. The `a/b` syntax must still order them.
  const notes = [
    note("a.md", ["science", "science/physics", "science/physics/quantum"]),
    note("b.md", ["science", "science/physics", "science/physics/quantum"]),
  ];
  const tags = buildTags(notes);
  assert.deepEqual(tags.get("science").children, ["science/physics"]);
  assert.deepEqual(tags.get("science/physics").children, ["science/physics/quantum"]);
  assert.deepEqual(tags.get("science/physics/quantum").parents, ["science/physics"]);
  assert.deepEqual(tags.get("science/physics/quantum").children, []);
});

test("set inclusion still wins where the hierarchy says nothing", () => {
  // `cat` is unrelated by name but strictly contained by `animal`.
  const notes = [note("x.md", ["animal", "cat"]), note("y.md", ["animal"])];
  const tags = buildTags(notes);
  assert.deepEqual(tags.get("animal").children, ["cat"]);
  assert.deepEqual(tags.get("cat").parents, ["animal"]);
});
