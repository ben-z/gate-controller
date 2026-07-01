import { expect, type Page } from "@playwright/test";

export const admin = { username: "admin", password: "password" };
export const agentToken = process.env.AGENT_TOKEN ?? "e2e-agent-token";

export async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function browserJson(
  page: Page,
  url: string,
  options: { body?: unknown; method?: string } = {}
): Promise<{ status: number; body: unknown }> {
  return page.evaluate(
    async ({ requestUrl, body, method }) => {
      const response = await fetch(requestUrl, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        method,
      });
      let responseBody: unknown = null;
      try {
        responseBody = await response.json();
      } catch {
        // 204 responses have no body.
      }
      return { status: response.status, body: responseBody };
    },
    { requestUrl: url, body: options.body, method: options.method ?? "GET" }
  );
}

export async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    )
    .toBe(true);
}
