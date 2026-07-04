export type Agent = "claude" | "cursor" | "agents-md";

export const DEFAULT_REPO = "otomatty/ai-dev-harness";
export const DEFAULT_REF = "main";

/** dist/ path inside the repo for each agent target. */
export const DIST_SOURCE: Record<Agent, string> = {
  claude: "dist/claude/.claude",
  cursor: "dist/cursor/.cursor",
  "agents-md": "dist/agents-md/AGENTS.md",
};

/** Relative path written under the target project root. */
export const PROJECT_DEST: Record<Agent, string> = {
  claude: ".claude",
  cursor: ".cursor",
  "agents-md": "AGENTS.md",
};

export function parseAgent(value: string): Agent {
  if (value === "claude" || value === "cursor" || value === "agents-md") return value;
  throw new Error(`Unknown agent "${value}". Use: claude, cursor, agents-md`);
}
