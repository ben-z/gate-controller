import { test, expect } from '@playwright/test';

const ADMIN_CREDENTIALS = JSON.parse(process.env.AUTH_CREDENTIALS!);
const ADMIN_USERNAME = ADMIN_CREDENTIALS.username;
const ADMIN_PASSWORD = ADMIN_CREDENTIALS.password;

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page before each test
    await page.goto('http://localhost:3001');
  });
  test.afterEach(async ({ page }) => {
    // Clear local storage after each test
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should show login form when not authenticated', async ({ page }) => {
    // Check if login form is visible
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  test('should show error message with invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.getByLabel('Username').fill('invaliduser');
    await page.getByLabel('Password').fill('invalidpass');
    
    // Submit the form
    await page.getByRole('button', { name: 'Login' }).click();

    // Check for error message
    await expect(page.getByText('Invalid username or password')).toBeVisible();
  });

  test('should log in successfully', async ({ page }) => {
    // Fill in valid credentials (using environment variables or test credentials)
    const username = ADMIN_USERNAME;
    const password = ADMIN_PASSWORD;

    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(password);
    
    // Submit the form
    await page.getByRole('button', { name: 'Login' }).click();

    // Check if we're redirected to the main page
    await expect(page.getByRole('heading', { name: 'Gate Controller' })).toBeVisible();
    
    // Check if user info is displayed
    await expect(page.getByText(`Logged in as:${username}`)).toBeVisible();
    
    // Check if logout button is visible
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test.only('should maintain login state after page refresh', async ({ page }) => {
    // Login first
    const username = ADMIN_USERNAME;
    const password = ADMIN_PASSWORD;

    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();

    // pause for a little bit to ensure the local storage is set
    await page.waitForTimeout(500);

    // Refresh the page
    await page.reload();

    // Check if we're still logged in
    await expect(page.getByRole('heading', { name: 'Gate Controller' })).toBeVisible();
    await expect(page.getByText(`Logged in as:${username}`)).toBeVisible();
  });

  test('should log out successfully', async ({ page }) => {
    // Login first
    const username = ADMIN_USERNAME;
    const password = ADMIN_PASSWORD;

    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();

    // Click logout button
    await page.getByRole('button', { name: 'Logout' }).click();

    // Check if we're redirected back to login form
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });
}); 