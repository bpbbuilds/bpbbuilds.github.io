import { initNav } from '../../shared/nav.js';
import { resolveAdminAuth } from './api.js';
import { mountGate } from './gate.js';
import { DESIGN_H, DESIGN_W, initCombatSky } from '../home/combat-sky/index.js';
import { applyTime, bindSkyLayers } from '../home/combat-sky/apply.js';
import { buildSkyDom, combatSkyRoot } from '../home/combat-sky/dom.js';
import { createFallingItemsBackground } from './backgrounds/falling-items.js?v=game-surfaces-spread-20261011';
import { BACKGROUND_GROUPS, BACKGROUND_OPTIONS, getBackgroundPreset } from './backgrounds/index.js?v=falling-town-square-20261011';

function fitScale(host) {
  const scale = Math.max(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
  host.style.setProperty('--combat-sky-scale', String(scale));
}

function createStaticSky() {
  const host = buildSkyDom(combatSkyRoot());
  host.classList.add('combat-sky--test-static');
  host.hidden = true;
  document.body.insertBefore(host, document.body.firstChild);
  fitScale(host);

  const layers = bindSkyLayers(host);
  window.addEventListener('resize', () => fitScale(host), { passive: true });
  return { host, layers };
}

function createAssetBackground() {
  const element = document.createElement('div');
  element.className = 'background-test__asset';
  element.setAttribute('aria-hidden', 'true');
  element.hidden = true;
  document.body.insertBefore(element, document.body.firstChild);
  return element;
}

function renderTestSurface(main, skyController, staticSky, assetBackground, fallingItems) {
  const buttons = BACKGROUND_OPTIONS.map(
    ({ id, label, group }, index) => `
      <button
        class="background-test__button"
        type="button"
        data-background-choice="${id}"
        data-background-group="${group}"
        aria-pressed="${index === 0 ? 'true' : 'false'}"
      >${label}</button>
    `,
  ).join('');
  const filterOptions = [
    { id: 'all', label: 'All backgrounds' },
    ...BACKGROUND_GROUPS,
  ].map(({ id, label }) => `<option value="${id}">${label}</option>`).join('');

  main.innerHTML = `
    <section class="background-test" aria-label="Background choices">
      <div class="background-test__controls" role="toolbar" aria-label="Change background">
        <div class="background-test__picker-head">
          <span class="background-test__picker-label">Background preview</span>
          <span class="background-test__selected" data-background-selection>Home background</span>
        </div>
        <label class="background-test__filter-label">
          <span>Category</span>
          <select class="background-test__filter" data-background-filter aria-label="Filter backgrounds by category">
            ${filterOptions}
          </select>
        </label>
        <div class="background-test__falling-controls" data-falling-controls hidden>
          <div class="background-test__falling-controls-title">Falling items</div>
          <label class="background-test__range">
            <span>Drop frequency</span>
            <input
              type="range"
              min="0.25"
              max="3"
              step="0.25"
              value="1"
              data-falling-rate
              aria-label="Falling item drop frequency"
            />
            <output data-falling-rate-value>1.00×</output>
          </label>
          <label class="background-test__range">
            <span>Drop speed</span>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value="1"
              data-falling-speed
              aria-label="Falling item drop speed"
            />
            <output data-falling-speed-value>1.0×</output>
          </label>
          <label class="background-test__toggle">
            <input type="checkbox" data-falling-bounce />
            <span>Bounce once at the bottom</span>
          </label>
          <label class="background-test__toggle">
            <input type="checkbox" data-falling-surfaces />
            <span>Bounce off game surfaces (blue tent)</span>
          </label>
        </div>
        <div class="background-test__options">${buttons}</div>
      </div>
      <div class="background-test__blank" aria-hidden="true"></div>
    </section>
  `;

  const sky = skyController?.host ?? document.querySelector('.combat-sky');
  const choiceButtons = [...main.querySelectorAll('[data-background-choice]')];
  const filterSelect = main.querySelector('[data-background-filter]');
  const selectionLabel = main.querySelector('[data-background-selection]');
  const fallingControls = main.querySelector('[data-falling-controls]');
  const fallingRate = main.querySelector('[data-falling-rate]');
  const fallingRateValue = main.querySelector('[data-falling-rate-value]');
  const fallingSpeed = main.querySelector('[data-falling-speed]');
  const fallingSpeedValue = main.querySelector('[data-falling-speed-value]');
  const fallingBounce = main.querySelector('[data-falling-bounce]');
  const fallingSurfaces = main.querySelector('[data-falling-surfaces]');

  const updateFallingSettings = () => {
    const rate = Number(fallingRate?.value || 1);
    const speed = Number(fallingSpeed?.value || 1);
    const bounce = Boolean(fallingBounce?.checked);
    const surfaces = Boolean(fallingSurfaces?.checked);
    fallingItems.setSettings({
      dropRate: rate,
      dropSpeed: speed,
      bounceOnce: bounce,
      gameSurfaces: surfaces,
    });
    if (fallingRateValue) fallingRateValue.textContent = `${rate.toFixed(2)}×`;
    if (fallingSpeedValue) fallingSpeedValue.textContent = `${speed.toFixed(1)}×`;
  };

  const setFilter = (filter) => {
    choiceButtons.forEach((button) => {
      button.toggleAttribute('hidden', filter !== 'all' && button.dataset.backgroundGroup !== filter);
    });
  };

  const setBackground = (choice) => {
    const selected = getBackgroundPreset(choice);
    const showHome = selected?.mode === 'live';
    const showStatic = selected?.mode === 'combat-static';
    const showAsset = selected?.mode === 'asset' || selected?.mode === 'falling-items';
    const showFallingItems = selected?.mode === 'falling-items';
    sky?.toggleAttribute('hidden', !showHome);
    staticSky.host.toggleAttribute('hidden', !showStatic);
    assetBackground.toggleAttribute('hidden', !showAsset);
    fallingControls?.toggleAttribute('hidden', !showFallingItems);
    if (showFallingItems) fallingItems.show();
    else fallingItems.hide();
    skyController?.setPaused(!showHome);
    if (showStatic && selected?.time != null) {
      staticSky.host.classList.toggle('combat-sky--test-twinkle', selected.twinkle === true);
      applyTime(staticSky.layers, selected.time);
      if (selected.moon && staticSky.layers.moon) {
        staticSky.layers.moon.style.setProperty('--x', `${selected.moon.x}px`);
        staticSky.layers.moon.style.setProperty('--y', `${selected.moon.y}px`);
      }
    }
    if (showAsset) {
      const root = combatSkyRoot();
      assetBackground.style.backgroundImage = `url('${root}assets/theme/backgrounds/${selected.image}')`;
      assetBackground.dataset.fit = selected.fit ?? 'cover';
    }
    choiceButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.backgroundChoice === choice));
    });
    if (selectionLabel && selected) selectionLabel.textContent = selected.label;
  };

  choiceButtons.forEach((button) => {
    button.addEventListener('click', () => setBackground(button.dataset.backgroundChoice));
  });
  fallingRate?.addEventListener('input', updateFallingSettings);
  fallingSpeed?.addEventListener('input', updateFallingSettings);
  fallingBounce?.addEventListener('change', updateFallingSettings);
  fallingSurfaces?.addEventListener('change', updateFallingSettings);
  filterSelect?.addEventListener('change', () => setFilter(filterSelect.value));
  updateFallingSettings();
  setFilter('all');
  setBackground('home');
}

async function boot() {
  if (!(await initNav())) return;

  const main = document.getElementById('main');
  if (!(main instanceof HTMLElement)) return;

  const auth = await resolveAdminAuth();
  if (!auth) {
    mountGate(main, { error: 'Owner admin access required.' });
    return;
  }

  const skyController = initCombatSky();
  const staticSky = createStaticSky();
  const assetBackground = createAssetBackground();
  const fallingItems = createFallingItemsBackground({ root: combatSkyRoot() });
  renderTestSurface(main, skyController, staticSky, assetBackground, fallingItems);
}

void boot();
