import { test } from '../../fixtures/app.fixture';

test.describe('Product Inventory Tests', { tag: '@inventory' }, () => {
  test('Product Listing', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage }) => {
    await test.step('Step 1: Assert On Inventory Page', async () => {
      await inventoryPage.assertOnInventoryPage();
      await inventoryPage.assertFirstProductCardFor('backpack');
      await inventoryPage.assertProductCount();
      await inventoryPage.assertAllProductsHaveRequiredElements();
    });
  });
});
