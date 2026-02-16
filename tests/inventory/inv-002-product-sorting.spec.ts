import { test } from '../../fixtures/app.fixture';

test.describe('Product Inventory Tests', { tag: '@inventory' }, () => {
  test('Product Sorting', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage }) => {
    await test.step('Step 1: Assert On Inventory Page', async () => {
      await inventoryPage.assertOnInventoryPage();
      await inventoryPage.assertDefaultSortIsNameAscending();
    });

    await test.step('Step 2: Sort By Name Descending', async () => {
      await inventoryPage.sortByNameDescending();
      await inventoryPage.assertProductNamesSortedDescending();
    });

    await test.step('Step 3: Sort By Price Ascending', async () => {
      await inventoryPage.sortByPriceAscending();
      await inventoryPage.assertProductPricesSortedAscending();
    });

    await test.step('Step 4: Sort By Price Descending', async () => {
      await inventoryPage.sortByPriceDescending();
      await inventoryPage.assertProductPricesSortedDescending();
    });
  });
});
