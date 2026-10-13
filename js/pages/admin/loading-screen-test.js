import {
  LOADING_SCREEN_PRESETS,
  getLoadingScreenPreset,
} from '../../shared/loading-screen/presets/index.js?v=loading-screen-presets-20261011i';
import { resolveAdminAuth } from './api.js';
import { mountGate } from './gate.js';

const DEMO_STAGES = ['Loading assets', 'Preparing the game', 'Almost ready'];
const DEMO_DURATION_MS = 4200;

let cancelDemo = () => {};

function startGenericDemo(screen, button) {
  if (!screen || !button) return;
  cancelDemo();
  let startedAt = performance.now();
  let frame = 0;
  let active = true;
  cancelDemo = () => {
    active = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  button.disabled = true;
  screen.reset();

  const tick = (now) => {
    if (!active) return;
    const progress = Math.min(100, ((now - startedAt) / DEMO_DURATION_MS) * 100);
    screen.setProgress(progress);
    if (progress < 100) {
      frame = requestAnimationFrame(tick);
      return;
    }
    screen.complete('Ready to play');
    button.disabled = false;
  };

  frame = requestAnimationFrame(tick);
}

function renderPreset(preview, root, presetId, replay) {
  cancelDemo();
  preview.replaceChildren();
  const preset = getLoadingScreenPreset(presetId);
  const screen = preset.create({
    host: preview,
    root,
    title: 'Loading your adventure',
    subtitle: 'Preparing your backpack…',
    stages: DEMO_STAGES,
  });
  if (!screen) return;

  replay.disabled = true;
  if (presetId === 'generic') {
    startGenericDemo(screen, replay);
    return;
  }

  screen.reset?.();
  void screen.play?.().finally(() => {
    replay.disabled = false;
  });
}

async function boot() {
  const main = document.getElementById('main');
  if (!(main instanceof HTMLElement)) return;

  const auth = await resolveAdminAuth();
  if (!auth) {
    mountGate(main, { error: 'Owner admin access required.' });
    return;
  }

  main.innerHTML = `
    <section class="loading-screen-test" aria-label="Loading screen preview">
      <div class="loading-screen-test__preview" data-loading-preview></div>
      <div class="loading-screen-test__controls" role="toolbar" aria-label="Loading screen controls">
        <label>
          <span class="sr-only">Loading screen preset</span>
          <select data-loading-preset aria-label="Loading screen preset">
            ${Object.values(LOADING_SCREEN_PRESETS).map((preset) => `
              <option value="${preset.id}" ${preset.id === 'build-creator' ? 'selected' : ''}>${preset.label}</option>
            `).join('')}
          </select>
        </label>
        <button type="button" data-loading-replay>Replay</button>
      </div>
    </section>
  `;

  const preview = main.querySelector('[data-loading-preview]');
  const presetSelect = main.querySelector('[data-loading-preset]');
  const replay = main.querySelector('[data-loading-replay]');
  const root = document.body.dataset.root || './';
  const mount = () => renderPreset(
    preview,
    root,
    presetSelect?.value || 'build-creator',
    replay,
  );
  presetSelect?.addEventListener('change', mount);
  replay?.addEventListener('click', mount);
  mount();
}

void boot();
