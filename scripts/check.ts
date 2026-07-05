import { join } from "node:path";
import { hashDir, hashPath } from "./lib/hashdir";
import { build, DIST_TARGETS } from "./build";

const MARKETPLACE_FILES = [
  ".claude-plugin/marketplace.json",
  ".agents/plugins/marketplace.json",
] as const;

const CATALOG_FILE = "dist/catalog.json";

function hashMarketplaces(root: string): string[] {
  return MARKETPLACE_FILES.map((rel) => hashPath(join(root, rel)));
}

export function check(root: string): { ok: boolean; message: string } {
  const before = DIST_TARGETS.map((a) => hashDir(join(root, "dist", a)));
  const beforeMarketplaces = hashMarketplaces(root);
  const beforeCatalog = hashPath(join(root, CATALOG_FILE));
  build(root);
  const after = DIST_TARGETS.map((a) => hashDir(join(root, "dist", a)));
  const afterMarketplaces = hashMarketplaces(root);
  const afterCatalog = hashPath(join(root, CATALOG_FILE));

  for (let i = 0; i < DIST_TARGETS.length; i++) {
    if (before[i] !== after[i]) {
      return {
        ok: false,
        message: `dist/${DIST_TARGETS[i]} is stale or hand-edited — run \`bun run build\` and commit.`,
      };
    }
  }

  for (let i = 0; i < MARKETPLACE_FILES.length; i++) {
    if (beforeMarketplaces[i] !== afterMarketplaces[i]) {
      return {
        ok: false,
        message: `${MARKETPLACE_FILES[i]} is stale or hand-edited — run \`bun run build\` and commit.`,
      };
    }
  }

  if (beforeCatalog !== afterCatalog) {
    return {
      ok: false,
      message: `${CATALOG_FILE} is stale or hand-edited — run \`bun run build\` and commit.`,
    };
  }

  return { ok: true, message: "dist is up to date." };
}

if (import.meta.main) {
  const { ok, message } = check(process.cwd());
  console.log(ok ? `✅ ${message}` : `❌ ${message}`);
  if (!ok) process.exit(1);
}
