import { test, expect } from '@playwright/test';

test.describe('Authentication Tests', () => {
  test('Failed Login Attempts', async ({ page }) => {
    // Store frequently used locators
    const usernameInput = page.locator('[data-test="username"]');
    const passwordInput = page.locator('[data-test="password"]');
    const loginButton = page.locator('[data-test="login-button"]');

    // Navigate to login page
    await page.goto('https://www.saucedemo.com');

    // Test invalid username with valid password
    await usernameInput.fill('invalid_user');
    await passwordInput.fill('secret_sauce');
    await loginButton.click();
    await expect(page.getByText('Epic sadface: Username and password do not match any user in this service')).toBeVisible();

    // Test valid username with invalid password
    await usernameInput.fill('standard_user');
    await passwordInput.fill('wrong_password');
    await loginButton.click();
    await expect(page.getByText('Epic sadface: Username and password do not match any user in this service')).toBeVisible();

    // Test empty username with valid password
    await usernameInput.fill('');
    await passwordInput.fill('secret_sauce');
    await loginButton.click();
    await expect(page.getByText('Epic sadface: Username is required')).toBeVisible();

    // Test locked out user
    await usernameInput.fill('locked_out_user');
    await passwordInput.fill('secret_sauce');
    await loginButton.click();
    await expect(page.getByText('Epic sadface: Sorry, this user has been locked out.')).toBeVisible();
  });
});