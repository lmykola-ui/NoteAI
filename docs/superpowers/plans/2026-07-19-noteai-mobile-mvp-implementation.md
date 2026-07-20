# NoteAI Mobile MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the deployed static page with a mobile-only Ukrainian AI notepad that captures text or voice, previews structured tasks, and persists them locally in Inbox or a rolling seven-day Plan.

**Architecture:** Build a Next.js App Router application with a client-side task domain and repository boundary, an IndexedDB adapter, and two server-only OpenAI routes. Keep UI components, task rules, persistence, and provider code isolated so later UI/UX changes and cloud sync do not rewrite the core.

**Tech Stack:** Node.js 20.9+, Next.js App Router, React, TypeScript 5.1+, CSS Modules/global design tokens, Zod, OpenAI JavaScript SDK, `idb`, Vitest, Testing Library, `fake-indexeddb`, Playwright, Vercel, and Vercel Web Analytics.

## Global Constraints

- The product is mobile-only and opens at `https://note-ai-smoky.vercel.app/`.
- Ukrainian is the primary and fully tested MVP language.
- Opening the application lands on Capture, not Inbox or Plan.
- Bottom navigation contains exactly `Capture`, `Inbox`, and `План`.
- Plan shows today plus the next six local calendar dates.
- Undated, overdue, and later-future active tasks remain visible in Inbox.
- AI never invents a date, time, completion status, or priority.
- Every AI result is editable in Quick Preview before persistence.
- IndexedDB is the MVP source of truth; no account or cloud backup is implied.
- Same-domain, same-device, same-browser persistence is the only storage guarantee.
- Existing local tasks remain readable and editable while offline; AI actions require a connection.
- OpenAI API keys exist only in Vercel/server environment variables.
- Raw audio is discarded after successful transcription.
- Do not add projects, tags, calendars, teams, push reminders, or automatic scheduling.
- Run unit tests, lint, typecheck, and build before each milestone commit.

---

## Planned File Map

```text
src/
  app/
    api/parse/route.ts                 HTTP boundary for structured task parsing
    api/transcribe/route.ts            HTTP boundary for bounded audio transcription
    globals.css                        mobile tokens and global layout rules
    layout.tsx                         Ukrainian metadata and analytics component
    page.tsx                           mounts the client application
  components/
    app-shell/AppShell.tsx             three-destination navigation and screen selection
    capture/CaptureScreen.tsx          text capture, voice trigger, draft states
    capture/VoiceRecorder.tsx          MediaRecorder lifecycle only
    preview/QuickPreview.tsx           editable TaskDraft cards and confirmation
    tasks/TaskCard.tsx                 shared task display and actions
    tasks/InboxScreen.tsx              undated, overdue, later-future, completed sections
    tasks/PlanScreen.tsx               rolling seven-day strip and selected-day list
  features/tasks/
    application/TaskProvider.tsx       loads repository and exposes task use cases
    domain/dateWindow.ts               local date keys and seven-day routing
    domain/task.ts                     Task, TaskDraft, ParseResult contracts
    infrastructure/indexedDb.ts        database schema and connection
    infrastructure/IndexedDbTaskRepository.ts
    infrastructure/TaskRepository.ts   storage interface
  features/capture/
    application/parseClient.ts         typed `/api/parse` client
    application/transcribeClient.ts    typed `/api/transcribe` client
    infrastructure/draftStore.ts       unfinished local input persistence
  lib/
    analytics.ts                       non-sensitive event names only
    storagePersistence.ts              StorageManager persistent-mode request
  server/openai/
    client.ts                          server-only OpenAI client and model config
    parseTasks.ts                      prompt, Structured Outputs, normalized result
    transcribeAudio.ts                 bounded audio transcription
tests/
  e2e/noteai-core.spec.ts              browser-level text and local persistence flow
  fixtures/memoryTaskRepository.ts     inspectable repository test double
  fixtures/taskFactory.ts              complete reusable Task fixtures
  fixtures/ukrainian-cases.ts          canonical language acceptance cases
```

Tests live next to the unit under test as `*.test.ts` or `*.test.tsx`; Playwright tests live under `tests/e2e`.

---

### Task 1: Replace the Static Page with a Tested Mobile Next.js Shell

**Files:**
- Delete: `index.html`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.mts`
- Create: `vitest.setup.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/page.test.tsx`
- Create: `src/app/globals.css`

**Interfaces:**
- Consumes: none.
- Produces: `RootLayout`, `HomePage`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.

- [ ] **Step 1: Replace the static toolchain with Next.js and the test dependencies**

Delete `index.html` with:

```diff
*** Begin Patch
*** Delete File: index.html
*** End Patch
```

Then run:

```bash
pnpm init
pnpm add next@latest react@latest react-dom@latest openai zod idb server-only @vercel/analytics
pnpm add -D typescript @types/node @types/react @types/react-dom eslint eslint-config-next vitest jsdom @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event fake-indexeddb @playwright/test
```

Expected: `package.json` and `pnpm-lock.yaml` exist, and the removed static page is staged as a deletion.

- [ ] **Step 2: Define scripts and TypeScript/test configuration**

Set the scripts without overwriting dependency fields:

```bash
pnpm pkg set scripts.dev="next dev"
pnpm pkg set scripts.build="next build"
pnpm pkg set scripts.start="next start"
pnpm pkg set scripts.lint="eslint ."
pnpm pkg set scripts.typecheck="tsc --noEmit"
pnpm pkg set scripts.test="vitest run"
pnpm pkg set scripts.test:watch="vitest"
pnpm pkg set scripts.test:e2e="playwright test"
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
```

Create `eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([".next/**", "out/**", "coverage/**", "playwright-report/**"]),
]);
```

Create `vitest.config.mts`:

```ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    clearMocks: true,
  },
});
```

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
```

- [ ] **Step 3: Write the failing mobile shell test**

Create `src/app/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

it("opens on the Ukrainian Capture screen", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { name: "Що в голові?" })).toBeVisible();
  expect(screen.getByRole("navigation", { name: "Основна навігація" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Capture" })).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 4: Run the test and verify the expected failure**

Run: `pnpm test -- src/app/page.test.tsx`

Expected: FAIL because `src/app/page.tsx` does not exist.

- [ ] **Step 5: Implement the minimal shell with isolated design tokens**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NoteAI",
  description: "Український AI-нотатник для щоденних задач",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

Create `src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="mobile-shell">
      <section className="screen">
        <h1>Що в голові?</h1>
        <p>Напишіть або скажіть усе підряд</p>
      </section>
      <nav aria-label="Основна навігація" className="bottom-nav">
        <button type="button" aria-current="page">Capture</button>
        <button type="button">Inbox</button>
        <button type="button">План</button>
      </nav>
    </main>
  );
}
```

Create `src/app/globals.css`:

```css
:root {
  --color-bg: #171b25;
  --color-surface: #252a35;
  --color-text: #f7f8fb;
  --color-muted: #9ca3b2;
  --color-accent: #ff4b45;
  --radius-card: 18px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: var(--color-text);
  background: var(--color-bg);
}

