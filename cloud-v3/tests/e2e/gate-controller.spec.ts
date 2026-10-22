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
  await expect(page).toHaveTitle(new RegExp(`${name}.*Gate Controller`));
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
  await page.getByRole('button', { name: 'Add manually', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill(scheduleName);
  await page.getByLabel('Cron Expression').fill('0 8 * * 1-5');
  await page.getByLabel('Action', { exact: true }).selectOption('open');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(
    scheduleName,
  );
  await expect(page.getByLabel('Cron Expression')).toHaveValue('0 8 * * 1-5');
  const createdResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/schedules' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create Schedule' }).click();
  const response = await createdResponse;
  const created = await response.json();
  expect(response.status(), JSON.stringify(created)).toBe(200);
  expect(created).toMatchObject({
    name: scheduleName,
    cron_expression: '0 8 * * 1-5',
    action: 'open',
    enabled: true,
  });
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
  await expect(page.getByLabel('Cron Expression')).toBeFocused();
  await expect(enabled).toBeDisabled();
  await expect(
    schedule.getByRole('button', {
      name: `Delete ${scheduleName}`,
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByLabel('Cron Expression').fill('0 9 * * 1-5');
  await page.getByRole('button', { name: 'Update Schedule' }).click();
  await expect(schedule).toContainText('09:00 AM');
  await expect(
    schedule.getByRole('button', { name: `Edit ${scheduleName}`, exact: true }),
  ).toBeFocused();
  await expect(enabled).toHaveAttribute('aria-checked', 'false');
  await enabled.click();
  await expect(enabled).toHaveAttribute('aria-checked', 'true');

  const username = 'e2e-user';
  const password = 'user-password';
  await openView(page, 'Access');
  await page.getByRole('button', { name: 'Add User' }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await expect(
    page.getByRole('button', { name: 'Edit admin', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Delete admin', exact: true }),
  ).toBeDisabled();
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
  await expect(
    page.getByRole('button', { name: `Edit ${username}`, exact: true }),
  ).toBeFocused();

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
  await expect(
    page.getByRole('button', { name: 'Edit admin', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Delete ${username}`, exact: true }),
  ).toBeFocused();
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
  await expect(
    page.getByRole('button', { name: 'Add User', exact: true }),
  ).toBeFocused();

  await openView(page, 'Schedules');
  page.once('dialog', (dialog) => dialog.accept());
  await savedSchedule(page, scheduleName)
    .getByRole('button', { name: `Delete ${scheduleName}`, exact: true })
    .click();
  await expect(savedSchedule(page, scheduleName)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Add manually', exact: true }),
  ).toBeFocused();
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
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(
    admin.username,
  );
  await page.getByLabel('Password', { exact: true }).fill(admin.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard?view=schedules');
  await expect(page).toHaveURL(/\/login$/);
});

test('field edits preserve changes made in another session', async ({
  browser,
  page,
}) => {
  await login(page, admin.username, admin.password);
  const suffix = Date.now().toString(36);
  const scheduleName = `e2e concurrent schedule ${suffix}`;
  const username = `e2e-concurrent-user-${suffix}`;
  const password = 'updated-concurrent-password';
  const scheduleUrl = `/api/schedules?name=${encodeURIComponent(scheduleName)}`;
  const userUrl = `/api/users?username=${encodeURIComponent(username)}`;
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  let scheduleCreated = false;
  let userCreated = false;

  try {
    const createdSchedule = await browserJson(page, '/api/schedules', {
      method: 'POST',
      body: {
        name: scheduleName,
        cron_expression: '0 7 * * 1',
        action: 'open',
        enabled: true,
      },
    });
    scheduleCreated = createdSchedule.status === 200;
    expect(createdSchedule.status).toBe(200);
    const createdUser = await browserJson(page, '/api/users', {
      method: 'POST',
      body: {
        username,
        password: 'original-concurrent-password',
        role: 'admin',
      },
    });
    userCreated = createdUser.status === 200;
    expect(createdUser.status).toBe(200);
    await login(otherPage, admin.username, admin.password);

    await page.goto('/dashboard?view=schedules');
    const schedule = savedSchedule(page, scheduleName);
    await schedule
      .getByRole('button', { name: `Edit ${scheduleName}`, exact: true })
      .click();
    await expect(
      page.getByLabel('Enable this schedule', { exact: true }),
    ).toBeChecked();
    await page.getByLabel('Cron Expression').fill('0 8 * * 1');
    const paused = await browserJson(otherPage, scheduleUrl, {
      method: 'PUT',
      body: { enabled: false },
    });
    expect(paused.status).toBe(200);
    expect(paused.body).toMatchObject({ name: scheduleName, enabled: false });

    const scheduleRequest = page.waitForRequest(
      (request) =>
        request.method() === 'PUT' &&
        new URL(request.url()).pathname === '/api/schedules' &&
        new URL(request.url()).searchParams.get('name') === scheduleName,
    );
    await page
      .getByRole('button', { name: 'Update Schedule', exact: true })
      .click();
    expect((await scheduleRequest).postDataJSON()).toEqual({
      cron_expression: '0 8 * * 1',
    });
    await expect(page.getByRole('status')).toContainText('Schedule updated');
    const schedules = await browserJson(page, '/api/schedules');
    expect(schedules.status).toBe(200);
    expect(schedules.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: scheduleName,
          cron_expression: '0 8 * * 1',
          enabled: false,
        }),
      ]),
    );
    await expect(
      schedule.getByRole('switch', { name: `Enable ${scheduleName}` }),
    ).toHaveAttribute('aria-checked', 'false');

    await page.goto('/dashboard?view=access');
    await page
      .getByRole('button', { name: `Edit ${username}`, exact: true })
      .click();
    await expect(page.getByLabel('Role', { exact: true })).toHaveValue('admin');
    await page.getByLabel('New password', { exact: true }).fill(password);
    expect(
      await browserJson(otherPage, '/api/users', {
        method: 'PUT',
        body: { username, role: 'user' },
      }),
    ).toEqual({ status: 200, body: { success: true } });

    const userRequest = page.waitForRequest(
      (request) =>
        request.method() === 'PUT' &&
        new URL(request.url()).pathname === '/api/users',
    );
    await page
      .getByRole('button', { name: 'Update User', exact: true })
      .click();
    expect((await userRequest).postDataJSON()).toEqual({ username, password });
    await expect(page.getByRole('status')).toContainText(`${username} updated`);
    const users = await browserJson(page, '/api/users');
    expect(users.status).toBe(200);
    expect(users.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ username, role: 'user' }),
      ]),
    );
    await login(otherPage, username, password);
    expect((await browserJson(otherPage, '/api/users')).status).toBe(403);
  } finally {
    await otherContext.close();
    if (userCreated) {
      expect(await browserJson(page, userUrl, { method: 'DELETE' })).toEqual({
        status: 204,
        body: null,
      });
    }
    if (scheduleCreated) {
      expect(
        await browserJson(page, scheduleUrl, { method: 'DELETE' }),
      ).toEqual({ status: 204, body: null });
    }
  }
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
        await expect(
          page.getByRole('banner').getByText(admin.username, { exact: true }),
        ).toBeVisible();
        if (view === 'Schedules') {
          await page
            .getByRole('button', { name: 'Add manually', exact: true })
            .click();
          await expect(page.getByLabel('Cron Expression')).toBeVisible();
          await expectNoHorizontalOverflow(page);
          await page
            .getByRole('button', { name: 'Cancel', exact: true })
            .click();
          await expect(
            page.getByRole('button', { name: 'Add manually', exact: true }),
          ).toBeFocused();
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
          await expect(
            page.getByRole('button', { name: 'Add User', exact: true }),
          ).toBeFocused();
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
  await expect(
    page
      .getByRole('main')
      .getByRole('alert')
      .filter({ hasText: /failed|unavailable/i }),
  ).toBeFocused();
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
    description: 'At 07:00 AM, Monday through Friday',
    summary: 'Close every day at midnight',
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
  ).toBeFocused();
  expect((await browserJson(page, '/api/schedules')).body).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ name })]),
  );

  const review = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(
    review.getByText(draft.description, { exact: true }),
  ).toBeVisible();
  await expect(review.getByText(draft.summary, { exact: true })).toHaveCount(0);
  await expect(review.getByText('Enabled', { exact: true })).toBeVisible();
  await expect(
    review.getByText('Next scheduled times', { exact: true }),
  ).toBeVisible();
  const editDraft = review.getByRole('button', { name: 'Edit', exact: true });
  await editDraft.click();
  await page.getByLabel('Cron Expression').fill('0 8 * * 1-5');
  await expect(
    page.getByRole('button', { name: 'Apply All', exact: true }),
  ).toBeDisabled();
  await expect(
    review.getByRole('button', { name: 'Apply', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editDraft).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Apply All', exact: true }),
  ).toBeEnabled();

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
  await expect(page.getByRole('main').getByRole('alert')).toBeFocused();
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
  await expect(page.getByLabel('Describe schedule')).toBeFocused();
  expect(
    await browserJson(page, `/api/schedules?name=${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),
  ).toEqual({ status: 204, body: null });
});

test('draft actions return focus to the remaining review or composer', async ({
  page,
}) => {
  await login(page, admin.username, admin.password);
  await openView(page, 'Schedules');
  const prefix = `e2e review focus ${Date.now().toString(36)}`;
  let draftNames: string[] = [];
  await page.route('**/api/schedules/draft/stream', (route) =>
    route.fulfill({
      contentType: 'application/x-ndjson',
      body: `${JSON.stringify({
        type: 'result',
        result: {
          interpretation: 'Two paused schedules to review.',
          drafts: draftNames.map((name, index) => ({
            name,
            cron_expression: index === 0 ? '0 7 * * 1' : '0 18 * * 1',
            action: index === 0 ? 'open' : 'close',
            enabled: false,
            description: index === 0 ? 'Monday at 7 AM' : 'Monday at 6 PM',
            nextExecutions: ['2027-01-04T07:00:00.000Z'],
          })),
          questions: [],
          warnings: [],
        },
      })}\n`,
    }),
  );
  const composer = page.getByLabel('Describe schedule');
  const reviewHeading = page.getByRole('heading', {
    name: 'Review Drafts',
    exact: true,
  });

  try {
    for (const action of ['Dismiss', 'Apply', 'Edit']) {
      draftNames = [
        `${prefix} ${action} morning`,
        `${prefix} ${action} evening`,
      ];
      await composer.fill('Review two paused Monday schedules');
      await page.getByRole('button', { name: 'Draft', exact: true }).click();
      await expect(reviewHeading).toBeFocused();
      if (action === 'Dismiss') {
        await page
          .getByRole('button', { name: 'Dismiss', exact: true })
          .click();
        await expect(reviewHeading).toHaveCount(0);
        await expect(composer).toBeFocused();
        continue;
      }

      for (const [index, name] of draftNames.entries()) {
        const draft = page.getByRole('article').filter({
          has: page.getByRole('heading', { name, exact: true }),
        });
        await draft.getByRole('button', { name: action, exact: true }).click();
        if (action === 'Edit') {
          await page
            .getByLabel('Cron Expression')
            .fill(index === 0 ? '0 8 * * 1' : '0 19 * * 1');
          await page
            .getByRole('button', { name: 'Create Schedule', exact: true })
            .click();
        }
        await expect(savedSchedule(page, name)).toBeVisible();
        await expect(draft).toHaveCount(0);
        await expect(index === 0 ? reviewHeading : composer).toBeFocused();
      }
    }
  } finally {
    const schedules = await browserJson(page, '/api/schedules');
    expect(schedules.status).toBe(200);
    for (const { name } of schedules.body as Array<{ name: string }>) {
      if (!name.startsWith(prefix)) continue;
      expect(
        await browserJson(
          page,
          `/api/schedules?name=${encodeURIComponent(name)}`,
          { method: 'DELETE' },
        ),
      ).toEqual({ status: 204, body: null });
    }
  }
});

test('gate commands fit the initial viewport and remain readable with text spacing', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, admin.username, admin.password);

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 667 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const name of ['Open Gate', 'Close Gate']) {
      await expect(
        page.getByRole('button', { name, exact: true }),
      ).toBeInViewport({ ratio: 1 });
    }
  }

  await page.addStyleTag({
    content: `
    * { letter-spacing: .12em !important; word-spacing: .16em !important; line-height: 1.5 !important; }
    p { margin-bottom: 2em !important; }
  `,
  });
  await expectNoHorizontalOverflow(page);
  for (const name of ['Open Gate', 'Close Gate']) {
    const bounds = await page
      .getByRole('button', { name, exact: true })
      .evaluate((element) => {
        const button = element.getBoundingClientRect();
        const region = element.closest('section');
        if (!region) throw new Error('Gate command has no containing region');
        const card = region.getBoundingClientRect();
        return {
          left: button.left,
          right: button.right,
          cardLeft: card.left,
          cardRight: card.right,
          viewportWidth: innerWidth,
          contentWidth: element.scrollWidth,
          availableWidth: element.clientWidth,
        };
      });
    expect(bounds.left).toBeGreaterThanOrEqual(bounds.cardLeft);
    expect(bounds.right).toBeLessThanOrEqual(
      Math.min(bounds.cardRight, bounds.viewportWidth),
    );
    expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.availableWidth);
  }
});

test('a confirmed gate command stays visible when the status refresh fails', async ({
  page,
}) => {
  await login(page, admin.username, admin.password);
  const before = await browserJson(page, '/api/gate');
  expect(before.status).toBe(200);
  const { status } = before.body as { status: 'open' | 'closed' };
  const action = status === 'open' ? 'close' : 'open';
  const label = action === 'open' ? 'Open' : 'Close';
  const historyUrl = (url: URL) =>
    url.pathname === '/api/gate' && url.searchParams.get('history') === 'true';
  await page.route(historyUrl, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Status refresh unavailable' }),
    }),
  );
  try {
    const refreshFailed = page.waitForResponse(
      (response) =>
        historyUrl(new URL(response.url())) && response.status() === 503,
    );
    await page
      .getByRole('button', { name: `${label} Gate`, exact: true })
      .click();
    await refreshFailed;
    await expect(page.getByRole('status')).toContainText(
      `${label} command saved`,
    );
    await expect(
      page
        .getByRole('main')
        .getByRole('status')
        .filter({ hasText: `${label} command saved` }),
    ).toBeFocused();
    await expect(page.locator('.gate-state')).toContainText(
      action === 'open' ? 'Open' : 'Closed',
    );
    await expect(
      page
        .getByRole('main')
        .getByRole('alert')
        .filter({ hasText: /refresh|connection/i })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open Gate', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Close Gate', exact: true }),
    ).toBeDisabled();
    const persisted = await browserJson(page, '/api/gate');
    expect(persisted.status).toBe(200);
    expect(persisted.body).toMatchObject({
      status: action === 'open' ? 'open' : 'closed',
    });
  } finally {
    await page.unroute(historyUrl);
    expect(
      await browserJson(page, '/api/gate', {
        method: 'POST',
        body: { action: status === 'open' ? 'open' : 'close' },
      }),
    ).toMatchObject({ status: 200 });
  }
});

