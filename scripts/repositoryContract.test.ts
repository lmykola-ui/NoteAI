import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const historicalDocument = /^docs\/superpowers\/(?:plans|specs)\//;

function activeRepositoryFiles() {
  return execFileSync(
    "git",
    ["ls-files", "-co", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean)
    .filter((file) => !historicalDocument.test(file));
}

it("keeps active repository references on the current OpenAI contract", () => {
  const legacyModelVariable = ["OPENAI", "TASK", "MODEL"].join("_");
  const legacyParseRoute = ["", "api", "parse"].join("/");
  const legacyParseReference = new RegExp(
    `${legacyParseRoute.replaceAll("/", "\\/")}(?!-note)(?:\\b|/)`,
  );
  const violations: string[] = [];

  for (const file of activeRepositoryFiles()) {
    const contents = readFileSync(file);
    if (contents.includes(0)) continue;

    const lines = contents.toString("utf8").split("\n");
    lines.forEach((line, index) => {
      if (line.includes(legacyModelVariable) || legacyParseReference.test(line)) {
        violations.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  expect(violations).toEqual([]);
});