* { box-sizing: border-box; }
body { margin: 0; min-height: 100dvh; background: var(--color-bg); }
button, textarea, input { font: inherit; }
.mobile-shell { width: min(100%, 480px); min-height: 100dvh; margin: 0 auto; padding: 24px 20px 92px; }
.screen h1 { margin: 0; font-size: 2rem; }
.screen p { color: var(--color-muted); }
.bottom-nav { position: fixed; inset: auto 0 0; display: flex; justify-content: center; gap: 8px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: #11151dcc; backdrop-filter: blur(16px); }
.bottom-nav button { border: 0; border-radius: 12px; padding: 10px 16px; color: var(--color-muted); background: transparent; }
.bottom-nav button[aria-current="page"] { color: var(--color-accent); background: var(--color-surface); }
```

- [ ] **Step 6: Verify the shell and commit**

Run:

```bash
pnpm test -- src/app/page.test.tsx
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all four commands exit 0; the test reports one passing test; build emits a successful production build.

Commit:

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts eslint.config.mjs vitest.config.mts vitest.setup.ts src index.html
git commit -m "feat: scaffold NoteAI mobile shell"
```

---

### Task 2: Define Task Contracts and Rolling Seven-Day Routing

**Files:**
- Create: `src/features/tasks/domain/task.ts`
- Create: `src/features/tasks/domain/dateWindow.ts`
- Create: `src/features/tasks/domain/dateWindow.test.ts`
- Create: `tests/fixtures/ukrainian-cases.ts`
- Create: `tests/fixtures/taskFactory.ts`

**Interfaces:**
- Consumes: none.
- Produces: `Task`, `TaskDraft`, `ParseResult`, `toLocalDateKey(date)`, `addLocalDays(key, amount)`, and `classifyTaskDate(date, today)`.

- [ ] **Step 1: Write routing tests first**

Create `src/features/tasks/domain/dateWindow.test.ts`:

```ts
import { addLocalDays, classifyTaskDate } from "./dateWindow";

const today = "2026-07-19";

it.each([
  [null, "inbox"],
  ["2026-07-18", "inbox"],
  ["2026-07-19", "plan"],
  ["2026-07-25", "plan"],
  ["2026-07-26", "inbox"],
] as const)("classifies %s as %s", (date, destination) => {
  expect(classifyTaskDate(date, today)).toBe(destination);
});

it("adds local calendar days without UTC conversion", () => {
  expect(addLocalDays("2026-03-28", 2)).toBe("2026-03-30");
});
```

Run: `pnpm test -- src/features/tasks/domain/dateWindow.test.ts`

Expected: FAIL because `dateWindow.ts` does not exist.

- [ ] **Step 2: Implement explicit domain types**

Create `src/features/tasks/domain/task.ts`:

```ts
export type TaskStatus = "active" | "completed";
export type TaskPriority = "low" | "medium" | "high";
export type InputMethod = "text" | "voice";

export type Task = {
  id: string;
  title: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  status: TaskStatus;
  priority: TaskPriority | null;
  inputMethod: InputMethod;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type TaskDraft = Pick<
  Task,
  "title" | "scheduledDate" | "scheduledTime" | "status" | "priority" | "inputMethod"
>;

export type ParseResult = {
  tasks: TaskDraft[];
  clarification: string | null;
};

export function materializeTask(draft: TaskDraft, now = new Date()): Task {
  const timestamp = now.toISOString();
  return {
    ...draft,
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: draft.status === "completed" ? timestamp : null,
  };
}
```

Create `src/features/tasks/domain/dateWindow.ts`:

```ts
export type TaskDestination = "inbox" | "plan";

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addLocalDays(key: string, amount: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + amount);
  return toLocalDateKey(date);
}

export function classifyTaskDate(date: string | null, today: string): TaskDestination {
  if (!date) return "inbox";
  const finalPlanDate = addLocalDays(today, 6);
  return date >= today && date <= finalPlanDate ? "plan" : "inbox";
}

export function isOverdue(date: string | null, today: string): boolean {
  return Boolean(date && date < today);
}
```

- [ ] **Step 3: Add canonical Ukrainian acceptance data**

Create `tests/fixtures/ukrainian-cases.ts`:

```ts
export const ukrainianAcceptanceCases = [
  {
    input: "Молоко купити сьогодні, пошту глянути завтра, а рахунок я вже оплатив",
    expectedTaskCount: 3,
  },
  { input: "Подзвони лікарю сьогодні до п’ятої", expectedTaskCount: 1 },
  { input: "Перенеси зустріч на завтра", expectedTaskCount: 1 },
  { input: "Купити лампочку", expectedTaskCount: 1 },
] as const;
```

Create `tests/fixtures/taskFactory.ts`:

```ts
import type { Task } from "@/features/tasks/domain/task";

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Купити молоко",
    scheduledDate: null,
    scheduledTime: null,
    status: "active",
    priority: null,
    inputMethod: "text",
    createdAt: "2026-07-19T10:00:00.000Z",
    updatedAt: "2026-07-19T10:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm test -- src/features/tasks/domain/dateWindow.test.ts && pnpm typecheck`

Expected: PASS; five classifications and the calendar-day test succeed.

Commit:

```bash
git add src/features/tasks/domain tests/fixtures/ukrainian-cases.ts tests/fixtures/taskFactory.ts
git commit -m "feat: define task domain and seven-day routing"
```

---

### Task 3: Add the IndexedDB Repository and Local Draft Persistence

**Files:**
- Create: `src/features/tasks/infrastructure/TaskRepository.ts`
- Create: `src/features/tasks/infrastructure/indexedDb.ts`
- Create: `src/features/tasks/infrastructure/IndexedDbTaskRepository.ts`
- Create: `src/features/tasks/infrastructure/IndexedDbTaskRepository.test.ts`
- Create: `src/features/capture/infrastructure/draftStore.ts`
- Create: `tests/fixtures/memoryTaskRepository.ts`

**Interfaces:**
- Consumes: `Task` from Task 2.
- Produces: `TaskRepository`, `indexedDbTaskRepository`, `loadCaptureDraft()`, `saveCaptureDraft(text)`, and `clearCaptureDraft()`.

- [ ] **Step 1: Write the repository contract test**

Create `src/features/tasks/infrastructure/IndexedDbTaskRepository.test.ts`:

```ts
import { noteAiDb } from "./indexedDb";
import { indexedDbTaskRepository } from "./IndexedDbTaskRepository";
import type { Task } from "../domain/task";

const task: Task = {
  id: "task-1",
  title: "Купити молоко",
  scheduledDate: null,
  scheduledTime: null,
  status: "active",
  priority: null,
  inputMethod: "text",
  createdAt: "2026-07-19T10:00:00.000Z",
  updatedAt: "2026-07-19T10:00:00.000Z",
  completedAt: null,
};

beforeEach(async () => {
  const db = await noteAiDb;
  await db.clear("tasks");
});

it("persists tasks across repository calls", async () => {
  await indexedDbTaskRepository.saveMany([task]);
  expect(await indexedDbTaskRepository.list()).toEqual([task]);
});

it("updates and deletes a task", async () => {
  await indexedDbTaskRepository.saveMany([task]);
  await indexedDbTaskRepository.save({ ...task, title: "Купити хліб" });
  expect((await indexedDbTaskRepository.list())[0].title).toBe("Купити хліб");
  await indexedDbTaskRepository.remove(task.id);
  expect(await indexedDbTaskRepository.list()).toEqual([]);
});
```

Run: `pnpm test -- src/features/tasks/infrastructure/IndexedDbTaskRepository.test.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 2: Implement the repository boundary and database**

Create `src/features/tasks/infrastructure/TaskRepository.ts`:

```ts
import type { Task } from "../domain/task";

export interface TaskRepository {
  list(): Promise<Task[]>;
  save(task: Task): Promise<void>;
  saveMany(tasks: Task[]): Promise<void>;
  remove(id: string): Promise<void>;
}
```

Create `src/features/tasks/infrastructure/indexedDb.ts`:

```ts
import { openDB, type DBSchema } from "idb";
import type { Task } from "../domain/task";

interface NoteAiDb extends DBSchema {
  tasks: {
    key: string;
    value: Task;
    indexes: { "by-date": string; "by-status": Task["status"] };
  };
  meta: { key: string; value: { key: string; value: string } };
}

export const noteAiDb = openDB<NoteAiDb>("noteai", 1, {
  upgrade(db) {
    const tasks = db.createObjectStore("tasks", { keyPath: "id" });
    tasks.createIndex("by-date", "scheduledDate");
    tasks.createIndex("by-status", "status");
    db.createObjectStore("meta", { keyPath: "key" });
  },
});
```

Create `src/features/tasks/infrastructure/IndexedDbTaskRepository.ts`:

```ts
import type { TaskRepository } from "./TaskRepository";
import { noteAiDb } from "./indexedDb";

export const indexedDbTaskRepository: TaskRepository = {
  async list() {
    const db = await noteAiDb;
    return db.getAll("tasks");
  },
  async save(task) {
    const db = await noteAiDb;
    await db.put("tasks", task);
  },
  async saveMany(tasks) {
    const db = await noteAiDb;
    const transaction = db.transaction("tasks", "readwrite");
    await Promise.all([...tasks.map((task) => transaction.store.put(task)), transaction.done]);
  },
  async remove(id) {
    const db = await noteAiDb;
    await db.delete("tasks", id);
  },
};
```

Create `src/features/capture/infrastructure/draftStore.ts`:

```ts
import { noteAiDb } from "@/features/tasks/infrastructure/indexedDb";

const DRAFT_KEY = "capture-draft";

export async function loadCaptureDraft(): Promise<string> {
  const db = await noteAiDb;
  return (await db.get("meta", DRAFT_KEY))?.value ?? "";
}

export async function saveCaptureDraft(value: string): Promise<void> {
  const db = await noteAiDb;
  await db.put("meta", { key: DRAFT_KEY, value });
}

export async function clearCaptureDraft(): Promise<void> {
  const db = await noteAiDb;
  await db.delete("meta", DRAFT_KEY);
}
```

Create `tests/fixtures/memoryTaskRepository.ts`:

```ts
import type { Task } from "@/features/tasks/domain/task";
import type { TaskRepository } from "@/features/tasks/infrastructure/TaskRepository";

export function createMemoryTaskRepository(initial: Task[] = []): TaskRepository & { saved: Task[] } {
  const saved = [...initial];
  return {
    saved,
    list: async () => [...saved],
    async save(task) {
      const index = saved.findIndex((item) => item.id === task.id);
      if (index === -1) saved.push(task);
      else saved.splice(index, 1, task);
    },
    async saveMany(tasks) { saved.push(...tasks); },
    async remove(id) {
      const index = saved.findIndex((task) => task.id === id);
      if (index >= 0) saved.splice(index, 1);
    },
  };
}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm test -- src/features/tasks/infrastructure/IndexedDbTaskRepository.test.ts && pnpm typecheck`

Expected: both repository tests pass and TypeScript exits 0.

Commit:

```bash
git add src/features/tasks/infrastructure src/features/capture/infrastructure tests/fixtures/memoryTaskRepository.ts
git commit -m "feat: persist tasks and capture drafts locally"
```

---

### Task 4: Add Task Application State and Use Cases

**Files:**
- Create: `src/features/tasks/application/TaskProvider.tsx`
- Create: `src/features/tasks/application/TaskProvider.test.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `TaskRepository`, `indexedDbTaskRepository`, `Task`, `TaskDraft`, and `materializeTask`.
- Produces: `TaskProvider` and `useTasks()` with `tasks`, `loading`, `error`, `addDrafts`, `updateTask`, `completeTask`, `restoreTask`, and `deleteTask`.

- [ ] **Step 1: Write a provider use-case test with an in-memory repository**

Create `src/features/tasks/application/TaskProvider.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import type { TaskRepository } from "../infrastructure/TaskRepository";
import { TaskProvider, useTasks } from "./TaskProvider";

const saved: Awaited<ReturnType<TaskRepository["list"]>> = [];
const repository: TaskRepository = {
  list: async () => saved,
  save: async (task) => {
    const index = saved.findIndex((item) => item.id === task.id);
    if (index === -1) saved.push(task);
    else saved.splice(index, 1, task);
  },
  saveMany: async (tasks) => { saved.push(...tasks); },
  remove: async (id) => { const index = saved.findIndex((task) => task.id === id); if (index >= 0) saved.splice(index, 1); },
};

it("materializes and persists confirmed drafts", async () => {
  const wrapper = ({ children }: PropsWithChildren) => <TaskProvider repository={repository}>{children}</TaskProvider>;
  const { result } = renderHook(() => useTasks(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(() => result.current.addDrafts([{ title: "Купити молоко", scheduledDate: null, scheduledTime: null, status: "active", priority: null, inputMethod: "text" }]));
  expect(result.current.tasks).toHaveLength(1);
  expect(saved).toHaveLength(1);
});
```

Run: `pnpm test -- src/features/tasks/application/TaskProvider.test.tsx`

Expected: FAIL because `TaskProvider` does not exist.

- [ ] **Step 2: Implement the provider and explicit use cases**

Create `src/features/tasks/application/TaskProvider.tsx` with a client component that:

```tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { materializeTask, type Task, type TaskDraft } from "../domain/task";
import type { TaskRepository } from "../infrastructure/TaskRepository";
import { indexedDbTaskRepository } from "../infrastructure/IndexedDbTaskRepository";

type TaskContextValue = {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  addDrafts(drafts: TaskDraft[]): Promise<void>;
  updateTask(task: Task): Promise<void>;
  completeTask(id: string): Promise<void>;
  restoreTask(id: string): Promise<void>;
  deleteTask(id: string): Promise<void>;
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children, repository = indexedDbTaskRepository }: PropsWithChildren<{ repository?: TaskRepository }>) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    repository.list().then(setTasks).catch(() => setError("Не вдалося відкрити локальні задачі")).finally(() => setLoading(false));
  }, [repository]);

  const value = useMemo<TaskContextValue>(() => {
    async function persistUpdate(task: Task): Promise<void> {
      const updated = { ...task, updatedAt: new Date().toISOString() };
      await repository.save(updated);
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
    }

    return {
    tasks,
    loading,
    error,
    async addDrafts(drafts) {
      const created = drafts.map((draft) => materializeTask(draft));
      await repository.saveMany(created);
      setTasks((current) => [...current, ...created]);
    },
    async updateTask(task) {
      await persistUpdate(task);
    },
    async completeTask(id) {
      const task = tasks.find((item) => item.id === id);
      if (!task) return;
      const now = new Date().toISOString();
      await persistUpdate({ ...task, status: "completed", completedAt: now });
    },
    async restoreTask(id) {
      const task = tasks.find((item) => item.id === id);
      if (!task) return;
      await persistUpdate({ ...task, status: "active", completedAt: null });
    },
    async deleteTask(id) {
      await repository.remove(id);
      setTasks((current) => current.filter((task) => task.id !== id));
    },
    };
  }, [repository, tasks, loading, error]);

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks(): TaskContextValue {
  const value = useContext(TaskContext);
  if (!value) throw new Error("useTasks must be used inside TaskProvider");
  return value;
}
```

Wrap the future shell in `src/app/page.tsx`:

```tsx
import { TaskProvider } from "@/features/tasks/application/TaskProvider";

export default function HomePage() {
  return <TaskProvider><main className="mobile-shell"><h1>Що в голові?</h1></main></TaskProvider>;
}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm test -- src/features/tasks/application/TaskProvider.test.tsx && pnpm typecheck`

Expected: the provider test passes and TypeScript exits 0.

Commit:

```bash
git add src/features/tasks/application src/app/page.tsx
git commit -m "feat: add local task use cases"
```

---

### Task 5: Implement the Structured Ukrainian Task Parser Route

**Files:**
- Create: `.env.example`
- Create: `src/server/openai/client.ts`
- Create: `src/server/openai/parseTasks.ts`
- Create: `src/server/openai/parseTasks.test.ts`
- Create: `src/app/api/parse/route.ts`
- Create: `src/app/api/parse/route.test.ts`

**Interfaces:**
- Consumes: `ParseResult`, `TaskDraft`.
- Produces: `parseTaskRequestSchema`, `parseTasksWithOpenAI(request)`, and `POST /api/parse`.

- [ ] **Step 1: Write parser service tests around the baseline phrase and invalid output**

Create `src/server/openai/parseTasks.test.ts` with a fake client exposing `responses.parse`:

```ts
import { describe, expect, it, vi } from "vitest";
import { parseTasksWithClient } from "./parseTasks";

it("normalizes structured Ukrainian task output", async () => {
  const parse = vi.fn().mockResolvedValue({ output_parsed: {
    tasks: [
      { title: "Купити молоко", scheduledDate: "2026-07-19", scheduledTime: null, status: "active", priority: null },
      { title: "Перевірити пошту", scheduledDate: "2026-07-20", scheduledTime: null, status: "active", priority: null },
      { title: "Оплатити рахунок", scheduledDate: null, scheduledTime: null, status: "completed", priority: null },
    ],
    clarification: null,
  }});
  const client = { responses: { parse } } as unknown as Parameters<typeof parseTasksWithClient>[0];
  const result = await parseTasksWithClient(client, {
    text: "Молоко купити сьогодні, пошту глянути завтра, а рахунок я вже оплатив",
    today: "2026-07-19",
    timeZone: "Europe/Warsaw",
    inputMethod: "text",
  });
  expect(result.tasks).toHaveLength(3);
  expect(result.tasks.every((task) => task.inputMethod === "text")).toBe(true);
});

it("fails closed when no parsed payload is returned", async () => {
  const parse = vi.fn().mockResolvedValue({ output_parsed: null });
  const client = { responses: { parse } } as unknown as Parameters<typeof parseTasksWithClient>[0];
  await expect(parseTasksWithClient(client, {
    text: "Купити молоко",
    today: "2026-07-19",
    timeZone: "Europe/Warsaw",
    inputMethod: "text",
  })).rejects.toThrow("INVALID_AI_RESPONSE");
});
```

Run: `pnpm test -- src/server/openai/parseTasks.test.ts`

Expected: FAIL because `parseTasks.ts` does not exist.

- [ ] **Step 2: Implement schemas, prompt, and the server-only client**

Create `.env.example`:

```dotenv
OPENAI_API_KEY=replace_with_server_only_key
OPENAI_TASK_MODEL=gpt-5.6-terra
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

Create `src/server/openai/client.ts`:

```ts
import "server-only";
import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const taskModel = process.env.OPENAI_TASK_MODEL ?? "gpt-5.6-terra";
export const transcribeModel = process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";
```

Create `src/server/openai/parseTasks.ts`:

```ts
import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { InputMethod, ParseResult } from "@/features/tasks/domain/task";
import { openai, taskModel } from "./client";

export const parseTaskRequestSchema = z.object({
  text: z.string().trim().min(1).max(10_000),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: z.string().min(1).max(100),
  inputMethod: z.enum(["text", "voice"]),
});

const aiResultSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().min(1).max(300),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    status: z.enum(["active", "completed"]),
    priority: z.enum(["low", "medium", "high"]).nullable(),
  })).max(50),
  clarification: z.string().max(300).nullable(),
});

