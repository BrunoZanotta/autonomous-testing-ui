import { Locator, Page, expect } from '@playwright/test';

const readRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
};

export const APP_URLS = {
  base: readRequiredEnv('BASE_URL'),
  inventory: '/inventory.html',
  cart: '/cart.html',
  checkoutStepOne: '/checkout-step-one.html',
  checkoutStepTwo: '/checkout-step-two.html',
  checkoutComplete: '/checkout-complete.html',
} as const;

const getAppUsers = () => ({
  standard: {
    username: readRequiredEnv('APP_USER_STANDARD_USERNAME'),
    password: readRequiredEnv('APP_USER_STANDARD_PASSWORD'),
  },
  locked: {
    username: readRequiredEnv('APP_USER_LOCKED_USERNAME'),
    password: readRequiredEnv('APP_USER_LOCKED_PASSWORD'),
  },
  invalid: {
    username: readRequiredEnv('APP_USER_INVALID_USERNAME'),
    password: readRequiredEnv('APP_USER_INVALID_PASSWORD'),
  },
}) as const;

export const AUTH_ERROR_MESSAGES = {
  usernameRequired: 'Epic sadface: Username is required',
  invalidCredentials: 'Epic sadface: Username and password do not match any user in this service',
  lockedUser: 'Epic sadface: Sorry, this user has been locked out.',
} as const;

export type AppUserKey = keyof ReturnType<typeof getAppUsers>;

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('[data-test="username"]');
    this.passwordInput = page.locator('[data-test="password"]');
    this.loginButton = page.locator('[data-test="login-button"]');
    this.errorMessage = page.locator('[data-test="error"]');
  }

  async goto() {
    await this.page.goto(APP_URLS.base);
  }

  async fillUsername(username: string) {
    await this.usernameInput.fill(username);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async clickLogin() {
    await this.loginButton.click();
  }

  async login(username: string, password: string) {
    await this.fillUsername(username);
    await this.fillPassword(password);
    await this.clickLogin();
  }

  async loginAs(user: AppUserKey) {
    const credentials = getAppUsers()[user];
    await this.login(credentials.username, credentials.password);
  }

  async loginAsStandardUser() {
    await this.loginAs('standard');
  }

  async loginWithInvalidUsername() {
    await this.loginAs('invalid');
  }

  async loginWithWrongPassword() {
    await this.login(getAppUsers().standard.username, 'wrong_password');
  }

  async loginWithoutUsername() {
    await this.fillUsername('');
    await this.fillPassword(getAppUsers().standard.password);
    await this.clickLogin();
  }

  async loginAsLockedUser() {
    await this.loginAs('locked');
  }

  async assertLoginSuccess() {
    await expect(this.page).toHaveURL(new RegExp(`${APP_URLS.inventory}$`));
  }

  async assertErrorMessage(expectedMessage: string) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(expectedMessage);
  }

  async assertOnLoginPage() {
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.loginButton).toBeVisible();
  }

  async assertInvalidCredentialsError() {
    await this.assertErrorMessage(AUTH_ERROR_MESSAGES.invalidCredentials);
  }

  async assertUsernameRequiredError() {
    await this.assertErrorMessage(AUTH_ERROR_MESSAGES.usernameRequired);
  }

  async assertLockedUserError() {
    await this.assertErrorMessage(AUTH_ERROR_MESSAGES.lockedUser);
  }
}
