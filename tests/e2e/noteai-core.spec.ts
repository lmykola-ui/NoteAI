import { expect, test } from "@playwright/test";

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
  await expect(page.getByLabel("Статус").nth(2)).toHaveValue("completed");
  await expect(page.getByLabel("Пріоритет").nth(3)).toHaveValue("high");
  await page.getByRole("button", { name: "Додати все" }).click();

  await expect(page.getByRole("heading", { name: "Що в голові?" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "План" }).click();
  await expect(page.getByRole("heading", { name: "Купити молоко" })).toBeVisible();

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

test("keeps local tasks usable while AI is offline", async ({ page, context }) => {
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

  await page.reload();
  await page.getByRole("button", { name: "Inbox" }).click();
  const localTask = page.getByRole("article", { name: "Локальна задача" });
  await expect(localTask).toBeVisible();

  await context.setOffline(true);
  await expect(
    page.getByText("Офлайн: локальні задачі доступні, AI тимчасово не працює"),
  ).toBeVisible();
  await localTask.getByRole("button", { name: "Позначити виконаною" }).click();
  await expect(page.getByText("Виконані")).toBeVisible();
  await page.getByText("Виконані").click();
  await expect(page.getByRole("article", { name: "Локальна задача" })).toContainText(
    "Виконано",
  );
});
