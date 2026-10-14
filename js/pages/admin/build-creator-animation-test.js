import { initHomePromoBand } from '../home/home-promo-band.js?v=promo-player-20261013a';
import { resolveAdminAuth } from './api.js?v=admin-csp-20261013a';
import { mountGate } from './gate.js';

function renderTestSurface(main) {
  main.innerHTML = `
    <section class="build-creator-animation-test" aria-label="Build creator animation preview">
      <header class="build-creator-animation-test__intro">
        <p class="build-creator-animation-test__eyebrow">Admin test / Home sections</p>
        <h1 class="build-creator-animation-test__title">Build creator animation</h1>
        <p class="build-creator-animation-test__hint">
          Each preset uses a real public player build, including its actual board placement.
        </p>
      </header>

      <div class="build-creator-animation-test__toolbar" aria-label="Animation preview controls">
        <div class="build-creator-animation-test__control-group" role="tablist" aria-label="Animation launcher preset">
          <span class="build-creator-animation-test__control-label">Animation source</span>
          <div class="build-creator-animation-test__controls">
            <button class="build-creator-animation-test__tab is-active" type="button" role="tab" aria-selected="true" data-launcher="catalog">Catalog</button>
            <button class="build-creator-animation-test__tab" type="button" role="tab" aria-selected="false" data-launcher="chest">Chest preset</button>
            <button class="build-creator-animation-test__tab" type="button" role="tab" aria-selected="false" data-launcher="creator">Creator wave</button>
            <button class="build-creator-animation-test__tab" type="button" role="tab" aria-selected="false" data-launcher="player">Player info</button>
          </div>
        </div>
        <div class="build-creator-animation-test__control-group" aria-label="Preview style">
          <span class="build-creator-animation-test__control-label">Preview style</span>
          <div class="build-creator-animation-test__controls">
            <button class="build-creator-animation-test__tab is-active" type="button" aria-pressed="true" data-style="home">Home skin</button>
            <button class="build-creator-animation-test__tab" type="button" aria-pressed="false" data-style="performance">Performance</button>
            <button class="build-creator-animation-test__tab" type="button" aria-pressed="false" data-style="wireframe">Wireframe</button>
          </div>
        </div>
      </div>

      <section id="build-creator-animation" data-animation-preview data-style="home" aria-label="Create a build animation">
        <div id="home-promo-band"></div>
      </section>

      <div class="build-creator-animation-test__scroll-space" aria-hidden="true"></div>
    </section>
  `;

  const preview = main.querySelector('[data-animation-preview]');
  const mountLauncher = (launcher) => {
    initHomePromoBand('#home-promo-band', {
      variant: 'create',
      launcher,
    });
  };
  mountLauncher('catalog');

  main.querySelectorAll('[data-launcher]').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (!(tab instanceof HTMLButtonElement)) return;
      const playerInfo = tab.dataset.launcher === 'player';
      const launcher = playerInfo || ['chest', 'creator'].includes(tab.dataset.launcher)
        ? tab.dataset.launcher
        : 'catalog';
      main.querySelectorAll('[data-launcher]').forEach((button) => {
        const active = button === tab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
      mountLauncher(launcher);
    });
  });

  main.querySelectorAll('button[data-style]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!(button instanceof HTMLButtonElement)) return;
      const style = ['performance', 'wireframe'].includes(button.dataset.style) ? button.dataset.style : 'home';
      if (preview instanceof HTMLElement) preview.dataset.style = style;
      main.querySelectorAll('button[data-style]').forEach((control) => {
        const active = control === button;
        control.classList.toggle('is-active', active);
        control.setAttribute('aria-pressed', String(active));
      });
    });
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

  renderTestSurface(main);
}

void boot();
