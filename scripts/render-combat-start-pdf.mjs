#!/usr/bin/env node

/** Render the generated combat-start HTML through the installed Edge engine. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'docs/sim/combat-start-sequence.md');
const outputPath = path.join(root, 'docs/sim/combat-start-sequence.pdf');
const tempPath = path.join(os.tmpdir(), `bpb-combat-start-${process.pid}-${Date.now()}.html`);
const pythonScript = path.join(root, 'scripts/render-combat-start-pdf.py');
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

function fail(message) {
  throw new Error(message);
}

try {
  const render = spawnSync('python', [pythonScript, sourcePath, tempPath], {
    cwd: root,
    encoding: 'utf8',
  });
  if (render.status !== 0) fail(render.stderr || 'Markdown renderer failed');
  if (!fs.existsSync(tempPath)) fail('Markdown renderer did not create HTML');
  if (!fs.existsSync(edgePath)) fail(`Edge executable not found at ${edgePath}`);

  const html = fs.readFileSync(tempPath, 'utf8');
  const browser = await chromium.launch({ headless: true, executablePath: edgePath });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  const structure = await page.evaluate(() => ({
    title: document.querySelector('h1')?.textContent?.trim() || '',
    headings: document.querySelectorAll('h2, h3').length,
    tables: document.querySelectorAll('table').length,
    lists: document.querySelectorAll('ul, ol').length,
    codeBlocks: document.querySelectorAll('pre').length,
    textLength: document.body.innerText.length,
  }));
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="width:100%;font:9px Georgia,serif;color:#6b513b;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '16mm', right: '14mm', bottom: '17mm', left: '14mm' },
  });
  await browser.close();

  const stat = fs.statSync(outputPath);
  if (!stat.size) fail('PDF renderer created an empty file');
  console.log(JSON.stringify({ outputPath, bytes: stat.size, structure }));
} finally {
  if (fs.existsSync(tempPath)) fs.rmSync(tempPath);
}
