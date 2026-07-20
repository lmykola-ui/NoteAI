import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AppStatus } from "./AppStatus";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows an offline message after the browser goes offline", async () => {
  vi.stubGlobal("navigator", { onLine: true });
  render(<AppStatus />);

  expect(screen.queryByRole("status")).not.toBeInTheDocument();

  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  await act(async () => window.dispatchEvent(new Event("offline")));

  expect(screen.getByRole("status")).toHaveTextContent(
    "Офлайн: локальні задачі доступні, AI тимчасово не працює",
  );
});

it("notifies the shell when connectivity changes", async () => {
  vi.stubGlobal("navigator", { onLine: false });
  const onOnlineChange = vi.fn();
  render(<AppStatus onOnlineChange={onOnlineChange} />);

  expect(onOnlineChange).toHaveBeenLastCalledWith(false);

  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  await act(async () => window.dispatchEvent(new Event("online")));

  expect(onOnlineChange).toHaveBeenLastCalledWith(true);
});