type ParseRequest = z.infer<typeof parseTaskRequestSchema>;
type ParserClient = Pick<typeof openai, "responses">;

const systemPrompt = `Ти аналізуєш українські нотатки та повертаєш лише структуровані задачі.
Використовуй передану локальну дату як основу для “сьогодні” і “завтра”.
Не вигадуй дату, час, статус або пріоритет. Якщо дія справді неоднозначна, поверни одне коротке уточнення.
Розділяй кілька справ на окремі задачі. Фраза про вже зроблену справу має status=completed.`;

export async function parseTasksWithClient(client: ParserClient, request: ParseRequest): Promise<ParseResult> {
  const response = await client.responses.parse({
    model: taskModel,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Локальна дата: ${request.today}\nЧасовий пояс: ${request.timeZone}\nНотатка: ${request.text}` },
    ],
    text: { format: zodTextFormat(aiResultSchema, "noteai_task_result") },
  }, { timeout: 15_000, maxRetries: 1 });
  if (!response.output_parsed) throw new Error("INVALID_AI_RESPONSE");
  return {
    clarification: response.output_parsed.clarification,
    tasks: response.output_parsed.tasks.map((task) => ({ ...task, inputMethod: request.inputMethod as InputMethod })),
  };
}

export async function parseTasksWithOpenAI(request: ParseRequest): Promise<ParseResult> {
  return parseTasksWithClient(openai, request);
}
```

- [ ] **Step 3: Add and test the HTTP boundary**

Create `src/app/api/parse/route.ts`:

```ts
import { parseTaskRequestSchema, parseTasksWithOpenAI } from "@/server/openai/parseTasks";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseTaskRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
  try {
    return Response.json(await parseTasksWithOpenAI(parsed.data));
  } catch {
    return Response.json({ code: "AI_UNAVAILABLE" }, { status: 502 });
  }
}
```

Create `src/app/api/parse/route.test.ts`:

```ts
import { expect, it } from "vitest";
import { POST } from "./route";

it("rejects blank task input before contacting OpenAI", async () => {
  const response = await POST(new Request("http://localhost/api/parse", {
    method: "POST",
    body: JSON.stringify({ text: "", today: "2026-07-19", timeZone: "Europe/Warsaw", inputMethod: "text" }),
  }));
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({ code: "INVALID_REQUEST" });
});
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm test -- src/server/openai/parseTasks.test.ts src/app/api/parse/route.test.ts && pnpm typecheck`

Expected: parser and route tests pass; no client bundle imports `src/server/openai`.

Commit:

```bash
git add .env.example src/server/openai src/app/api/parse
git commit -m "feat: parse Ukrainian notes into task drafts"
```

---

### Task 6: Build Text Capture and Quick Preview

**Files:**
- Create: `src/features/capture/application/parseClient.ts`
- Create: `src/components/capture/CaptureScreen.tsx`
- Create: `src/components/capture/CaptureScreen.test.tsx`
- Create: `src/components/preview/QuickPreview.tsx`
- Create: `src/components/preview/QuickPreview.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `ParseResult`, `TaskDraft`, draft store, `useTasks().addDrafts`.
- Produces: `parseText(request)`, `CaptureScreen`, and `QuickPreview`.

- [ ] **Step 1: Write the capture-to-preview test**

Create `src/components/capture/CaptureScreen.test.tsx` with mocked `fetch`, a `TaskProvider`, and this assertion flow:

```tsx
import { createMemoryTaskRepository } from "../../../tests/fixtures/memoryTaskRepository";

it("shows editable preview and persists only after confirmation", async () => {
  const repository = createMemoryTaskRepository();
  const saved = repository.saved;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    tasks: [{ title: "Купити молоко", scheduledDate: null, scheduledTime: null, status: "active", priority: null, inputMethod: "text" }],
    clarification: null,
  }), { status: 200 })));
  render(<TaskProvider repository={repository}><CaptureScreen /></TaskProvider>);
  await userEvent.type(screen.getByLabelText("Ваша нотатка"), "Купити молоко");
  await userEvent.click(screen.getByRole("button", { name: "Розібрати" }));
  expect(await screen.findByDisplayValue("Купити молоко")).toBeVisible();
  expect(saved).toHaveLength(0);
  await userEvent.click(screen.getByRole("button", { name: "Додати все" }));
  expect(saved).toHaveLength(1);
});
```

Run: `pnpm test -- src/components/capture/CaptureScreen.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 2: Implement the typed client and preview contract**

