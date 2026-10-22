import { expect, test, type Page, type Route } from '@playwright/test';
import {
  admin,
  agentToken,
  browserJson,
  expectNoHorizontalOverflow,
  login,
} from '../helpers';

async function openView(
  page: Page,
  name: 'Overview' | 'Schedules' | 'Access' | 'System',
) {
  const link = page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name, exact: true });
  await link.click();
  await expect(link).toHaveAttribute('aria-current', 'page');
}

function savedSchedule(page: Page, name: string) {
  return page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
}

test('gate controller works end-to-end', async ({ browser, page, request }) => {
  await expect((await request.get('/api/gate')).status()).toBe(401);
  await expect((await request.get('/api/schedules/upcoming')).status()).toBe(
    401,
  );
  await expect((await request.get('/api/users')).status()).toBe(401);
  await expect((await request.post('/api/gate/take_status')).status()).toBe(
    401,
  );

  const initialAgentStatus = await request.post('/api/gate/take_status', {
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  await expect(initialAgentStatus).toBeOK();
  expect(await initialAgentStatus.json()).toMatchObject({ status: 'closed' });

  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await login(page, admin.username, admin.password);
  await expect(
    page.getByRole('link', { name: 'Gate Controller home' }),
  ).toBeVisible();

  await openView(page, 'System');
  await expect(
    page.getByRole('heading', { name: 'Diagnostics', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Controller timezone')).toBeVisible();
  await expect(page.getByText('Agent auth')).toBeVisible();
  await openView(page, 'Overview');
  await expect(page.locator('.gate-state')).toContainText('Closed');

  await page.getByRole('button', { name: 'Open Gate', exact: true }).click();
  await expect(page.locator('.gate-state')).toContainText('Open');
  await expect(page.getByRole('status')).toContainText('Open command saved');

  const openedAgentStatus = await request.post('/api/gate/take_status', {
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  await expect(openedAgentStatus).toBeOK();
  const openedStatus = await openedAgentStatus.json();
  expect(openedStatus.status).toBe('open');
  expect(openedStatus.lastContactTimestamp).toBeGreaterThan(0);

  const scheduleName = 'e2e weekday open';
  await openView(page, 'Schedules');
  await page.getByRole('button', { name: 'Add Schedule' }).click();
  await page.getByLabel('Name', { exact: true }).fill(scheduleName);
  await page.getByLabel('Cron Expression').fill('0 8 * * 1-5');
  await page.getByLabel('Action', { exact: true }).selectOption('open');
  await page.getByRole('button', { name: 'Create Schedule' }).click();
  const schedule = savedSchedule(page, scheduleName);
  await expect(schedule).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(schedule).toContainText('Open gate');
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 1280, height: 720 });

  await expect
    .poll(async () => {
      const response = await browserJson(page, '/api/schedules/upcoming');
      expect(response.status).toBe(200);
      return (response.body as Array<{ schedule: { name: string } }>).some(
        (entry) => entry.schedule.name === scheduleName,
      );
    })
    .toBe(true);

  const enabled = schedule.getByRole('switch', {
    name: `Enable ${scheduleName}`,
  });
  await enabled.click();
  await expect(enabled).toHaveAttribute('aria-checked', 'false');
  await expect
    .poll(async () => {
      const response = await browserJson(page, '/api/schedules/upcoming');
      return (response.body as Array<{ schedule: { name: string } }>).some(
        (entry) => entry.schedule.name === scheduleName,
      );
    })
    .toBe(false);

  await schedule
    .getByRole('button', { name: `Edit ${scheduleName}`, exact: true })
    .click();
  await expect(page.getByLabel('Name', { exact: true })).toBeDisabled();
  await page.getByLabel('Cron Expression').fill('0 9 * * 1-5');
  await page.getByRole('button', { name: 'Update Schedule' }).click();
  await expect(schedule).toContainText('09:00 AM');
  await expect(enabled).toHaveAttribute('aria-checked', 'false');
  await enabled.click();
  await expect(enabled).toHaveAttribute('aria-checked', 'true');

  const username = 'e2e-user';
  const password = 'user-password';
  await openView(page, 'Access');
  await page.getByRole('button', { name: 'Add User' }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Role', { exact: true }).selectOption('user');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(
    page
      .getByRole('list', { name: 'Users' })
      .getByText(username, { exact: true }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: `Edit ${username}`, exact: true })
    .click();
  await expect(page.getByLabel('Username', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Update User' }).click();
  await expect(page.getByRole('status')).toContainText(`${username} updated`);

  const userContext = await browser.newContext();
  const userPage = await userContext.newPage();
  await login(userPage, username, password);
  await expect(
    userPage.getByRole('link', { name: 'Access', exact: true }),
  ).toHaveCount(0);
  await expect(
    userPage.getByRole('link', { name: 'System', exact: true }),
  ).toHaveCount(0);
  await expect((await browserJson(userPage, '/api/users')).status).toBe(403);
  await userPage.goto('/dashboard?view=access');
  await expect(
    userPage.getByRole('heading', { name: 'User Management' }),
  ).toHaveCount(0);
  await expect(
    userPage.getByRole('heading', { name: 'Diagnostics' }),
  ).toHaveCount(0);
  await expect(
    userPage.getByRole('heading', { name: 'Main gate' }),
  ).toBeVisible();
  await userContext.close();

  expect(
    await browserJson(page, '/api/users?username=admin', { method: 'DELETE' }),
  ).toEqual({
    status: 400,
    body: { error: 'Cannot delete the last admin user' },
  });

  await page
    .getByRole('button', { name: `Delete ${username}`, exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page
      .getByRole('list', { name: 'Users' })
      .getByText(username, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: `Delete ${username}`, exact: true })
    .click();
  await page.getByRole('button', { name: 'Delete user', exact: true }).click();
  await expect(
    page
      .getByRole('list', { name: 'Users' })
      .getByText(username, { exact: true }),
  ).toHaveCount(0);

  await openView(page, 'Schedules');
  page.once('dialog', (dialog) => dialog.accept());
  await savedSchedule(page, scheduleName)
    .getByRole('button', { name: `Delete ${scheduleName}`, exact: true })
    .click();
  await expect(savedSchedule(page, scheduleName)).toHaveCount(0);
});

test('sign-in errors allow another attempt and sign-out ends the session', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/login');
  await expectNoHorizontalOverflow(page);
  await page.getByLabel('Username', { exact: true }).fill(admin.username);
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Invalid username or password',
  );
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Username', { exact: true }).fill(admin.username);
  await page.getByLabel('Password', { exact: true }).fill(admin.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard?view=schedules');
  await expect(page).toHaveURL(/\/login$/);
});

test('views support browser history, direct links, and narrow screens', async ({
  page,
}) => {
  await login(page, admin.username, admin.password);
  await openView(page, 'Schedules');
  await expect(page).toHaveURL(/\/dashboard\?view=schedules$/);
  await openView(page, 'Access');
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard\?view=schedules$/);
  await expect(page.getByLabel('Describe schedule')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Describe schedule')).toBeVisible();

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      for (const view of [
        'Overview',
        'Schedules',
        'Access',
        'System',
      ] as const) {
        await openView(page, view);
        await expectNoHorizontalOverflow(page);
        if (view === 'Schedules') {
          await page.getByRole('button', { name: 'Add Schedule' }).click();
          await expect(page.getByLabel('Cron Expression')).toBeVisible();
          await expectNoHorizontalOverflow(page);
          await page
            .getByRole('button', { name: 'Cancel', exact: true })
            .click();
        }
        if (view === 'Access') {
          await page.getByRole('button', { name: 'Add User' }).click();
          await expect(
            page.getByLabel('Username', { exact: true }),
          ).toBeVisible();
          await expectNoHorizontalOverflow(page);
          await page
            .getByRole('button', { name: 'Cancel', exact: true })
            .click();
        }
      }
    }
  }
});

test('a rejected gate command shows an error and preserves the requested state', async ({
  page,
}) => {
  await login(page, admin.username, admin.password);
  const before = await browserJson(page, '/api/gate');
  expect(before.status).toBe(200);
  const { status } = before.body as { status: 'open' | 'closed' };
  const action = status === 'open' ? 'Close' : 'Open';
  let releaseFailure!: () => void;
  const failureReady = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  await page.route('**/api/gate', async (route) => {
    await failureReady;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Gate service unavailable' }),
    });
  });
  await page
    .getByRole('button', { name: `${action} Gate`, exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Saving command…', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', {
      name: `${action === 'Open' ? 'Close' : 'Open'} Gate`,
      exact: true,
    }),
  ).toBeDisabled();
  releaseFailure();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    /failed|unavailable/i,
  );
  await expect(page.locator('.gate-state')).toContainText(
    status === 'open' ? 'Open' : 'Closed',
  );
  await expect(
    page.getByRole('button', { name: `${action} Gate`, exact: true }),
  ).toBeEnabled();
  await page.unroute('**/api/gate');
  expect((await browserJson(page, '/api/gate')).body).toMatchObject({ status });
});

test('agent sync becomes stale when polling returns an unchanged timestamp', async ({
  page,
}) => {
  await login(page, admin.username, admin.password);
  const now = new Date('2026-10-22T12:00:00.000Z');
  await page.clock.install({ time: now });
  await page.route(
    (url) =>
      url.pathname === '/api/gate' &&
      url.searchParams.get('history') === 'true',
    (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'closed',
          lastContactTimestamp: now.getTime(),
          history: [],
        }),
      }),
  );
  await page.goto('/dashboard');
  await expect(
    page.getByText('Recent agent sync', { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(60_001);
  await expect(
    page.getByText('Awaiting agent sync', { exact: true }),
  ).toBeVisible();
});

test('draft review preserves unapplied schedules after a save error', async ({
  page,
}) => {
  await login(page, admin.username, admin.password);
  await openView(page, 'Schedules');
  const name = 'e2e reviewed draft';
  const gateBefore = await browserJson(page, '/api/gate');
  const draft = {
    name,
    cron_expression: '0 7 * * 1-5',
    action: 'open',
    enabled: true,
    description: 'Open at 7 AM on weekdays.',
    summary: 'Weekday mornings at 7 AM',
    nextExecutions: ['2027-01-04T07:00:00.000Z'],
  };
  await page.route('**/api/schedules/draft/stream', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: `${JSON.stringify({
        type: 'result',
        result: {
          interpretation: 'Open every weekday morning.',
          drafts: [draft],
          questions: [],
          warnings: [],
        },
      })}\n`,
    }),
  );
  await page.getByLabel('Describe schedule').fill('Open weekdays at 7 AM');
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Review Drafts' }),
  ).toBeVisible();
  expect((await browserJson(page, '/api/schedules')).body).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ name })]),
  );

  const rejectSave = (route: Route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'This schedule could not be saved.' }),
        })
      : route.continue();
  await page.route('**/api/schedules', rejectSave);
  await page.getByRole('button', { name: 'Apply All', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'This schedule could not be saved.',
  );
  await expect(
    page.getByRole('heading', { name: name, exact: true }),
  ).toBeVisible();
  expect((await browserJson(page, '/api/schedules')).body).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ name })]),
  );
  expect((await browserJson(page, '/api/gate')).body).toMatchObject({
    status: (gateBefore.body as { status: string }).status,
  });

  await page.unroute('**/api/schedules', rejectSave);
  await page.getByRole('button', { name: 'Apply All', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Review Drafts' }),
  ).toHaveCount(0);
  await expect(savedSchedule(page, name)).toBeVisible();
  expect(
    await browserJson(page, `/api/schedules?name=${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),
  ).toEqual({ status: 204, body: null });
});

test('AI schedule drafting works end-to-end', async ({ page }) => {
  if (!process.env.E2E_OPENAI_API_KEY) {
    throw new Error(
      'E2E_OPENAI_API_KEY is required for AI schedule drafting E2E',
    );
  }

  await login(page, admin.username, admin.password);
  await openView(page, 'Schedules');

  const before = await browserJson(page, '/api/schedules');
  expect(before.status).toBe(200);
  const existingNames = new Set(
    (before.body as Array<{ name: string }>).map((schedule) => schedule.name),
  );

  await page
    .getByLabel('Describe schedule')
    .fill('Open the gate every weekday at 7:30 AM.');
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  await expect(page.getByText('No gate command is being sent.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Review Drafts' }),
  ).toBeVisible({ timeout: 30_000 });
  expect((await browserJson(page, '/api/schedules')).body).toEqual(before.body);
  await page.getByRole('button', { name: 'Apply All', exact: true }).click();

  let createdSchedules: Array<{
    action: 'open' | 'close';
    cron_expression: string;
    enabled: boolean;
    name: string;
  }> = [];

  await expect
    .poll(async () => {
      const response = await browserJson(page, '/api/schedules');
      expect(response.status).toBe(200);
      createdSchedules = (response.body as typeof createdSchedules).filter(
        (schedule) => !existingNames.has(schedule.name),
      );
      return createdSchedules.length;
    })
    .toBeGreaterThan(0);

  for (const schedule of createdSchedules) {
    expect(schedule.action).toBe('open');
    expect(schedule.cron_expression.trim().split(/\s+/)).toHaveLength(5);
    expect(schedule.enabled).toBe(true);
    await expect(savedSchedule(page, schedule.name)).toBeVisible();
    expect(
      await browserJson(
        page,
        `/api/schedules?name=${encodeURIComponent(schedule.name)}`,
        { method: 'DELETE' },
      ),
    ).toEqual({ status: 204, body: null });
  }
});