test('upcoming recovery keeps focus on the result or a chosen link', async ({
  page,
}) => {
  await login(page, admin.username, admin.password);
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  const upcomingUrl = '**/api/schedules/upcoming';
  const populated = [
    {
      schedule: {
        name: 'e2e upcoming focus',
        cron_expression: '0 7 * * 1',
        action: 'open',
        enabled: true,
      },
      nextExecution: '2027-01-04T07:00:00.000Z',
    },
  ];

  for (const result of [[], populated]) {
    for (const { recovery, moveFocus } of [
      { recovery: 'keyboard', moveFocus: false },
      { recovery: 'keyboard', moveFocus: true },
      { recovery: 'automatic', moveFocus: false },
      { recovery: 'automatic', moveFocus: true },
    ]) {
      let firstRead = true;
      let releaseRecovery!: () => void;
      let recoveryStarted!: () => void;
      const recoveryRequest = new Promise<void>((resolve) => {
        recoveryStarted = resolve;
      });
      const recoveryResponse = new Promise<void>((resolve) => {
        releaseRecovery = resolve;
      });
      const holdRecovery = async (route: Route) => {
        if (route.request().method() !== 'GET') return route.continue();
        if (firstRead) {
          firstRead = false;
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Upcoming schedules unavailable' }),
          });
        }
        recoveryStarted();
        await recoveryResponse;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(result),
        });
      };
      await page.route(upcomingUrl, holdRecovery);
      try {
        await page.clock.setSystemTime(new Date());
        await page.goto('/dashboard');
        const upcoming = page.getByRole('region', {
          name: 'Up next',
          exact: true,
        });
        const error = upcoming.getByRole('alert');
        const retry = error.getByRole('button', {
          name: 'Try again',
          exact: true,
        });
        const manage = upcoming.getByRole('link', {
          name: 'Manage schedules',
          exact: true,
        });
        await expect(error).toContainText('Unable to load upcoming schedules.');
        await retry.focus();
        if (recovery === 'keyboard') {
          await retry.press('Enter');
        } else {
          await page.clock.fastForward('01:00');
        }
        await recoveryRequest;
        if (moveFocus) await manage.focus();
        await expect(moveFocus ? manage : retry).toBeFocused();
        releaseRecovery();
        await expect(error).toHaveCount(0);
        const recovered = result.length
          ? upcoming.getByRole('list', {
              name: 'Upcoming gate commands',
              exact: true,
            })
          : upcoming.getByRole('group', {
              name: 'No upcoming gate commands',
              exact: true,
            });
        await expect(recovered).toBeVisible();
        if (result.length) {
          await expect(
            recovered.getByRole('heading', {
              name: 'e2e upcoming focus',
              exact: true,
            }),
          ).toBeVisible();
        }
        await expect(moveFocus ? manage : recovered).toBeFocused();
      } finally {
        releaseRecovery();
        await page.unroute(upcomingUrl, holdRecovery);
      }
    }
  }
});

