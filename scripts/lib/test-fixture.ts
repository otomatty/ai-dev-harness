import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function seedMinimalHarnessRoot(root: string): void {
  mkdirSync(join(root, "core/skills/foo"), { recursive: true });
  writeFileSync(join(root, "core/skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nbody");
  mkdirSync(join(root, "harness/claude"), { recursive: true });
  mkdirSync(join(root, "harness/codex"), { recursive: true });
  writeFileSync(join(root, "harness/claude/settings.base.json"), '{"hooks":{}}');
  writeFileSync(join(root, "harness/claude/plugin.manifest.json"), '{"name":"test-plugin"}');
  writeFileSync(join(root, "harness/claude/marketplace.json"), '{"name":"test-marketplace","plugins":[]}');
  writeFileSync(join(root, "harness/codex/plugin.manifest.json"), '{"name":"test-plugin","skills":"./skills/"}');
  writeFileSync(join(root, "harness/codex/marketplace.json"), '{"name":"test-marketplace","plugins":[]}');
  writeFileSync(
    join(root, "core/catalog.overrides.yaml"),
    "bundles:\n  - id: full\n    label: 全部\n    components: ['*']\n",
  );
}
