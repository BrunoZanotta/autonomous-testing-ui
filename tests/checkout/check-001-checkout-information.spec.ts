import { test } from '../../fixtures/app.fixture';

test.describe('Checkout Process Tests', { tag: '@checkout' }, () => {
  test('Checkout Information', { tag: '@smoke' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage, cartPage, checkoutPage }) => {
    await test.step('Step 1: Add Product To Cart By Key', async () => {
      await inventoryPage.addProductToCartByKey('backpack');
    });

    await test.step('Step 2: Go To Cart', async () => {
      await inventoryPage.goToCart();
      await cartPage.assertOnCartPage();
      await cartPage.proceedToCheckout();
    });

    await test.step('Step 3: Assert On Checkout Info Page', async () => {
      await checkoutPage.assertOnCheckoutInfoPage();
      await checkoutPage.fillCheckoutInformationFromProfile('valid');
      await checkoutPage.clickContinue();
    });

    await test.step('Step 4: Assert On Checkout Overview Page', async () => {
      await checkoutPage.assertOnCheckoutOverviewPage();
      await checkoutPage.assertOrderSummaryVisible();
      await checkoutPage.assertDefaultPaymentMethod();
      await checkoutPage.assertDefaultShippingMethod();
      await checkoutPage.assertProductInOverviewByKey('backpack');
    });
  });

  test('Checkout Overview Supports Duplicate Product Prices', { tag: '@regression' }, async ({
    authenticatedPage: _authenticatedPage,
    inventoryPage,
    cartPage,
    checkoutPage,
  }) => {
    await test.step('Step 1: Add Product To Cart By Key', async () => {
      await inventoryPage.addProductToCartByKey('boltTShirt');
      await inventoryPage.addProductToCartByKey('tShirtRed');
    });

    await test.step('Step 2: Go To Cart', async () => {
      await inventoryPage.goToCart();
      await cartPage.assertOnCartPage();
      await cartPage.proceedToCheckout();
    });

    await test.step('Step 3: Assert On Checkout Info Page', async () => {
      await checkoutPage.assertOnCheckoutInfoPage();
      await checkoutPage.fillCheckoutInformationFromProfile('valid');
      await checkoutPage.clickContinue();
    });

    await test.step('Step 4: Assert On Checkout Overview Page', async () => {
      await checkoutPage.assertOnCheckoutOverviewPage();
      await checkoutPage.assertProductInOverviewByKey('boltTShirt');
      await checkoutPage.assertProductInOverviewByKey('tShirtRed');
      await checkoutPage.assertSubtotalEqualsProductSum(['boltTShirt', 'tShirtRed']);
      await checkoutPage.assertTotalEqualsSubtotalPlusTax();
    });
  });
});
