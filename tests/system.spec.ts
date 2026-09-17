import { test, expect } from '@playwright/test';

/**
 * Scrolls to the work list and waits for its sort to settle.
 *
 * The rows are displaced and the list takes no pointer events while the
 * sort runs, so anything that hovers or clicks a row has to let it finish
 * first. Tests about the sort itself deliberately do not use this.
 */
async function workSettled(page: import('@playwright/test').Page) {
  await page.locator('#work').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-work-status]');
    return !el || el.getAttribute('data-state') === 'done';
  }, null, { timeout: 15_000 });
}

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
    await workSettled(page);
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
    // project and this drifts, the page is lying about itself. The odometer
    // keeps the value as real text beside its digit columns, so this reads
    // what a screen reader would read.
    await expect(page.locator('.hero-index [data-odometer] .sr-only')).toHaveText(
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

  test('the hover preview follows the pointer', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'pointer-driven');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await workSettled(page);

    const panel = page.locator('.work-preview');
    const box = (await page.locator('[data-work-row]').nth(1).boundingBox())!;
    await page.mouse.move(box.x + 200, box.y + box.height / 2);
    await page.waitForTimeout(700);
    await expect(panel).toBeVisible();

    // It tracks the pointer rather than parking somewhere near the row.
    const before = (await panel.boundingBox())!;
    await page.mouse.move(box.x + 560, box.y + box.height / 2);
    await page.waitForTimeout(700);
    const after = (await panel.boundingBox())!;
    expect(after.x).toBeGreaterThan(before.x);
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
    // The cursor keeps working and loses its motion: it still mounts and
    // still names what is under it, but the position is snapped rather than
    // interpolated and the state changes are not transitions. Removing it
    // entirely would take the affordance away with the animation.
    await expect(page.locator('.cur')).toHaveCount(1);
    const eased = await page.locator('.cur-inner').evaluate(
      (el) => getComputedStyle(el).transitionDuration,
    );
    expect(eased).toBe('0s');

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
    expect(await page.locator('.machine-stage').count()).toBe(4);
    await expect(page.locator('.case-next a')).toBeVisible();

    // Before and after are stated as a pair rather than buried in the prose.
    await expect(page.locator('.ba')).toBeVisible();

    const rows = await page.locator('.case-facts dt').allTextContents();
    for (const k of ['TYPE', 'USE', 'ROLE', 'STATUS', 'CAPABILITIES']) {
      expect(rows, `${k} row`).toContain(k);
    }
  });

  test('never invents a technology a project does not document', async ({ page }) => {
    // Two of the seven have no documented language or runtime. The page has
    // to show no BUILT WITH row at all for those rather than guess one, and
    // show a real one where it is known. This is the whole reason stack and
    // capabilities were split.
    const cases: [string, boolean][] = [
      ['sales-dashboard', true],
      ['basic-withdrawal-tool', false],
      ['mistake-count-tracker', false],
    ];
    for (const [slug, hasStack] of cases) {
      await page.goto(`/work/${slug}/`);
      await page.waitForTimeout(1800);
      const rows = await page.locator('.case-facts dt').allTextContents();
      expect(rows.includes('BUILT WITH'), `${slug} BUILT WITH row`).toBe(hasStack);
      // Capabilities are always known, so that row is always there.
      expect(rows, `${slug} capabilities`).toContain('CAPABILITIES');
    }
  });

  test('the technology list contains technologies, not capabilities', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2400);
    const group = (heading: string) => page
      .locator('#technology .tech-group')
      .filter({ has: page.locator('.tech-head', { hasText: heading }) })
      .locator('.t-label')
      .evaluateAll((els) => els.map((e) => e.textContent!.trim()));

    const built = await group('BUILT WITH');
    const interactive = await group('INTERACTIVE & 3D');
    const caps = await group('CAPABILITIES');
    const tech = [...built, ...interactive];

    // "Automation" and "Bots" are things the tools do, not things they are
    // written in; listing them beside Python was the thing to fix.
    for (const c of ['Automation', 'Bots', 'Reporting', 'Logging']) {
      expect(tech, `${c} must not be listed as a technology`).not.toContain(c);
    }
    expect(tech).toContain('Python');
    expect(caps).toContain('Automation');
    // The creative-technology half has to be there too: the section exists to
    // show the work is not only Python and operational automation.
    expect(interactive).toContain('Three.js');
    expect(interactive).toContain('WebGL');
    // And nothing may claim a tool the repository cannot evidence.
    expect(tech, 'Spline appears nowhere in this repository').not.toContain('Spline');
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

