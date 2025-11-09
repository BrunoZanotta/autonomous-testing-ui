import { test, expect } from '@playwright/test';

test.describe('Shopping Cart Tests', () => {
  test('Cart Management', async ({ page }) => {
    // Login as standard_user
    await page.goto('https://www.saucedemo.com');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();

    // Store frequently used locators
    const cartBadge = page.locator('.shopping_cart_badge');
    const cartLink = page.locator('[data-test="shopping-cart-link"]');

    // Add multiple products to cart
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]').click();
    await expect(cartBadge).toHaveText('2');

    // Navigate to cart page
    await cartLink.click();
    await expect(page).toHaveURL('https://www.saucedemo.com/cart.html');

    // Verify initial cart state
    await expect(page.locator('.cart_item')).toHaveCount(2);
    await expect(page.getByText('Sauce Labs Backpack')).toBeVisible();
    await expect(page.getByText('Sauce Labs Bike Light')).toBeVisible();

    // Remove one product
    await page.locator('[data-test="remove-sauce-labs-backpack"]').click();
    
    // Verify cart updates
    await expect(page.locator('.cart_item')).toHaveCount(1);
    await expect(page.getByText('Sauce Labs Backpack')).not.toBeVisible();
    await expect(cartBadge).toHaveText('1');

    // Continue shopping
    await page.locator('[data-test="continue-shopping"]').click();
    await expect(page).toHaveURL('https://www.saucedemo.com/inventory.html');

    // Add another product
    await page.locator('[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]').click();

    // Verify cart maintains state
    await expect(cartBadge).toHaveText('2');
    await cartLink.click();
    await expect(page.locator('.cart_item')).toHaveCount(2);
    await expect(page.getByText('Sauce Labs Bike Light')).toBeVisible();
    await expect(page.getByText('Sauce Labs Bolt T-Shirt')).toBeVisible();
  });
});