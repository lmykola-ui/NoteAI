# NoteAI Mobile Web MVP Roadmap and Design

Date: 2026-07-19
Status: Approved design

## 1. Product Definition

NoteAI is a mobile-only Ukrainian AI notepad. A user writes or dictates everything that is on their mind, and AI turns the input into structured tasks. The first release is not a broad life planner. Its core promise is:

> Написав або сказав думку -> AI розібрав -> перевірив прев’ю -> отримав список задач.

The production site is deployed from `lmykola-ui/NoteAI` to `https://note-ai-smoky.vercel.app/`. The current repository contains only a placeholder page, so no legacy application migration is required.

## 2. MVP Boundaries

### Included

- mobile-only web application opened through the existing Vercel URL;
- Ukrainian as the primary and fully tested language;
- text input and microphone recording;
- real AI transcription and task extraction;
- quick preview before tasks are saved;
- Inbox for tasks without a date;
- a rolling seven-day Plan covering today plus the next six days;
- local persistence on the same device and browser;
- task editing, deletion, completion, and restoration;
- explicit dates, times, completion status, and priority extraction;
- clear loading, empty, offline, permission, and API error states.

### Explicitly deferred

- user accounts, authentication, cloud backup, and cross-device sync;
- PWA installation and push reminders;
- calendars, projects, tags, teams, and complex productivity settings;
- automatic smart scheduling or invented deadlines;
- fully supported languages other than Ukrainian;
- planning views beyond the rolling seven-day window.

These deferred features may be considered only after the core is validated with real usage.

## 3. Core Navigation and Screens

The application is Capture-first. Opening the site takes the user directly to the input surface instead of a dashboard.

The bottom navigation has three destinations:

1. **Capture** — text field, microphone action, and processing state.
2. **Inbox** — undated tasks plus future-dated tasks outside the visible seven-day window.
3. **План** — one selected day at a time with a horizontal strip for today and the next six days.

### Capture

- Primary prompt: `Що в голові?`
- The user may type free-form Ukrainian or record a short voice note.
- Voice is transcribed into editable Ukrainian text before task parsing.
- The original draft stays available until parsing succeeds or the user discards it.

### Quick Preview

- Shows every extracted task as an editable card.
- Allows changing the title, date, time, status, or explicit priority.
- Allows removing individual suggestions.
- Provides one primary `Додати все` action.
- Nothing is persisted as a task until the user confirms the preview.

### Inbox

- Contains active tasks with no date.
- Contains dated tasks outside the rolling seven-day Plan window, with their date visible.
- Contains active tasks with a past date, marked as overdue, so they are never hidden or dropped.
- Allows editing, deletion, completion, and manual assignment to a day in the visible window.
- Contains a simple completed section so completed tasks can be restored without adding a separate top-level screen.

### План

- Shows a horizontal strip of exactly seven dates: today plus six following dates.
- Selecting a date shows only tasks scheduled for that date.
- When the date changes, the strip rolls forward automatically.
- A future task stored in Inbox appears in Plan automatically when its date enters the seven-day window.
- Plan ordering is simple and stable: timed tasks by time, then untimed tasks by creation order.

## 4. Task Rules and Data Model

The minimum persisted task shape is:

```ts
type Task = {
  id: string;
  title: string;
  scheduledDate: string | null; // Local calendar date: YYYY-MM-DD
  scheduledTime: string | null; // Local time: HH:mm
  status: "active" | "completed";
  priority: "low" | "medium" | "high" | null;
  inputMethod: "text" | "voice";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};
```

Rules:

- AI sets a date, time, status, or priority only when the user states or clearly implies it.
- `сьогодні` resolves to the user’s current local date.
- `завтра` resolves to the following local date.
- A date within today plus six days routes to the matching Plan day.
- No date routes to Inbox.
- A date beyond the seven-day window remains visible in Inbox until it enters the window.
- A past date routes to Inbox and is presented as overdue.
- Ambiguous wording produces a short clarification instead of invented data.
- A completed statement such as `рахунок я вже оплатив` creates a completed preview item.

Baseline acceptance phrase:

> Молоко купити сьогодні, пошту глянути завтра, а рахунок я вже оплатив.

Expected result: two active dated tasks and one completed task.

## 5. AI Integration

