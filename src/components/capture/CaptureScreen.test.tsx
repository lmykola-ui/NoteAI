import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, it, vi } from "vitest";
import { TaskProvider } from "@/features/tasks/application/TaskProvider";
import { createMemoryTaskRepository } from "../../../tests/fixtures/memoryTaskRepository";
import { CaptureScreen } from "./CaptureScreen";

const draftStoreMocks = vi.hoisted(() => ({
  clear: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/features/capture/infrastructure/draftStore", () => ({
  clearCaptureDraft: draftStoreMocks.clear,
  loadCaptureDraft: draftStoreMocks.load,
  saveCaptureDraft: draftStoreMocks.save,
}));

beforeEach(() => {
  draftStoreMocks.clear.mockReset().mockResolvedValue(undefined);
  draftStoreMocks.load.mockReset().mockResolvedValue("");
  draftStoreMocks.save.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows editable preview and persists only after confirmation", async () => {
  const repository = createMemoryTaskRepository();
  const saved = repository.saved;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tasks: [
            {
              title: "Купити молоко",
              scheduledDate: null,
              scheduledTime: null,
              status: "active",
              priority: null,
              inputMethod: "text",
            },
          ],
          clarification: null,
        }),
        { status: 200 },
      ),
    ),
  );
  render(
    <TaskProvider repository={repository}>
      <CaptureScreen />
    </TaskProvider>,
  );

  await userEvent.type(screen.getByLabelText("Ваша нотатка"), "Купити молоко");
  await userEvent.click(screen.getByRole("button", { name: "Розібрати" }));

  expect(await screen.findByDisplayValue("Купити молоко")).toBeVisible();
  expect(saved).toHaveLength(0);

  await userEvent.click(screen.getByRole("button", { name: "Додати все" }));

  expect(saved).toHaveLength(1);
});

it("waits for the latest draft write before clearing it on confirmation", async () => {
  let finishSave!: () => void;
  draftStoreMocks.save.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tasks: [
            {
              title: "Купити молоко",
              scheduledDate: null,
              scheduledTime: null,
              status: "active",
              priority: null,
              inputMethod: "text",
            },
          ],
          clarification: null,
        }),
        { status: 200 },
      ),
    ),
  );
  render(
    <TaskProvider repository={createMemoryTaskRepository()}>
      <CaptureScreen />
    </TaskProvider>,
  );

  fireEvent.change(screen.getByLabelText("Ваша нотатка"), {
    target: { value: "Купити молоко" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Розібрати" }));
  await userEvent.click(screen.getByRole("button", { name: "Додати все" }));

  expect(draftStoreMocks.clear).not.toHaveBeenCalled();

  finishSave();

  await waitFor(() => expect(draftStoreMocks.clear).toHaveBeenCalledOnce());
});