Create `src/features/capture/application/parseClient.ts`:

```ts
import type { InputMethod, ParseResult } from "@/features/tasks/domain/task";

export async function parseText(input: { text: string; today: string; timeZone: string; inputMethod: InputMethod }): Promise<ParseResult> {
  const response = await fetch("/api/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("AI_UNAVAILABLE");
  return response.json() as Promise<ParseResult>;
}
```

Create `src/components/preview/QuickPreview.tsx` as a client component accepting:

```ts
type QuickPreviewProps = {
  initialTasks: TaskDraft[];
  clarification: string | null;
  onCancel(): void;
  onConfirm(tasks: TaskDraft[]): Promise<void>;
};
```

Its implementation must keep `TaskDraft[]` in local state, render one labeled title/date/time/status/priority editor per task, provide a remove button per item, display `clarification` above the cards, disable `Додати все` when no valid cards remain, and call `onConfirm(tasks)` only from that button.

- [ ] **Step 3: Implement draft-preserving CaptureScreen**

Create `src/components/capture/CaptureScreen.tsx` with these explicit states:

```ts
type CaptureState =
  | { kind: "editing" }
  | { kind: "parsing" }
  | { kind: "preview"; result: ParseResult }
  | { kind: "error"; message: string };
```

On mount, load `loadCaptureDraft()`. On each textarea change, update state and call `saveCaptureDraft(value)`. On `Розібрати`, call `parseText` with `toLocalDateKey(new Date())`, `Intl.DateTimeFormat().resolvedOptions().timeZone`, and `inputMethod: "text"`. On confirm, call `addDrafts`, clear the IndexedDB draft, clear the textarea, and return to `editing`. On error, keep the text and show `Не вдалося проаналізувати нотатку. Спробувати ще раз`.

