import { test, expect } from "bun:test";
import { deepMerge } from "./settings-merge";

test("deepMerge concatenates arrays and drops // keys", () => {
  const out = deepMerge(
    { hooks: { PreToolUse: [1] } },
    { "// note": "x", hooks: { PreToolUse: [2], PostToolUse: [3] } },
  );
  expect(out).toEqual({ hooks: { PreToolUse: [1, 2], PostToolUse: [3] } });
});