test('confirmed schedule and user saves survive a failed list refresh', async ({
  page,
}) => {
  await login(page, admin.username, admin.password);
  const scheduleName = 'e2e saved schedule refresh failure';
  const username = 'e2e-saved-user-refresh-failure';
  const rejectRead = (route: Route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'List refresh unavailable' }),
        })
      : route.continue();

  await openView(page, 'Schedules');
  await page.getByRole('button', { name: 'Add manually', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill(scheduleName);
  await page.getByLabel('Cron Expression').fill('0 7 * * 1');
  await page.route('**/api/schedules', rejectRead);
  const scheduleRefreshFailed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/schedules' &&
      response.request().method() === 'GET' &&
      response.status() === 503,
  );
  await page
    .getByRole('button', { name: 'Create Schedule', exact: true })
    .click();
  await scheduleRefreshFailed;
  await expect(page.getByRole('status')).toContainText('Schedule added');
  await expect(savedSchedule(page, scheduleName)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create Schedule', exact: true }),
  ).toHaveCount(0);
  const scheduleRefreshAlert = page
    .getByRole('main')
    .getByRole('alert')
    .filter({ hasText: /refresh/i });
  await expect(scheduleRefreshAlert).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Add manually', exact: true }),
  ).toBeFocused();
  const retrySchedules = scheduleRefreshAlert.getByRole('button', {
    name: 'Try again',
    exact: true,
  });
  const scheduleRetryFailed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/schedules' &&
      response.request().method() === 'GET' &&
      response.status() === 503,
  );
  await retrySchedules.click();
  await scheduleRetryFailed;
  await expect(retrySchedules).toBeFocused();
  await page.unroute('**/api/schedules', rejectRead);
  const schedules = await browserJson(page, '/api/schedules');
  expect(schedules.status).toBe(200);
  expect(schedules.body).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: scheduleName })]),
  );
  await retrySchedules.click();
  await expect(scheduleRefreshAlert).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Add manually', exact: true }),
  ).toBeFocused();

  await openView(page, 'Access');
  await page.getByRole('button', { name: 'Add User', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page
    .getByLabel('Password', { exact: true })
    .fill('isolated-refresh-password');
  await page.route('**/api/users', rejectRead);
  const usersRefreshFailed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/users' &&
      response.request().method() === 'GET' &&
      response.status() === 503,
  );
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await usersRefreshFailed;
  await expect(page.getByRole('status')).toContainText(`${username} added`);
  await expect(
    page
      .getByRole('list', { name: 'Users' })
      .getByText(username, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create User', exact: true }),
  ).toHaveCount(0);
  const usersRefreshAlert = page
    .getByRole('main')
    .getByRole('alert')
    .filter({ hasText: /people list could not be refreshed/i });
  const retryUsers = usersRefreshAlert.getByRole('button', {
    name: 'Try again',
    exact: true,
  });
  await expect(usersRefreshAlert).toBeVisible();
  await expect(retryUsers).toBeFocused();
  const userRetryFailed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/users' &&
      response.request().method() === 'GET' &&
      response.status() === 503,
  );
  await retryUsers.click();
  await userRetryFailed;
  await expect(retryUsers).toBeFocused();
  await page.unroute('**/api/users', rejectRead);
  const users = await browserJson(page, '/api/users');
  expect(users.status).toBe(200);
  expect(users.body).toEqual(
    expect.arrayContaining([expect.objectContaining({ username })]),
  );
  await retryUsers.click();
  await expect(usersRefreshAlert).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Add User', exact: true }),
  ).toBeFocused();

  await page
    .getByRole('button', { name: `Edit ${username}`, exact: true })
    .click();
  await page.getByLabel('Role', { exact: true }).selectOption('admin');
  await page.route('**/api/users', rejectRead);
  await page.getByRole('button', { name: 'Update User', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`${username} updated`);
  await expect(retryUsers).toBeFocused();
  await page.unroute('**/api/users', rejectRead);
  const updatedUsers = await browserJson(page, '/api/users');
  expect(updatedUsers.status).toBe(200);
  expect(updatedUsers.body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ username, role: 'admin' }),
    ]),
  );
  await retryUsers.click();
  await expect(usersRefreshAlert).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Add User', exact: true }),
  ).toBeFocused();

  await page
    .getByRole('button', { name: `Delete ${username}`, exact: true })
    .click();
  await page.route('**/api/users', rejectRead);
  await page.getByRole('button', { name: 'Delete user', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`${username} removed`);
  await expect(retryUsers).toBeFocused();
  await expect(
    page
      .getByRole('list', { name: 'Users' })
      .getByText(username, { exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/users', rejectRead);
  const remainingUsers = await browserJson(page, '/api/users');
  expect(remainingUsers.status).toBe(200);
  expect(remainingUsers.body).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ username })]),
  );
  await retryUsers.click();
  await expect(usersRefreshAlert).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Add User', exact: true }),
  ).toBeFocused();

  await openView(page, 'Schedules');
  page.once('dialog', (dialog) => dialog.accept());
  await savedSchedule(page, scheduleName)
    .getByRole('button', { name: `Delete ${scheduleName}`, exact: true })
    .click();
  await expect(savedSchedule(page, scheduleName)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Add manually', exact: true }),
  ).toBeFocused();
});