test.describe('cursor', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'pointer-driven');

  test('resolves a state for whatever is under it', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.goto('/');
    await page.waitForTimeout(2400);
    const state = () => page.locator('.cur').getAttribute('data-state');

    // Plain page: the crosshair.
    await page.mouse.move(700, 640);
    await page.waitForTimeout(300);
    expect(await state()).toBe('default');

    // The scroll cue carries no data-cursor: the link arrow has to be
    // inferred from the element being a link, or every anchor on the site
    // would need annotating by hand. (The header's section list is hidden
    // below 1440px, so it is not a reliable target at test viewport sizes.)
    const nav = (await page.locator('.hero-scroll').boundingBox())!;
    await page.mouse.move(nav.x + 30, nav.y + nav.height / 2);
    await page.waitForTimeout(300);
    expect(await state()).toBe('link');

    // A work row is a link too, but it declares itself a project, and the
    // explicit declaration has to win over the inferred link.
    await workSettled(page);
    const row = (await page.locator('[data-work-row]').nth(2).boundingBox())!;
    await page.mouse.move(row.x + 400, row.y + row.height / 2);
    await page.waitForTimeout(400);
    expect(await state()).toBe('project');
  });

  test('shows the hovered project’s own preview, one at a time', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await workSettled(page);

    const rows = page.locator('[data-work-row]');
    for (const i of [1, 4]) {
      const row = rows.nth(i);
      const id = await row.getAttribute('data-preview');
      const box = (await row.boundingBox())!;
      await page.mouse.move(box.x + 400, box.y + box.height / 2);
      await page.waitForTimeout(500);
      // The frame showing must be the one belonging to the row under the
      // pointer, paired by the project's id, not by document order.
      const on = await page.locator('.work-frame.is-on').getAttribute('data-preview');
      expect(on, `row ${i} shows its own preview`).toBe(id);
      expect(await page.locator('.work-frame.is-on').count()).toBe(1);
    }
  });

  test('the preview escapes the transformed sections it sits inside', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.goto('/');
    await page.waitForTimeout(2400);
    // The panel is position:fixed and placed in viewport coordinates, but a
    // transformed ancestor becomes the containing block for fixed children,
    // and the section focus scrub puts a scale on every section. Inside the
    // work section the panel would resolve against that section instead of
    // the window, and every edge calculation would be against the wrong box.
    const parent = await page.locator('.work-preview').evaluate(
      (el) => el.parentElement?.tagName,
    );
    expect(parent).toBe('BODY');
  });

  test('the preview never leaves the viewport', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.setViewportSize({ width: 900, height: 600 });
    await page.goto('/');
    await page.waitForTimeout(2400);
    await workSettled(page);

    const boxes = await page.locator('[data-work-row]').evaluateAll(
      (els) => els.map((el) => el.getBoundingClientRect().toJSON()),
    );
    const usable = boxes.filter((b) => b.y > 60 && b.y + b.height < 600);
    expect(usable.length).toBeGreaterThan(1);

    // Each corner of the list, at the extremes of the window.
    for (const [x, b] of [
      [855, usable[0]], [45, usable[0]],
      [855, usable[usable.length - 1]], [45, usable[usable.length - 1]],
    ] as const) {
      await page.mouse.move(x, b.y + b.height / 2);
      await page.waitForTimeout(500);
      const m = await page.locator('.work-preview').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return Math.min(r.left, r.top, window.innerWidth - r.right, window.innerHeight - r.bottom);
      });
      expect(m, `preview clipped at x=${x}`).toBeGreaterThanOrEqual(22);
    }
  });

  test('the control compresses on press', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    // The case study's main visual takes the image state and is not a link,
    // so it can be held down without navigating out from under the pointer.
    await page.goto('/work/sales-dashboard/');
    await page.waitForTimeout(2400);
    const visual = page.locator('.case-visual');
    await visual.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const box = (await visual.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);
    await expect(page.locator('.cur')).toHaveAttribute('data-state', 'image');

    const scale = () => page.locator('.cur-inner').evaluate(
      (el) => Number(new DOMMatrix(getComputedStyle(el).transform).a.toFixed(2)),
    );
    expect(await scale()).toBe(1);
    await page.mouse.down();
    await page.waitForTimeout(250);
    // The compression lives on its own wrapper, so a state's transform and
    // the press cannot out-specify each other.
    expect(await scale()).toBe(0.82);
    await page.mouse.up();
  });

  test('leaves the system pointer alone', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.goto('/');
    await page.waitForTimeout(2400);
    // Nothing may hide the native cursor. A drawn replacement always trails
    // the real pointer by its own easing, and that half-beat is exactly what
    // this system was rebuilt to remove.
    const hiding = await page.evaluate(() =>
      [...document.querySelectorAll('body, main, section, a, p, h1, h2, li')]
        .filter((el) => getComputedStyle(el).cursor === 'none').length);
    expect(hiding).toBe(0);
    // And a link still shows the hand the browser would normally show.
    await expect(page.locator('.hero-scroll')).toHaveCSS('cursor', 'pointer');
  });

  test('shows the control only where there is something to say', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.goto('/');
    await page.waitForTimeout(2400);
    const opacity = () => page.locator('.cur-box').evaluate(
      (el) => Number(getComputedStyle(el).opacity),
    );

    // Empty page: nothing follows the mouse at all.
    await page.mouse.move(700, 640);
    await page.waitForTimeout(400);
    expect(await opacity()).toBe(0);

    // A plain link: the system pointer already becomes a hand, so the
    // control stays out of it.
    const nav = (await page.locator('.hero-scroll').boundingBox())!;
    await page.mouse.move(nav.x + 30, nav.y + nav.height / 2);
    await page.waitForTimeout(400);
    expect(await opacity()).toBe(0);

    // A project row: the control appears, because VIEW → is information the
    // pointer cannot carry by itself.
    await workSettled(page);
    const row = (await page.locator('[data-work-row]').nth(2).boundingBox())!;
    await page.mouse.move(row.x + 400, row.y + row.height / 2);
    await page.waitForTimeout(500);
    expect(await opacity()).toBe(1);
  });

  test('goes white inside the inverted block', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('#technology').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const t = (await page.locator('#technology .tech-item').first().boundingBox())!;
    await page.mouse.move(t.x + 60, t.y + 12);
    await page.waitForTimeout(300);
    await expect(page.locator('.cur')).toHaveAttribute('data-theme', 'dark');
    const ink = await page.locator('.cur').evaluate((el) => getComputedStyle(el).color);
    expect(ink).toBe('rgb(255, 255, 255)');
  });

  test('never blocks what is underneath it', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.goto('/');
    await page.waitForTimeout(2400);
    for (const sel of ['.cur', '.work-preview']) {
      const pe = await page.locator(sel).evaluate((el) => getComputedStyle(el).pointerEvents);
      expect(pe, `${sel} must not take pointer events`).toBe('none');
    }
    // And a link under the cursor still opens.
    await workSettled(page);
    await page.locator('[data-work-row]').first().click();
    await page.waitForURL(/\/work\/.+\//);
  });

  test('does not mount on a touch device', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const m = await ctx.newPage();
    await m.goto('/');
    await m.waitForTimeout(2400);
    expect(await m.locator('.cur').count()).toBe(0);
    // And no preview panel is left tracking a pointer that does not exist.
    expect(await m.locator('.work-preview.is-on').count()).toBe(0);
    await ctx.close();
  });
});

