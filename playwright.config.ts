import { defineConfig, devices } from '@playwright/test';

// Some sandboxes and CI images ship a Chromium that Playwright did not
// download itself. Pointing at it beats re-downloading a browser that is
// already on disk; unset, Playwright resolves its own as usual.
const launchOptions = process.env.CHROMIUM_PATH
  ? { executablePath: process.env.CHROMIUM_PATH }
  : {};

// Tests run against the real production build, not the dev server: the
// things most likely to break on this site (the bundled boot script, the
// serialized command index, the generated case-study routes) only exist
// after a build.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    launchOptions,
  },
  projects: [
    // The `unit` project used to carry the video seek rules. The generated
    // dive has no playhead to seek, so those rules — and the project that
    // ran them without a browser — are gone with the footage.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      // Reduced motion is a supported mode here, not an afterthought — the
      // preloader, the dive and the palette all branch on it, so it gets
      // its own run rather than being assumed to work.
      name: 'reduced-motion',
      use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // A plain static server over dist/ rather than `astro preview`, which
    // daemonizes itself in some environments and keeps a lock file — both
    // of which break Playwright's contract that the webServer command runs
    // in the foreground for the life of the run.
    command: 'npm run build && npx serve dist --listen 4321 --no-clipboard',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
