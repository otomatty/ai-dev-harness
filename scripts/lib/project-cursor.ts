import { join } from "node:path";
import type { Capability } from "./scan";
import type { ProjectResult } from "./project-claude";
import { serializeFrontmatter } from "./frontmatter";
import { applyTemplate, writeFileEnsured } from "./io";

export function projectCursor(
  caps: Capability[], _coreDir: string, outDir: string,
): ProjectResult {
  const rules = join(outDir, ".cursor/rules");
  const warnings: string[] = [];

  for (const cap of caps) {
    if (cap.type === "skill" || cap.type === "aidlc-rule") {
      const desc = String(cap.frontmatter.description ?? cap.name);
      const body = applyTemplate(cap.body, { HARNESS_DIR: ".cursor" });
      const mdc = serializeFrontmatter({ description: desc, alwaysApply: false }, body);
      const sub = cap.type === "aidlc-rule" ? join("aidlc", `${cap.name}.mdc`) : `${cap.name}.mdc`;
      writeFileEnsured(join(rules, sub), mdc);
    } else {
      warnings.push(`${cap.type} '${cap.name}': no Cursor equivalent — kept Claude-only`);
      const note = `# ${cap.type} '${cap.name}' (Claude-only)\n\n`
        + `This capability has no native Cursor equivalent and was not projected.\n`
        + `Use the Claude distribution (\`dist/claude\`) to run it.\n`;
      writeFileEnsured(join(rules, "_unsupported", `${cap.type}-${cap.name}.md`), note);
    }
  }
  return { warnings };
}
