import { expect, test } from "@playwright/test";
import { admin, agentToken, browserJson, login } from "../helpers";

test("api routes enforce auth and controlled edge errors", async ({
  browser,
  page,
  request,
}) => {
  const suffix = Date.now().toString(36);
  const scheduleName = `api schedule ${suffix}`;
  const username = `api-user-${suffix}`;
  const password = "api-password";

  for (const { method, url } of [
    { method: "GET", url: "/api/gate" },
    { method: "GET", url: "/api/gate?history=true" },
    { method: "POST", url: "/api/gate" },
    { method: "GET", url: "/api/schedules" },
    { method: "GET", url: "/api/schedules/upcoming" },
    { method: "POST", url: "/api/schedules" },
    { method: "POST", url: "/api/schedules/draft" },
    { method: "GET", url: "/api/users" },
  ]) {
    const response =
      method === "GET"
        ? await request.get(url)
        : await request.post(url, { data: { action: "open" } });
    expect(response.status(), `${method} ${url}`).toBe(401);
  }

  await expect((await request.post("/api/gate/take_status")).status()).toBe(401);
  await expect(
    (
      await request.post("/api/gate/take_status", {
        headers: { Authorization: "Bearer wrong" },
      })
    ).status()
  ).toBe(401);

  const agentStatus = await request.post("/api/gate/take_status", {
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  await expect(agentStatus).toBeOK();
  const agentStatusBody = await agentStatus.json();
  expect(["closed", "open"]).toContain(agentStatusBody.status);
  expect(agentStatusBody.lastContactTimestamp).toBeGreaterThan(0);

  await login(page, admin.username, admin.password);

  expect(
    await browserJson(page, "/api/schedules", {
      body: {
        action: "open",
        cron_expression: "0 6 * * *",
        enabled: true,
        name: scheduleName,
      },
      method: "POST",
    })
  ).toEqual({
    status: 200,
    body: {
      action: "open",
      created_by: admin.username,
      cron_expression: "0 6 * * *",
      enabled: true,
      name: scheduleName,
    },
  });
  expect(
    await browserJson(page, "/api/schedules", {
      body: {
        action: "open",
        cron_expression: "0 6 * * *",
        enabled: true,
        name: scheduleName,
      },
      method: "POST",
    })
  ).toEqual({
    status: 400,
    body: { error: `Schedule already exists: ${scheduleName}` },
  });
  expect(
    await browserJson(page, "/api/schedules", {
      body: {
        action: "open",
        cron_expression: "not cron",
        enabled: true,
        name: `bad-cron-${suffix}`,
      },
      method: "POST",
    })
  ).toEqual({
    status: 400,
    body: { error: "Invalid cron expression" },
  });
  expect(
    await browserJson(page, "/api/schedules", {
      body: {
        action: "raise",
        cron_expression: "0 6 * * *",
        enabled: true,
        name: `bad-action-${suffix}`,
      },
      method: "POST",
    })
  ).toEqual({
    status: 400,
    body: { error: "Invalid action" },
  });
  expect(
    await browserJson(page, `/api/schedules?name=missing-${suffix}`, {
      body: { enabled: false },
      method: "PUT",
    })
  ).toEqual({
    status: 400,
    body: { error: `Schedule not found: missing-${suffix}` },
  });
  expect(
    await browserJson(page, `/api/schedules?name=missing-${suffix}`, {
      method: "DELETE",
    })
  ).toEqual({
    status: 400,
    body: { error: `Schedule not found: missing-${suffix}` },
  });
  expect(
    await browserJson(page, "/api/gate", {
      body: { action: "raise" },
      method: "POST",
    })
  ).toEqual({
    status: 400,
    body: { error: "Invalid action" },
  });
  if (!process.env.E2E_OPENAI_API_KEY) {
    expect(
      await browserJson(page, "/api/schedules/draft", {
        body: { prompt: "Open weekdays at 8 AM" },
        method: "POST",
      })
    ).toEqual({
      status: 503,
      body: { error: "AI schedule drafting is not configured. Set OPENAI_API_KEY." },
    });
  }

  expect(
    await browserJson(page, "/api/users", {
      body: { password, role: "user", username },
      method: "POST",
    })
  ).toMatchObject({
    status: 200,
    body: { created_by: admin.username, role: "user", username },
  });
  expect(
    await browserJson(page, "/api/users", {
      body: { password, role: "user", username },
      method: "POST",
    })
  ).toEqual({
    status: 400,
    body: { error: `User already exists: ${username}` },
  });
  expect(
    await browserJson(page, "/api/users", {
      body: { password, role: "owner", username: `bad-role-${suffix}` },
      method: "POST",
    })
  ).toEqual({
    status: 400,
    body: { error: "Invalid role" },
  });
  expect(
    await browserJson(page, "/api/users", {
      body: { role: "user", username: `missing-${suffix}` },
      method: "PUT",
    })
  ).toEqual({
    status: 400,
    body: { error: `User not found: missing-${suffix}` },
  });
  expect(
    await browserJson(page, `/api/users?username=missing-${suffix}`, {
      method: "DELETE",
    })
  ).toEqual({
    status: 400,
    body: { error: `User not found: missing-${suffix}` },
  });

  const userContext = await browser.newContext();
  const userPage = await userContext.newPage();
  await login(userPage, username, password);

  await expect(userPage.getByRole("heading", { name: "Diagnostics" })).toHaveCount(0);
  await expect(userPage.getByRole("heading", { name: "User Management" })).toHaveCount(0);
  expect(await browserJson(userPage, "/api/users")).toEqual({
    status: 403,
    body: { error: "Forbidden" },
  });
  const userSchedules = await browserJson(userPage, "/api/schedules");
  expect(userSchedules.status).toBe(200);
  expect(userSchedules.body).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: scheduleName })])
  );
  expect(
    await browserJson(userPage, "/api/gate", {
      body: { action: "close" },
      method: "POST",
    })
  ).toMatchObject({
    status: 200,
    body: { status: "close" },
  });
  await userContext.close();

  expect(
    await browserJson(page, `/api/users?username=${encodeURIComponent(username)}`, {
      method: "DELETE",
    })
  ).toEqual({ status: 204, body: null });
  expect(
    await browserJson(page, `/api/schedules?name=${encodeURIComponent(scheduleName)}`, {
      method: "DELETE",
    })
  ).toEqual({ status: 204, body: null });
});
