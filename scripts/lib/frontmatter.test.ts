// scripts/lib/frontmatter.test.ts
import { test, expect } from "bun:test";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";

test("parses name and description from frontmatter", () => {
  const text = "---\nname: foo\ndescription: a skill\n---\n# Body\ntext";
  const { data, body } = parseFrontmatter(text);
  expect(data.name).toBe("foo");
  expect(data.description).toBe("a skill");
  expect(body).toBe("# Body\ntext");
});

test("returns empty data when no frontmatter", () => {
  const { data, body } = parseFrontmatter("just body");
  expect(data).toEqual({});
  expect(body).toBe("just body");
});

test("parses nested yaml frontmatter", () => {
  const text = "---\nid: pytest\ninput_schema:\n  file_path: string\n---\nbody";
  const { data } = parseFrontmatter(text);
  expect((data.input_schema as Record<string, unknown>).file_path).toBe("string");
});

test("serialize then parse round-trips top-level scalars", () => {
  const out = serializeFrontmatter({ name: "x", description: "y" }, "body");
  const { data, body } = parseFrontmatter(out);
  expect(data.name).toBe("x");
  expect(body).toBe("body");
});
