# Atomic Task Titles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one Ukrainian note about three prioritized templates produce three concise, distinct task titles without repeating note-level labels or priority explanations.

**Architecture:** Keep the existing single OpenAI structured-output request and strengthen only its system prompt. Protect the behavior with a prompt regression assertion, a mocked parser contract case, and the opt-in real-model evaluator; do not add title post-processing or another provider call.

**Tech Stack:** TypeScript 5.9, Node.js ESM, OpenAI Responses API, Zod Structured Outputs, Vitest.

## Global Constraints

- Keep one OpenAI parsing request per note.
- Do not mutate task titles with deterministic cleanup heuristics.
- Store priority only in the existing `priority` field.
- Do not change Capture, preview, task cards, or IndexedDB.
- The paid model evaluation remains opt-in and must not run without deliberate API-key availability.

---

## File Map

- Modify `src/server/openai/parseTasks.test.ts`: prove the system prompt contains the atomic-title contract.
- Modify `src/server/openai/taskPrompt.mjs`: instruct the model to remove note-level labels, shared prefixes, and structured metadata from each title, with the reported example.
- Modify `tests/fixtures/ukrainian-cases.ts`: add the reported note and exact mocked structured result.
- Modify `scripts/ukrainianModelEval.mjs`: grade the same new input against concise per-template titles and exact priorities.
- Modify `scripts/ukrainianModelEval.test.ts`: update shared-case counts and verify the new case rejects repeated shared prefixes.

### Task 1: Enforce Atomic Titles at the Model Boundary

**Files:**
- Modify: `src/server/openai/parseTasks.test.ts`
- Modify: `src/server/openai/taskPrompt.mjs`
- Modify: `tests/fixtures/ukrainian-cases.ts`
- Modify: `scripts/ukrainianModelEval.mjs`
- Modify: `scripts/ukrainianModelEval.test.ts`

**Interfaces:**
- Consumes: `taskSystemPrompt: string`, `ukrainianParserContractCases`, `ukrainianModelEvalCases`, and `evaluateUkrainianModelCase(definition, actual): string[]`.
- Produces: the same interfaces with an eleventh shared Ukrainian case; no runtime API or domain-type changes.

- [ ] **Step 1: Write a failing prompt regression assertion**

In the existing parser-contract test in `src/server/openai/parseTasks.test.ts`, extend the system-message assertion:

