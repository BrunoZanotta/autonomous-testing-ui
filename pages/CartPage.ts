import { Page, Locator, expect } from '@playwright/test';

export class CartPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly cartItems: Locator;
  readonly continueShoppingButton: Locator;
  readonly checkoutButton: Locator;
  readonly removeButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByText('Your Cart');
    this.cartItems = page.locator('.cart_item');
    this.continueShoppingButton = page.locator('[data-test="continue-shopping"]');
    this.checkoutButton = page.locator('[data-test=""]');
    this.removeButtons = page.locator('button[id^="remove-"]');
  }

  async assertOnCartPage() {
    await expect(this.pageTitle).toBeVisible();
  }

  async assertCartItemCount(expectedCount: number) {
    await expect(this.cartItems).toHaveCount(expectedCount);
  }

  async assertEmptyCart() {
    await expect(this.cartItems).toHaveCount(0);
  }

  async getCartItemByName(productName: string) {
    return this.page.locator('.cart_item', { hasText: productName });
  }

  async assertProductInCart(productName: string, price: string) {
    const cartItem = await this.getCartItemByName(productName);
    await expect(cartItem.locator('.inventory_item_name')).toHaveText(productName);
    await expect(cartItem.locator('.inventory_item_price')).toHaveText(price);
  }

  async assertProductQuantity(index: number, expectedQuantity: string) {
    await expect(this.cartItems.nth(index).locator('.cart_quantity')).toHaveText(expectedQuantity);
  }

  async removeProductByName(productName: string) {
    const cartItem = await this.getCartItemByName(productName);
    await cartItem.locator('button[id^="remove-"]').click();
  }

  async removeProductByIndex(index: number) {
    await this.removeButtons.nth(index).click();
  }

  async continueShopping() {
    await this.continueShoppingButton.click();
  }

  async proceedToCheckout() {
    await this.checkoutButton.click();
  }

  async getAllCartItemNames(): Promise<string[]> {
    const names = await this.cartItems.locator('.inventory_item_name').allTextContents();
    return names;
  }

  async getAllCartItemPrices(): Promise<string[]> {
    const prices = await this.cartItems.locator('.inventory_item_price').allTextContents();
    return prices;
  }
}
