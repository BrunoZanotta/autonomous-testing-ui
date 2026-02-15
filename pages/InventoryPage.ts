import { Page, Locator, expect } from '@playwright/test';
import { APP_URLS } from './LoginPage';

export const STORE_PRODUCTS = {
  backpack: {
    name: 'Sauce Labs Backpack',
    price: '$29.99',
    descriptionSnippet: 'carry.allTheThings()',
    addToCartDataTest: 'add-to-cart-sauce-labs-backpack',
  },
  bikeLight: {
    name: 'Sauce Labs Bike Light',
    price: '$9.99',
    descriptionSnippet: 'A red light',
    addToCartDataTest: 'add-to-cart-sauce-labs-bike-light',
  },
  boltTShirt: {
    name: 'Sauce Labs Bolt T-Shirt',
    price: '$15.99',
    descriptionSnippet: 'Get your testing superhero',
    addToCartDataTest: 'add-to-cart-sauce-labs-bolt-t-shirt',
  },
  fleeceJacket: {
    name: 'Sauce Labs Fleece Jacket',
    price: '$49.99',
    descriptionSnippet: 'fleece jacket',
    addToCartDataTest: 'add-to-cart-sauce-labs-fleece-jacket',
  },
  onesie: {
    name: 'Sauce Labs Onesie',
    price: '$7.99',
    descriptionSnippet: 'Rib snap infant onesie',
    addToCartDataTest: 'add-to-cart-sauce-labs-onesie',
  },
  tShirtRed: {
    name: 'Test.allTheThings() T-Shirt (Red)',
    price: '$15.99',
    descriptionSnippet: 'This classic Sauce Labs t-shirt',
    addToCartDataTest: 'add-to-cart-test.allthethings()-t-shirt-(red)',
  },
} as const;

export type StoreProductKey = keyof typeof STORE_PRODUCTS;

export const INVENTORY_SORT_OPTIONS = {
  nameAsc: 'az',
  nameDesc: 'za',
  priceAsc: 'lohi',
  priceDesc: 'hilo',
} as const;

export const INVENTORY_UI = {
  addToCartLabel: 'Add to cart',
  expectedProductCount: Object.keys(STORE_PRODUCTS).length,
} as const;

