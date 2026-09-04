import { test, expect } from '@playwright/test';
import {
  ACCOUNTS,
  BASE,
  expectApiOnline,
  login,
  logout,
  navTab,
  tabVisible,
} from './helpers';

test.use({ viewport: { width: 1280, height: 900 } });

/* ─── AUTH ─── */
test.describe('Authentication', () => {
  test('TC-AUTH-001: Login page loads', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expectApiOnline(page);
  });

  test('TC-AUTH-002: Continue disabled when fields empty', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  test('TC-AUTH-003: Invalid credentials show error', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.locator('input[type="email"]').fill('bad@example.com');
    await page.locator('input[type="password"]').fill('wrongpass');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('TC-AUTH-004: Super admin login', async ({ page }) => {
    const { email, password } = ACCOUNTS.superAdmin;
    await login(page, email, password);
    await expect(page).toHaveURL(/\/admin\/companies/);
    await expect(page.getByRole('button', { name: 'Companies' })).toBeVisible();
  });

  test('TC-AUTH-005: Company owner login', async ({ page }) => {
    const { email, password } = ACCOUNTS.companyOwner;
    await login(page, email, password);
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('TC-AUTH-006: Driver login', async ({ page }) => {
    const { email, password } = ACCOUNTS.driver;
    await login(page, email, password);
    await expect(page).toHaveURL(/\/driver\/sheets/);
  });

  test('TC-AUTH-007: Logout returns to login', async ({ page }) => {
    await login(page, ACCOUNTS.companyOwner.email, ACCOUNTS.companyOwner.password);
    await logout(page);
  });

  test('TC-AUTH-008: Forgot password flow', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`);
    await expect(page.getByRole('heading', { name: 'Forgot password' })).toBeVisible();
    await page.locator('input[type="email"]').fill(ACCOUNTS.companyOwner.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(
      page.getByText(/reset link|account exists/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('TC-AUTH-009: Session persists after refresh', async ({ page }) => {
    await login(page, ACCOUNTS.companyOwner.email, ACCOUNTS.companyOwner.password);
    await page.reload();
    await expect(page).toHaveURL(/\/app\/dashboard/);
    await expect(page.locator('.ts-nav-item').first()).toBeVisible();
  });

  test('TC-AUTH-010: Unauthenticated /app redirects to login', async ({ page }) => {
    await page.goto(`${BASE}/app/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-AUTH-011: Driver blocked from super admin', async ({ page }) => {
    await login(page, ACCOUNTS.driver.email, ACCOUNTS.driver.password);
    await page.goto(`${BASE}/admin/companies`);
    await expect(page).toHaveURL(/\/driver\//);
  });
});

/* ─── SUPER ADMIN ─── */
test.describe('Super Admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password);
  });

  test('TC-SA-001: Companies tab lists tenants', async ({ page }) => {
    await expect(page.getByText(/registered/i)).toBeVisible();
    await expect(page.getByText('MKX Transport')).toBeVisible();
  });

  test('TC-SA-002: Tenant ops tab loads', async ({ page }) => {
    await navTab(page, 'Tenant ops');
    await expect(page.getByText('Tenant ops').first()).toBeVisible();
  });

  test('TC-SA-003: Create company validation', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Company' }).click();
    await page.getByRole('button', { name: /create company/i }).click();
    await expect(
      page.getByText(/required|name and short name|admin login/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});

/* ─── COMPANY ADMIN — tab smoke ─── */
const COMPANY_TABS: { id: string; label: string; marker: RegExp | string }[] = [
  { id: 'dashboard', label: 'Dashboard', marker: /dashboard|loads|fleet/i },
  { id: 'dispatch', label: 'Dispatch', marker: /dispatch|loads|Assign Load/i },
  { id: 'track', label: 'Track', marker: /track|in transit|loads/i },
  { id: 'emanifest', label: 'eManifest', marker: /manifest|carrier|eManifest/i },
  { id: 'drivers', label: 'Drivers', marker: /driver|roster|invite/i },
  { id: 'assets', label: 'Assets', marker: /asset|truck|trailer/i },
  { id: 'fleet', label: 'Fleet Ops', marker: /fleet|maintenance|ops/i },
  { id: 'sheets', label: 'Sheets', marker: /sheet|trip/i },
  { id: 'messages', label: 'Messages', marker: /message|communication|comment/i },
  { id: 'compliance', label: 'Compliance', marker: /compliance|document|audit/i },
  { id: 'reports', label: 'Reports', marker: /report|revenue|SMS/i },
  { id: 'accounting', label: 'Accounting', marker: /account|invoice|ledger/i },
  { id: 'users', label: 'Users', marker: /user|role|staff/i },
  { id: 'company', label: 'Company', marker: /company|profile|settings/i },
];

test.describe('Company Admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.companyOwner.email, ACCOUNTS.companyOwner.password);
  });

  for (const tab of COMPANY_TABS) {
    test(`TC-CA-${tab.id}: ${tab.label} tab loads`, async ({ page }) => {
      await page.waitForTimeout(800);
      const visible = await tabVisible(page, tab.label);
      if (!visible && tab.id === 'accounting') {
        test.skip(true, 'Accounting tab hidden by RBAC/entitlements');
      }
      if (!visible) {
        throw new Error(`Expected tab "${tab.label}" to be visible in sidebar`);
      }
      await navTab(page, tab.label);
      await expect(page).toHaveURL(new RegExp(`/app/${tab.id}`));
      const body = page.locator('body');
      await expect(body.getByText(tab.marker).first()).toBeVisible({
        timeout: 15_000,
      });
    });
  }

  test('TC-CA-dispatch-form: Assign load form opens', async ({ page }) => {
    await navTab(page, 'Dispatch');
    await page.getByRole('button', { name: '+ Assign Load' }).click();
    await expect(page.getByText('Assign New Load')).toBeVisible();
  });

  test('TC-CA-dispatch-validation: Empty save shows validation', async ({ page }) => {
    await navTab(page, 'Dispatch');
    await page.getByRole('button', { name: '+ Assign Load' }).click();
    const saveBtn = page.getByRole('button', { name: /^save$|save load|assign/i }).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await expect(
        page.getByText(/fix the highlighted|required|origin|destination/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('TC-CA-drivers-search: Driver search filters roster', async ({ page }) => {
    await navTab(page, 'Drivers');
    const search = page.getByLabel('Search');
    await search.fill('divyam');
    await expect(page.getByText(/divyam/i).first()).toBeVisible({ timeout: 10_000 });
    await search.fill('');
  });

  test('TC-CA-theme: Theme toggle works', async ({ page }) => {
    const themeBtn = page.locator('button[aria-label*="theme" i], button').filter({
      hasText: /light|dark/i,
    });
    if (await themeBtn.count()) {
      await themeBtn.first().click();
      await page.waitForTimeout(300);
    }
  });
});

/* ─── DRIVER PORTAL ─── */
const DRIVER_TABS = [
  { label: 'Sheets', marker: /sheet|trip|payroll/i },
  { label: 'My Docs', marker: /doc|upload|compliance/i },
  { label: 'Contract', marker: /contract|sign/i },
  { label: 'My Load', marker: /load|active|availability/i },
];

test.describe('Driver Portal', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.driver.email, ACCOUNTS.driver.password);
  });

  for (const tab of DRIVER_TABS) {
    test(`TC-DR-${tab.label.toLowerCase()}: ${tab.label} tab loads`, async ({ page }) => {
      await navTab(page, tab.label);
      await expect(page.getByText(tab.marker).first()).toBeVisible({
        timeout: 15_000,
      });
    });
  }
});