test.describe('section motion', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough');

  /** Each digit column's offset, as a percentage of its own height. */
  const strips = (page: import('@playwright/test').Page, sel: string) =>
    page.evaluate((s) => {
      const sec = document.querySelector(s)!;
      return [...sec.querySelectorAll('.odo-s')].map((el) => {
        const m = new DOMMatrix(getComputedStyle(el).transform);
        const h = el.getBoundingClientRect().height || 1;
        return Math.round((m.f / h) * 1000) / 10;
      });
    }, sel);

  test('odometers replay on every entry, in both directions', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'motion project only');
    await page.goto('/');
    await page.waitForTimeout(2400);

    const atZero = (a: number[]) => a.filter((v) => Math.abs(v) < 1).length;

    // Three separate arrivals at the same section. A `hasAnimated` flag
    // anywhere would make the second and third of these do nothing.
    for (const pass of [1, 2, 3]) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1400);
      const before = await strips(page, '#skills');
      expect(atZero(before), `pass ${pass}: reset while away`).toBe(before.length);

      await page.locator('#skills').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1800);
      const after = await strips(page, '#skills');
      const rolled = after.filter((v, i) => Math.abs(v - before[i]) > 1).length;
      expect(rolled, `pass ${pass}: columns rolled on entry`).toBeGreaterThan(0);
    }

    // And arriving from below, which is the direction a play-once or
    // scroll-direction-aware implementation gets wrong.
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1600);
    const below = await strips(page, '#skills');
    expect(atZero(below), 'reset while below').toBe(below.length);
    await page.locator('#skills').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800);
    const up = await strips(page, '#skills');
    expect(up.filter((v, i) => Math.abs(v - below[i]) > 1).length).toBeGreaterThan(0);
  });

  test('a carry rolls both columns independently', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'motion project only');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('#about').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2200);

    // The stats row carries: the technology count runs into two digits and
    // the year is four, so the tens column has to move on its own rather
    // than the number being re-rendered as a string.
    const pairs = await page.evaluate(() =>
      [...document.querySelectorAll('.stats [data-odometer]')].map((el) => ({
        value: el.querySelector('.sr-only')?.textContent?.trim() ?? '',
        offsets: [...el.querySelectorAll('.odo-s')].map((s) => {
          const m = new DOMMatrix(getComputedStyle(s).transform);
          // `|| 0` normalises the -0 that Math.round returns for a column
          // that has not moved; toEqual treats -0 and 0 as different.
          return Math.round((m.f / (s.getBoundingClientRect().height || 1)) * -10) || 0;
        }),
      })));

    expect(pairs.length).toBe(4);
    // At least one value must actually exercise a carry.
    expect(pairs.some((p) => p.value.replace(/\D/g, '').length > 1)).toBe(true);
    for (const { value, offsets } of pairs) {
      const digits = value.replace(/\D/g, '').split('').map(Number);
      // Each column must have travelled to exactly its own digit.
      expect(offsets, `"${value}" settled on its digits`).toEqual(digits);
    }
  });

  test('focus follows scroll position continuously, and symmetrically', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'motion project only');
    await page.goto('/');
    await page.waitForTimeout(2400);

    const read = () => page.locator('#skills').evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        blur: Number((cs.filter.match(/blur\(([\d.]+)px\)/) || [0, '0'])[1]),
        opacity: Number(cs.opacity),
      };
    });

    const box = (await page.locator('#skills').boundingBox())!;
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const at = async (frac: number) => {
      const y = box.y + box.height / 2 - 450 + frac * 900;
      await page.evaluate((v) => window.scrollTo(0, v), Math.max(0, Math.min(y, max)));
      await page.waitForTimeout(900);
      return read();
    };

    const approaching = await at(-0.85);
    const focal = await at(0);
    const leaving = await at(0.85);

    // Sharp in the focal area, soft on both sides, and this is a scrub, so
    // reversing the scroll runs the same curve backwards by construction.
    expect(focal.blur).toBe(0);
    expect(focal.opacity).toBe(1);
    expect(approaching.blur).toBeGreaterThan(2);
    expect(leaving.blur).toBeGreaterThan(2);
    expect(approaching.opacity).toBeLessThan(0.6);
    expect(leaving.opacity).toBeLessThan(0.6);
    // Symmetric: entering and leaving cost the same.
    expect(Math.abs(approaching.blur - leaving.blur)).toBeLessThan(0.5);
  });

  test('reduced motion settles the numbers and never blurs', async ({ page }) => {
    test.skip(test.info().project.name !== 'reduced-motion', 'reduced-motion project only');
    await page.goto('/');
    await page.waitForTimeout(1600);
    await page.locator('#skills').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    // The numbers are correct immediately, with no roll to watch.
    const pairs = await page.evaluate(() =>
      [...document.querySelectorAll('#skills [data-odometer]')].map((el) => ({
        value: el.querySelector('.sr-only')?.textContent?.trim() ?? '',
        offsets: [...el.querySelectorAll('.odo-s')].map((s) => {
          const m = new DOMMatrix(getComputedStyle(s).transform);
          // `|| 0` normalises the -0 that Math.round returns for a column
          // that has not moved; toEqual treats -0 and 0 as different.
          return Math.round((m.f / (s.getBoundingClientRect().height || 1)) * -10) || 0;
        }),
      })));
    for (const { value, offsets } of pairs) {
      expect(offsets).toEqual(value.replace(/\D/g, '').split('').map(Number));
    }

    // Nothing is dimmed or softened at any scroll position.
    const soft = await page.locator('[data-motion]').evaluateAll((els) =>
      els.filter((el) => {
        const cs = getComputedStyle(el);
        return cs.filter !== 'none' || Number(cs.opacity) < 0.99;
      }).length);
    expect(soft).toBe(0);
  });
});

