import { test } from '../../fixtures/app.fixture';

test.describe('Shopping Cart Tests', { tag: '@cart' }, () => {
  test('Cart Management', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage, cartPage }) => {
    await inventoryPage.addProductToCartByKey('backpack');
    await inventoryPage.addProductToCartByKey('bikeLight');
    await inventoryPage.assertCartBadgeCount(2);

    await inventoryPage.goToCart();
    await cartPage.assertCartItemCount(2);
    await cartPage.assertOnCartPage();
    await cartPage.assertProductInCartByKey('backpack');
    await cartPage.assertProductInCartByKey('bikeLight');

    await cartPage.removeProductByKey('backpack');

    await cartPage.assertCartItemCount(1);
    await cartPage.assertProductNotInCartByKey('backpack');
    await inventoryPage.assertCartBadgeCount(1);

    await cartPage.continueShopping();
    await inventoryPage.assertOnInventoryPage();

    await inventoryPage.addProductToCartByKey('boltTShirt');

    await inventoryPage.assertCartBadgeCount(2);
    await inventoryPage.goToCart();
    await cartPage.assertCartItemCount(2);
    await cartPage.assertProductInCartByKey('bikeLight');
    await cartPage.assertProductInCartByKey('boltTShirt');
  });
});
