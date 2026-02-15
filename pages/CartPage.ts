import { Page, Locator, expect } from '@playwright/test';
import { APP_URLS } from './LoginPage';
import { STORE_PRODUCTS, StoreProductKey } from './InventoryPage';

export class CartPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly cartItems: Locator;
  readonly continueShoppingButton: Locator;
  readonly checkoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByText('Your Cart');
    this.cartItems = page.locator('.cart_item');
    this.continueShoppingButton = page.locator('[data-test="continue-shopping"]');
    this.checkoutButton = page.locator('[data-test="checkout"]');
  }

  async assertOnCartPage() {
    await expect(this.page).toHaveURL(new RegExp(`${APP_URLS.cart}$`));
    await expect(this.pageTitle).toBeVisible();
  }

  async assertCartItemCount(expectedCount: number) {
    await expect(this.cartItems).toHaveCount(expectedCount);
  }

  async assertEmptyCart() {
    await expect(this.cartItems).toHaveCount(0);
  }

  private getCartItemByName(productName: string) {
    return this.page.locator('.cart_item', { hasText: productName });
  }

  async assertProductInCartByKey(productKey: StoreProductKey) {
    const product = STORE_PRODUCTS[productKey];
    const cartItem = this.getCartItemByName(product.name);
    await expect(cartItem.locator('.inventory_item_name')).toHaveText(product.name);
    await expect(cartItem.locator('.inventory_item_price')).toHaveText(product.price);
  }

  async assertProductNotInCartByKey(productKey: StoreProductKey) {
    const cartItem = this.getCartItemByName(STORE_PRODUCTS[productKey].name);
    await expect(cartItem).toHaveCount(0);
  }

  async assertAllItemsQuantity(expectedQuantity: string) {
    const itemCount = await this.cartItems.count();
    for (let i = 0; i < itemCount; i++) {
      await expect(this.cartItems.nth(i).locator('.cart_quantity')).toHaveText(expectedQuantity);
    }
  }

  async removeProductByKey(productKey: StoreProductKey) {
    const cartItem = this.getCartItemByName(STORE_PRODUCTS[productKey].name);
    await cartItem.locator('button[id^="remove-"]').click();
  }

  async continueShopping() {
    await this.continueShoppingButton.click();
  }

  async proceedToCheckout() {
    await this.checkoutButton.click();
  }
}
