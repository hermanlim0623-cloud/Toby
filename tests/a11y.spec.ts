import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/work/sales-dashboard/', '/404'];

// A portfolio that animates this hard is exactly the kind of site where
// accessibility quietly rots, so it is asserted rather than assumed.
for (const path of PAGES) {
  test(`${path} has no detectable WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    // Let the preloader finish so axe scans the page, not the cover.
    await page.waitForTimeout(1500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // The decorative atmosphere layers are aria-hidden by design; the
      // canvas-based skill constellation has its own text panel beside it.
      .exclude('.grain')
      .exclude('#skill-canvas')
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test('the skip link is the first thing a keyboard visitor reaches', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
});

test('the off-screen mobile menu is not in the tab order while closed', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#mobile-menu')).toHaveAttribute('inert', '');
});

test('every page has exactly one h1', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator('h1')).toHaveCount(1);
  }
});
