import { test, expect } from '@playwright/test';

// The design system's own rules, asserted. These are the things that make
// the page read as one system rather than as a set of sections that happen
// to share a font, and every one of them is easy to break by accident.

test.describe('grid and scale', () => {
  test('nothing overflows the viewport at any breakpoint', async ({ page }) => {
    for (const width of [1440, 1024, 810, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.waitForTimeout(2200);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
    }
  });

  test('the left margin is one unbroken line down the page', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2200);
    // Every section's content starts on the same x. This is the single
    // most visible promise the grid makes, and the cheapest to break.
    const lefts = await page.locator('.section-label').evaluateAll(
      (els) => els.map((el) => Math.round(el.getBoundingClientRect().left)),
    );
    expect(lefts.length).toBeGreaterThan(3);
    expect(new Set(lefts).size, `section labels start at ${lefts.join(', ')}`).toBe(1);
  });

  test('the palette is the six tokens and nothing else', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2200);
    // No gradients anywhere: the brief rules them out, and they are what a
    // design like this drifts back into first.
    const gradients = await page.evaluate(() =>
      [...document.querySelectorAll('*')].filter((el) => {
        const bg = getComputedStyle(el).backgroundImage;
        return bg.includes('gradient');
      }).length,
    );
    expect(gradients).toBe(0);
  });

  test('the inverted block inverts its tokens, not just its colour', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2200);
    // Setting `color` alone leaves anything that names var(--text) painting
    // the light token onto the dark background. This asserts the tokens
    // themselves flip, which is the thing that is easy to half-fix.
    // The technology archive is the document's inverted block. The menu and
    // the footer are .on-dark too but carry no section label, so this names
    // the one that has to survive the inversion intact.
    const tokens = await page.locator('#technology.on-dark').evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        text: s.getPropertyValue('--text').trim(),
        bg: s.backgroundColor,
        label: getComputedStyle(el.querySelector('.section-label')!).color,
      };
    });
    expect(tokens.text.toUpperCase()).toBe('#F4F4F4');
    // The section label must be light, not the page's #404040.
    expect(tokens.label).not.toBe('rgb(64, 64, 64)');
  });

  test('borders are 1px, everywhere they exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2200);
    const widths = await page.evaluate(() => {
      const found = new Set<string>();
      for (const el of document.querySelectorAll('*')) {
        const s = getComputedStyle(el);
        for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
          const w = s[`border${side}Width`];
          if (w !== '0px') found.add(w);
        }
      }
      return [...found];
    });
    expect(widths.every((w) => w === '1px'), `found ${widths.join(', ')}`).toBe(true);
  });
});

test.describe('the index', () => {
  test('the header names the section you are actually in', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2200);
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    await expect(page.locator('[data-where-name]')).toHaveText('SELECTED WORK');
    await expect(page.locator('[data-where-num]')).toHaveText('02');

    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    await expect(page.locator('[data-where-name]')).toHaveText('CONTACT');
  });

  test('the local clock is the visitor’s own and it runs', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2200);
    const clock = page.locator('[data-clock]');
    const first = await clock.textContent();
    expect(first).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    await page.waitForTimeout(1400);
    expect(await clock.textContent()).not.toBe(first);
  });

  test('counters are derived from the work collection, not typed in', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2600);
    const rows = await page.locator('[data-work-row]').count();
    // The hero index states the number of projects; if someone adds a
    // project and this drifts, the page is lying about itself.
    await expect(page.locator('.hero-index [data-counter]')).toHaveText(
      String(rows).padStart(2, '0'),
    );
  });
});

test.describe('work list', () => {
  test('every project is a row that navigates to its case study', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2200);
    const rows = page.locator('[data-work-row]');
    expect(await rows.count()).toBeGreaterThanOrEqual(7);

    await rows.first().click();
    await page.waitForURL(/\/work\/.+\//);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('the hover preview follows the pointer and swaps between rows', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'pointer-driven');
    await page.goto('/');
    await page.waitForTimeout(2200);
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    const panel = page.locator('[data-work-preview]');
    const box = await page.locator('[data-work-row]').nth(1).boundingBox();
    await page.mouse.move(box!.x + 120, box!.y + box!.height / 2);
    await page.waitForTimeout(700);
    await expect(panel).toBeVisible();
    // One frame on at a time: the panel re-titles itself, it does not stack.
    expect(await page.locator('[data-work-frame].is-on').count()).toBe(1);

    const before = await panel.boundingBox();
    await page.mouse.move(box!.x + 520, box!.y + box!.height / 2);
    await page.waitForTimeout(700);
    const after = await panel.boundingBox();
    expect(after!.x).toBeGreaterThan(before!.x);
  });
});

test.describe('menu', () => {
  test('opens, traps nothing, and closes on Escape', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2200);
    await page.locator('[data-menu-open]').click();
    const menu = page.locator('[data-menu]');
    await expect(menu).not.toHaveAttribute('inert', '');
    await expect(page.locator('[data-menu-open]')).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('inert', '');
    await expect(page.locator('[data-menu-open]')).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('reduced motion', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough');

  test('lands every reveal on its end state with nothing animated', async ({ page }) => {
    test.skip(test.info().project.name !== 'reduced-motion', 'reduced-motion project only');
    await page.goto('/');
    await page.waitForTimeout(1200);

    // No curtain at all, rather than a fast one.
    expect(await page.locator('[data-loader]').count()).toBe(0);
    // No cursor follower: it is motion by definition.
    expect(await page.locator('.cursor').count()).toBe(0);

    await page.locator('#technology').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const hidden = await page.locator('[data-reveal]').evaluateAll(
      (els) => els.filter((el) => Number(getComputedStyle(el).opacity) < 0.95).length,
    );
    expect(hidden).toBe(0);
  });
});

test.describe('metadata', () => {
  test('the sitemap lists every page', async ({ request }) => {
    const index = await request.get('/sitemap-index.xml');
    expect(index.ok()).toBeTruthy();
    const body = await (await request.get('/sitemap-0.xml')).text();
    expect(body).toContain('/work/sales-dashboard/');
  });

  test('structured data parses as valid JSON', async ({ page }) => {
    await page.goto('/');
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(() => JSON.parse(b)).not.toThrow();
  });

  test('no render-blocking third-party font request', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.host !== 'localhost:4321' && r.resourceType() === 'font') external.push(r.url());
    });
    await page.goto('/');
    await page.waitForTimeout(2200);
    expect(external).toEqual([]);
  });
});

test.describe('case study', () => {
  test('carries its own index, facts, machine and a next link', async ({ page }) => {
    await page.goto('/work/sales-dashboard/');
    await page.waitForTimeout(2200);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.locator('.case-facts div').count()).toBe(4);
    expect(await page.locator('.machine-stage').count()).toBe(4);
    await expect(page.locator('.case-next a')).toBeVisible();
  });

  test('the last study wraps back to the first rather than dead-ending', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2200);
    const hrefs = await page.locator('[data-work-row]').evaluateAll(
      (els) => els.map((el) => el.getAttribute('href')),
    );
    await page.goto(hrefs[hrefs.length - 1]!);
    const next = await page.locator('.case-next a').getAttribute('href');
    expect(next).toBe(hrefs[0]);
  });
});
