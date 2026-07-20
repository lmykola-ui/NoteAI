import { Children, type ReactElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AnalyticsInitializer } from "@/components/app-shell/AnalyticsInitializer";
import { OfflineInitializer } from "@/components/app-shell/OfflineInitializer";
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
  expect(bodyChildren).toHaveLength(3);
  expect(bodyChildren[1].type).toBe(OfflineInitializer);
  expect(bodyChildren[2].type).toBe(AnalyticsInitializer);
});