- [ ] **Step 4: Add complete preview behavior tests**

Create `src/components/preview/QuickPreview.test.tsx` covering:

```tsx
import type { TaskDraft } from "@/features/tasks/domain/task";

const firstDraft: TaskDraft = { title: "Купити молоко", scheduledDate: null, scheduledTime: null, status: "active", priority: null, inputMethod: "text" };
const secondDraft: TaskDraft = { title: "Перевірити пошту", scheduledDate: "2026-07-20", scheduledTime: null, status: "active", priority: null, inputMethod: "text" };

it("edits and removes AI suggestions before confirmation", async () => {
  const onConfirm = vi.fn();
  render(<QuickPreview initialTasks={[firstDraft, secondDraft]} clarification={null} onCancel={vi.fn()} onConfirm={onConfirm} />);
  await userEvent.clear(screen.getAllByLabelText("Назва задачі")[0]);
  await userEvent.type(screen.getAllByLabelText("Назва задачі")[0], "Купити хліб");
  await userEvent.click(screen.getAllByRole("button", { name: "Видалити пропозицію" })[1]);
  await userEvent.click(screen.getByRole("button", { name: "Додати все" }));
  expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ title: "Купити хліб" })]);
});
```

- [ ] **Step 5: Verify and commit**

Run: `pnpm test -- src/components/capture src/components/preview && pnpm lint && pnpm typecheck`