test.describe('project covers', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough');

  test('the index never pulls a full-size cover', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'network shape only');

    const fetched: string[] = [];
    page.on('response', (r) => {
      if (r.url().includes('/images/work/')) fetched.push(r.url().split('/').pop()!);
    });
    await page.goto('/');
    await page.waitForTimeout(2600);
    // Nothing to guard until covers exist; this becomes a real assertion the
    // moment the first one is dropped in.
    test.skip(fetched.length === 0, 'no covers in public/images/work/ yet');

    // `.work-preview` is position:fixed, so the browser treats it as
    // on-screen and loading="lazy" defers nothing: every preview is
    // fetched on first paint. Serving the full covers here would put the
    // whole gallery on the index page's critical path for a panel about
    // 270px wide.
    const full = fetched.filter((n) => !n.includes('-thumb'));
    expect(full, `full-size covers on the index: ${full.join(', ')}`).toEqual([]);
  });

  test('the case study gets the full-size cover, never upscaled', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'network shape only');
    await page.goto('/work/sales-dashboard/');
    await page.waitForTimeout(2600);

    const img = page.locator('.case-visual img');
    test.skip(await img.count() === 0, 'no cover for this project yet');

    const m = await img.evaluate((el: HTMLImageElement) => ({
      natural: el.naturalWidth,
      shown: el.getBoundingClientRect().width,
    }));
    expect(m.natural).toBeGreaterThan(1000);
    // Displayed at or below its own resolution: past that the browser is
    // upscaling, which shows as soft text on a screenshot of an interface
    // long before it would on a photograph.
    expect(m.shown).toBeLessThanOrEqual(m.natural);

    // And the cap holds on a display wide enough to ask for more.
    await page.setViewportSize({ width: 2560, height: 900 });
    await page.waitForTimeout(600);
    const wide = await img.evaluate((el: HTMLImageElement) => el.getBoundingClientRect().width);
    expect(wide).toBeLessThanOrEqual(m.natural);
  });
});

test.describe('hero slash', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'pointer-driven');

  /** How much of the canvas currently carries ink. */
  const inked = (page: import('@playwright/test').Page) => page.evaluate(() => {
    const c = document.querySelector('[data-hero-slash-canvas]') as HTMLCanvasElement | null;
    if (!c) return -1;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 160) if (d[i] > 12) n += 1;
    return n;
  });

  test('is completely invisible until the brush touches it', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.goto('/');
    await page.waitForTimeout(2400);

    // Not faint. Absent. The whole idea is that it is discovered.
    expect(await inked(page), 'default state').toBe(0);

    // Approaching is not touching: the far side of the hero reveals nothing.
    await page.mouse.move(160, 300);
    await page.waitForTimeout(400);
    expect(await inked(page), 'pointer far from the slash').toBe(0);
  });

  test('reveals locally, then forgets', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.goto('/');
    await page.waitForTimeout(2400);

    for (let i = 0; i < 16; i += 1) {
      await page.mouse.move(700 + i * 12, 580 - i * 16);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(160);
    const touched = await inked(page);
    expect(touched, 'ink appears where the brush crossed').toBeGreaterThan(200);

    // Local, not global: a single crossing must not light the whole band.
    const total = await page.evaluate(() => {
      const c = document.querySelector('[data-hero-slash-canvas]') as HTMLCanvasElement;
      return Math.floor((c.width * c.height) / 40);
    });
    expect(touched, 'the reveal is local').toBeLessThan(total * 0.5);

    // And the memory is temporary rather than a painted line.
    await page.waitForTimeout(2800);
    expect(await inked(page), 'returns to clean').toBe(0);
  });

  test('the artwork never moves', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.goto('/');
    await page.waitForTimeout(2400);

    // The canvas carries no transform of its own: the band is painted at a
    // fixed place inside it, and only the mask changes. A cursor-following
    // slash would show up here as a moving transform.
    const before = await page.locator('[data-hero-slash-canvas]').evaluate(
      (el) => getComputedStyle(el).transform,
    );
    await page.mouse.move(500, 400);
    await page.waitForTimeout(300);
    await page.mouse.move(1200, 700);
    await page.waitForTimeout(300);
    const after = await page.locator('[data-hero-slash-canvas]').evaluate(
      (el) => getComputedStyle(el).transform,
    );
    expect(after).toBe(before);
  });

  test('never covers the hero content', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.goto('/');
    await page.waitForTimeout(2400);
    expect(await page.locator('[data-hero-slash]').evaluate(
      (el) => getComputedStyle(el).pointerEvents,
    )).toBe('none');
    const fxZ = await page.locator('[data-hero-slash]').evaluate((el) => getComputedStyle(el).zIndex);
    const contentZ = await page.locator('.hero .hero-top').evaluate((el) => getComputedStyle(el).zIndex);
    expect(Number(fxZ)).toBeLessThan(Number(contentZ));
    await page.locator('.hero-scroll').click();
    await page.waitForTimeout(600);
    expect(page.url()).toContain('#about');
  });

  test('is not mounted where there is no pointer to follow', async ({ browser }) => {
    for (const ctxOpts of [
      { reducedMotion: 'reduce' as const },
      { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    ]) {
      const ctx = await browser.newContext(ctxOpts);
      const page = await ctx.newPage();
      await page.goto('/');
      await page.waitForTimeout(2400);
      expect(await page.locator('[data-hero-slash]').count()).toBe(0);
      await ctx.close();
    }
  });
});

