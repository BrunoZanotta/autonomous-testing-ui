import { test, expect } from '@playwright/test';

test.describe('Checkout Process Tests', () => {
  test('Checkout Information', async ({ page }) => {
    // Login as standard_user
    await page.goto('https://www.saucedemo.com');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();

    // Add product to cart
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();

    // Navigate to cart and proceed to checkout
    await page.locator('[data-test="shopping-cart-link"]').click();
    await page.locator('[data-test="checkout"]').click();

    // Verify we're on the checkout information page
    await expect(page.getByText('Checkout: Your Information')).toBeVisible();

    // Fill in personal information
    await page.locator('[data-test="firstName"]').fill('John');
    await page.locator('[data-test="lastName"]').fill('Doe');
    await page.locator('[data-test="postalCode"]').fill('12345');

    // Submit information
    await page.locator('[data-test="continue"]').click();

    // Verify checkout overview page loads
    await expect(page.getByText('Checkout: Overview')).toBeVisible();
    
    // Verify order summary elements
    await expect(page.getByText('Payment Information:')).toBeVisible();
    await expect(page.getByText('Shipping Information:')).toBeVisible();
    await expect(page.getByText('Price Total')).toBeVisible();
    await expect(page.getByText('SauceCard #31337')).toBeVisible();
    await expect(page.getByText('Free Pony Express Delivery!')).toBeVisible();

    // Verify item details
    await expect(page.getByText('Sauce Labs Backpack')).toBeVisible();
    await expect(page.getByText('$29.99')).toBeVisible();
  });
});