Expected: capture and preview suites pass with no accessibility query failures.

Commit:

```bash
git add src/features/capture src/components/capture src/components/preview src/app/globals.css
git commit -m "feat: add text capture and task preview"
```

---

### Task 7: Build Capture-First Navigation, Inbox, and Seven-Day Plan

**Files:**
- Create: `src/components/app-shell/AppShell.tsx`
- Create: `src/components/app-shell/AppShell.test.tsx`
- Create: `src/components/tasks/TaskCard.tsx`
- Create: `src/components/tasks/InboxScreen.tsx`
- Create: `src/components/tasks/InboxScreen.test.tsx`
- Create: `src/components/tasks/PlanScreen.tsx`
- Create: `src/components/tasks/PlanScreen.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `CaptureScreen`, `useTasks`, `classifyTaskDate`, `isOverdue`, `addLocalDays`, and `toLocalDateKey`.
- Produces: `AppShell`, `InboxScreen`, `PlanScreen`, and shared `TaskCard`.

- [ ] **Step 1: Write navigation and routing tests**

Create `src/components/app-shell/AppShell.test.tsx`:

```tsx
import { createMemoryTaskRepository } from "../../../tests/fixtures/memoryTaskRepository";

it("opens Capture and switches between exactly three destinations", async () => {
  const repository = createMemoryTaskRepository();
  render(<TaskProvider repository={repository}><AppShell /></TaskProvider>);
  expect(screen.getByRole("heading", { name: "Що в голові?" })).toBeVisible();
  expect(screen.getAllByRole("navigation")).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: /Capture|Inbox|План/ })).toHaveLength(3);
  await userEvent.click(screen.getByRole("button", { name: "Inbox" }));
  expect(screen.getByRole("heading", { name: "Inbox" })).toBeVisible();
});
```

Create `src/components/tasks/PlanScreen.test.tsx`:

```tsx
import { makeTask } from "../../../tests/fixtures/taskFactory";

const todayTask = makeTask({ id: "today", scheduledDate: "2026-07-19" });
const tomorrowTask = makeTask({ id: "tomorrow", title: "Перевірити пошту", scheduledDate: "2026-07-20" });
const actions = { onChange: vi.fn(), onComplete: vi.fn(), onRestore: vi.fn(), onDelete: vi.fn() };

it("shows exactly today plus six days and only the selected day tasks", () => {
  render(<PlanScreen tasks={[todayTask, tomorrowTask]} today="2026-07-19" {...actions} />);
  expect(screen.getAllByRole("button", { name: /Обрати/ })).toHaveLength(7);
  expect(screen.getByText(todayTask.title)).toBeVisible();
  expect(screen.queryByText(tomorrowTask.title)).not.toBeInTheDocument();
});
```

Create `src/components/tasks/InboxScreen.test.tsx`:

```tsx
import { makeTask } from "../../../tests/fixtures/taskFactory";

const undated = makeTask({ id: "undated" });
const overdue = makeTask({ id: "overdue", title: "Прострочена", scheduledDate: "2026-07-18" });
const laterFuture = makeTask({ id: "future", title: "Майбутня", scheduledDate: "2026-07-28" });
const todayTask = makeTask({ id: "today", scheduledDate: "2026-07-19" });
const actions = { onChange: vi.fn(), onComplete: vi.fn(), onRestore: vi.fn(), onDelete: vi.fn() };

it("keeps undated, overdue, and later-future tasks in Inbox", () => {
  render(<InboxScreen tasks={[undated, overdue, laterFuture, todayTask]} today="2026-07-19" {...actions} />);
  expect(screen.getByText(undated.title)).toBeVisible();
  expect(screen.getByText(overdue.title)).toBeVisible();
  expect(screen.getByText("Прострочено")).toBeVisible();
  expect(screen.getByText(laterFuture.title)).toBeVisible();
  expect(screen.queryByText(todayTask.title)).not.toBeInTheDocument();
});
```

Run: `pnpm test -- src/components/app-shell src/components/tasks`

Expected: FAIL because these components do not exist.

- [ ] **Step 2: Implement shared TaskCard and deterministic ordering**

`TaskCard` must receive `task`, `today`, `onChange`, `onComplete`, `onRestore`, and `onDelete`. Render title, formatted date/time, explicit priority, `Прострочено` when `isOverdue`, and buttons with accessible names. Do not add drag-and-drop, projects, or tags.

Before rendering a selected Plan day, sort with:

```ts
export function comparePlanTasks(a: Task, b: Task): number {
  if (a.scheduledTime && b.scheduledTime) return a.scheduledTime.localeCompare(b.scheduledTime);
  if (a.scheduledTime) return -1;
  if (b.scheduledTime) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}
```

- [ ] **Step 3: Implement Inbox and Plan filters**

`InboxScreen` filters active tasks where `classifyTaskDate(task.scheduledDate, today) === "inbox"`. Render active tasks first and a collapsed `Виконані` section containing completed tasks. `PlanScreen` builds seven keys with `Array.from({ length: 7 }, (_, index) => addLocalDays(today, index))`, keeps `selectedDate` in state, and filters active tasks by exact `scheduledDate`.

- [ ] **Step 4: Implement AppShell and mount it**

Create `AppShell` with:

```ts
type Destination = "capture" | "inbox" | "plan";
```

Default to `capture`. Render only the active screen. The fixed bottom navigation exposes exactly the Ukrainian labels chosen in the spec. Update `src/app/page.tsx` to:

```tsx
import { AppShell } from "@/components/app-shell/AppShell";
import { TaskProvider } from "@/features/tasks/application/TaskProvider";

