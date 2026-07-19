import { expect, test, type Page } from "@playwright/test";

type ParseRequest = {
  text: string;
  today: string;
};

function addDays(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function reloadOffline(page: Page, browserName: string): Promise<void> {
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
  } catch (error) {
    const isKnownWebKitOfflineReloadSignal =
      browserName === "webkit" &&
      error instanceof Error &&
      error.message.includes("WebKit encountered an internal error");

    if (!isKnownWebKitOfflineReloadSignal) throw error;
  }
}

test("captures multiple domain-rich tasks, confirms preview, and survives reload", async ({
  page,
}) => {
  await page.route("**/api/parse", async (route) => {
    const request = route.request().postDataJSON() as ParseRequest;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tasks: [
          {
            title: "Купити молоко",
            scheduledDate: request.today,
            scheduledTime: null,
            status: "active",
            priority: null,
            inputMethod: "text",
          },
          {
            title: "Перевірити пошту",
            scheduledDate: addDays(request.today, 1),
            scheduledTime: "09:30",
            status: "active",
            priority: null,
            inputMethod: "text",
          },
          {
            title: "Оплатити рахунок",
            scheduledDate: null,
            scheduledTime: null,
            status: "completed",
            priority: null,
            inputMethod: "text",
          },
          {
            title: "Продовжити домен",
            scheduledDate: addDays(request.today, 8),
            scheduledTime: null,
            status: "active",
            priority: "high",
            inputMethod: "text",
          },
        ],
        clarification: null,
      }),
    });
  });

  await page.goto("/");
  await page
    .getByLabel("Ваша нотатка")
    .fill(
      "Молоко купити сьогодні, пошту глянути завтра, рахунок я вже оплатив, а домен продовжити через вісім днів — високий пріоритет",
    );
  await page.getByRole("button", { name: "Розібрати" }).click();

  await expect(page.getByLabel("Назва задачі").first()).toHaveValue(
    "Купити молоко",
  );
  await expect(page.getByLabel("Назва задачі").nth(1)).toHaveValue(
    "Перевірити пошту",
  );
  await expect(page.getByLabel("Дата").nth(1)).toHaveValue(
    addDays((await page.getByLabel("Дата").first().inputValue()), 1),
  );
  await expect(page.getByLabel("Час").nth(1)).toHaveValue("09:30");
  await expect(page.getByLabel("Статус").nth(2)).toHaveValue("completed");
  await expect(page.getByLabel("Пріоритет").nth(3)).toHaveValue("high");
  await page.getByRole("button", { name: "Додати все" }).click();

  await expect(page.getByRole("heading", { name: "Що в голові?" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "План" }).click();
  await expect(page.getByRole("heading", { name: "Купити молоко" })).toBeVisible();
  await page.getByRole("button", { name: /^Обрати / }).nth(1).click();
  const tomorrowTask = page.getByRole("article", { name: "Перевірити пошту" });
  await expect(tomorrowTask).toBeVisible();
  await expect(tomorrowTask).toContainText("09:30");

  await page.getByRole("button", { name: "Inbox" }).click();
  const futureTask = page.getByRole("article", { name: "Продовжити домен" });
  await expect(futureTask).toBeVisible();
  await expect(futureTask).toContainText("Пріоритет: Високий");
  await page.getByText("Виконані").click();
  await expect(page.getByRole("heading", { name: "Оплатити рахунок" })).toBeVisible();
});

test("shows an ambiguity clarification without inventing tasks", async ({ page }) => {
  await page.route("**/api/parse", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tasks: [],
        clarification: "Коли саме запланувати зустріч?",
      }),
    }),
  );

  await page.goto("/");
  await page.getByLabel("Ваша нотатка").fill("Заплануй зустріч якось потім");
  await page.getByRole("button", { name: "Розібрати" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "Коли саме запланувати зустріч?",
  );
  await expect(page.getByRole("button", { name: "Додати все" })).toBeDisabled();
  await expect(page.locator(".preview-card")).toHaveCount(0);
});