test.describe('staircase transition', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'client routing');

  /** Whether the staircase ran during the navigation just performed. */
  interface SeenWindow extends Window {
    __seen?: number;
    __seenPoll?: ReturnType<typeof setInterval>;
  }
  const watch = (page: import('@playwright/test').Page) => page.evaluate(() => {
    const w = window as unknown as SeenWindow;
    w.__seen = 0;
    w.__seenPoll ??= setInterval(() => {
      const st = document.querySelector('[data-stairs]') as HTMLElement | null;
      if (st && st.dataset.on !== undefined) w.__seen! += 1;
    }, 20);
  });
  /** Sampled often enough that a real run cannot be missed, and a navigation
   *  with no mechanism at all cannot be mistaken for one. */
  const ran = async (page: import('@playwright/test').Page) =>
    (await page.evaluate(() => (window as unknown as SeenWindow).__seen!)) > 4;

  test('every project opens and closes with the staircase', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    test.setTimeout(180_000);
    await page.goto('/');
    await page.waitForTimeout(2400);
    await workSettled(page);

    const hrefs = await page.locator('[data-work-row]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('href')!),
    );
    expect(hrefs.length).toBe(7);

    // One mechanism, seven projects, both directions. Walking them without
    // reloading also proves the layer is not consumed by the run before it.
    for (const href of hrefs) {
      await watch(page);
      await page.locator(`[data-work-row][href="${href}"]`).click();
      await page.waitForTimeout(1800);
      expect(await ran(page), `${href} opening`).toBe(true);
      await watch(page);
      await page.goBack();
      await page.waitForTimeout(1800);
      expect(await ran(page), `${href} closing`).toBe(true);
      await workSettled(page);
    }
  });

  test('stepping between two projects runs it too', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await workSettled(page);
    await page.locator('[data-work-row]').first().click();
    await page.waitForTimeout(1800);
    await watch(page);
    await page.locator('.case-next a').click();
    await page.waitForTimeout(1800);
    expect(await ran(page)).toBe(true);
  });

  test('the route links use it as well as the browser controls', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await workSettled(page);

    await watch(page);
    await page.locator('[data-work-row][href="/work/sales-dashboard/"]').click();
    await page.waitForTimeout(1900);
    expect(await ran(page), 'entering').toBe(true);
    expect(page.url()).toContain('/work/sales-dashboard/');

    await watch(page);
    await page.goBack();
    await page.waitForTimeout(1900);
    expect(await ran(page), 'browser back').toBe(true);

    // And the page's own back link, not just the browser control.
    await workSettled(page);
    await page.locator('[data-work-row][href="/work/sales-dashboard/"]').click();
    await page.waitForTimeout(1900);
    await watch(page);
    await page.locator('.case-back').click();
    await page.waitForTimeout(1900);
    expect(await ran(page), 'the ALL WORK link').toBe(true);
  });

  test('the steps arrive one at a time, not together', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await workSettled(page);

    // Sample the columns mid-build. If they were animating together every
    // column would sit at the same offset and the staircase would be a
    // rectangle rising, which is the thing this is not.
    await page.evaluate(() => {
      (window as unknown as { __rows?: number[][] }).__rows = [];
      const poll = setInterval(() => {
        const ys = [...document.querySelectorAll('[data-stair]')].map(
          (el) => Math.round(new DOMMatrix(getComputedStyle(el).transform).f),
        );
        (window as unknown as { __rows: number[][] }).__rows.push(ys);
      }, 25);
      setTimeout(() => clearInterval(poll), 900);
    });
    await page.locator('[data-work-row][href="/work/sales-dashboard/"]').click();
    await page.waitForTimeout(1400);

    const rows = await page.evaluate(() => (window as unknown as { __rows: number[][] }).__rows);
    // A stepped silhouette: every column at a different height, and the
    // offsets decreasing left to right, which is each step standing taller
    // than the one before it. A settled build reads [640, 480, 320, 160, 0].
    const stepped = rows.filter((ys) => {
      if (ys.length !== 5) return false;
      const distinct = new Set(ys).size;
      const rising = ys.every((v, i) => i === 0 || ys[i - 1] > v);
      return distinct === 5 && rising;
    });
    expect(stepped.length, 'frames showing a stepped silhouette').toBeGreaterThan(2);

    // And the steps are evenly spaced, so it reads as architecture rather
    // than five things that happened to stop at different heights.
    const built = stepped[stepped.length - 1];
    const gaps = built.slice(1).map((v, i) => built[i] - v);
    const spread = Math.max(...gaps) - Math.min(...gaps);
    expect(spread, `uneven risers: ${gaps.join(', ')}`).toBeLessThan(4);
  });

  test('cleans up, and a second click does not stack a second run', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await workSettled(page);

    const row = page.locator('[data-work-row][href="/work/sales-dashboard/"]');
    await row.click();
    await page.waitForTimeout(60);
    await row.click({ force: true }).catch(() => { /* mid-transition */ });
    await page.waitForTimeout(2200);

    expect(page.url()).toContain('/work/sales-dashboard/');
    expect(await page.evaluate(
      () => (document.querySelector('[data-stairs]') as HTMLElement).dataset.on === undefined,
    ), 'layer cleared').toBe(true);
    expect(await page.evaluate(
      () => getComputedStyle(document.querySelector('[data-stairs]')!).visibility,
    )).toBe('hidden');
  });
  test('the layer survives the swap rather than being replaced by it', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await workSettled(page);

    // The router replaces document.body on every swap. A layer created from
    // script is destroyed by the first navigation and the mechanism then
    // silently does nothing, which is exactly what happened before it was
    // moved into the layout with transition:persist.
    const steps: [string, () => Promise<unknown>][] = [
      ['forward', () => page.locator('[data-work-row][href="/work/back-office-report/"]').click()],
      ['back', () => page.goBack()],
      ['forward again', () => page.goForward()],
      ['next project', () => page.locator('.case-next a').click()],
    ];
    for (const [label, act] of steps) {
      await act();
      await page.waitForTimeout(1900);
      expect(await page.locator('[data-stairs]').count(), `${label}: layer survived`).toBe(1);
      expect(await page.evaluate(
        () => (document.querySelector('[data-stairs]') as HTMLElement).dataset.on === undefined,
      ), `${label}: layer cleared`).toBe(true);
    }
  });

  test('the steps are the brand blue, and take no pointer events', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    const layer = page.locator('[data-stairs]');
    expect(await layer.evaluate((n) => getComputedStyle(n).pointerEvents)).toBe('none');
    // Hidden between navigations rather than a permanently composited layer.
    expect(await layer.evaluate((n) => getComputedStyle(n).visibility)).toBe('hidden');
    const step = await page.locator('[data-stair]').first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(step).toBe('rgb(5, 93, 255)');
  });

  test('reduced motion navigates without the mechanism', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1800);
    expect(await page.locator('[data-stairs]').count()).toBe(0);
    await workSettled(page);
    await page.locator('[data-work-row]').first().click();
    await page.waitForTimeout(1500);
    // Still navigates, just without anything building across the screen.
    expect(page.url()).toContain('/work/');
    await ctx.close();
  });
});

