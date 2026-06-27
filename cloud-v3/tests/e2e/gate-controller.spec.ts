import { expect, test, type Page } from "@playwright/test";

const admin = { username: "admin", password: "password" };
const agentToken = process.env.AGENT_TOKEN ?? "e2e-agent-token";

async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function browserJson(
  page: Page,
  url: string,
  options: { method?: string } = {}
): Promise<{ status: number; body: unknown }> {
  return page.evaluate(
    async ({ requestUrl, method }) => {
      const response = await fetch(requestUrl, { method });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // 204 responses have no body.
      }
      return { status: response.status, body };
    },
    { requestUrl: url, method: options.method ?? "GET" }
  );
}

test("gate controller works end-to-end", async ({ browser, page, request }) => {
  await expect((await request.get("/api/gate")).status()).toBe(401);
  await expect((await request.get("/api/schedules/upcoming")).status()).toBe(401);
  await expect((await request.get("/api/users")).status()).toBe(401);
  await expect((await request.post("/api/gate/take_status")).status()).toBe(401);

  const initialAgentStatus = await request.post("/api/gate/take_status", {
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  await expect(initialAgentStatus).toBeOK();
  expect(await initialAgentStatus.json()).toMatchObject({ status: "closed" });

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await login(page, admin.username, admin.password);

  await expect(page.getByRole("heading", { name: "Gate Controller" })).toBeVisible();
  await expect(page.getByText("CLOSED")).toBeVisible();

  await page.getByRole("button", { name: "Open Gate" }).click();
  await expect(page.getByText("OPEN")).toBeVisible();

  const openedAgentStatus = await request.post("/api/gate/take_status", {
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  await expect(openedAgentStatus).toBeOK();
  const openedStatus = await openedAgentStatus.json();
  expect(openedStatus.status).toBe("open");
  expect(openedStatus.lastContactTimestamp).toBeGreaterThan(0);

  const scheduleName = "e2e weekday open";
  await page.getByRole("button", { name: "Add Schedule" }).click();
  await page.getByLabel("Name").fill(scheduleName);
  await page.getByLabel("Cron Expression").fill("0 8 * * 1-5");
  await page.getByLabel("Action").selectOption("open");
  await page.getByRole("button", { name: "Create Schedule" }).click();
  await expect(page.getByRole("cell", { name: scheduleName })).toBeVisible();

  await expect
    .poll(async () => {
      const response = await browserJson(page, "/api/schedules/upcoming");
      expect(response.status).toBe(200);
      const upcoming = response.body as Array<{ schedule: { name: string } }>;
      return upcoming.some((entry) => entry.schedule.name === scheduleName);
    })
    .toBe(true);

  const username = "e2e-user";
  const password = "user-password";
  await page.getByRole("button", { name: "Add User" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Role").selectOption("user");
  await page.getByRole("button", { name: "Create User" }).click();
  await expect(page.getByRole("cell", { name: username })).toBeVisible();

  const userContext = await browser.newContext();
  const userPage = await userContext.newPage();
  await login(userPage, username, password);
  await expect(userPage.getByRole("heading", { name: "User Management" })).toHaveCount(0);
  await expect((await browserJson(userPage, "/api/users")).status).toBe(403);
  await userContext.close();

  expect(await browserJson(page, "/api/users?username=admin", { method: "DELETE" })).toEqual({
    status: 400,
    body: { error: "Cannot delete the last admin user" },
  });

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("row", { name: new RegExp(username) })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByRole("cell", { name: username })).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("row", { name: new RegExp(scheduleName) })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByRole("cell", { name: scheduleName })).toHaveCount(0);
});
