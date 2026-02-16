import { test } from '../../fixtures/app.fixture';

test.describe('Shopping Cart Tests', { tag: '@cart' }, () => {
  test('Add Products to Cart', { tag: '@smoke' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage, cartPage }) => {
    await test.step('Step 1: Add Product To Cart By Key', async () => {
      await inventoryPage.addProductToCartByKey('backpack');
      await inventoryPage.addProductToCartByKey('bikeLight');
    });

    await test.step('Step 2: Assert Cart Badge Count', async () => {
      await inventoryPage.assertCartBadgeCount(2);
    });

    await test.step('Step 3: Go To Cart', async () => {
      await inventoryPage.goToCart();
    });

    await test.step('Step 4: Assert On Cart Page', async () => {
      await cartPage.assertOnCartPage();
      await cartPage.assertCartItemCount(2);
      await cartPage.assertProductInCartByKey('backpack');
      await cartPage.assertProductInCartByKey('bikeLight');
      await cartPage.assertAllItemsQuantity('1');
    });
  });
});
