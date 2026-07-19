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
});
