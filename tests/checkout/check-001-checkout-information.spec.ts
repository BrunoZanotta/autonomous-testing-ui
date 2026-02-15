import { test } from '../../fixtures/app.fixture';

test.describe('Checkout Process Tests', { tag: '@checkout' }, () => {
  test('Checkout Information', { tag: '@smoke' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage, cartPage, checkoutPage }) => {
    await inventoryPage.addProductToCartByKey('backpack');

    await inventoryPage.goToCart();
    await cartPage.assertOnCartPage();
    await cartPage.proceedToCheckout();

    await checkoutPage.assertOnCheckoutInfoPage();
    await checkoutPage.fillCheckoutInformationFromProfile('valid');
    await checkoutPage.clickContinue();

    await checkoutPage.assertOnCheckoutOverviewPage();
    await checkoutPage.assertOrderSummaryVisible();
    await checkoutPage.assertDefaultPaymentMethod();
    await checkoutPage.assertDefaultShippingMethod();
    await checkoutPage.assertProductInOverviewByKey('backpack');
  });
});
