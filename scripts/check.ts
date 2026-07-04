import { join } from "node:path";
import { hashDir } from "./lib/hashdir";
import { build } from "./build";

export function check(root: string): { ok: boolean; message: string } {
  const agents = ["claude", "cursor", "agents-md"];
  const before = agents.map((a) => hashDir(join(root, "dist", a)));
  build(root);
  const after = agents.map((a) => hashDir(join(root, "dist", a)));
  for (let i = 0; i < agents.length; i++) {
    if (before[i] !== after[i]) {
      return {
        ok: false,
        message: `dist/${agents[i]} is stale or hand-edited — run \`bun run build\` and commit.`,
      };
    }
  }
  return { ok: true, message: "dist is up to date." };
}

if (import.meta.main) {
  const { ok, message } = check(process.cwd());
  console.log(ok ? `✅ ${message}` : `❌ ${message}`);
  if (!ok) process.exit(1);
}
