import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const secretPattern = new RegExp(
  String.raw`\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b`,
  "g",
);

export function findOpenAiSecrets(text) {
  return [...text.matchAll(secretPattern)].map((match) => ({
    index: match.index,
    value: match[0],
  }));
}

function repositoryFiles() {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

export function scanRepository() {
  const secrets = [];
  const references = [];

  for (const file of repositoryFiles()) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    if (text.includes("\0")) continue;

    for (const match of findOpenAiSecrets(text)) {
      secrets.push(`${file}:${lineNumberAt(text, match.index)}`);
    }

    text.split("\n").forEach((line, index) => {
      if (line.includes("OPENAI_API_KEY")) {
        references.push(`${file}:${index + 1}:${line.trim()}`);
      }
    });
  }

  return { references, secrets };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { references, secrets } = scanRepository();

  console.log("OPENAI_API_KEY references:");
  references.forEach((reference) => console.log(reference));

  if (secrets.length > 0) {
    console.error("OpenAI-style secret patterns found:");
    secrets.forEach((secret) => console.error(secret));
    process.exitCode = 1;
  } else {
    console.log("OpenAI-style secret patterns: none found.");
  }
}
