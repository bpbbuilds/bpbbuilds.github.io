#!/usr/bin/env node

/** Browser-level CSP smoke for the admin animation-lab Supabase origin. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = fs.readFileSync(path.join(root, 'js/shared/config.js'), 'utf8');
const origin = config.match(/supabaseUrl:\s*"(https:\/\/[^"/]+)"/)?.[1] || '';
if (!origin) throw new Error('Could not read the configured Supabase origin.');

const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, executablePath: edgePath });
try {
  const page = await browser.newPage();
  const violations = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
      violations.push(message.text());
    }
  });
  await page.goto('http://127.0.0.1:5501/admin/performance/pages/home/sections/build-creator-animation/', {
    waitUntil: 'domcontentloaded',
  });
  const result = await page.evaluate(async (configuredOrigin) => {
    const allowed = await fetch(`${configuredOrigin}/rest/v1/profiles?select=id&limit=1`)
      .then((response) => ({ status: response.status }))
      .catch((error) => ({ error: String(error) }));
    const stale = await fetch('https://xklkysmakrmgtiztsquq.supabase.co/rest/v1/profiles?select=id&limit=1')
      .then((response) => ({ status: response.status }))
      .catch((error) => ({ error: String(error) }));
    return { allowed, stale };
  }, origin);

  if (result.allowed.error) throw new Error(`Configured Supabase origin was blocked: ${result.allowed.error}`);
  if (result.stale.status != null || !result.stale.error?.includes('Failed to fetch')) {
    throw new Error(`Stale Supabase origin was not blocked by CSP: ${JSON.stringify(result.stale)}`);
  }
  if (violations.length < 2) {
    throw new Error(`Expected stale-origin CSP console errors, got ${violations.length}: ${JSON.stringify(violations)}`);
  }
  console.log(JSON.stringify({ configuredOrigin: origin, allowedStatus: result.allowed.status, staleBlocked: true }));
} finally {
  await browser.close();
}
