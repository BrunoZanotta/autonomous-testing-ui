import { test } from '../../fixtures/app.fixture';

test.describe('Product Inventory Tests', { tag: '@inventory' }, () => {
  test('Product Sorting', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage }) => {
    await inventoryPage.assertOnInventoryPage();
    await inventoryPage.assertDefaultSortIsNameAscending();

    await inventoryPage.sortByNameDescending();
    await inventoryPage.assertProductNamesSortedDescending();

    await inventoryPage.sortByPriceAscending();
    await inventoryPage.assertProductPricesSortedAscending();

    await inventoryPage.sortByPriceDescending();
    await inventoryPage.assertProductPricesSortedDescending();
  });
});
