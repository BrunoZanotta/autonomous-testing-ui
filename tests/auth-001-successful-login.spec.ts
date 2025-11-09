import { test, expect } from '@playwright/test';

test.describe('Authentication Tests', () => {
  test('Successful Login', async ({ page }) => {
    // Navigate to login page
    await page.goto('https://www.saucedemo.com');

    // Enter username "standard_user"
    await page.locator('[data-test="username"]').fill('standard_user');

    // Enter password "secret_sauce"
    await page.locator('[data-test="password"]').fill('secret_sauce');

    // Click Login button
    await page.locator('[data-test="login-button"]').click();

    // Verify user is redirected to inventory page
    await expect(page).toHaveURL('https://www.saucedemo.com/inventory.html');

    // Verify product list is visible
    await expect(page.getByText('Products')).toBeVisible();

    // Verify shopping cart icon is present in header
    await expect(page.locator('.shopping_cart_link')).toBeVisible();
  });
});