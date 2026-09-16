import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Waits for the opening curtain to leave AND the entrance timeline to
 * settle. Scanning before that catches elements mid-fade and reports their
 * transient opacity as a contrast failure, which is a race, not a defect.
 */
async function settled(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => !document.querySelector('[data-loader]'), null, { timeout: 8000 });
  await page.waitForTimeout(1600);
}

const PAGES = ['/', '/work/sales-dashboard/', '/404'];

// A portfolio built this heavily on type and interaction is exactly where
// accessibility quietly rots, so it is asserted rather than assumed.
for (const path of PAGES) {
  test(`${path} has no detectable WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await settled(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // The About figure is a decorative canvas with a text caption beside it.
      .exclude('.about-figure-canvas')
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test('the skip link is the first thing a keyboard visitor reaches', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('href', '#main');
});

test('the closed menu is not in the tab order', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2200);
  await expect(page.locator('[data-menu]')).toHaveAttribute('inert', '');
  // inert is what actually removes it; an off-screen transform would not.
  const inert = await page.locator('[data-menu] a').first()
    .evaluate((el) => el.closest('[inert]') !== null);
  expect(inert).toBe(true);
});

test('every page has exactly one h1', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    expect(await page.locator('h1').count(), `${path} h1 count`).toBe(1);
  }
});

test('the opening curtain never gates the content behind it', async ({ page }) => {
  await page.goto('/');
  // Before the curtain lifts the document underneath is already complete —
  // a loading screen here is a cover, not a gate.
  const titles = await page.locator('[data-work-row] .work-title').allTextContents();
  expect(titles.length).toBeGreaterThanOrEqual(7);
});