test.describe('work list sort', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough');

  /** Row indices ordered by where they sit on screen, sampled over the run. */
  const watchOrder = (page: import('@playwright/test').Page) => page.evaluate(() => {
    (window as unknown as { __ord: string[] }).__ord = [];
    const poll = setInterval(() => {
      const ys = [...document.querySelectorAll('.work-row')]
        .map((r) => r.getBoundingClientRect().top);
      const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]).join('');
      (window as unknown as { __ord: string[] }).__ord.push(order);
    }, 25);
    setTimeout(() => clearInterval(poll), 4000);
  });
  const orders = async (page: import('@playwright/test').Page) => {
    const raw = await page.evaluate(() => (window as unknown as { __ord: string[] }).__ord);
    return raw.filter((o, i) => i === 0 || raw[i - 1] !== o);
  };

  test('the rows arrive out of order and end sorted', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await watchOrder(page);
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => document.querySelector('[data-work-status]')!.getAttribute('data-state') === 'done',
    );

    const seen = await orders(page);
    // No frame may show the finished list before the sort runs: seeing the
    // answer and then watching it be thrown away reads as a glitch.
    expect(seen[0], `first order seen: ${seen[0]}`).not.toBe('0123456');
    expect(seen.at(-1), 'settles sorted').toBe('0123456');
    // A sort, not a jump. Several distinct arrangements on the way.
    expect(seen.length, `arrangements: ${seen.join(' ')}`).toBeGreaterThan(3);
  });

  test('the numbers stay readable, so the disorder is legible', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    // Sampled mid-sort. An odometer rolling here would leave every row
    // reading 00 at the one moment the number is what carries the meaning.
    const nums = await page.locator('.work-num').allInnerTexts();
    expect(nums.map((n) => n.trim())).toEqual(
      ['01', '02', '03', '04', '05', '06', '07'],
    );
  });

  test('the document order is right even mid-sort', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    // Only the transforms are allowed to lie. Reading order, tab order and
    // link targets are the finished order from the first frame.
    const hrefs = await page.locator('[data-work-row]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('href')!),
    );
    expect(hrefs[0]).toContain('sales-dashboard');
    expect(hrefs.length).toBe(7);
    const moved = await page.evaluate(() => [...document.querySelectorAll('.work-row')]
      .some((r) => new DOMMatrix(getComputedStyle(r).transform).f !== 0));
    expect(moved, 'rows were still in motion when this was sampled').toBe(true);
  });

  test('replays when the section is scrolled back to', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => document.querySelector('[data-work-status]')!.getAttribute('data-state') === 'done',
    );
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);

    await watchOrder(page);
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    const seen = await orders(page);
    expect(seen.length, `second pass: ${seen.join(' ')}`).toBeGreaterThan(3);
    expect(seen.at(-1)).toBe('0123456');
  });

  test('the list cannot be hovered while its rows are moving', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    // A row sliding under a stationary cursor would otherwise fire hover on
    // whichever project happened to pass beneath it.
    expect(await page.locator('[data-work-list]')
      .evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    await page.waitForFunction(
      () => document.querySelector('[data-work-status]')!.getAttribute('data-state') === 'done',
    );
    expect(await page.locator('[data-work-list]')
      .evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('auto');
  });

  test('reduced motion gets the sorted list and no sort', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1800);
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const state = await page.evaluate(
      () => [...document.querySelectorAll('.work-row')].map((r) => ({
        y: new DOMMatrix(getComputedStyle(r).transform).f,
        o: +getComputedStyle(r).opacity,
      })));
    expect(state.every((s) => s.y === 0), 'nothing displaced').toBe(true);
    expect(state.every((s) => s.o === 1), 'everything legible').toBe(true);
    await ctx.close();
  });
});

test.describe('technology partition', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough');

  /** Whether the three group blocks are still pulled together. */
  const closed = (page: import('@playwright/test').Page) => page.evaluate(
    () => [...document.querySelectorAll('.tech-group')]
      .map((g) => Math.round(new DOMMatrix(getComputedStyle(g).transform).f)));

  test('the inventory arrives undivided, then splits into its groups',
    async ({ page }) => {
      test.skip(test.info().project.name !== 'chromium', 'client routing');
      await page.goto('/');
      await page.waitForTimeout(2400);
      await page.locator('#technology').scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);

      // Closed: every group but the first is pulled up into the one above,
      // and the names are not there yet to divide them.
      const before = await closed(page);
      expect(before.slice(1).every((y) => y < 0), `offsets: ${before}`).toBe(true);
      const headsEarly = await page.locator('.tech-head').evaluateAll(
        (els) => els.map((e) => +getComputedStyle(e).opacity));
      expect(Math.max(...headsEarly), 'headings held back').toBeLessThan(1);

      await page.waitForTimeout(2600);
      const after = await closed(page);
      expect(after.every((y) => y === 0), `offsets: ${after}`).toBe(true);
      const headsLate = await page.locator('.tech-head').evaluateAll(
        (els) => els.map((e) => +getComputedStyle(e).opacity));
      expect(Math.min(...headsLate), 'headings arrived').toBe(1);
    });

  test('the numbers are readable while the list is still undivided',
    async ({ page }) => {
      test.skip(test.info().project.name !== 'chromium', 'client routing');
      await page.goto('/');
      await page.waitForTimeout(2400);
      await page.locator('#technology').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);

      // The repeating count is the whole hook: a single list has no business
      // numbering 01-08, 01-05, 01-08. An odometer rolling here would leave
      // every row reading 00 at exactly the moment that has to be legible.
      const nums = await page.locator('.tech-item .t-tiny').allInnerTexts();
      const seq = nums.map((n) => n.replace('/', '').trim());
      expect(seq.slice(0, 8)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08']);
      expect(seq.slice(8, 13)).toEqual(['01', '02', '03', '04', '05']);
      expect(seq.slice(13)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08']);
    });

  test('everything is legible once it settles, on any route in', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    // Landing straight on the section must not leave it armed and hidden.
    await page.goto('/#technology');
    await page.waitForTimeout(3600);
    const state = await page.evaluate(() => ({
      items: [...document.querySelectorAll('.tech-item')]
        .filter((e) => +getComputedStyle(e).opacity === 1).length,
      heads: [...document.querySelectorAll('.tech-head')]
        .filter((e) => +getComputedStyle(e).opacity === 1).length,
    }));
    expect(state).toEqual({ items: 21, heads: 3 });
  });

  test('replays when the section is scrolled back to', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('#technology').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2600);
    expect((await closed(page)).every((y) => y === 0)).toBe(true);

    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await page.locator('#technology').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const again = await closed(page);
    expect(again.slice(1).every((y) => y < 0), `offsets: ${again}`).toBe(true);
  });

  test('reduced motion gets the divided list and no partition', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1800);
    await page.locator('#technology').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => ({
      offsets: [...document.querySelectorAll('.tech-group')]
        .map((g) => new DOMMatrix(getComputedStyle(g).transform).f),
      hidden: [...document.querySelectorAll('.tech-item, .tech-head')]
        .filter((e) => +getComputedStyle(e).opacity < 1).length,
    }));
    expect(state.offsets.every((y) => y === 0), 'nothing displaced').toBe(true);
    expect(state.hidden, 'nothing held back').toBe(0);
    await ctx.close();
  });
});