export class InventoryPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly inventoryContainer: Locator;
  readonly inventoryItems: Locator;
  readonly shoppingCartLink: Locator;
  readonly shoppingCartBadge: Locator;
  readonly sortDropdown: Locator;
  readonly burgerMenu: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByText('Products');
    this.inventoryContainer = page.locator('.inventory_container');
    this.inventoryItems = page.locator('.inventory_item');
    this.shoppingCartLink = page.locator('.shopping_cart_link');
    this.shoppingCartBadge = page.locator('.shopping_cart_badge');
    this.sortDropdown = page.locator('[data-test="product-sort-container"]');
    this.burgerMenu = page.locator('#react-burger-menu-btn');
  }

  async assertOnInventoryPage() {
    await expect(this.page).toHaveURL(new RegExp(`${APP_URLS.inventory}$`));
    await expect(this.pageTitle).toBeVisible();
    await expect(this.inventoryContainer).toBeVisible();
  }

  async assertProductCount(expectedCount: number = INVENTORY_UI.expectedProductCount) {
    await expect(this.inventoryItems).toHaveCount(expectedCount);
  }

  private getProductByName(productName: string) {
    return this.page.locator('.inventory_item', { hasText: productName });
  }

  async assertShoppingCartLinkVisible() {
    await expect(this.shoppingCartLink).toBeVisible();
  }

  async addProductToCartByKey(productKey: StoreProductKey) {
    await this.page.locator(`[data-test="${STORE_PRODUCTS[productKey].addToCartDataTest}"]`).click();
  }

  async assertCartBadgeCount(expectedCount: number | string) {
    await expect(this.shoppingCartBadge).toHaveText(String(expectedCount));
  }

  async assertCartBadgeNotVisible() {
    await expect(this.shoppingCartBadge).not.toBeVisible();
  }

  async goToCart() {
    await this.shoppingCartLink.click();
  }

  async selectSortOption(option: (typeof INVENTORY_SORT_OPTIONS)[keyof typeof INVENTORY_SORT_OPTIONS]) {
    await this.sortDropdown.selectOption(option);
  }

  async sortByNameDescending() {
    await this.selectSortOption(INVENTORY_SORT_OPTIONS.nameDesc);
  }

  async sortByPriceAscending() {
    await this.selectSortOption(INVENTORY_SORT_OPTIONS.priceAsc);
  }

  async sortByPriceDescending() {
    await this.selectSortOption(INVENTORY_SORT_OPTIONS.priceDesc);
  }

  async assertDefaultSortIsNameAscending() {
    await expect(this.sortDropdown).toHaveValue(INVENTORY_SORT_OPTIONS.nameAsc);
    await this.assertProductNamesSortedAscending();
  }

  private async getProductNames(): Promise<string[]> {
    return this.inventoryItems.locator('.inventory_item_name').allTextContents();
  }

  private async getProductPricesAsNumbers(): Promise<number[]> {
    const prices = await this.inventoryItems.locator('.inventory_item_price').allTextContents();
    return prices.map((price) => Number(price.replace('$', '')));
  }

  async assertProductNamesSortedAscending() {
    const names = await this.getProductNames();
    expect(names).toEqual([...names].sort());
  }

  async assertProductNamesSortedDescending() {
    const names = await this.getProductNames();
    expect(names).toEqual([...names].sort().reverse());
  }

  async assertProductPricesSortedAscending() {
    const prices = await this.getProductPricesAsNumbers();
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  }

  async assertProductPricesSortedDescending() {
    const prices = await this.getProductPricesAsNumbers();
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  }

  private async assertProductHasAllElements(productLocator: Locator) {
    await expect(productLocator.locator('img')).toBeVisible();
    await expect(productLocator.locator('.inventory_item_name')).toBeVisible();
    await expect(productLocator.locator('.inventory_item_desc')).toBeVisible();
    await expect(productLocator.locator('.inventory_item_price')).toBeVisible();
    await expect(productLocator.locator('button')).toBeVisible();
  }

  async assertFirstProductCardFor(productKey: StoreProductKey) {
    const productData = STORE_PRODUCTS[productKey];
    const firstProduct = this.inventoryItems.first();
    const productImage = firstProduct.locator('img');
    const productButton = firstProduct.locator('button');

    await expect(firstProduct.locator('.inventory_item_name')).toHaveText(productData.name);
    await expect(firstProduct.locator('.inventory_item_price')).toHaveText(productData.price);
    await expect(firstProduct.locator('.inventory_item_desc')).toContainText(productData.descriptionSnippet);
    await expect(productImage).toBeVisible();
    await expect(productImage).toHaveAttribute('alt', productData.name);
    await expect(productButton).toBeVisible();
    await expect(productButton).toHaveText(INVENTORY_UI.addToCartLabel);
  }

  async assertProductCardTitleDescriptionAndImageFor(productKey: StoreProductKey) {
    const productData = STORE_PRODUCTS[productKey];
    const product = this.getProductByName(productData.name);
    const productImage = product.locator('img');

    await expect(product.locator('.inventory_item_name')).toHaveText(productData.name);
    await expect(product.locator('.inventory_item_desc')).toContainText(productData.descriptionSnippet);
    await expect(productImage).toBeVisible();
    await expect(productImage).toHaveAttribute('alt', productData.name);
  }

  async assertAllProductsHaveRequiredElements() {
    const count = await this.inventoryItems.count();
    for (let i = 0; i < count; i++) {
      const product = this.inventoryItems.nth(i);
      await this.assertProductHasAllElements(product);
    }
  }
}
