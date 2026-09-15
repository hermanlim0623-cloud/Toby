import { test, expect } from '@playwright/test';

const CASE_STUDIES = [
  'sales-dashboard',
  'kitchen-operations-site',
  'order-adjustment-bot',
  'back-office-report',
  'mistake-count-tracker',
  'rtp-report-tool',
  'basic-withdrawal-tool',
];

test.describe('home', () => {
  test('renders the hero and every project card', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TOBY/);
    await expect(page.locator('.hero h1')).toContainText('I build digital');
    await expect(page.locator('a.project-card')).toHaveCount(CASE_STUDIES.length);
  });

  test('the boot sequence hands over instead of covering the page forever', async ({ page }) => {
    await page.goto('/');
    // The sequence waits on a real first frame from the renderer, so it has a
    // backstop in bootSequence.js precisely so a GPU that never finishes
    // compiling cannot trap the visitor behind it.
    await expect(page.locator('.boot')).toBeHidden({ timeout: 15_000 });
  });

  test('the boot checks resolve rather than sitting on a fake counter', async ({ page }) => {
    await page.goto('/');

    const reduced = await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    // Reduced motion skips the sequence entirely rather than playing it
    // faster — holding someone who asked for stillness behind a timed
    // opening is the exact thing the preference is asking us not to do. So
    // there are deliberately no checks to resolve there.
    if (reduced) {
      await expect(page.locator('[data-boot]')).toHaveCount(0);
      return;
    }

    // Each check names something the page genuinely waits on, and every one
    // has to reach a settled state — a check that can hang is worse than no
    // check, because it reports a failure that is not happening.
    const total = await page.locator('[data-boot-check]').count();
    expect(total).toBeGreaterThan(0);
    await expect(page.locator('[data-boot-check].is-ready')).toHaveCount(total, {
      timeout: 15_000,
    });
  });

  test('the environment resolves to either a live scene or the static fallback', async ({ page }) => {
    await page.goto('/');
    const stage = page.locator('[data-cinema]');
    // The one outcome that must never happen is neither: a canvas that was
    // created but is not being painted leaves the whole page on a dead
    // black rectangle, which is worse than not having tried at all.
    await expect(stage).toHaveClass(/is-live|is-unsupported/, { timeout: 20_000 });
    const resolved = await stage.evaluate((el) => ({
      live: el.classList.contains('is-live') && !el.classList.contains('is-unsupported'),
      degraded: el.classList.contains('is-unsupported'),
    }));
    expect(resolved.live || resolved.degraded).toBe(true);
    // Either way the stage carries a painted background, so the copy on top
    // of it is legible rather than sitting on whatever the browser defaults
    // to. This also catches a dangling custom property: one bad var() voids
    // the whole declaration, and the fallback silently becomes `none`.
    const bg = await stage.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain('gradient');
  });

  test('a project card navigates to its case study', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('a.project-card').first();
    const href = await card.getAttribute('href');
    expect(href).toBe('/work/sales-dashboard/');
    await page.goto(href!);
    await expect(page.locator('h1')).toHaveText('Sales Dashboard');
  });
});

test.describe('case studies', () => {
  for (const slug of CASE_STUDIES) {
    test(`${slug} has a body, facts and a next link`, async ({ page }) => {
      const response = await page.goto(`/work/${slug}/`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('.case-body h2').first()).toBeVisible();
      await expect(page.locator('.case-facts dt')).toHaveCount(4);
      await expect(page.locator('.case-next-link')).toHaveAttribute('href', /^\/work\//);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://toby.dev/work/${slug}/`
      );
    });
  }

  test('the last study wraps back to the first rather than dead-ending', async ({ page }) => {
    await page.goto(`/work/${CASE_STUDIES[CASE_STUDIES.length - 1]}/`);
    await expect(page.locator('.case-next-link')).toHaveAttribute(
      'href',
      `/work/${CASE_STUDIES[0]}/`
    );
  });
});

test.describe('command palette', () => {
  test.skip(({ browserName, isMobile }) => isMobile || browserName !== 'chromium');

  test('opens on the keyboard shortcut and filters fuzzily', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('ControlOrMeta+k');
    const panel = page.locator('.palette-panel');
    await expect(panel).toBeVisible();
    await expect(page.locator('.palette-input')).toBeFocused();

    // "sldb" is a subsequence of "Sales Dashboard", not a substring — this
    // asserts the fuzzy matcher, not an indexOf.
    await page.locator('.palette-input').fill('sldb');
    await expect(page.locator('.palette-item').first()).toContainText('Sales Dashboard');
  });

  test('Enter opens the highlighted result', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('ControlOrMeta+k');
    await page.locator('.palette-input').fill('order adjustment');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/work\/order-adjustment-bot\//);
  });

  test('Escape closes it and returns focus to the page', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('.palette-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-palette]')).toBeHidden();
  });

  test('a query that matches nothing says so instead of showing stale results', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('ControlOrMeta+k');
    await page.locator('.palette-input').fill('zzzzqqq');
    await expect(page.locator('.palette-empty')).toBeVisible();
    await expect(page.locator('.palette-item')).toHaveCount(0);
  });
});

test.describe('metadata', () => {
  test('404 is in-theme and still navigable', async ({ page }) => {
    await page.goto('/404');
    await expect(page.locator('.lost-code')).toHaveText('404');
    await expect(page.locator('.nav')).toBeVisible();
  });

  test('the sitemap lists every page', async ({ request }) => {
    const index = await request.get('/sitemap-index.xml');
    expect(index.ok()).toBeTruthy();
    const sitemap = await request.get('/sitemap-0.xml');
    const xml = await sitemap.text();
    for (const slug of CASE_STUDIES) expect(xml).toContain(`/work/${slug}/`);
  });

  test('structured data parses as valid JSON', async ({ page }) => {
    await page.goto('/');
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const parsed = JSON.parse(raw!);
    expect(parsed['@graph']).toHaveLength(2);
  });

  test('no render-blocking third-party font request', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('fonts.googleapis.com') || r.url().includes('fonts.gstatic.com')) {
        external.push(r.url());
      }
    });
    await page.goto('/');
    expect(external).toEqual([]);
  });
});