export default function HomePage() {
  return <TaskProvider><AppShell /></TaskProvider>;
}
```

- [ ] **Step 5: Verify and commit**

Run: `pnpm test -- src/components/app-shell src/components/tasks && pnpm lint && pnpm typecheck`

Expected: navigation, Inbox classification, seven-day strip, and selected-day tests pass.

Commit:

```bash
git add src/components/app-shell src/components/tasks src/app/page.tsx src/app/globals.css
git commit -m "feat: add Inbox and rolling seven-day Plan"
```

---

### Task 8: Add Bounded Voice Capture and Transcription

**Files:**
- Create: `src/server/openai/transcribeAudio.ts`
- Create: `src/server/openai/transcribeAudio.test.ts`
- Create: `src/app/api/transcribe/route.ts`
- Create: `src/app/api/transcribe/route.test.ts`
- Create: `src/features/capture/application/transcribeClient.ts`
- Create: `src/components/capture/VoiceRecorder.tsx`
- Create: `src/components/capture/VoiceRecorder.test.tsx`
- Modify: `src/components/capture/CaptureScreen.tsx`

**Interfaces:**
- Consumes: server `openai`, `transcribeModel`, `parseText`, and Capture draft handling.
- Produces: `transcribeAudio(file)`, `POST /api/transcribe`, `requestTranscription(blob)`, and `VoiceRecorder`.

- [ ] **Step 1: Write route bounds and permission-state tests**

Create `src/app/api/transcribe/route.test.ts`:

```ts
it("rejects missing and oversized audio before OpenAI", async () => {
  const missing = await POST(new Request("http://localhost/api/transcribe", { method: "POST", body: new FormData() }));
  expect(missing.status).toBe(400);
  const data = new FormData();
  data.set("audio", new File([new Uint8Array(10_000_001)], "note.webm", { type: "audio/webm" }));
  const oversized = await POST(new Request("http://localhost/api/transcribe", { method: "POST", body: data }));
  expect(oversized.status).toBe(413);
});
```

Create `src/components/capture/VoiceRecorder.test.tsx`:

```tsx
it("reports denied microphone permission without disabling text capture", async () => {
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")) } });
  render(<VoiceRecorder onTranscript={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));
  expect(await screen.findByText("Немає доступу до мікрофона")).toBeVisible();
});
```

- [ ] **Step 2: Implement bounded server transcription**

Create `src/server/openai/transcribeAudio.ts`:

```ts
import "server-only";
import { openai, transcribeModel } from "./client";

export async function transcribeAudio(file: File): Promise<string> {
  const result = await openai.audio.transcriptions.create({
    file,
    model: transcribeModel,
    response_format: "text",
    prompt: "Українська нотатка про повсякденні справи, дати та час.",
  }, { timeout: 30_000, maxRetries: 1 });
  return typeof result === "string" ? result : result.text;
}
```

Create `src/app/api/transcribe/route.ts`:

```ts
import { transcribeAudio } from "@/server/openai/transcribeAudio";

const MAX_AUDIO_BYTES = 10_000_000;
const allowedTypes = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a"]);

export async function POST(request: Request) {
  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File) || !allowedTypes.has(audio.type)) return Response.json({ code: "INVALID_AUDIO" }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return Response.json({ code: "AUDIO_TOO_LARGE" }, { status: 413 });
  try {
    return Response.json({ text: await transcribeAudio(audio) });
  } catch {
    return Response.json({ code: "TRANSCRIPTION_UNAVAILABLE" }, { status: 502 });
  }
}
```

- [ ] **Step 3: Implement the client and MediaRecorder lifecycle**

Create `src/features/capture/application/transcribeClient.ts`:

```ts
export async function requestTranscription(blob: Blob): Promise<string> {
  const form = new FormData();
  form.set("audio", new File([blob], "note.webm", { type: blob.type || "audio/webm" }));
  const response = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!response.ok) throw new Error("TRANSCRIPTION_UNAVAILABLE");
  return ((await response.json()) as { text: string }).text;
}
```

`VoiceRecorder` must own only `idle | requesting | recording | transcribing | denied | error`, stop automatically at 60 seconds, combine recorded chunks into one Blob, stop every media track, call `requestTranscription`, pass successful text to `onTranscript`, and release the Blob reference after completion.

- [ ] **Step 4: Connect voice to the existing text path**

Render `VoiceRecorder` inside `CaptureScreen`. `onTranscript(text)` must put the editable transcript in the same textarea and invoke the same `parseText` flow with `inputMethod: "voice"`. Do not persist raw audio or create a second parser.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test -- src/app/api/transcribe src/server/openai/transcribeAudio.test.ts src/components/capture/VoiceRecorder.test.tsx && pnpm typecheck`

Expected: invalid audio, denied permission, success, retry, timer stop, and track cleanup tests pass.

Commit:

```bash
git add src/server/openai src/app/api/transcribe src/features/capture/application/transcribeClient.ts src/components/capture
git commit -m "feat: add Ukrainian voice capture"
```

---

### Task 9: Add Persistent-Storage, Offline, and Safe Analytics Behavior

**Files:**
- Create: `src/lib/storagePersistence.ts`
- Create: `src/lib/storagePersistence.test.ts`
- Create: `src/lib/analytics.ts`
- Create: `src/components/app-shell/AppStatus.tsx`
- Create: `src/components/app-shell/AppStatus.test.tsx`
- Modify: `src/components/app-shell/AppShell.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: browser StorageManager and online/offline events.
- Produces: `requestLocalPersistence()`, `trackSafeEvent(name)`, and `AppStatus`.

- [ ] **Step 1: Write persistence and offline tests**

Create `src/lib/storagePersistence.test.ts`:

```ts
import { requestLocalPersistence } from "./storagePersistence";

it("reports granted persistent storage", async () => {
  Object.defineProperty(navigator, "storage", { configurable: true, value: {
    persisted: vi.fn().mockResolvedValue(false),
    persist: vi.fn().mockResolvedValue(true),
  }});
  await expect(requestLocalPersistence()).resolves.toBe("persistent");
});

it("falls back honestly when the API is unavailable", async () => {
  Object.defineProperty(navigator, "storage", { configurable: true, value: undefined });
  await expect(requestLocalPersistence()).resolves.toBe("best-effort");
});
```

- [ ] **Step 2: Implement storage status without false backup claims**

Create `src/lib/storagePersistence.ts`:

```ts
export type StorageMode = "persistent" | "best-effort";

export async function requestLocalPersistence(): Promise<StorageMode> {
  if (!navigator.storage?.persisted || !navigator.storage.persist) return "best-effort";
  if (await navigator.storage.persisted()) return "persistent";
  return (await navigator.storage.persist()) ? "persistent" : "best-effort";
}
```

Call it once after the first confirmed save. Never render “backed up”; render `Зберігається лише в цьому браузері` in local-storage help text.

- [ ] **Step 3: Add offline status and non-sensitive analytics**

Create `src/lib/analytics.ts`:

```ts
import { track } from "@vercel/analytics";

export type SafeEvent = "capture_confirmed" | "parse_failed" | "transcription_failed";