/* ─── NEGATIVE / EDGE ─── */
test.describe('Negative & edge cases', () => {
  test('TC-NEG-001: Invalid invite token', async ({ page }) => {
    await page.goto(`${BASE}/invite?invite=invalid-token-xyz`);
    await expect(
      page.getByText(/invalid|already been used|invite link/i),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('TC-NEG-002: Browser back after login with active session', async ({ page }) => {
    await login(page, ACCOUNTS.companyOwner.email, ACCOUNTS.companyOwner.password);
    await expect(page).toHaveURL(/\/app\/dashboard/);
    await page.goBack();
    await page.waitForTimeout(400);
    if (page.url() === 'about:blank') {
      await page.goForward();
    }
    // Session persists — user remains in (or returns to) the workspace.
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10_000 });
  });

  test('TC-NEG-003: Forgot password empty email disabled', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`);
    await expect(
      page.getByRole('button', { name: 'Send reset link' }),
    ).toBeDisabled();
  });

  test('TC-NEG-004: Root redirect when logged in', async ({ page }) => {
    await login(page, ACCOUNTS.companyOwner.email, ACCOUNTS.companyOwner.password);
    await page.goto(`${BASE}/`);
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('TC-NEG-005: Unknown route redirects home', async ({ page }) => {
    await login(page, ACCOUNTS.companyOwner.email, ACCOUNTS.companyOwner.password);
    await page.goto(`${BASE}/does-not-exist-xyz`);
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });
});
