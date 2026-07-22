# Preserve the active task destination after saving

## Goal

Saving a manually created task must close the composer without navigating away from the destination the person was viewing.

## Behaviour

- From **Вхідні**, save and remain in **Вхідні**.
- From **Сьогодні**, save and remain in **Сьогодні**.
- From **Заплановані**, save and remain in **Заплановані**.
- The task's chosen date controls which list contains it. It does not control the destination that remains open after saving.
- Editing and voice capture behaviour remain unchanged.

## Implementation

`AppShell` currently changes `destination` to `inbox` after `addDrafts` resolves. Remove only that forced state update. Keep the existing save, persistence request, composer-close, and voice-state reset sequence.

## Regression coverage

Add UI tests that create a task from **Сьогодні** and **Заплановані**, then assert the corresponding destination heading and active navigation item remain visible after save. One task uses a future date to prove that filtering does not redirect the screen.

## Scope

No changes to task date parsing, list filtering, sorting, navigation labels, or voice capture.
