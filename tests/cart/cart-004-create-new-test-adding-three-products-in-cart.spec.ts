import { test } from '../../fixtures/app.fixture';

test.describe('Shopping Cart Tests', { tag: '@cart' }, () => {
  test('Cart Two Products Validation', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage, cartPage, checkoutPage }) => {
    await inventoryPage.assertOnInventoryPage();
    await inventoryPage.assertProductCardDetailsFor('onesie');
    await inventoryPage.assertProductCardDetailsFor('bikeLight');

    await inventoryPage.addProductToCartByKey('onesie');
    await inventoryPage.addProductToCartByKey('bikeLight');
    await inventoryPage.assertCartBadgeCount(2);

    await inventoryPage.goToCart();
    await cartPage.assertOnCartPage();
    await cartPage.assertCartItemCount(2);
    await cartPage.assertProductDetailsInCartByKey('onesie');
    await cartPage.assertProductDetailsInCartByKey('bikeLight');

    await cartPage.proceedToCheckout();
    await checkoutPage.assertOnCheckoutInfoPage();
    await checkoutPage.fillCheckoutInformationFromProfile('valid');
    await checkoutPage.clickContinue();

    await checkoutPage.assertOnCheckoutOverviewPage();
    await checkoutPage.assertProductInOverviewByKey('onesie');
    await checkoutPage.assertProductInOverviewByKey('bikeLight');
    await checkoutPage.assertSubtotalEqualsProductSum(['onesie', 'bikeLight']);
    await checkoutPage.assertTotalEqualsSubtotalPlusTax();
  });
});
