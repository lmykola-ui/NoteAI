# Voice recording controls — design QA

- Source visual truth: `/var/folders/07/lmtltfdn27lbgz2b_0xktpfh0000gn/T/codex-clipboard-58c63da8-5574-4716-b3cc-c95841d248c7.png` and `/var/folders/07/lmtltfdn27lbgz2b_0xktpfh0000gn/T/codex-clipboard-8b91db77-7f50-41b2-8a0e-c68fd0e7f124.png`
- Implementation: `http://localhost:3001/`, in-app Browser capture at 390 × 844, recording state.
- Primary interaction tested: add task → voice capture → begin recording; pause and stop controls were present and reachable.

## Comparison history

1. **P1 — waveform bars were compressed.** The first implementation used a 52px-wide row with five-pixel bars, so the eleven bars visually collapsed. Fixed by using a fixed 68px bar row, three-pixel bars, and a gradual center-height profile.
2. **P1 — confirm action did not match the white-button reference.** The first state used a coral action background. Fixed with an off-white square control and black check icon, matching the microphone action family without adding a microphone glyph.
3. **P2 — horizontal level strip competed with the two recording actions.** Removed the strip and centered the pause and confirmation buttons as a compact, balanced pair.

## Findings

- No actionable P0, P1, or P2 differences remain for the requested recording-control region.
- Fonts and typography: the existing app type scale and bold listening label remain consistent with the dark mobile shell.
- Spacing and layout rhythm: the waveform remains aligned with the listening label and the action row remains inside the card at a mobile-safe width.
- Colors and tokens: waveform uses the existing off-white text token; the confirmation button uses the same off-white family with a high-contrast black check.
- Image and asset fidelity: the reference is a live UI waveform state; the implementation uses semantic, animated UI elements rather than a raster placeholder.
- Copy and content: Ukrainian labels and actions are unchanged.

## Focused region check

The recording card was compared directly in the in-app Browser against the two supplied reference images. A full-screen comparison was not necessary because the requested change is limited to the waveform and confirmation action inside the card.

final result: passed

---

# Task editing sheet — design QA

- Source visual truth: `/var/folders/07/lmtltfdn27lbgz2b_0xktpfh0000gn/T/codex-clipboard-4390c0dc-bac9-4528-b642-babc8f699e1f.png`; the requested interaction is a task card opening the same bottom-sheet language as creation.
- Implementation: `http://localhost:3001/`, in-app Browser, 390 × 844 mobile viewport.
- State: an active inbox task selected, then the populated editing sheet open.
- Primary interactions tested: task card → prefilled edit sheet → save changes → return to the updated card.

## Comparison history

1. **P1 — task cards had no edit affordance.** The card body was static, so a user could not open a task. Fixed by making the content region an accessible edit button while keeping the completion circle separate.
2. **P1 — the composer only created drafts.** Fixed by giving the same bottom sheet an editing mode with existing title, description, date, time, and priority prefilled; save updates the same local task.

## Findings

- No actionable P0, P1, or P2 issues remain in the requested flow.
- Typography and copy: "Редагувати задачу" and "Зберегти зміни" clearly distinguish the mode without adding extra controls.
- Spacing and layout: the sheet keeps the creation-panel spacing and its primary action remains visible at the mobile viewport.
- Colors and tokens: existing dark surfaces, borders, and white primary action are preserved.
- Icon and asset fidelity: existing Lucide semantic icons are retained; no new decorative assets are required.
- Accessibility: the edit area has an explicit accessible label; the completion circle remains a separate action. Screen-reader and physical-device testing were not performed.

## Evidence

Full view was captured in the in-app Browser after opening the card; focused inspection confirmed all prefilled inputs and the save action. The supplied screenshot and implementation are both dark mobile inbox contexts; the source does not specify a distinct editor visual, so reuse of the established creation sheet is intentional.

final result: passed
