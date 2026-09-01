/**
 * Benchmark AppearInLibrary class restart strategies (Playwright Chromium).
 *
 * Documents why per-item offsetWidth was slow (~500ms thrash vs ~5ms batch).
 * Run: node scripts/bench-appear-reflow.mjs
 */
import { chromium } from 'playwright';

const N = 520;

const html = `<!doctype html>
<html><body>
<div id="root" style="position:relative;width:800px;height:800px"></div>
<script>
window.__N = ${N};
window.bench = async function() {
  const root = document.getElementById('root');
  root.replaceChildren();
  const items = [];
  const unders = [];
  for (let i = 0; i < window.__N; i++) {
    const el = document.createElement('div');
    el.className = 'item';
    el.style.cssText = 'position:absolute;width:34px;height:34px;left:'+(i%20)*34+'px;top:'+Math.floor(i/20)*34+'px;background:#888';
    root.appendChild(el);
    items.push(el);
    const u = document.createElement('div');
    u.className = 'under';
    u.style.cssText = 'position:absolute;width:34px;height:34px;left:'+(i%20)*34+'px;top:'+Math.floor(i/20)*34+'px;background:#444';
    root.appendChild(u);
    unders.push(u);
  }

  function thrash() {
    const t0 = performance.now();
    for (let i = 0; i < items.length; i++) {
      items[i].classList.remove('appear', 'appear-bag');
      void items[i].offsetWidth;
      items[i].classList.add('appear');
      unders[i].classList.remove('appear', 'appear-bag');
      void unders[i].offsetWidth;
      unders[i].classList.add('appear');
    }
    return performance.now() - t0;
  }

  function batchBoth() {
    const t0 = performance.now();
    for (let i = 0; i < items.length; i++) {
      items[i].classList.remove('appear', 'appear-bag');
      unders[i].classList.remove('appear', 'appear-bag');
    }
    void root.offsetWidth;
    for (let i = 0; i < items.length; i++) {
      items[i].classList.add('appear');
      unders[i].classList.add('appear');
    }
    return performance.now() - t0;
  }

  function batchItemOnly() {
    const t0 = performance.now();
    for (let i = 0; i < items.length; i++) {
      items[i].classList.remove('appear', 'appear-bag');
    }
    void root.offsetWidth;
    for (let i = 0; i < items.length; i++) {
      items[i].classList.add('appear');
    }
    return performance.now() - t0;
  }

  // Warm
  thrash(); batchBoth(); batchItemOnly();

  const runs = 5;
  const avg = (fn) => {
    let s = 0;
    for (let r = 0; r < runs; r++) s += fn();
    return s / runs;
  };

  return {
    n: window.__N,
    thrashMs: avg(thrash),
    batchBothMs: avg(batchBoth),
    batchItemOnlyMs: avg(batchItemOnly),
  };
};
</script>
<style>
.appear { animation: a 0.5s ease-in-out forwards; }
@keyframes a { from { transform: scale(0) } to { transform: scale(1) } }
</style>
</body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(html);
const result = await page.evaluate(() => window.bench());
console.log(JSON.stringify(result, null, 2));
await browser.close();
