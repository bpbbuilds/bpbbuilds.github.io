import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function viewportOption() {
  const value = option('--viewport');
  if (!value) return { width: 1280, height: 720 };
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) throw new Error(`--viewport must look like 1280x720, received ${value}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

const url = option('--url') || process.env.BPB_URL || 'http://127.0.0.1:8123/';
const screenshot = option('--screenshot');
const strictNetwork = process.argv.includes('--strict-network');
const viewport = viewportOption();
const consoleMessages = [];
const pageErrors = [];
const failedRequests = [];
const httpErrors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport });

page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    consoleMessages.push({ type: message.type(), text: message.text() });
  }
});
page.on('pageerror', (error) => pageErrors.push(String(error)));
page.on('requestfailed', (request) => {
  failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
});
page.on('response', (response) => {
  if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
});

let navigationResponse;
let navigationError = null;
try {
  navigationResponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
} catch (error) {
  navigationError = String(error);
}

const pageState = await page.evaluate(() => ({
  title: document.title,
  bodyClass: document.body.className,
  href: location.href,
  viewport: { width: window.innerWidth, height: window.innerHeight },
  scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
})).catch(() => null);

if (screenshot) {
  const screenshotPath = path.resolve(screenshot);
  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

await browser.close();

const passed = Boolean(navigationResponse?.ok()) &&
  !navigationError &&
  pageErrors.length === 0 &&
  consoleMessages.every((message) => message.type !== 'error') &&
  failedRequests.length === 0 &&
  (!strictNetwork || httpErrors.length === 0);

console.log(JSON.stringify({
  passed,
  url,
  navigationStatus: navigationResponse?.status() || null,
  navigationError,
  pageState,
  consoleMessages,
  pageErrors,
  failedRequests,
  httpErrors,
  screenshot: screenshot ? path.resolve(screenshot) : null,
}, null, 2));

if (!passed) process.exitCode = 1;
