import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(text: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const m = text.match(FM_RE);
  if (!m) return { data: {}, body: text };
  const data = (parseYaml(m[1]) ?? {}) as Record<string, unknown>;
  const body = text.slice(m[0].length);
  return { data, body };
}

export function serializeFrontmatter(
  data: Record<string, unknown>,
  body: string,
): string {
  const yaml = stringifyYaml(data);
  return `---\n${yaml}---\n${body}`;
}
