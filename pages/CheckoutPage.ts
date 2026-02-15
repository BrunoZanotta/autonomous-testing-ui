import { Page, Locator, expect } from '@playwright/test';
import { APP_URLS } from './LoginPage';
import { STORE_PRODUCTS, StoreProductKey } from './InventoryPage';

export const CHECKOUT_PROFILES = {
  valid: {
    firstName: 'John',
    lastName: 'Doe',
    postalCode: '12345',
  },
  alternative: {
    firstName: 'Jane',
    lastName: 'Smith',
    postalCode: '54321',
  },
} as const;

export type CheckoutProfileKey = keyof typeof CHECKOUT_PROFILES;

export const CHECKOUT_EXPECTED = {
  paymentMethod: 'SauceCard #31337',
  shippingMethod: 'Free Pony Express Delivery!',
  completeHeader: 'Thank you for your order!',
} as const;

export const CHECKOUT_ERROR_MESSAGES = {
  firstNameRequired: 'Error: First Name is required',
  lastNameRequired: 'Error: Last Name is required',
  postalCodeRequired: 'Error: Postal Code is required',
} as const;

export class CheckoutPage {
  readonly page: Page;
  readonly checkoutInfoTitle: Locator;
  readonly checkoutOverviewTitle: Locator;
  readonly checkoutCompleteTitle: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly postalCodeInput: Locator;
  readonly continueButton: Locator;
  readonly finishButton: Locator;
  readonly cancelButton: Locator;
  readonly errorMessage: Locator;
  readonly paymentInfo: Locator;
  readonly shippingInfo: Locator;
  readonly priceTotalLabel: Locator;
  readonly subtotalLabel: Locator;
  readonly taxLabel: Locator;
  readonly totalLabel: Locator;
  readonly completeHeader: Locator;
  readonly completeText: Locator;
  readonly backHomeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.checkoutInfoTitle = page.getByText('Checkout: Your Information');
    this.checkoutOverviewTitle = page.getByText('Checkout: Overview');
    this.checkoutCompleteTitle = page.getByText('Checkout: Complete!');
    this.firstNameInput = page.locator('[data-test="firstName"]');
    this.lastNameInput = page.locator('[data-test="lastName"]');
    this.postalCodeInput = page.locator('[data-test="postalCode"]');
    this.continueButton = page.locator('[data-test="continue"]');
    this.finishButton = page.locator('[data-test="finish"]');
    this.cancelButton = page.locator('[data-test="cancel"]');
    this.errorMessage = page.locator('[data-test="error"]');
    this.paymentInfo = page.getByText('Payment Information:');
    this.shippingInfo = page.getByText('Shipping Information:');
    this.priceTotalLabel = page.getByText('Price Total');
    this.subtotalLabel = page.locator('.summary_subtotal_label');
    this.taxLabel = page.locator('.summary_tax_label');
    this.totalLabel = page.locator('.summary_total_label');
    this.completeHeader = page.locator('.complete-header');
    this.completeText = page.locator('.complete-text');
    this.backHomeButton = page.locator('[data-test="back-to-products"]');
  }

  async assertOnCheckoutInfoPage() {
    await expect(this.page).toHaveURL(new RegExp(`${APP_URLS.checkoutStepOne}$`));
    await expect(this.checkoutInfoTitle).toBeVisible();
  }

  async assertOnCheckoutOverviewPage() {
    await expect(this.page).toHaveURL(new RegExp(`${APP_URLS.checkoutStepTwo}$`));
    await expect(this.checkoutOverviewTitle).toBeVisible();
  }

  async assertOnCheckoutCompletePage() {
    await expect(this.page).toHaveURL(new RegExp(`${APP_URLS.checkoutComplete}$`));
    await expect(this.checkoutCompleteTitle).toBeVisible();
  }

  async fillCheckoutInformation(firstName: string, lastName: string, postalCode: string) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.postalCodeInput.fill(postalCode);
  }

  async fillCheckoutInformationFromProfile(profile: CheckoutProfileKey) {
    const customer = CHECKOUT_PROFILES[profile];
    await this.fillCheckoutInformation(customer.firstName, customer.lastName, customer.postalCode);
  }

  async clickContinue() {
    await this.continueButton.click();
  }

  async clickFinish() {
    await this.finishButton.click();
  }

  async clickCancel() {
    await this.cancelButton.click();
  }

  async assertErrorMessage(expectedMessage: string) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(expectedMessage);
  }

  async assertOrderSummaryVisible() {
    await expect(this.paymentInfo).toBeVisible();
    await expect(this.shippingInfo).toBeVisible();
    await expect(this.priceTotalLabel).toBeVisible();
  }

  async assertPaymentMethod(method: string) {
    await expect(this.page.getByText(method)).toBeVisible();
  }

  async assertShippingMethod(method: string) {
    await expect(this.page.getByText(method)).toBeVisible();
  }

  async assertDefaultPaymentMethod() {
    await this.assertPaymentMethod(CHECKOUT_EXPECTED.paymentMethod);
  }

  async assertDefaultShippingMethod() {
    await this.assertShippingMethod(CHECKOUT_EXPECTED.shippingMethod);
  }

  async assertProductInOverviewByKey(productKey: StoreProductKey) {
    const product = STORE_PRODUCTS[productKey];
    const overviewItem = this.page.locator('.cart_item', {
      has: this.page.locator('.inventory_item_name', { hasText: product.name }),
    });

    await expect(overviewItem).toHaveCount(1);
    await expect(overviewItem.locator('.inventory_item_name')).toHaveText(product.name);
    await expect(overviewItem.locator('.inventory_item_desc')).toContainText(product.descriptionSnippet);
    await expect(overviewItem.locator('.inventory_item_price')).toHaveText(product.price);
  }

  private parseMoneyValue(text: string): number {
    const match = text.match(/\$([0-9]+(?:\.[0-9]{1,2})?)/);
    if (!match) {
      throw new Error(`Could not parse money value from: ${text}`);
    }

    return Number(match[1]);
  }

  async getSubtotal(): Promise<string> {
    return (await this.subtotalLabel.textContent()) || '';
  }

  async getTax(): Promise<string> {
    return (await this.taxLabel.textContent()) || '';
  }

  async getTotal(): Promise<string> {
    return (await this.totalLabel.textContent()) || '';
  }

  async assertSubtotalEqualsProductSum(productKeys: StoreProductKey[]) {
    const expectedSubtotal = productKeys.reduce((sum, key) => {
      const productPrice = Number(STORE_PRODUCTS[key].price.replace('$', ''));
      return sum + productPrice;
    }, 0);

    const subtotalText = await this.getSubtotal();
    const subtotalValue = this.parseMoneyValue(subtotalText);

    expect(subtotalValue).toBeCloseTo(expectedSubtotal, 2);
  }

  async assertTotalEqualsSubtotalPlusTax() {
    const subtotalValue = this.parseMoneyValue(await this.getSubtotal());
    const taxValue = this.parseMoneyValue(await this.getTax());
    const totalValue = this.parseMoneyValue(await this.getTotal());

    expect(totalValue).toBeCloseTo(subtotalValue + taxValue, 2);
  }

  async assertCheckoutComplete() {
    await expect(this.completeHeader).toHaveText(CHECKOUT_EXPECTED.completeHeader);
    await expect(this.completeText).toBeVisible();
  }

  async clickBackHome() {
    await this.backHomeButton.click();
  }
}
