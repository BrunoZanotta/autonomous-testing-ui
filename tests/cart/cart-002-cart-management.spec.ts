import { test } from '../../fixtures/app.fixture';

test.describe('Shopping Cart Tests', { tag: '@cart' }, () => {
  test('Cart Management', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage, cartPage }) => {
    await test.step('Step 1: Add Product To Cart By Key', async () => {
      await inventoryPage.addProductToCartByKey('backpack');
      await inventoryPage.addProductToCartByKey('bikeLight');
      await inventoryPage.assertCartBadgeCount(2);
    });

    await test.step('Step 2: Go To Cart', async () => {
      await inventoryPage.goToCart();
      await cartPage.assertCartItemCount(2);
      await cartPage.assertOnCartPage();
      await cartPage.assertProductInCartByKey('backpack');
      await cartPage.assertProductInCartByKey('bikeLight');
    });

    await test.step('Step 3: Remove Product By Key', async () => {
      await cartPage.removeProductByKey('backpack');
    });

    await test.step('Step 4: Assert Cart Item Count', async () => {
      await cartPage.assertCartItemCount(1);
      await cartPage.assertProductNotInCartByKey('backpack');
      await inventoryPage.assertCartBadgeCount(1);
    });

    await test.step('Step 5: Continue Shopping', async () => {
      await cartPage.continueShopping();
      await inventoryPage.assertOnInventoryPage();
    });

    await test.step('Step 6: Add Product To Cart By Key', async () => {
      await inventoryPage.addProductToCartByKey('boltTShirt');
    });

    await test.step('Step 7: Assert Cart Badge Count', async () => {
      await inventoryPage.assertCartBadgeCount(2);
      await inventoryPage.goToCart();
      await cartPage.assertCartItemCount(2);
      await cartPage.assertProductInCartByKey('bikeLight');
      await cartPage.assertProductInCartByKey('boltTShirt');
    });
  });
});
