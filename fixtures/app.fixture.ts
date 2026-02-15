import { test as base, Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { InventoryPage } from '../pages/InventoryPage';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { AuthSessionPage } from '../pages/AuthSessionPage';

type PageObjects = {
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  authSessionPage: AuthSessionPage;
};

type AuthenticatedPageFixture = {
  authenticatedPage: Page;
};

export const test = base.extend<PageObjects & AuthenticatedPageFixture>({
  // Page Objects fixtures
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  inventoryPage: async ({ page }, use) => {
    await use(new InventoryPage(page));
  },

  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },

  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },

  authSessionPage: async ({ page }, use) => {
    await use(new AuthSessionPage(page));
  },

  authenticatedPage: async ({ page, authSessionPage }, use) => {
    await authSessionPage.bootstrapAuthenticatedSession();
    await use(page);
  },
});

export { expect } from '@playwright/test';
