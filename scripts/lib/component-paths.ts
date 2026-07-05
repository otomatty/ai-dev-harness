import type { Capability, CapabilityType } from "./scan";
import type { Agent } from "./install-layout";

/** Relative paths under the agent harness root (e.g. `.claude/` or `.cursor/`). */
export function componentRelPaths(type: CapabilityType, name: string, agent: Agent): string[] {
  switch (agent) {
    case "claude":
      return claudePaths(type, name);
    case "cursor":
      return cursorPaths(type, name);
    case "agents-md":
      return agentsMdPaths(type, name);
    default: {
      const _exhaustive: never = agent;
      throw new Error(`Unsupported agent: ${_exhaustive}`);
    }
  }
}

function claudePaths(type: CapabilityType, name: string): string[] {
  switch (type) {
    case "skill":
      return [`skills/${name}`];
    case "agent":
      return [`agents/${name}.md`];
    case "hook":
      return [`hooks/${name}.ts`];
    case "tool":
      return [`tools/${name}.ts`];
    case "sensor":
      return [`sensors/${name}.md`];
    case "aidlc-rule":
      return [`aidlc-rules/${name}.md`];
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown capability type: ${_exhaustive}`);
    }
  }
}

function cursorPaths(type: CapabilityType, name: string): string[] {
  switch (type) {
    case "skill":
      return [`rules/${name}.mdc`];
    case "aidlc-rule":
      return [`rules/aidlc/${name}.mdc`];
    default:
      return [`rules/_unsupported/${type}-${name.replace(/\//g, "-")}.md`];
  }
}

function agentsMdPaths(type: CapabilityType, name: string): string[] {
  const safe = fragmentFileName(type, name);
  return [`fragments/${safe}`];
}

export function fragmentFileName(type: CapabilityType, name: string): string {
  return `${type}--${name.replace(/\//g, "__")}.md`;
}

export function capabilityFromCatalogId(
  caps: Capability[],
  id: string,
): Capability | undefined {
  return caps.find((c) => c.name === id);
}
