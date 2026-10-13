import { initHomePromoBand } from '../home/home-promo-band.js?v=promo-creator-20261011m';
import { resolveAdminAuth } from './api.js';
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

      <div class="build-creator-animation-test__tabs" role="tablist" aria-label="Animation launcher preset">
        <button class="build-creator-animation-test__tab is-active" type="button" role="tab" aria-selected="true" data-launcher="catalog">Catalog</button>
        <button class="build-creator-animation-test__tab" type="button" role="tab" aria-selected="false" data-launcher="chest">Chest preset</button>
        <button class="build-creator-animation-test__tab" type="button" role="tab" aria-selected="false" data-launcher="creator">Creator wave</button>
      </div>

      <section id="build-creator-animation" aria-label="Create a build animation">
        <div id="home-promo-band"></div>
      </section>

      <div class="build-creator-animation-test__scroll-space" aria-hidden="true"></div>
    </section>
  `;

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
      const launcher = ['chest', 'creator'].includes(tab.dataset.launcher) ? tab.dataset.launcher : 'catalog';
      main.querySelectorAll('[data-launcher]').forEach((button) => {
        const active = button === tab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
      mountLauncher(launcher);
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
