import { expect, type Page } from '@playwright/test';

export const BASE = 'http://localhost:5173';

export const ACCOUNTS = {
  superAdmin: { email: 'admin@tripsheet.io', password: 'admin123' },
  companyOwner: { email: 'admin@mkx.ca', password: 'mkx123' },
  driver: { email: 'divyam@mkx.ca', password: 'driver123' },
} as const;

/** Login inputs (no htmlFor until BUG-002 fix — use input type selectors). */
export async function fillCredentials(page: Page, email: string, password: string) {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await fillCredentials(page, email, password);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 30_000,
  });
}

export async function logout(page: Page) {
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function navTab(page: Page, label: string) {
  const tab = page.getByRole('button', { name: label }).first();
  await tab.click();
  await page.waitForLoadState('domcontentloaded');
}

export async function expectApiOnline(page: Page) {
  const retry = page.getByRole('button', { name: 'Retry API' });
  await expect(retry).toHaveCount(0, { timeout: 15_000 });
}

export async function tabVisible(page: Page, label: string) {
  return page.getByRole('button', { name: label }).first().isVisible();
}
