import { test } from '../../fixtures/app.fixture';

test.describe('Authentication Tests', { tag: '@auth' }, () => {
  test('Successful Login', { tag: '@smoke' }, async ({ loginPage, inventoryPage }) => {
    await test.step('Step 1: Goto', async () => {
      await loginPage.goto();
      await loginPage.loginAsStandardUser();
      await loginPage.assertLoginSuccess();
      await inventoryPage.assertOnInventoryPage();
      await inventoryPage.assertShoppingCartLinkVisible();
    });
  });
});