test('read retries restore editor focus and preserve a chosen field', async ({
  page,
}) => {
  await login(page, admin.username, admin.password);
  const scheduleName = `e2e retry focus ${Date.now().toString(36)}`;
  const scheduleUrl = `/api/schedules?name=${encodeURIComponent(scheduleName)}`;
  let scheduleCreated = false;
  function barrier() {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { promise, release };
  }

  try {
    const created = await browserJson(page, '/api/schedules', {
      method: 'POST',
      body: {
        name: scheduleName,
        cron_expression: '0 10 * * 2',
        action: 'open',
        enabled: false,
      },
    });
    scheduleCreated = created.status === 200;
    expect(created.status).toBe(200);

    for (const manager of [
      {
        view: 'schedules',
        path: '/api/schedules',
        edit: `Edit ${scheduleName}`,
        initialField: 'Cron Expression',
        chosenField: 'Action',
      },
      {
        view: 'access',
        path: '/api/users',
        edit: `Edit ${admin.username}`,
        initialField: 'New password',
        chosenField: 'Role',
      },
    ]) {
      for (const { activation, moveFocus } of [
        { activation: 'pointer', moveFocus: false },
        { activation: 'pointer', moveFocus: true },
        { activation: 'keyboard', moveFocus: false },
        { activation: 'without focus', moveFocus: false },
      ]) {
        const initialStarted = barrier();
        const initialResponse = barrier();
        const retryStarted = barrier();
        const retryResponse = barrier();
        let firstRead = true;
        const readUrl = (url: URL) => url.pathname === manager.path;
        const holdReads = async (route: Route) => {
          if (route.request().method() !== 'GET') return route.continue();
          if (firstRead) {
            firstRead = false;
            initialStarted.release();
            await initialResponse.promise;
            return route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'List refresh unavailable' }),
            });
          }
          retryStarted.release();
          await retryResponse.promise;
          const response = await route.fetch();
          return route.fulfill({ response });
        };
        await page.route(readUrl, holdReads);
        try {
          await page.goto(`/dashboard?view=${manager.view}`);
          await initialStarted.promise;
          await page
            .getByRole('button', { name: manager.edit, exact: true })
            .click();
          const initialField = page.getByLabel(manager.initialField, {
            exact: true,
          });
          const chosenField = page.getByLabel(manager.chosenField, {
            exact: true,
          });
          await expect(initialField).toBeFocused();
          initialResponse.release();
          const refreshAlert = page
            .getByRole('main')
            .getByRole('alert')
            .filter({ hasText: /refresh/i });
          const retry = refreshAlert.getByRole('button', {
            name: 'Try again',
            exact: true,
          });
          await expect(refreshAlert).toBeVisible();
          const recoveredRead = page.waitForResponse(
            (response) =>
              readUrl(new URL(response.url())) &&
              response.request().method() === 'GET',
          );
          if (activation === 'keyboard') {
            await retry.focus();
            await retry.press('Enter');
          } else if (activation === 'without focus') {
            await page.getByRole('main').focus();
            await retry.dispatchEvent('click');
          } else {
            await retry.click();
          }
          await retryStarted.promise;
          if (moveFocus) await chosenField.focus();
          await expect(
            moveFocus
              ? chosenField
              : activation === 'without focus'
                ? page.getByRole('main')
                : retry,
          ).toBeFocused();
          retryResponse.release();
          expect((await recoveredRead).status()).toBe(200);
          await expect(refreshAlert).toHaveCount(0);
          await expect(moveFocus ? chosenField : initialField).toBeFocused();
          await page
            .getByRole('button', { name: 'Cancel', exact: true })
            .click();
        } finally {
          initialResponse.release();
          retryResponse.release();
          await page.unroute(readUrl, holdReads);
        }
      }
    }
  } finally {
    if (scheduleCreated) {
      expect(
        await browserJson(page, scheduleUrl, { method: 'DELETE' }),
      ).toEqual({ status: 204, body: null });
    }
  }
});

