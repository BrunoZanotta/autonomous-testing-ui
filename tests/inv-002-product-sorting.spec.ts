import { test, expect } from '@playwright/test';

test.describe('Product Inventory Tests', () => {
  test('Product Sorting', async ({ page }) => {
    // Login as standard_user
    await page.goto('https://www.saucedemo.com');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();

    // Store locators
    const sortDropdown = page.locator('[data-test="product-sort-container"]');
    const productNames = page.locator('.inventory_item_name');
    const productPrices = page.locator('.inventory_item_price');

    // Verify initial sort (Name A to Z)
    await expect(sortDropdown).toHaveValue('az');
    let names = await productNames.allInnerTexts();
    expect(names).toEqual([...names].sort());

    // Test Name (Z to A) sorting
    await sortDropdown.selectOption('za');
    names = await productNames.allInnerTexts();
    expect(names).toEqual([...names].sort().reverse());

    // Test Price (low to high) sorting
    await sortDropdown.selectOption('lohi');
    let prices = (await productPrices.allInnerTexts()).map(price => parseFloat(price.replace('$', '')));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    // Test Price (high to low) sorting
    await sortDropdown.selectOption('hilo');
    prices = (await productPrices.allInnerTexts()).map(price => parseFloat(price.replace('$', '')));
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });
});