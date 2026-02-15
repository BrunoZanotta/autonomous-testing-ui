import { Page } from '@playwright/test';
import { APP_URLS, LoginPage } from './LoginPage';

export class AuthSessionPage {
  readonly page: Page;
  readonly loginPage: LoginPage;

  constructor(page: Page) {
    this.page = page;
    this.loginPage = new LoginPage(page);
  }

  async bootstrapAuthenticatedSession() {
    await this.loginPage.goto();
    await this.loginPage.loginAsStandardUser();
    await this.page.waitForURL(new RegExp(`${APP_URLS.inventory}$`));
  }
}