test('rejected schedule and user writes retain input and focus the error', async ({
  page,
}) => {
  await login(page, admin.username, admin.password);
  const suffix = Date.now().toString(36);
  const scheduleName = `e2e rejected schedule ${suffix}`;
  const username = `e2e-rejected-user-${suffix}`;
  const scheduleUrl = `/api/schedules?name=${encodeURIComponent(scheduleName)}`;
  const userUrl = `/api/users?username=${encodeURIComponent(username)}`;
  const writeUrls = (url: URL) =>
    ['/api/schedules', '/api/users'].includes(url.pathname);
  const rejectWrite = (route: Route) =>
    route.request().method() === 'GET'
      ? route.continue()
      : route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'This write could not be saved.' }),
        });
  let scheduleCreated = false;
  let userCreated = false;
  const writeError = page
    .getByRole('main')
    .getByRole('alert')
    .filter({ hasText: 'This write could not be saved.' });

  try {
    await page.route(writeUrls, rejectWrite);
    await openView(page, 'Schedules');
    await page
      .getByRole('button', { name: 'Add manually', exact: true })
      .click();
    await page.getByLabel('Name', { exact: true }).fill(scheduleName);
    await page.getByLabel('Cron Expression').fill('0 10 * * 2');
    await page.getByLabel('Action', { exact: true }).selectOption('open');
    await page
      .getByRole('button', { name: 'Create Schedule', exact: true })
      .click();
    await expect(writeError).toBeFocused();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(
      scheduleName,
    );
    await expect(page.getByLabel('Cron Expression')).toHaveValue('0 10 * * 2');
    await expect(page.getByLabel('Action', { exact: true })).toHaveValue(
      'open',
    );
    await expect(
      page.getByLabel('Enable this schedule', { exact: true }),
    ).toBeChecked();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    const schedulesAfterReject = await browserJson(page, '/api/schedules');
    expect(schedulesAfterReject.status).toBe(200);
    expect(schedulesAfterReject.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: scheduleName })]),
    );

    await openView(page, 'Access');
    await page.getByRole('button', { name: 'Add User', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page
      .getByLabel('Password', { exact: true })
      .fill('rejected-user-password');
    await page.getByLabel('Role', { exact: true }).selectOption('admin');
    await page
      .getByRole('button', { name: 'Create User', exact: true })
      .click();
    await expect(writeError).toBeFocused();
    await expect(page.getByLabel('Username', { exact: true })).toHaveValue(
      username,
    );
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue(
      'rejected-user-password',
    );
    await expect(page.getByLabel('Role', { exact: true })).toHaveValue('admin');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    const usersAfterReject = await browserJson(page, '/api/users');
    expect(usersAfterReject.status).toBe(200);
    expect(usersAfterReject.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ username })]),
    );

    await page.unroute(writeUrls, rejectWrite);
    const createdSchedule = await browserJson(page, '/api/schedules', {
      method: 'POST',
      body: {
        name: scheduleName,
        cron_expression: '0 10 * * 2',
        action: 'open',
        enabled: false,
      },
    });
    scheduleCreated = createdSchedule.status === 200;
    expect(createdSchedule.status).toBe(200);
    const createdUser = await browserJson(page, '/api/users', {
      method: 'POST',
      body: { username, password: 'isolated-delete-password', role: 'user' },
    });
    userCreated = createdUser.status === 200;
    expect(createdUser.status).toBe(200);
    await page.route(writeUrls, rejectWrite);

    await page.goto('/dashboard?view=schedules');
    page.once('dialog', (dialog) => dialog.accept());
    await savedSchedule(page, scheduleName)
      .getByRole('button', { name: `Delete ${scheduleName}`, exact: true })
      .click();
    await expect(writeError).toBeFocused();
    await expect(savedSchedule(page, scheduleName)).toBeVisible();
    const schedulesAfterDelete = await browserJson(page, '/api/schedules');
    expect(schedulesAfterDelete.status).toBe(200);
    expect(schedulesAfterDelete.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: scheduleName })]),
    );

    let releaseUsersRead!: () => void;
    let usersReadStarted!: () => void;
    const usersRead = new Promise<void>((resolve) => {
      usersReadStarted = resolve;
    });
    const usersResponse = new Promise<void>((resolve) => {
      releaseUsersRead = resolve;
    });
    const holdUsersRead = async (route: Route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      usersReadStarted();
      await usersResponse;
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'People refresh unavailable' }),
      });
    };
    await page.route('**/api/users', holdUsersRead);
    try {
      await page.goto('/dashboard?view=access');
      await usersRead;
      await page
        .getByRole('button', { name: `Delete ${username}`, exact: true })
        .click();
      const confirmDelete = page.getByRole('button', {
        name: 'Delete user',
        exact: true,
      });
      const cancelDelete = page
        .getByRole('group', { name: `Remove ${username}`, exact: true })
        .getByRole('button', { name: 'Cancel', exact: true });
      await expect(confirmDelete).toBeEnabled();
      await expect(cancelDelete).toBeFocused();
      releaseUsersRead();
      const refreshAlert = page
        .getByRole('main')
        .getByRole('alert')
        .filter({ hasText: /people list could not be refreshed/i });
      await expect(refreshAlert).toBeVisible();
      await expect(confirmDelete).toBeDisabled();
      await expect(cancelDelete).toBeFocused();
      await page.unroute('**/api/users', holdUsersRead);
      await refreshAlert
        .getByRole('button', { name: 'Try again', exact: true })
        .click();
      await expect(refreshAlert).toHaveCount(0);
      await expect(confirmDelete).toBeEnabled();
      await expect(cancelDelete).toBeFocused();
    } finally {
      releaseUsersRead();
      await page.unroute('**/api/users', holdUsersRead);
    }
    await page
      .getByRole('button', { name: 'Delete user', exact: true })
      .click();
    await expect(writeError).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Delete user', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    const usersAfterDelete = await browserJson(page, '/api/users');
    expect(usersAfterDelete.status).toBe(200);
    expect(usersAfterDelete.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ username })]),
    );
  } finally {
    await page.unroute(writeUrls, rejectWrite);
    if (userCreated) {
      expect(await browserJson(page, userUrl, { method: 'DELETE' })).toEqual({
        status: 204,
        body: null,
      });
    }
    if (scheduleCreated) {
      expect(
        await browserJson(page, scheduleUrl, { method: 'DELETE' }),
      ).toEqual({ status: 204, body: null });
    }
  }
});

