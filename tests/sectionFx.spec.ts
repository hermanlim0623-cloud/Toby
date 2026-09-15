import { test, expect } from '@playwright/test';

// These assert end states, not that "an animation exists". The tech chips
// shipped once in a state where the tween reported itself complete while
// the elements sat at their scattered start values — visible only by
// reading the computed transform, which is what this file does.

test.describe('section motion', () => {
  test.skip(({ isMobile }) => isMobile);

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Past the preloader, which holds for up to 3s.
    await expect(page.locator('.preloader')).toBeHidden({ timeout: 15_000 });
  });

  test('tech chips settle back into the layout', async ({ page }) => {
    await page.locator('[data-tech-cloud]').scrollIntoViewIfNeeded();
    const chip = page.locator('.tech-chip').first();
    await expect(chip).toBeVisible();

    await expect
      .poll(async () => chip.evaluate((el) => getComputedStyle(el).opacity), { timeout: 10_000 })
      .toBe('1');

    // The identity matrix is the whole point: no leftover offset, rotation
    // or scale from the assemble tween.
    const transform = await chip.evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
  });

  test('pipeline stages ignite as the section is passed', async ({ page }) => {
    await page.locator('.pipeline-stats').scrollIntoViewIfNeeded();
    await expect
      .poll(async () => page.locator('.pipeline-stage.is-live').count(), { timeout: 10_000 })
      .toBeGreaterThan(0);
  });

  test('odometers render digit columns and stay readable', async ({ page }) => {
    // Reduced motion renders the plain number instead of columns, which the
    // dedicated reduced-motion test below covers.
    test.skip(test.info().project.name === 'reduced-motion');

    await page.locator('.pipeline-stats').scrollIntoViewIfNeeded();
    const odo = page.locator('.odo').first();
    await expect(odo).toBeVisible();

    // 1000 -> four columns, each a strip of 0-9 repeated.
    await expect(odo.locator('.odo-col')).toHaveCount(4);

    // The number must survive as text for assistive tech — an aria-label
    // on a bare <span> is prohibited, so it lives in a hidden text node.
    await expect(odo.locator('.sr-only')).toHaveText('1000');
    await expect(odo).not.toHaveAttribute('aria-label', /.*/);
  });

  test('the timeline spine fills and its node ignites', async ({ page }) => {
    await page.locator('[data-timeline]').scrollIntoViewIfNeeded();
    await expect(page.locator('.timeline-row').first()).toHaveClass(/is-reached/, { timeout: 10_000 });

    const scaleY = await page
      .locator('[data-timeline-fill]')
      .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).d);
    expect(scaleY).toBeGreaterThan(0);
  });

  test('the project card tilt and grading compose instead of overwriting', async ({ page }) => {
    // The tilt is deliberately not wired up under reduced motion.
    test.skip(test.info().project.name === 'reduced-motion');

    await page.locator('#work').scrollIntoViewIfNeeded();
    // Let the pinned gallery and the smooth scroll come to rest. Playwright's
    // own actionability wait never succeeds here: the gallery is scrubbed and
    // re-graded every frame, so a card is never "stable" by its definition.
    await page.waitForTimeout(1500);

    const target = await page.evaluate(() => {
      const mid = window.innerWidth / 2;
      // Mapped and sorted rather than accumulated into a mutable `best`:
      // TypeScript's flow analysis does not follow assignments made inside
      // a callback, so that shape narrows to `null` at the return.
      return [...document.querySelectorAll('a.project-card')]
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            distance: Math.abs(rect.left + rect.width / 2 - mid),
          };
        })
        .sort((a, b) => a.distance - b.distance)[0];
    });

    expect(target).toBeTruthy();

    // Two moves: the first enters the card, the second gives the tilt a
    // pointer delta to read.
    await page.mouse.move(target.x, target.y);
    await page.mouse.move(target.x + 40, target.y - 30);
    await page.waitForTimeout(400);

    const vars = await page.evaluate(() => {
      const el = document.querySelector('a.project-card.is-tilting') as HTMLElement | null;
      if (!el) return null;
      return {
        tilt: el.style.getPropertyValue('--t-ry'),
        inlineTransform: el.style.transform,
      };
    });

    expect(vars).not.toBeNull();
    expect(vars!.tilt).not.toBe('');
    // Neither system writes `transform` itself — that is what stops the
    // depth grading and the tilt from erasing one another.
    expect(vars!.inlineTransform).toBe('');
  });

  test('the skill matrix hands off to the gallery with an axis turn, then settles clean', async ({ page }) => {
    test.skip(test.info().project.name === 'reduced-motion');

    // A dedicated wheel-pump rather than scrollIntoView: this crosses a
    // scrub range whose exact pixel bounds depend on the pin's own layout,
    // and expect.poll driving the scroll itself throttles how often the
    // page actually moves — a plain incremental loop gets there reliably.
    await expect
      .poll(async () => {
        await page.mouse.wheel(0, 250);
        return page.evaluate(() => document.querySelector('.skill-stage')?.classList.contains('is-turning'));
      }, { timeout: 15_000 })
      .toBe(true);

    const mid = await page.evaluate(() => {
      const m = new DOMMatrix(getComputedStyle(document.querySelector('.gallery-viewport')!).transform);
      return { m13: m.m13, m31: m.m31 };
    });
    // Off-diagonal terms are only non-zero under an active rotateY — this
    // is the turn actually happening, not just "some transform exists".
    expect(Math.abs(mid.m13) + Math.abs(mid.m31)).toBeGreaterThan(0.2);

    await expect
      .poll(async () => {
        await page.mouse.wheel(0, 250);
        return page.evaluate(() => document.querySelector('.skill-stage')?.classList.contains('is-turning'));
      }, { timeout: 15_000 })
      .toBe(false);
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const settled = await page.evaluate(() => {
      const el = document.querySelector('.gallery-viewport')!;
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return { opacity: getComputedStyle(el).opacity, m13: m.m13, m31: m.m31 };
    });
    expect(settled.opacity).toBe('1');
    expect(Math.abs(settled.m13)).toBeLessThan(0.01);
    expect(Math.abs(settled.m31)).toBeLessThan(0.01);
  });

  test('the boundary iris fires once the gallery pin releases', async ({ page }) => {
    test.skip(test.info().project.name === 'reduced-motion');

    for (let i = 0; i < 60; i++) {
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(500);

    await expect(page.locator('[data-boundary-iris]')).toHaveClass(/is-firing/);
  });
});