export function trackSafeEvent(name: SafeEvent): void {
  if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true") track(name);
}
```

Never pass note text, task titles, dates, transcripts, identifiers, or error bodies to analytics.

Create `AppStatus` as a client component that listens to `online` and `offline` window events. When offline, render `Офлайн: локальні задачі доступні, AI тимчасово не працює`. Capture disables only parse/transcribe actions; Inbox, Plan, edit, complete, restore, and delete remain enabled.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test -- src/lib src/components/app-shell/AppStatus.test.tsx && pnpm lint && pnpm typecheck`

Expected: persistence status, offline transition, and no-content analytics tests pass.

Commit:

```bash
git add src/lib src/components/app-shell src/app/layout.tsx
git commit -m "feat: harden local storage and offline behavior"
```

---

### Task 10: Add End-to-End Acceptance Coverage and Production Runbook

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/noteai-core.spec.ts`
- Create: `README.md`
- Modify: `.env.example`
- Modify: `package.json`

**Interfaces:**
- Consumes: the complete text/voice UI, API routes, and IndexedDB repository.
- Produces: repeatable local verification and Vercel release instructions.

- [ ] **Step 1: Configure Playwright for the mobile web application**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: { command: "pnpm dev", url: "http://127.0.0.1:3000", reuseExistingServer: true },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
});
```

- [ ] **Step 2: Write the full text and reload acceptance test**

Create `tests/e2e/noteai-core.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("captures multiple tasks, confirms preview, and survives reload", async ({ page }) => {
  await page.route("**/api/parse", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      tasks: [
        { title: "Купити молоко", scheduledDate: "2026-07-19", scheduledTime: null, status: "active", priority: null, inputMethod: "text" },
        { title: "Перевірити пошту", scheduledDate: "2026-07-20", scheduledTime: null, status: "active", priority: null, inputMethod: "text" },
        { title: "Оплатити рахунок", scheduledDate: null, scheduledTime: null, status: "completed", priority: null, inputMethod: "text" },
      ],
      clarification: null,
    }),
  }));
  await page.goto("/");
  await page.getByLabel("Ваша нотатка").fill("Молоко купити сьогодні, пошту глянути завтра, а рахунок я вже оплатив");
  await page.getByRole("button", { name: "Розібрати" }).click();
  await expect(page.getByText("Купити молоко")).toBeVisible();
  await page.getByRole("button", { name: "Додати все" }).click();
  await page.reload();
  await page.getByRole("button", { name: "План" }).click();
  await expect(page.getByText("Купити молоко")).toBeVisible();
});
```

Add the second test in the same file:

```ts
test("keeps local tasks usable while AI is offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const request = indexedDB.open("noteai", 1);
    await new Promise<void>((resolve, reject) => {
      request.onupgradeneeded = () => request.result.createObjectStore("tasks", { keyPath: "id" });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction("tasks", "readwrite");
        transaction.objectStore("tasks").put({
          id: "offline-task", title: "Локальна задача", scheduledDate: null, scheduledTime: null,
          status: "active", priority: null, inputMethod: "text", createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(), completedAt: null,
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Inbox" }).click();
  await expect(page.getByText("Локальна задача")).toBeVisible();
  await page.getByRole("button", { name: "Capture" }).click();
  await expect(page.getByText("Офлайн: локальні задачі доступні, AI тимчасово не працює")).toBeVisible();
});
```

- [ ] **Step 3: Write the exact development and deployment runbook**

Create `README.md` with:

```markdown
# NoteAI

Mobile-only Ukrainian AI notepad deployed on Vercel.

## Local setup

1. Install Node.js 20.9 or newer and pnpm.
2. Run `pnpm install`.
3. Copy `.env.example` to `.env.local`.
4. Add a server-only `OPENAI_API_KEY` and keep both model variables unchanged unless the current OpenAI docs require a migration.
5. Run `pnpm dev` and open `http://localhost:3000` on a mobile viewport.

## Verification

Run `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.

## Vercel

Add `OPENAI_API_KEY`, `OPENAI_TASK_MODEL`, and `OPENAI_TRANSCRIBE_MODEL` to Preview and Production environment variables. Enable Web Analytics if desired; enable content-free custom events only by setting `NEXT_PUBLIC_ENABLE_ANALYTICS=true`. Never expose note text, transcripts, task titles, dates, or API keys in analytics.

In Vercel Firewall, add per-IP rate limits of 20 requests per minute for `/api/parse` and 10 requests per minute for `/api/transcribe`. Keep the OpenAI project monthly budget and usage alert enabled; the application-level request-size and timeout limits are not a substitute for provider budget controls.

## Local-data limitation

Tasks belong to the same domain and browser profile. Clearing site data, private browsing, changing browsers, or losing the device can remove access to them. The MVP has no cloud backup.
```

- [ ] **Step 4: Run the complete release gate**

Run:

```bash
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
git grep -n "OPENAI_API_KEY" -- ':!README.md' ':!.env.example'
```

Expected:

- all unit/component/API tests pass;
- both Playwright mobile projects pass;
- lint and typecheck exit 0;
- production build succeeds;
- the grep command finds only server-side environment access and no literal secret.

- [ ] **Step 5: Verify the Vercel preview manually**

Push the implementation branch, open the Vercel preview URL, and complete this checklist on real mobile Safari and Chrome:

```text
[ ] Capture opens first
[ ] Text produces editable preview
[ ] Voice permission grant, denial, and retry are understandable
[ ] Confirmed tasks route to Inbox or one of seven dates
[ ] Tasks survive browser close and reopen
[ ] Overdue and later-future tasks remain visible in Inbox
[ ] Existing tasks work offline
[ ] No raw note, transcript, title, or secret appears in analytics/network logs
```

- [ ] **Step 6: Commit the acceptance gate and runbook**

```bash
git add playwright.config.ts tests/e2e README.md .env.example package.json pnpm-lock.yaml
git commit -m "test: add NoteAI mobile release gate"
```

---

## Plan Completion Gate

Before calling the MVP complete:

1. Confirm every task commit exists and `git status --short` contains no unexpected changes.
2. Run the full Task 10 release gate from a clean checkout.
3. Confirm the ten Ukrainian acceptance scenarios include dates inside and outside the seven-day window, completed language, explicit priority, and ambiguity.
4. Confirm OpenAI model IDs against the current official model and speech-to-text documentation.
5. Confirm Vercel environment variables are configured separately for Preview and Production.
6. Do not merge until mobile Safari and Chrome manual checks pass.

## Official References

- [Next.js installation and runtime requirements](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI speech-to-text](https://developers.openai.com/api/docs/guides/speech-to-text)
- [Vercel Web Analytics for Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel Analytics privacy guidance](https://vercel.com/docs/analytics/privacy-policy)
