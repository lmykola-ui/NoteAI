import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TaskProvider } from "@/features/tasks/application/TaskProvider";
import { createMemoryTaskRepository } from "../../../tests/fixtures/memoryTaskRepository";
import { AppShell } from "./AppShell";

const firstRender = vi.hoisted(() => ({ aiAvailable: [] as boolean[] }));

vi.mock("@/components/capture/CaptureScreen", () => ({
  CaptureScreen: ({ aiAvailable }: { aiAvailable?: boolean }) => {
    firstRender.aiAvailable.push(aiAvailable ?? true);
    return <section aria-label="Створення нотатки" />;
  },
}));

beforeEach(() => {
  firstRender.aiAvailable = [];
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("never enables AI on the first render of a cold offline load", () => {
  render(
    <TaskProvider repository={createMemoryTaskRepository()}>
      <AppShell />
    </TaskProvider>,
  );

  expect(firstRender.aiAvailable[0]).toBe(false);
});
