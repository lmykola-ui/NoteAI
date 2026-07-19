import { Children, type ReactElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AnalyticsInitializer } from "@/components/app-shell/AnalyticsInitializer";
import RootLayout from "./layout";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("mounts only the safe custom-event analytics initializer", () => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_ANALYTICS", "true");

  const html = RootLayout({ children: <main>Приватна нотатка</main> }) as ReactElement<{
    children: ReactElement<{ children: ReactNode }>;
  }>;
  const body = html.props.children;

  const bodyChildren = Children.toArray(body.props.children) as ReactElement[];
  expect(bodyChildren).toHaveLength(2);
  expect(bodyChildren[1].type).toBe(AnalyticsInitializer);
});
