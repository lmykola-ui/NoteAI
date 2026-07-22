import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("centers a task completion control across the full card height", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const cardRule = css.match(/\.task-card \{([^}]*)\}/)?.[1] ?? "";
  const completionRule = css.match(/\.task-completion \{([^}]*)\}/)?.[1] ?? "";

  assert.match(cardRule, /grid-template-rows:\s*auto\s+auto/);
  assert.match(completionRule, /grid-row:\s*1\s*\/\s*3/);
  assert.match(completionRule, /align-self:\s*center/);
  assert.match(css, /\.task-card \.task-overdue, \.task-card > \.capture-error \{ grid-column:\s*2\s*\/\s*-1; \}/);
});
