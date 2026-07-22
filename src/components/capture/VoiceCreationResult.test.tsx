import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { makeTask } from "../../../tests/fixtures/taskFactory";
import { VoiceCreationResult } from "./VoiceCreationResult";

it("labels every created task as Inbox and shows its scheduled placement", () => {
  const todayTask = makeTask({
    id: "today-task",
    title: "Надіслати бриф",
    scheduledDate: "2026-07-22",
    priority: "high",
  });
  const upcomingTask = makeTask({
    id: "upcoming-task",
    title: "Купити корм",
    scheduledDate: "2026-07-28",
  });

  render(
    <VoiceCreationResult
      tasks={[todayTask, upcomingTask]}
      today="2026-07-22"
    />,
  );

  expect(
    screen.getByRole("status", { name: "Створено 2 задачі" }),
  ).toBeInTheDocument();
  expect(screen.getAllByText("Вхідні")).toHaveLength(2);
  expect(screen.getByText("Сьогодні")).toBeInTheDocument();
  expect(screen.getByText("Заплановані")).toBeInTheDocument();
  expect(screen.getByText("Високий пріоритет")).toBeInTheDocument();
});
