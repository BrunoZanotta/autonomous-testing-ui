import { test } from '../../fixtures/app.fixture';

test.describe('Shopping Cart Tests', { tag: '@cart' }, () => {
  test('Add Products to Cart', { tag: '@smoke' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage, cartPage }) => {
    await inventoryPage.addProductToCartByKey('backpack');
    await inventoryPage.addProductToCartByKey('bikeLight');

    await inventoryPage.assertCartBadgeCount(2);

    await inventoryPage.goToCart();

    await cartPage.assertOnCartPage();
    await cartPage.assertCartItemCount(2);
    await cartPage.assertProductInCartByKey('backpack');
    await cartPage.assertProductInCartByKey('bikeLight');
    await cartPage.assertAllItemsQuantity('1');
  });
});
