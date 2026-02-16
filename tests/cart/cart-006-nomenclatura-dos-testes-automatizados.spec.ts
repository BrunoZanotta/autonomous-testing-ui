import { test } from '../../fixtures/app.fixture';

test.describe('Shopping Cart Tests', { tag: '@cart' }, () => {
  test('Cart Two Products Validation', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage, cartPage, checkoutPage }) => {
    await inventoryPage.assertOnInventoryPage();
    await inventoryPage.assertProductCardDetailsFor('boltTShirt');
    await inventoryPage.assertProductCardDetailsFor('tShirtRed');

    await inventoryPage.addProductToCartByKey('boltTShirt');
    await inventoryPage.addProductToCartByKey('tShirtRed');
    await inventoryPage.assertCartBadgeCount(2);

    await inventoryPage.goToCart();
    await cartPage.assertOnCartPage();
    await cartPage.assertCartItemCount(2);
    await cartPage.assertProductDetailsInCartByKey('boltTShirt');
    await cartPage.assertProductDetailsInCartByKey('tShirtRed');

    await cartPage.proceedToCheckout();
    await checkoutPage.assertOnCheckoutInfoPage();
    await checkoutPage.fillCheckoutInformationFromProfile('valid');
    await checkoutPage.clickContinue();

    await checkoutPage.assertOnCheckoutOverviewPage();
    await checkoutPage.assertProductInOverviewByKey('boltTShirt');
    await checkoutPage.assertProductInOverviewByKey('tShirtRed');
    await checkoutPage.assertSubtotalEqualsProductSum(['boltTShirt', 'tShirtRed']);
    await checkoutPage.assertTotalEqualsSubtotalPlusTax();
  });
});