```ts
expect(request.input).toEqual([
  expect.objectContaining({
    role: "system",
    content: expect.stringMatching(
      /атомарну дію[\s\S]*не повторюй спільний вступ[\s\S]*не додавай.*пріоритет.*title/i,
    ),
  }),
  {
    role: "user",
    content: `Локальна дата: ${today}\nЧасовий пояс: Europe/Warsaw\nНотатка: ${input}`,
  },
]);
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```bash
pnpm test -- src/server/openai/parseTasks.test.ts
```

Expected: FAIL because the current four-line prompt does not contain the atomic-title, shared-introduction, or title-metadata rules.

- [ ] **Step 3: Implement the minimal prompt change**

Replace `src/server/openai/taskPrompt.mjs` with:

```js
export const taskSystemPrompt = `Ти аналізуєш українські нотатки та повертаєш лише структуровані задачі.
Використовуй передану локальну дату як основу для “сьогодні” і “завтра”.
Не вигадуй дату, час, статус або пріоритет. Якщо дія справді неоднозначна, поверни одне коротке уточнення.
Розділяй кілька справ на окремі задачі. Фраза про вже зроблену справу має status=completed.
Кожен title має описувати лише одну коротку атомарну дію. Не повторюй спільний вступ, назву схеми чи інший контекст нотатки в кожному title. Не додавай дату, час, статус або пріоритет у title, якщо вони вже записані в окремих структурованих полях.
Якщо одна спільна дія стосується перелічених або пронумерованих об’єктів, створи самостійну назву дії для кожного об’єкта.
Приклад: “Схема: зробити три шаблони (перший — пріоритетний, другий — середній, третій — низька пріоритетність)” → “Зробити перший шаблон” priority=high; “Зробити другий шаблон” priority=medium; “Зробити третій шаблон” priority=low.`;
```

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run:

```bash
pnpm test -- src/server/openai/parseTasks.test.ts
```

Expected: PASS with all parser tests green.

- [ ] **Step 5: Add the reported input to the mocked parser contract**

Append this `parserContractCase` to `ukrainianParserContractCases` in `tests/fixtures/ukrainian-cases.ts`:

```ts
parserContractCase({
  name: "splits a shared template action into atomic prioritized titles",
  input:
    "Схема: зробити три шаблони (перший — пріоритетний, другий — середній, третій — низька пріоритетність)",
  today: "2026-07-20",
  modelOutput: {
    tasks: [
      {
        title: "Зробити перший шаблон",
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: "high",
      },
      {
        title: "Зробити другий шаблон",
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: "medium",
      },
      {
        title: "Зробити третій шаблон",
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: "low",
      },
    ],
    clarification: null,
  },
}),
```

Change the parser contract count assertion from ten to eleven:

```ts
expect(ukrainianParserContractCases).toHaveLength(11);
```

- [ ] **Step 6: Add the same case to the real-model evaluator**

Append this definition to `ukrainianModelEvalCases` in `scripts/ukrainianModelEval.mjs`:

```js
{
  name: "atomic prioritized template titles",
  input:
    "Схема: зробити три шаблони (перший — пріоритетний, другий — середній, третій — низька пріоритетність)",
  today: "2026-07-20",
  expected: {
    tasks: [
      expectedTask([["зроб"], ["перш"], ["шаблон"]], {
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: "high",
        forbiddenTitleTerms: ["схема", "три шаблони", "пріоритет"],
      }),
      expectedTask([["зроб"], ["друг"], ["шаблон"]], {
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: "medium",
        forbiddenTitleTerms: ["схема", "три шаблони", "пріоритет"],
      }),
      expectedTask([["зроб"], ["трет"], ["шаблон"]], {
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: "low",
        forbiddenTitleTerms: ["схема", "три шаблони", "пріоритет"],
      }),
    ],
    clarification: "none",
  },
},
```

Update `scripts/ukrainianModelEval.test.ts` to expect eleven shared inputs and eleven provider calls:

```ts
expect(ukrainianModelEvalCases).toHaveLength(11);
expect(results).toHaveLength(11);
expect(parse).toHaveBeenCalledTimes(11);
```

Add an evaluator regression test that rejects the screenshot behavior:

```ts
it("rejects repeated shared context in atomic template titles", () => {
  const definition = ukrainianModelEvalCases[10];
  const issues = evaluateUkrainianModelCase(definition, {
    tasks: [
      {
        title:
          "Схема: зробити три шаблони (перший — пріоритетний, другий — середній, третій — низька пріоритетність)",
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: "high",
      },
      {
        title: "Схема: зробити три шаблони (другий — середній)",
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: "medium",
      },
      {
        title: "Схема: зробити три шаблони (третій — низька пріоритетність)",
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: "low",
      },
    ],
    clarification: null,
  });

  expect(issues).toContain("task 1 title: contains repeated shared context");
  expect(issues).toContain("task 2 title: contains repeated shared context");
  expect(issues).toContain("task 3 title: contains repeated shared context");
});
```

In `evaluateUkrainianModelCase`, after normalizing each title, grade the new optional forbidden concepts:

```js
for (const forbiddenTerm of expectedTaskDefinition.forbiddenTitleTerms ?? []) {
  if (normalizedTitle.includes(forbiddenTerm)) {
    issues.push(`task ${taskNumber} title: contains repeated shared context`);
    break;
  }
}
```

- [ ] **Step 7: Run the focused regression suite**

Run:

```bash
pnpm test -- src/server/openai/parseTasks.test.ts scripts/ukrainianModelEval.test.ts
```

Expected: PASS; 11 parser/evaluator inputs remain aligned, and repeated shared context is rejected.

- [ ] **Step 8: Run full verification**

Run each command separately:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Expected: every command exits with code 0. Do not run `pnpm eval:ukrainian:model` unless a dedicated key is deliberately configured, because it incurs API cost.

- [ ] **Step 9: Commit the implementation**

```bash
git add src/server/openai/taskPrompt.mjs src/server/openai/parseTasks.test.ts tests/fixtures/ukrainian-cases.ts scripts/ukrainianModelEval.mjs scripts/ukrainianModelEval.test.ts
git commit -m "fix: keep extracted task titles atomic"
```
