import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { scanCore, type Capability, type CapabilityType } from "./scan";
import { skillDependsOnAgents } from "./project-codex-plugin";

export type AgentId = "claude" | "cursor" | "codex" | "agents-md";
export type AgentSupportStatus = "full" | "partial" | "unsupported";

export interface AgentSupport {
  status: AgentSupportStatus;
  missing?: string[];
}

export interface CatalogComponent {
  id: string;
  type: CapabilityType;
  description: string;
  keywords: string[];
  dependsOn: string[];
  settingsFragments: string[];
  agents: Record<AgentId, AgentSupport>;
}

export interface CatalogBundle {
  id: string;
  label: string;
  components: string[];
}

export interface Catalog {
  version: string;
  repo: string;
  components: CatalogComponent[];
  bundles: CatalogBundle[];
}

interface ComponentOverride {
  keywords?: string[];
  dependsOn?: string[];
  settingsFragments?: string[];
}

interface CatalogOverrides {
  bundles?: CatalogBundle[];
  components?: Record<string, ComponentOverride>;
}

const CURSOR_NATIVE: CapabilityType[] = ["skill", "aidlc-rule"];
const AGENTS_MD_NATIVE: CapabilityType[] = ["skill", "aidlc-rule"];

function agentSupportFor(cap: Capability): Record<AgentId, AgentSupport> {
  const claudeOnly = ["agent", "hook", "tool", "sensor"] as const;

  const cursor: AgentSupport = CURSOR_NATIVE.includes(cap.type)
    ? { status: "full" }
    : { status: "partial", missing: [cap.type] };

  const agentsMd: AgentSupport = AGENTS_MD_NATIVE.includes(cap.type)
    ? { status: "partial", missing: claudeOnly.filter((t) => t !== cap.type) }
    : { status: "partial", missing: [cap.type] };

  let codex: AgentSupport;
  if (cap.type !== "skill") {
    codex = { status: "unsupported", missing: [cap.type] };
  } else if (skillDependsOnAgents(cap)) {
    codex = { status: "unsupported", missing: ["subagent"] };
  } else {
    codex = { status: "full" };
  }

  return {
    claude: { status: "full" },
    cursor,
    codex,
    "agents-md": agentsMd,
  };
}

function loadOverrides(root: string): CatalogOverrides {
  const path = join(root, "core/catalog.overrides.yaml");
  if (!existsSync(path)) return {};
  return parseYaml(readFileSync(path, "utf8")) as CatalogOverrides;
}

export function buildCatalog(root: string, version = "0.1.0"): Catalog {
  const coreDir = join(root, "core");
  const caps = scanCore(coreDir);
  const overrides = loadOverrides(root);

  const components: CatalogComponent[] = caps.map((cap) => {
    const meta = overrides.components?.[cap.name];
    const o = meta ?? {};
    return {
      id: cap.name,
      type: cap.type,
      description: String(cap.frontmatter.description ?? cap.name),
      keywords: o.keywords ?? [],
      dependsOn: o.dependsOn ?? [],
      settingsFragments: o.settingsFragments ?? [],
      agents: agentSupportFor(cap),
    };
  });

  const bundles = overrides.bundles ?? [];

  return {
    version,
    repo: "otomatty/ai-dev-harness",
    components,
    bundles,
  };
}

export function findComponent(catalog: Catalog, id: string): CatalogComponent | undefined {
  return catalog.components.find((c) => c.id === id);
}

export function findBundle(catalog: Catalog, id: string): CatalogBundle | undefined {
  return catalog.bundles.find((b) => b.id === id);
}

export function resolveComponentIds(catalog: Catalog, ids: string[]): string[] {
  const resolved = new Set<string>();

  function add(id: string): void {
    if (id === "*") {
      for (const c of catalog.components) resolved.add(c.id);
      return;
    }
    const bundle = findBundle(catalog, id);
    if (bundle) {
      for (const cid of bundle.components) add(cid);
      return;
    }
    const component = findComponent(catalog, id);
    if (!component) {
      throw new Error(`Unknown component or bundle: "${id}"`);
    }
    resolved.add(component.id);
    for (const dep of component.dependsOn) add(dep);
  }

  for (const id of ids) add(id);
  return [...resolved];
}

export function loadCatalogFromFile(path: string): Catalog {
  return JSON.parse(readFileSync(path, "utf8")) as Catalog;
}

export function catalogPath(root: string): string {
  return join(root, "dist/catalog.json");
}
