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
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

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
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const row = (await page.locator('[data-work-row]').nth(2).boundingBox())!;
    await page.mouse.move(row.x + 400, row.y + row.height / 2);
    await page.waitForTimeout(400);
    expect(await state()).toBe('project');
  });

  test('shows the hovered project’s own preview, one at a time', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'fine pointer only');
    await page.goto('/');
    await page.waitForTimeout(2400);
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

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
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

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
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
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
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
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
