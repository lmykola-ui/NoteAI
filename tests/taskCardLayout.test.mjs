import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";

it("aligns a task completion control with the task title", async () => {
  const css = await readFile(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");
  const cardRule = css.match(/\.task-card \{([^}]*)\}/)?.[1] ?? "";
  const completionRule = css.match(/\.task-completion \{([^}]*)\}/)?.[1] ?? "";

  expect(cardRule).not.toMatch(/grid-template-rows/);
  expect(completionRule).toMatch(/align-self:\s*start/);
  expect(completionRule).toMatch(/margin:\s*2px\s+0\s+0/);
  expect(css).toMatch(/\.task-card \.task-overdue, \.task-card > \.capture-error \{ grid-column:\s*1\s*\/\s*-1; \}/);
});