test('the shutdown pull-back deepens as the dive breaches the surface', async ({ page }) => {
  test.skip(test.info().project.name === 'reduced-motion');

  // Unlike the gallery turn/iris above, shutdown.js has no min-width gate —
  // it runs on mobile too, so this test isn't scoped to the desktop-only
  // describe block above.
  await page.goto('/');
  await expect(page.locator('.preloader')).toBeHidden({ timeout: 15_000 });
  await page.locator('[data-shutdown]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  const m11 = await page.locator('[data-shutdown-world]').evaluate((el) => {
    return new DOMMatrix(getComputedStyle(el).transform).m11;
  });
  // The old pull-back bottomed out at 0.72; this asserts the deepened one
  // rather than merely "some scale happened".
  expect(m11).toBeGreaterThan(0);
  expect(m11).toBeLessThan(0.6);
});

test('the hero submerges as it exits into the identity section, where supported', async ({ page }) => {
  test.skip(test.info().project.name === 'reduced-motion');

  await page.goto('/');
  await expect(page.locator('.preloader')).toBeHidden({ timeout: 15_000 });

  const supportsViewTimeline = await page.evaluate(() => CSS.supports('animation-timeline', 'view()'));
  test.skip(!supportsViewTimeline, 'animation-timeline: view() unsupported in this engine — plain scroll stands in');

  const before = await page.locator('.hero-content').evaluate((el) => getComputedStyle(el).opacity);
  expect(before).toBe('1');

  await page.locator('#intro').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const after = await page.locator('.hero-content').evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(after)).toBeLessThan(0.5);
});

test('reduced motion lands every section on its end state', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  const context = await page.context().browser()!.newContext({ reducedMotion: 'reduce' });
  const p = await context.newPage();
  await p.goto('/');
  await p.locator('.pipeline-stats').scrollIntoViewIfNeeded();

  // No tweens run, so the content has to already be at its final state
  // rather than waiting on an animation that will never play.
  await expect(p.locator('.pipeline-stage.is-live')).toHaveCount(5);
  await expect(p.locator('[data-counter]').first()).toHaveText('1,000');
  await context.close();
});

test('reduced motion never turns the axis, fires the iris, or amplifies the shutdown pull-back', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  // A forced desktop viewport: the axis turn and iris are min-width gated
  // in the source, and this assertion should hold regardless of which
  // project (including the narrow "mobile" one) actually ran it.
  const context = await page.context().browser()!.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1400, height: 900 },
  });
  const p = await context.newPage();
  await p.goto('/');
  await expect(p.locator('.preloader')).toBeHidden({ timeout: 15_000 });

  for (let i = 0; i < 60; i++) {
    await p.mouse.wheel(0, 600);
    await p.waitForTimeout(20);
  }
  await p.waitForTimeout(400);

  const state = await p.evaluate(() => ({
    heroOpacity: getComputedStyle(document.querySelector('.hero-content')!).opacity,
    skillTransform: getComputedStyle(document.querySelector('.skill-stage')!).transform,
    galleryTransform: getComputedStyle(document.querySelector('.gallery-viewport')!).transform,
    irisFiring: document.querySelector('[data-boundary-iris]')?.classList.contains('is-firing'),
    worldTransform: getComputedStyle(document.querySelector('[data-shutdown-world]')!).transform,
  }));

  expect(state.heroOpacity).toBe('1');
  expect(state.skillTransform).toBe('none');
  expect(state.galleryTransform).toBe('none');
  expect(state.irisFiring).toBe(false);
  expect(state.worldTransform).toBe('none');

  await context.close();
});
