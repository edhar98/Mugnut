// Smoke suite for the no-build web version, run at phone viewports.
const { defineConfig, devices } = require("@playwright/test");

// Each checkout gets its own port, and a server already on it is never reused:
// otherwise a second copy of the repository (a worktree under review, say) could be the one that gets tested.
const PORT = 4200 + [...__dirname].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 700, 7);
// MUGNUT_URL=https://edhar98.github.io/Mugnut/ npx playwright test   runs the same suite against a deployed copy.
const LIVE = process.env.MUGNUT_URL;

module.exports = defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: LIVE || `http://127.0.0.1:${PORT}/`,
    timezoneId: "Asia/Yerevan",
    locale: "en-US",
    // The service worker would cache index.html between tests; offline behaviour is covered separately.
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "android-chrome", use: { ...devices["Pixel 7"] } },
    { name: "ios-safari", use: { ...devices["iPhone 14"] } },
  ],
  webServer: LIVE ? undefined : {
    command: `npx http-server . -p ${PORT} -a 127.0.0.1 -c-1 --silent`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
  },
});
