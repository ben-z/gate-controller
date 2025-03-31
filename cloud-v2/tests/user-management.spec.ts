import { test, expect } from '@playwright/test';

const ADMIN_CREDENTIALS = JSON.parse(process.env.AUTH_CREDENTIALS!);
const ADMIN_USERNAME = ADMIN_CREDENTIALS.username;
const ADMIN_PASSWORD = ADMIN_CREDENTIALS.password;

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');
    
    // Login as admin
    await page.getByLabel('Username').fill(ADMIN_USERNAME);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Login' }).click();
    
    // Wait for login to complete and verify we're logged in
    await expect(page.getByText(`Logged in as:${ADMIN_USERNAME}`)).toBeVisible();
    
    // Navigate to settings page and wait for it to load
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    // Clear local storage after each test
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should display user management interface', async ({ page }) => {
    // Wait for the user management interface to be visible
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible();
  });

  test('should create a new user', async ({ page }) => {
    const username = `testuser_${Date.now()}`;
    const password = `testpass_${Date.now()}`;

    // Click add user button and wait for the form to be visible
    await page.getByRole('button', { name: 'Add User' }).click();

    const form = page.getByTestId('create-user-form');
    await expect(form).toBeVisible();

    await expect(form.getByLabel('Username')).toBeVisible();

    // Fill in the form
    await form.getByLabel('Username').fill(username);
    await form.getByLabel('Password').fill(password);
    await form.getByLabel('Role').selectOption('user');

    // Submit the form
    await form.getByRole('button', { name: 'Create' }).click();

    const userList = page.getByTestId('user-list');
    await expect(userList).toBeVisible();

    // Wait for the new user to appear in the list
    await expect(userList.getByText(username)).toBeVisible();

    // log out
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

    // log in as the new user
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText(`Logged in as:${username}`)).toBeVisible();

    // check that the user is a user
    await expect(page.getByTestId('user-info-role')).toHaveText('user', );
  });

  test('should edit an existing user', async ({ page }) => {
    // First create a user to edit
    const username = `edituser_${Date.now()}`;
    const password = `testpass_${Date.now()}`;

    await page.getByRole('button', { name: 'Add User' }).click();
    const form = page.getByTestId('create-user-form');
    await expect(form).toBeVisible();

    await expect(form.getByLabel('Username')).toBeVisible();
    
    await form.getByLabel('Username').fill(username);
    await form.getByLabel('Password').fill(password);
    await form.getByLabel('Role').selectOption('user');
    await form.getByRole('button', { name: 'Create' }).click();

    // Wait for the user to be created
    const userList = page.getByTestId('user-list');
    await expect(userList.getByText(username)).toBeVisible();

    // Find and click edit button for the new user
    const userCard = page.getByTestId('user-username').filter({ hasText: username }).locator('..').locator('..').locator('..');
    await userCard.getByRole('button', { name: 'Edit' }).click();

    // Wait for the edit form to be visible
    const editForm = page.getByTestId('edit-user-form');
    await expect(editForm).toBeVisible();

    // Update the user
    const newPassword = `newpass_${Date.now()}`;
    await editForm.getByLabel('Password').fill(newPassword);
    await editForm.getByLabel('Role').selectOption('admin');
    await editForm.getByRole('button', { name: 'Save Changes' }).click();

    // Wait for the changes to be reflected
    await expect(userCard.getByTestId('user-role')).toHaveText('admin', );

    // log out
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

    // log in as the new user
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(newPassword);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText(`Logged in as:${username}`)).toBeVisible();

    // check that the user is an admin
    await expect(page.getByTestId('user-info-role')).toHaveText('admin', );
  });

  test('should delete a user', async ({ page }) => {
    // First create a user to delete
    const username = `deleteuser_${Date.now()}`;
    const password = `testpass_${Date.now()}`;

    await page.getByRole('button', { name: 'Add User' }).click();
    const form = page.getByTestId('create-user-form');
    await expect(form).toBeVisible();
    
    await form.getByLabel('Username').fill(username);
    await form.getByLabel('Password').fill(password);
    await form.getByLabel('Role').selectOption('user');
    await form.getByRole('button', { name: 'Create' }).click();

    // Wait for the user to be created
    await expect(page.getByTestId('user-username').filter({ hasText: username })).toBeVisible();

    // Find and click delete button for the new user
    const userCard = page.getByTestId('user-username').filter({ hasText: username }).locator('..').locator('..').locator('..');

    // Confirm deletion by responding to the alert
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await userCard.getByRole('button', { name: 'Delete' }).click();

    // Wait for the user to be removed
    await expect(page.getByTestId('user-username').filter({ hasText: username })).not.toBeVisible();

    // log out
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  
    // log in as the new user, should fail
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText(/Invalid username or password/)).toBeVisible();
  });

  test('should show error for duplicate username', async ({ page }) => {
    const username = `duplicate_${Date.now()}`;
    const password = `testpass_${Date.now()}`;

    // Create first user
    await page.getByRole('button', { name: 'Add User' }).click();
    const form = page.getByTestId('create-user-form');
    await expect(form).toBeVisible();
    
    await form.getByLabel('Username').fill(username);
    await form.getByLabel('Password').fill(password);
    await form.getByLabel('Role').selectOption('user');
    await form.getByRole('button', { name: 'Create' }).click();

    // Wait for the user to be created
    await expect(page.getByTestId('user-username').filter({ hasText: username })).toBeVisible();

    // Try to create second user with same username
    await page.getByRole('button', { name: 'Add User' }).click();
    await expect(form).toBeVisible();
    
    await form.getByLabel('Username').fill(username);
    await form.getByLabel('Password').fill(`differentpass_${Date.now()}`);
    await form.getByLabel('Role').selectOption('user');
    await form.getByRole('button', { name: 'Create' }).click();

    // Wait for and verify error message
    await expect(page.getByText(/Username .* is already taken/)).toBeVisible();
  });
}); 