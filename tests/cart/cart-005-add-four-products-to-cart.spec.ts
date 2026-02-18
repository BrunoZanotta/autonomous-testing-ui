import { test } from '../../fixtures/app.fixture';

test.describe('Shopping Cart Tests', { tag: '@cart' }, () => {
  test('Cart Four Products Validation', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage, cartPage, checkoutPage }) => {
    await test.step('Step 1: Assert On Inventory Page', async () => {
      await inventoryPage.assertOnInventoryPage();
      await inventoryPage.assertProductCardDetailsFor('fleeceJacket');
      await inventoryPage.assertProductCardDetailsFor('backpack');
      await inventoryPage.assertProductCardDetailsFor('tShirtRed');
      await inventoryPage.assertProductCardDetailsFor('boltTShirt');
    });

    await test.step('Step 2: Add Product To Cart By Key', async () => {
      await inventoryPage.addProductToCartByKey('fleeceJacket');
      await inventoryPage.addProductToCartByKey('backpack');
      await inventoryPage.addProductToCartByKey('tShirtRed');
      await inventoryPage.addProductToCartByKey('boltTShirt');
      await inventoryPage.assertCartBadgeCount(4);
    });

    await test.step('Step 3: Go To Cart', async () => {
      await inventoryPage.goToCart();
      await cartPage.assertOnCartPage();
      await cartPage.assertCartItemCount(4);
      await cartPage.assertProductDetailsInCartByKey('fleeceJacket');
      await cartPage.assertProductDetailsInCartByKey('backpack');
      await cartPage.assertProductDetailsInCartByKey('tShirtRed');
      await cartPage.assertProductDetailsInCartByKey('boltTShirt');
    });

    await test.step('Step 4: Proceed To Checkout', async () => {
      await cartPage.proceedToCheckout();
      await checkoutPage.assertOnCheckoutInfoPage();
      await checkoutPage.fillCheckoutInformationFromProfile('valid');
      await checkoutPage.clickContinue();
    });

    await test.step('Step 5: Assert On Checkout Overview Page', async () => {
      await checkoutPage.assertOnCheckoutOverviewPage();
      await checkoutPage.assertProductInOverviewByKey('fleeceJacket');
      await checkoutPage.assertProductInOverviewByKey('backpack');
      await checkoutPage.assertProductInOverviewByKey('tShirtRed');
      await checkoutPage.assertProductInOverviewByKey('boltTShirt');
      await checkoutPage.assertSubtotalEqualsProductSum(['fleeceJacket', 'backpack', 'tShirtRed', 'boltTShirt']);
      await checkoutPage.assertTotalEqualsSubtotalPlusTax();
    });
  });
});