test('retrying a partially applied draft saves only the remaining schedule', async ({
  page,
}) => {
  await login(page, admin.username, admin.password);
  await openView(page, 'Schedules');
  const firstName = 'e2e partial draft morning';
  const secondName = 'e2e partial draft evening';
  const drafts = [
    {
      name: firstName,
      cron_expression: '0 7 * * 1',
      action: 'open',
      enabled: true,
      description: 'Open Monday at 7 AM.',
      summary: 'Monday mornings',
      nextExecutions: ['2027-01-04T07:00:00.000Z'],
    },
    {
      name: secondName,
      cron_expression: '0 18 * * 1',
      action: 'close',
      enabled: false,
      description: 'Close Monday at 6 PM.',
      summary: 'Monday evenings',
      nextExecutions: ['2027-01-04T18:00:00.000Z'],
    },
  ];
  await page.route('**/api/schedules/draft/stream', (route) =>
    route.fulfill({
      contentType: 'application/x-ndjson',
      body: `${JSON.stringify({ type: 'result', result: { interpretation: 'Open and close on Mondays.', drafts, questions: [], warnings: [] } })}\n`,
    }),
  );
  const posts: string[] = [];
  let rejectSecond = true;
  await page.route('**/api/schedules', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const { name } = route.request().postDataJSON() as { name: string };
    posts.push(name);
    if (name === secondName && rejectSecond) {
      rejectSecond = false;
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Second schedule could not be saved.' }),
      });
    }
    return route.continue();
  });
  await page
    .getByLabel('Describe schedule')
    .fill('Open Monday at 7 AM and close at 6 PM');
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Review Drafts', exact: true }),
  ).toBeVisible();
  const pausedDraft = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: secondName, exact: true }),
  });
  await expect(pausedDraft.getByText('Paused', { exact: true })).toBeVisible();
  await expect(
    pausedDraft.getByText('Next times if enabled', { exact: true }),
  ).toBeVisible();
  await expect(
    pausedDraft.getByText('Next scheduled times', { exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Apply All', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Second schedule could not be saved.',
  );
  await expect(page.getByRole('main').getByRole('alert')).toBeFocused();
  await expect(savedSchedule(page, firstName)).toBeVisible();
  await expect(
    page.getByRole('article').filter({
      has: page.getByRole('heading', { name: firstName, exact: true }),
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('article').filter({
      has: page.getByRole('heading', { name: secondName, exact: true }),
    }),
  ).toBeVisible();
  const beforeRetry = await browserJson(page, '/api/schedules');
  expect(beforeRetry.status).toBe(200);
  const createdBeforeRetry = beforeRetry.body as Array<{ name: string }>;
  expect(
    createdBeforeRetry
      .filter((schedule) => [firstName, secondName].includes(schedule.name))
      .map((schedule) => schedule.name),
  ).toEqual([firstName]);

  await page.getByRole('button', { name: 'Apply All', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Review Drafts', exact: true }),
  ).toHaveCount(0);
  await expect(savedSchedule(page, secondName)).toBeVisible();
  await expect(page.getByLabel('Describe schedule')).toBeFocused();
  expect(posts).toEqual([firstName, secondName, secondName]);
  const afterRetry = await browserJson(page, '/api/schedules');
  expect(afterRetry.status).toBe(200);
  const createdAfterRetry = afterRetry.body as Array<{
    name: string;
    enabled: boolean;
  }>;
  expect(
    createdAfterRetry.filter((schedule) =>
      [firstName, secondName].includes(schedule.name),
    ),
  ).toHaveLength(2);
  expect(createdAfterRetry).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: secondName, enabled: false }),
    ]),
  );
  await expect(
    savedSchedule(page, secondName).getByText('Paused', { exact: true }),
  ).toBeVisible();
  for (const name of [firstName, secondName]) {
    expect(
      await browserJson(
        page,
        `/api/schedules?name=${encodeURIComponent(name)}`,
        { method: 'DELETE' },
      ),
    ).toEqual({ status: 204, body: null });
  }
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
