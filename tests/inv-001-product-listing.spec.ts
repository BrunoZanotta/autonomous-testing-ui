import { test, expect } from '@playwright/test';

test.describe('Product Inventory Tests', () => {
  test('Product Listing', async ({ page }) => {
    // Login as standard_user
    await page.goto('https://www.saucedemo.com');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();

    // Verify product grid layout
    await expect(page.getByText('Products')).toBeVisible();
    const inventoryContainer = page.locator('.inventory_container');
    await expect(inventoryContainer).toBeVisible();

    // Verify first product card elements (Sauce Labs Backpack)
    const firstProduct = page.locator('.inventory_item').first();
    
    // Verify product image
    await expect(firstProduct.locator('img')).toBeVisible();
    await expect(firstProduct.locator('img')).toHaveAttribute('alt', 'Sauce Labs Backpack');
    
    // Verify product name
    await expect(firstProduct.locator('.inventory_item_name')).toBeVisible();
    await expect(firstProduct.locator('.inventory_item_name')).toHaveText('Sauce Labs Backpack');
    
    // Verify product description
    await expect(firstProduct.locator('.inventory_item_desc')).toBeVisible();
    await expect(firstProduct.locator('.inventory_item_desc')).toContainText('carry.allTheThings()');
    
    // Verify product price
    await expect(firstProduct.locator('.inventory_item_price')).toBeVisible();
    await expect(firstProduct.locator('.inventory_item_price')).toHaveText('$29.99');
    
    // Verify Add to Cart button
    await expect(firstProduct.locator('button')).toBeVisible();
    await expect(firstProduct.locator('button')).toHaveText('Add to cart');

    // Verify all products are displayed (6 items total)
    await expect(page.locator('.inventory_item')).toHaveCount(6);

    // Verify each product has all required elements
    const products = page.locator('.inventory_item');
    const count = await products.count();
    
    for (let i = 0; i < count; i++) {
      const product = products.nth(i);
      await expect(product.locator('img')).toBeVisible();
      await expect(product.locator('.inventory_item_name')).toBeVisible();
      await expect(product.locator('.inventory_item_desc')).toBeVisible();
      await expect(product.locator('.inventory_item_price')).toBeVisible();
      await expect(product.locator('button')).toBeVisible();
    }
  });
});