The baseline implementation uses two server-side OpenAI roles:

1. `gpt-4o-mini-transcribe` for bounded Ukrainian audio transcription.
2. `gpt-5.6-terra` through the Responses API for Ukrainian task analysis.

The exact current production model IDs must be revalidated against official OpenAI documentation at implementation time. The application code must keep model IDs in server-side configuration so they can be changed without modifying UI or task-domain code.

The parser uses Structured Outputs and returns a validated object rather than free-form prose:

```ts
type ParseResult = {
  tasks: Array<{
    title: string;
    scheduledDate: string | null;
    scheduledTime: string | null;
    status: "active" | "completed";
    priority: "low" | "medium" | "high" | null;
  }>;
  clarification: string | null;
};
```

If a safe task structure cannot be produced, the server returns a clarification or a recoverable error. It never saves partial AI output directly.

## 6. Architecture

Recommended stack:

- Next.js with TypeScript;
- Vercel deployment and server functions;
- mobile-first component styling with reusable design tokens;
- IndexedDB behind a task repository interface;
- OpenAI API calls only from server routes.

### Client units

- `Capture`: text and microphone interaction;
- `Preview`: editable AI drafts;
- `Inbox`: undated and later-future tasks;
- `Plan`: rolling seven-day strip and selected-day tasks;
- `TaskCard`: shared task presentation and actions;
- task use cases: create, edit, complete, restore, delete, and route by date;
- `TaskRepository` interface with an IndexedDB implementation.

### Server units

- `/api/transcribe`: accepts a bounded audio upload and returns text;
- `/api/parse`: accepts text plus local date/timezone context and returns validated task drafts;
- schema validation and safe error mapping;
- request-size, timeout, usage, and rate safeguards;
- OpenAI API key read only from Vercel environment variables.

### Isolation requirements

- UI components do not call IndexedDB directly.
- UI components do not call OpenAI directly.
- Product logic depends on `TaskRepository`, not a concrete storage engine.
- Server routes hide provider credentials and normalize provider errors.
- Visual tokens and layout components remain separate from task rules, allowing later UI/UX redesign without rewriting AI or persistence logic.

## 7. Data Flow

### Text

1. User enters Ukrainian text.
2. Client sends the text and local date/timezone context to `/api/parse`.
3. Server requests structured task drafts from OpenAI.
4. Server validates the response schema.
5. Client shows Quick Preview.
6. User edits or confirms.
7. Confirmed tasks are written to IndexedDB.
8. The routing rule exposes them in Inbox or the relevant Plan day.

### Voice

1. User grants microphone permission and records a short note.
2. Client sends the bounded audio file to `/api/transcribe`.
3. The returned transcript is shown and remains editable.
4. The transcript follows the same parse, preview, validation, and persistence flow as text.
5. Raw audio is not retained after transcription succeeds.

## 8. Local Persistence Contract

IndexedDB is the source of truth for the MVP. It stores tasks, completion state, and an unfinished local capture draft.

On first meaningful use, the application checks storage status and requests persistent storage with `navigator.storage.persist()` when supported. Failure to receive persistent mode does not block the app, but the UI must not claim that data is backed up.

The persistence guarantee is deliberately precise:

> The same domain opened on the same phone in the same browser profile reloads the locally stored tasks.

The MVP cannot guarantee recovery after:

- the user clears site data;
- private/incognito browsing ends;
- the user switches browsers or browser profiles;
- browser or operating-system storage eviction;
- device loss or reset.

Cloud backup is the later solution for those cases; it is not silently simulated in the MVP.

## 9. Error Handling

- **Microphone denied:** explain how to enable access and keep text entry usable.
- **Recording failure:** keep the screen usable and offer another recording attempt.
- **Transcription failure:** do not create a task; preserve the capture state where possible.
- **Parser/API failure:** preserve entered text and provide an explicit retry.
- **Offline:** existing local tasks remain readable and editable; AI actions explain that a connection is required.
- **Invalid AI schema:** reject the response and show a recoverable error without saving malformed tasks.
- **IndexedDB failure or quota error:** show that saving failed; do not claim success.
- **Ambiguous language:** ask one short clarification in Preview instead of guessing.
- **Unsupported date beyond seven days:** store it in Inbox with its date rather than dropping it.

## 10. Roadmap

