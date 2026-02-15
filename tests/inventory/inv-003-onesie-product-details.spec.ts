import { test } from '../../fixtures/app.fixture';

test.describe('Product Inventory Tests', { tag: '@inventory' }, () => {
  test('Onesie Product Details', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage }) => {
    await inventoryPage.assertOnInventoryPage();
    await inventoryPage.assertProductCardTitleDescriptionAndImageFor('onesie');
  });
});
