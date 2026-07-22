# Optional description and explicit priority

## Goal

Make the Ukrainian task parser leave optional fields empty unless the note actually states their content. A basic task such as `Сходити в магазин` must not receive a placeholder description or an inferred priority.

## Behaviour

### Description

- `description` is absent when the note gives no task detail or substeps.
- The parser must never return a placeholder such as `unspecified`.
- When the note does state details or substeps, retain them in `description` using the current bullet-list convention.

### Priority

- `priority` is `null` unless the note explicitly communicates importance or lack of urgency.
- High: `дуже важливо`, `терміново`, `високий пріоритет`.
- Medium: `важливо`, `середній пріоритет`.
- Low: `не терміново`, `можна пізніше`, `низький пріоритет`.
- A normal imperative such as `зробити`, `треба зробити`, or `сходити в магазин` does not set a priority by itself.

## Implementation boundary

The OpenAI task prompt is the source of this behavior. The existing parser already trims and omits a blank description and persists `priority: null`, so neither the UI nor storage model changes.

## Verification

1. Prompt-contract tests assert the new instructions are sent to the model.
2. Parser normalization tests cover no description and `unspecified` removal.
3. Ukrainian model evaluation fixtures cover absent priority plus high, medium, and low natural-language signals.

## Scope

No changes to task card rendering, manual editing, storage, dates, status, or the number of paid parsing requests.