test("transcribes voice into editable text and parses only after explicit confirmation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const track = { stop() {} };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [track] }),
      },
    });

    class BrowserMockMediaRecorder {
      state: RecordingState = "inactive";
      mimeType = "audio/webm;codecs=opus";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onstop: ((event: Event) => void) | null = null;

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["mock voice"], { type: this.mimeType }),
        } as BlobEvent);
        this.onstop?.(new Event("stop"));
      }
    }

    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: BrowserMockMediaRecorder,
    });
  });

  let parseRequests = 0;
  await page.route("**/api/transcribe", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: "Купити молоко сьогодні" }),
    }),
  );
  await page.route("**/api/parse", async (route) => {
    parseRequests += 1;
    const request = route.request().postDataJSON() as ParseRequest & {
      inputMethod: string;
    };
    expect(request).toMatchObject({
      text: "Купити молоко сьогодні і хліб",
      inputMethod: "voice",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tasks: [
          {
            title: "Купити молоко і хліб",
            scheduledDate: request.today,
            scheduledTime: null,
            status: "active",
            priority: null,
            inputMethod: "voice",
          },
        ],
        clarification: null,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Почати запис" }).click();
  await page.getByRole("button", { name: "Зупинити запис" }).click();
  const note = page.getByLabel("Ваша нотатка");
  await expect(note).toHaveValue("Купити молоко сьогодні");
  expect(parseRequests).toBe(0);

  await note.fill("Купити молоко сьогодні і хліб");
  await page.getByRole("button", { name: "Розібрати" }).click();

  await expect(page.getByLabel("Назва задачі")).toHaveValue(
    "Купити молоко і хліб",
  );
  expect(parseRequests).toBe(1);
});

test("keeps local tasks usable while AI is offline", async ({
  page,
  context,
  browserName,
}) => {
  await page.route("**/api/parse", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tasks: [
          {
            title: "Локальна задача",
            scheduledDate: null,
            scheduledTime: null,
            status: "active",
            priority: null,
            inputMethod: "text",
          },
        ],
        clarification: null,
      }),
    }),
  );

  await page.goto("/");
  await page.getByLabel("Ваша нотатка").fill("Локальна задача");
  await page.getByRole("button", { name: "Розібрати" }).click();
  await expect(page.getByLabel("Назва задачі")).toHaveValue("Локальна задача");
  await page.getByRole("button", { name: "Додати все" }).click();
  await expect(page.getByRole("heading", { name: "Що в голові?" })).toBeVisible();

  const supportsOfflineReload = await page.evaluate(
    () => "serviceWorker" in navigator && "caches" in window,
  );
  expect(
    supportsOfflineReload,
    "The mandated mobile E2E projects must support ServiceWorker and CacheStorage",
  ).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-offline-ready", "true");

  await context.setOffline(true);
  await reloadOffline(page, browserName);
  await expect(
    page.getByText("Офлайн: локальні задачі доступні, AI тимчасово не працює"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Inbox" }).click();
  const localTask = page.getByRole("article", { name: "Локальна задача" });
  await expect(localTask).toBeVisible();
  await localTask.getByRole("button", { name: "Позначити виконаною" }).click();
  const completedBeforeReload = page.locator("details.completed-tasks");
  await expect(completedBeforeReload).toBeVisible();
  await completedBeforeReload.locator("summary").click();
  await expect(completedBeforeReload).toHaveAttribute("open", "");
  await expect(page.getByRole("article", { name: "Локальна задача" })).toContainText(
    "Виконано",
  );

  await reloadOffline(page, browserName);
  await expect(
    page.getByText("Офлайн: локальні задачі доступні, AI тимчасово не працює"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Inbox" }).click();
  const completedAfterReload = page.locator("details.completed-tasks");
  await expect(completedAfterReload).toBeVisible();
  await completedAfterReload.evaluate(
    (details: HTMLDetailsElement) => {
      details.open = true;
    },
  );
  await expect(completedAfterReload).toHaveAttribute("open", "");
  await expect(page.getByRole("article", { name: "Локальна задача" })).toContainText(
    "Виконано",
  );
});
