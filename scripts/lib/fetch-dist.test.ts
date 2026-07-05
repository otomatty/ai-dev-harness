import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findRepoDir } from "./fetch-dist";

let extractDir: string;
beforeEach(() => {
  extractDir = mkdtempSync(join(tmpdir(), "extract-"));
});
afterEach(() => rmSync(extractDir, { recursive: true, force: true }));

test("findRepoDir accepts any single root directory name", () => {
  mkdirSync(join(extractDir, "my-fork-ai-dev-harness-main"));
  expect(findRepoDir(extractDir)).toBe(join(extractDir, "my-fork-ai-dev-harness-main"));
});

test("findRepoDir rejects ambiguous layouts", () => {
  mkdirSync(join(extractDir, "a"));
  mkdirSync(join(extractDir, "b"));
  expect(() => findRepoDir(extractDir)).toThrow(/expected 1 root directory/);
  expect(readdirSync(extractDir).length).toBe(2);
});
