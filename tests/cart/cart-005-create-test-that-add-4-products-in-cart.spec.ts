import { test } from '../../fixtures/app.fixture';

test.describe('Shopping Cart Tests', { tag: '@cart' }, () => {
  test('Cart Two Products Validation', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage, cartPage, checkoutPage }) => {
    await inventoryPage.assertOnInventoryPage();
    await inventoryPage.assertProductCardDetailsFor('fleeceJacket');
    await inventoryPage.assertProductCardDetailsFor('backpack');

    await inventoryPage.addProductToCartByKey('fleeceJacket');
    await inventoryPage.addProductToCartByKey('backpack');
    await inventoryPage.assertCartBadgeCount(2);

    await inventoryPage.goToCart();
    await cartPage.assertOnCartPage();
    await cartPage.assertCartItemCount(2);
    await cartPage.assertProductDetailsInCartByKey('fleeceJacket');
    await cartPage.assertProductDetailsInCartByKey('backpack');

    await cartPage.proceedToCheckout();
    await checkoutPage.assertOnCheckoutInfoPage();
    await checkoutPage.fillCheckoutInformationFromProfile('valid');
    await checkoutPage.clickContinue();

    await checkoutPage.assertOnCheckoutOverviewPage();
    await checkoutPage.assertProductInOverviewByKey('fleeceJacket');
    await checkoutPage.assertProductInOverviewByKey('backpack');
    await checkoutPage.assertSubtotalEqualsProductSum(['fleeceJacket', 'backpack']);
    await checkoutPage.assertTotalEqualsSubtotalPlusTax();
  });
});
