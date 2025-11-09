import { test, expect } from '@playwright/test';

test.describe('Shopping Cart Tests', () => {
  test('Add Products to Cart', async ({ page }) => {
    // Login as standard_user
    await page.goto('https://www.saucedemo.com');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();

    // Add multiple products to cart
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]').click();

    // Verify cart badge updates
    const cartBadge = page.locator('.shopping_cart_badge');
    await expect(cartBadge).toHaveText('2');

    // Click cart icon
    await page.locator('.shopping_cart_link').click();

    // Verify cart page displays correct items and prices
    await expect(page.getByText('Your Cart')).toBeVisible();
    
    // Verify first item (Backpack)
    const backpackItem = page.locator('.cart_item').first();
    await expect(backpackItem.locator('.inventory_item_name')).toHaveText('Sauce Labs Backpack');
    await expect(backpackItem.locator('.inventory_item_price')).toHaveText('$29.99');

    // Verify second item (Bike Light)
    const bikeLightItem = page.locator('.cart_item').nth(1);
    await expect(bikeLightItem.locator('.inventory_item_name')).toHaveText('Sauce Labs Bike Light');
    await expect(bikeLightItem.locator('.inventory_item_price')).toHaveText('$9.99');

    // Verify item quantity
    await expect(page.locator('.cart_quantity')).toHaveCount(2);
    await expect(page.locator('.cart_quantity').first()).toHaveText('1');
    await expect(page.locator('.cart_quantity').nth(1)).toHaveText('1');
  });
});