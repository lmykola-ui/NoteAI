# Atomic Task Titles Design

**Goal:** Prevent a shared introductory phrase or priority explanation from being repeated in every task title when one Ukrainian note describes several related tasks.

## Problem

For a note such as `Схема: зробити три шаблони (перший — пріоритетний, другий — середній, третій — низька пріоритетність)`, the model currently returns three tasks but copies most of the shared phrase into each title. The UI and repository display exactly what the parser returns, so the defect originates at the model instruction boundary rather than in rendering or persistence.

## Chosen Approach

Strengthen the existing task system prompt while keeping the single-request architecture. Each returned title must describe only one atomic action, omit note-level labels such as `Схема:`, omit shared introductory text, and exclude metadata already represented by structured fields. When one shared action applies to numbered items, the model should produce a self-contained action for each item.

The target interpretation is:

1. `Зробити перший шаблон`, priority `high`
2. `Зробити другий шаблон`, priority `medium`
3. `Зробити третій шаблон`, priority `low`

No deterministic title cleanup will be added because Ukrainian natural-language prefixes cannot be removed safely without changing legitimate titles. No second model request will be added because it would increase latency and cost for a formatting issue the existing structured extraction request can handle.

## Components and Data Flow

- `taskPrompt.mjs` defines the atomic-title rules and provides the numbered-template example.
- `parseTasks.ts` continues sending one structured request and normalizing fields without semantic rewriting.
- The parser contract fixtures add the reported Ukrainian case and its expected structured result.
- The paid model evaluator adds the same case so the real configured model can be checked before release when an evaluation key is intentionally available.
- Capture, preview, task cards, and IndexedDB remain unchanged.

## Error Handling

Existing fail-closed behavior remains unchanged. Invalid or empty structured output still produces `INVALID_AI_RESPONSE`; the title rule does not introduce local heuristics or fallback mutations.

## Verification

- A prompt-level regression assertion must fail before the prompt changes and pass afterward.
- The mocked parser contract must preserve the three distinct titles and `high`, `medium`, and `low` priorities.
- The evaluator unit tests must recognize the new case and validate distinct title concepts and priorities.
- Run the targeted parser and evaluator tests, then the complete unit suite, lint, typecheck, and production build.
- The paid Ukrainian model evaluation is optional and must only run when a dedicated API key is deliberately available; otherwise report it as skipped.

## Acceptance Criteria

- The reported note yields exactly three tasks.
- Titles are `Зробити перший шаблон`, `Зробити другий шаблон`, and `Зробити третій шаблон`, or equivalent concise Ukrainian wording with the same individual meaning.
- The shared `Схема: зробити три шаблони` phrase is not repeated across titles.
- Priority wording appears only in the structured priority field, not in task titles.
- Existing date, time, completion, ambiguity, and single-task behavior remains unchanged.
