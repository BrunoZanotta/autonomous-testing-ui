import { test } from '../../fixtures/app.fixture';

test.describe('Authentication Tests', { tag: '@auth' }, () => {
  test('Failed Login Attempts', { tag: '@smoke' }, async ({ loginPage }) => {
    await test.step('Step 1: Goto', async () => {
      await loginPage.goto();
      await loginPage.loginWithInvalidUsername();
      await loginPage.assertInvalidCredentialsError();
    });

    await test.step('Step 2: Login With Wrong Password', async () => {
      await loginPage.loginWithWrongPassword();
      await loginPage.assertInvalidCredentialsError();
    });

    await test.step('Step 3: Login Without Username', async () => {
      await loginPage.loginWithoutUsername();
      await loginPage.assertUsernameRequiredError();
    });

    await test.step('Step 4: Login As Locked User', async () => {
      await loginPage.loginAsLockedUser();
      await loginPage.assertLockedUserError();
    });
  });
});
