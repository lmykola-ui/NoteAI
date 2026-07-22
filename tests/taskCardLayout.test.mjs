import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("aligns a task completion control with the task title", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const cardRule = css.match(/\.task-card \{([^}]*)\}/)?.[1] ?? "";
  const completionRule = css.match(/\.task-completion \{([^}]*)\}/)?.[1] ?? "";

  assert.doesNotMatch(cardRule, /grid-template-rows/);
  assert.match(completionRule, /align-self:\s*start/);
  assert.match(completionRule, /margin:\s*2px\s+0\s+0/);
  assert.match(css, /\.task-card \.task-overdue, \.task-card > \.capture-error \{ grid-column:\s*1\s*\/\s*-1; \}/);
});