test.describe('prose measure', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough');

  const FIRST = 'I work close to the ground, inside the actual workflow of a food and '
    + 'beverage business, not from a spec document. The tools I build get judged the '
    + 'same way the kitchen does: does it work today, under pressure, without anyone '
    + 'babysitting it.';

  test('the rules are drawn before the lines land on them', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('#about').scrollIntoViewIfNeeded();
    await page.waitForTimeout(260);

    // Mid-cascade there must be a rule already drawn under a line whose
    // words have not arrived: the measure stating itself ahead of the text
    // is the whole move, and a rule that merely accompanies its line is not
    // the same thing.
    const lead = await page.evaluate(() => {
      const paras = [...document.querySelectorAll('.about-body p')];
      return paras.some((para) => {
        const rules = [...para.querySelectorAll<HTMLElement>('.pl')];
        return rules.some((rule) => {
          const drawn = new DOMMatrix(getComputedStyle(rule).transform).a > 0.9
            && +getComputedStyle(rule).opacity > 0.5;
          if (!drawn) return false;
          const top = parseFloat(rule.style.top);
          // The words sitting on this rule's own line.
          const words = [...para.querySelectorAll<HTMLElement>('.pw')].filter(
            (w) => Math.abs(w.offsetTop + w.offsetHeight - 1 - top) < 2);
          return words.length > 0 && words.every((w) => +getComputedStyle(w).opacity < 0.5);
        });
      });
    });
    expect(lead, 'a drawn rule was waiting for its line').toBe(true);
  });

  test('every rule and word settles, and none are left behind', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('#about').scrollIntoViewIfNeeded();
    await page.waitForTimeout(3200);
    const end = await page.evaluate(() => ({
      hiddenWords: [...document.querySelectorAll('.pw')]
        .filter((w) => +getComputedStyle(w).opacity < 1).length,
      rulesLeft: [...document.querySelectorAll('.pl')]
        .filter((r) => +getComputedStyle(r).opacity > 0.02).length,
    }));
    expect(end).toEqual({ hiddenWords: 0, rulesLeft: 0 });
  });

  test('splitting the words does not change the text', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('#about').scrollIntoViewIfNeeded();
    await page.waitForTimeout(3200);
    // The rules are decoration and must not read; the prose must survive
    // being taken apart to be measured.
    const text = await page.locator('.about-body p').first()
      .evaluate((el) => el.textContent!.replace(/\s+/g, ' ').trim());
    expect(text).toBe(FIRST);
    expect(await page.locator('.pl[aria-hidden="true"]').count())
      .toBe(await page.locator('.pl').count());
  });

  test('a resize redraws the rules against the new line boxes', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'client routing');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('#about').scrollIntoViewIfNeeded();
    await page.waitForTimeout(3200);
    await page.setViewportSize({ width: 900, height: 900 });
    await page.waitForTimeout(900);

    // A rule drawn against the old width would sit between lines rather
    // than under one, so the count has to follow the new layout exactly.
    const m = await page.evaluate(() => {
      const paras = [...document.querySelectorAll('.about-body p')];
      const lines = new Set<string>();
      paras.forEach((para, i) => para.querySelectorAll('.pw')
        .forEach((w) => lines.add(`${i}:${Math.round((w as HTMLElement).offsetTop)}`)));
      return {
        rules: document.querySelectorAll('.pl').length,
        lines: lines.size,
        hidden: [...document.querySelectorAll('.pw')]
          .filter((w) => +getComputedStyle(w).opacity < 1).length,
      };
    });
    expect(m.rules, `rules ${m.rules} vs lines ${m.lines}`).toBe(m.lines);
    expect(m.hidden, 'nothing left hidden by the rebuild').toBe(0);
  });

  test('reduced motion leaves the prose alone entirely', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1800);
    await page.locator('#about').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    // Not merely settled: never taken apart in the first place.
    expect(await page.locator('.pw').count()).toBe(0);
    expect(await page.locator('.pl').count()).toBe(0);
    const text = await page.locator('.about-body p').first()
      .evaluate((el) => el.textContent!.replace(/\s+/g, ' ').trim());
    expect(text).toBe(FIRST);
    await ctx.close();
  });
});

