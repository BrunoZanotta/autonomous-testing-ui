import { test } from '../../fixtures/app.fixture';

test.describe('Authentication Tests', { tag: '@auth' }, () => {
  test('Failed Login Attempts', { tag: '@smoke' }, async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.loginWithInvalidUsername();
    await loginPage.assertInvalidCredentialsError();

    await loginPage.loginWithWrongPassword();
    await loginPage.assertInvalidCredentialsError();

    await loginPage.loginWithoutUsername();
    await loginPage.assertUsernameRequiredError();

    await loginPage.loginAsLockedUser();
    await loginPage.assertLockedUserError();
  });
});
