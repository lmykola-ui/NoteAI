import { Children, type ReactElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import RootLayout from "./layout";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("does not mount automatic page-view analytics when custom events are enabled", () => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_ANALYTICS", "true");

  const html = RootLayout({ children: <main>Приватна нотатка</main> }) as ReactElement<{
    children: ReactElement<{ children: ReactNode }>;
  }>;
  const body = html.props.children;

  expect(Children.toArray(body.props.children)).toHaveLength(1);
});