test.describe('footer field', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough');

  /**
   * What the brush has laid down: the strongest alpha anywhere on the
   * footer canvas, and how much of it carries any at all.
   *
   * Both are needed. Coverage alone cannot see the ink fading, because a
   * stroke keeps its footprint while it weakens; strength alone cannot see
   * it reach empty, because the last of it is a hair above zero.
   */
  const inked = (page: import('@playwright/test').Page) => page.evaluate(() => {
    const c = document.querySelector('[data-foot-ink-canvas]') as HTMLCanvasElement | null;
    if (!c) return { peak: -1, area: -1 };
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    let peak = 0;
    let area = 0;
    for (let i = 3; i < data.length; i += 4 * 97) {
      if (data[i] > peak) peak = data[i];
      if (data[i] > 4) area += 1;
    }
    return { peak, area };
  });

  /** Drags across the footer, which is the only way anything here appears. */
  const drag = async (page: import('@playwright/test').Page) => {
    const box = (await page.locator('.foot').boundingBox())!;
    const y = box.y + box.height * 0.45;
    for (let i = 0; i <= 24; i += 1) {
      await page.mouse.move(box.x + 30 + ((box.width - 60) * i) / 24, y);
    }
    return box;
  };

  test('nothing is there until the pointer finds it', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'needs a fine pointer');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('.foot').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    // The field is painted and then masked to nothing. Untouched, it is not
    // faint, it is absent, which is what makes finding it worth anything.
    expect((await inked(page)).area, 'footer starts clean').toBe(0);

    await drag(page);
    await page.waitForTimeout(120);
    expect((await inked(page)).area, 'the drag marked it').toBeGreaterThan(0);
  });

  test('the ink fades back on its own', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'needs a fine pointer');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('.foot').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    await drag(page);
    await page.waitForTimeout(120);
    const wet = await inked(page);
    await page.waitForTimeout(1200);
    const fading = await inked(page);
    expect(fading.peak, `wet ${wet.peak}`).toBeLessThan(wet.peak);

    // And all the way back to empty, not to a faint permanent stain. An
    // 8-bit alpha buffer cannot decay to nothing on proportional removal
    // alone: taking 2.7% of an alpha of 16 truncates to zero and the stroke
    // stops fading, so the residue has to be wiped rather than waited out.
    await page.waitForTimeout(3400);
    expect((await inked(page)).area, 'footer returned to clean').toBe(0);
  });

  test('whatever is revealed, the footer stays readable on it', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'needs a fine pointer');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('.foot').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);

    // Saturate it, then measure what the footer's own text is standing on.
    // Set in white, the wordmark's glyphs would be the brightest thing here
    // and would take the email address to roughly 1.2:1.
    const box = (await page.locator('.foot').boundingBox())!;
    for (let row = 0; row <= 8; row += 1) {
      const y = box.y + (box.height * row) / 8;
      for (let i = 0; i <= 28; i += 1) {
        await page.mouse.move(box.x + 8 + ((box.width - 16) * i) / 28, y);
      }
    }
    const worst = await page.evaluate(() => {
      const c = document.querySelector('[data-foot-ink-canvas]') as HTMLCanvasElement;
      const g = c.getContext('2d')!;
      const { data } = g.getImageData(0, 0, c.width, c.height);
      const dark = [22, 24, 25];
      const lin = (v: number) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      let top = -1;
      for (let i = 0; i < data.length; i += 4 * 31) {
        const a = data[i + 3] / 255;
        // What the visitor sees is the canvas composited over the footer.
        const r = data[i] * a + dark[0] * (1 - a);
        const gg = data[i + 1] * a + dark[1] * (1 - a);
        const b = data[i + 2] * a + dark[2] * (1 - a);
        const l = 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
        if (l > top) top = l;
      }
      const text = 0.2126 * lin(244) + 0.7152 * lin(244) + 0.0722 * lin(244);
      return (text + 0.05) / (top + 0.05);
    });
    expect(worst, `footer text measured ${worst.toFixed(2)}:1 on the field`)
      .toBeGreaterThanOrEqual(4.5);
  });

  test('it sits behind the footer and takes no clicks', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'needs a fine pointer');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('.foot').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const fx = page.locator('[data-foot-ink]');
    expect(await fx.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    const zs = await page.evaluate(() => ({
      fx: +getComputedStyle(document.querySelector('[data-foot-ink]')!).zIndex,
      content: +getComputedStyle(document.querySelector('.foot > .bleed')!).zIndex,
    }));
    expect(zs.fx).toBeLessThan(zs.content);
    // The email is still the thing a click lands on.
    const mail = page.locator('.foot a[href^="mailto:"]');
    await expect(mail).toBeVisible();
    expect(await mail.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return el.contains(hit) || hit === el;
    })).toBe(true);
  });

  test('is not mounted where there is no pointer to paint with', async ({ browser }) => {
    for (const opts of [
      { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
      { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' as const },
    ]) {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      await page.goto('/');
      await page.waitForTimeout(1800);
      expect(await page.locator('[data-foot-ink]').count()).toBe(0);
      await ctx.close();
    }
  });
});

// The social card. Every case study used to point at the same /og.jpg, so a
// shared link said nothing about which project it opened. These assert the
// per-project cards exist, are actually distinct, and are shaped the way
// social scrapers require.
test.describe('social cards', () => {
  test('every case study points at its own card, and no two are the same', async ({ page, request }) => {
    await page.goto('/');
    const slugs = await page.locator('[data-work-row]').evaluateAll((rows) =>
      rows
        .map((r) => r.closest('a')?.getAttribute('href') ?? r.getAttribute('href'))
        .filter((h): h is string => !!h && h.startsWith('/work/'))
        .map((h) => h.replace(/^\/work\/|\/$/g, '')),
    );
    expect(slugs.length).toBeGreaterThan(1);

    const seen = new Set<string>();
    for (const slug of slugs) {
      await page.goto(`/work/${slug}/`);
      const content = await page.locator('meta[property="og:image"]').getAttribute('content');
      // Absolute, because scrapers do not resolve relative image paths.
      expect(content).toBe(`https://toby.dev/og/${slug}.png`);
      expect(seen.has(content!), `${slug} reuses another project's card`).toBe(false);
      seen.add(content!);

      // The declared dimensions have to be the file's real ones, or the
      // preview is cropped by whatever platform trusted the meta tag.
      const res = await request.get(`/og/${slug}.png`);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain('image/png');
      const body = await res.body();
      expect(body.subarray(1, 4).toString()).toBe('PNG');
      // Width and height are big-endian 32-bit values in the IHDR chunk.
      expect(body.readUInt32BE(16)).toBe(1200);
      expect(body.readUInt32BE(20)).toBe(630);
    }
  });

  test('the card the page declares is the card its structured data names', async ({ page }) => {
    // Two places state the image, and a scraper may read either. They are
    // built from one value in the page, and this is what keeps that true.
    await page.goto('/work/sales-dashboard/');
    const meta = await page.locator('meta[property="og:image"]').getAttribute('content');
    const ld = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(ld!).image).toBe(meta);
  });
});
