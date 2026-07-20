import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findOpenAiSecrets } from "./secretScan.mjs";

describe("findOpenAiSecrets", () => {
  it("detects legacy and project-scoped OpenAI keys", () => {
    expect(findOpenAiSecrets("token=sk-" + "a".repeat(24))).toHaveLength(1);
    expect(findOpenAiSecrets("token=sk-proj-" + "b".repeat(24))).toHaveLength(1);
  });

  it("does not flag placeholders or environment variable names", () => {
    expect(
      findOpenAiSecrets(
        "OPENAI_API_KEY=replace_with_server_only_key\nprocess.env.OPENAI_API_KEY",
      ),
    ).toEqual([]);
  });

  it("never prints a source line containing a detected secret", () => {
    const repository = mkdtempSync(join(tmpdir(), "noteai-secret-scan-"));
    const fakeSecret = "sk-proj-" + "sensitive-value-1234567890";
    writeFileSync(
      join(repository, "leaked.env"),
      `OPENAI_API_KEY=${fakeSecret}\n`,
      "utf8",
    );
    execFileSync("git", ["init", "-q"], { cwd: repository });

    const result = spawnSync(
      process.execPath,
      [join(process.cwd(), "scripts/secretScan.mjs")],
      { cwd: repository, encoding: "utf8" },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("leaked.env:1:[REDACTED]");
    expect(result.stderr).toContain("leaked.env:1:[REDACTED]");
    expect(result.stdout).not.toContain(fakeSecret);
    expect(result.stderr).not.toContain(fakeSecret);
    expect(result.stdout).not.toContain(`OPENAI_API_KEY=${fakeSecret}`);
    expect(result.stderr).not.toContain(`OPENAI_API_KEY=${fakeSecret}`);
  });
});
