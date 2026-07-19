import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const historicalDocument = /^docs\/superpowers\/(?:plans|specs)\//;
const legacyModelVariable = ["OPENAI", "TASK", "MODEL"].join("_");
const legacyParseRoute = ["", "api", "parse"].join("/");
const legacyParseReference = new RegExp(
  `${legacyParseRoute.replaceAll("/", "\\/")}(?!-note)(?:\\b|/)`,
);
const legacyParseRoutePath = new RegExp(
  `(?:^|/)${legacyParseRoute.slice(1).replaceAll("/", "\\/")}(?:/|$)`,
);

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

function repositoryContractViolations(file: string, contents: Buffer) {
  const violations: string[] = [];

  if (legacyParseRoutePath.test(file)) {
    violations.push(`${file}: legacy parse route path`);
  }

  if (contents.includes(0)) return violations;

  const lines = contents.toString("utf8").split("\n");
  lines.forEach((line, index) => {
    if (line.includes(legacyModelVariable) || legacyParseReference.test(line)) {
      violations.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  });

  return violations;
}

it("rejects legacy parse-route paths even when their contents are clean", () => {
  const legacyRoutePath = ["src", "app", "api", "parse", "route.ts"].join("/");

  expect(
    repositoryContractViolations(legacyRoutePath, Buffer.from("export {};")),
  ).toEqual([`${legacyRoutePath}: legacy parse route path`]);
});

it("accepts the canonical parse-note route path", () => {
  const canonicalRoutePath = [
    "src",
    "app",
    "api",
    "parse-note",
    "route.ts",
  ].join("/");

  expect(
    repositoryContractViolations(canonicalRoutePath, Buffer.from("export {};")),
  ).toEqual([]);
});

it("rejects legacy parse-route references in file contents", () => {
  const legacyRouteReference = ["", "api", "parse"].join("/");
  const line = `fetch("${legacyRouteReference}");`;

  expect(
    repositoryContractViolations("src/client.ts", Buffer.from(line)),
  ).toEqual([`src/client.ts:1: ${line}`]);
});

it("keeps active repository references on the current OpenAI contract", () => {
  const violations = activeRepositoryFiles().flatMap((file) =>
    repositoryContractViolations(file, readFileSync(file)),
  );

  expect(violations).toEqual([]);
});