The roadmap is milestone-based. A phase is complete only when its exit criteria pass.

### Phase 0 — Foundation

Deliverables:

- replace the static placeholder with a mobile-only Next.js shell;
- establish GitHub-to-Vercel preview and production deployment;
- create OpenAI Platform billing, a controlled spending limit, and an API key;
- configure Vercel environment variables without exposing secrets;
- define shared task, draft, parser, and repository contracts;
- establish IndexedDB and a storage persistence check.

Exit criteria:

- a test server route runs on Vercel without exposing the API key;
- a locally created sample task survives closing and reopening the same browser.

### Phase 1 — Text Vertical Slice

Deliverables:

- Capture-first text UI;
- `/api/parse` with Ukrainian Structured Outputs;
- editable Quick Preview;
- IndexedDB task persistence;
- Inbox and seven-day Plan routing;
- basic task edit, delete, complete, and restore actions.

Exit criteria:

- the baseline multi-task phrase produces the expected three preview items;
- confirmed tasks survive reload and appear in the correct destinations;
- undated and later-future tasks are not lost.

### Phase 2 — Voice Vertical Slice

Deliverables:

- mobile browser microphone recording;
- clear idle, recording, uploading, transcribing, and failed states;
- `/api/transcribe` and editable transcript;
- voice transcript routed through the same parser used by text;
- bounded upload size and duration.

Exit criteria:

- equivalent text and voice input yield equivalent task structures;
- permission denial and transcription failure preserve a usable text flow;
- raw audio is not retained after successful transcription.

### Phase 3 — MVP Beta

Deliverables:

- polished Capture, Preview, Inbox, and Plan states;
- seven-day date strip and deterministic task ordering;
- completed-task section and restoration;
- offline, storage, API, microphone, and validation error UX;
- mobile Safari and Chrome QA;
- privacy-conscious, non-sensitive product analytics;
- OpenAI cost and rate monitoring.

Exit criteria:

- ten core Ukrainian acceptance scenarios pass without task loss;
- the full voice and text flows work on supported phones;
- the API key is absent from client assets and browser requests;
- the app remains usable for existing tasks while offline;
- the production Vercel deployment passes the release checklist.

### Phase 4 — Post-MVP Validation and Evolution

Consider only after observing real usage:

1. improve Ukrainian language evaluation coverage and parsing prompts;
2. add accounts, cloud backup, and cross-device synchronization;
3. add PWA installation and push reminders;
4. add other languages;
5. consider a smarter Today/Plan experience without inventing user intent;
6. iterate freely on UI/UX using the isolated component and token layers.

Calendars, projects, tags, teams, and broad proactive planning remain outside the roadmap until separately validated.

## 11. Testing Strategy

### Automated

- unit tests for rolling seven-day date classification;
- unit tests for Inbox, Plan, completed, and future task routing;
- schema validation tests for valid and malformed AI responses;
- IndexedDB repository contract tests;
- component tests for preview editing and task actions;
- API route tests with mocked OpenAI responses;
- end-to-end text and voice happy paths;
- failure-path tests for offline, denied microphone, API timeout, invalid schema, and storage failure.

### Ukrainian acceptance set

At minimum, cover:

- `сьогодні`, `завтра`, and explicit weekdays;
- `увечері`, `до п’ятої`, and explicit numeric times;
- multiple tasks in one sentence;
- `не забудь`, `я вже зробив`, and `перенеси на завтра`;
- explicit priority wording;
- ambiguous requests that require a clarification;
- dates inside and outside the seven-day Plan window.

### Manual mobile QA

- current mobile Safari on iPhone;
- current mobile Chrome on Android;
- microphone permission grant, denial, and later re-enable;
- reload, browser restart, phone restart, and offline reopen;
- narrow viewport, keyboard-open layout, long task titles, and seven-day strip interaction.

## 12. Product Success Criteria

The MVP succeeds when a user can open the link on a phone, unload a Ukrainian thought by voice or text, correct the AI preview, and reliably find the saved result in Inbox or one of the next seven days.

The initial product is judged primarily by:

- task extraction correctness;
- zero silent task loss;
- clarity of AI corrections and clarifications;
- speed of the Capture-to-save flow;
- reliable same-browser local persistence;
- ease of changing and improving UI/UX after release.
