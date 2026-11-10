// Smoke suite for the no-build web version, run at phone viewports.
const { defineConfig, devices } = require("@playwright/test");

const PORT = 4173;

module.exports = defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
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
  webServer: {
    command: `npx http-server . -p ${PORT} -a 127.0.0.1 -c-1 --silent`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
  },
});
