import { initHomeClassShowcase } from '../home/home-class-showcase.js?v=ranger-hq-20261014a';
import { resolveAdminAuth } from './api.js?v=admin-csp-20261013a';
import { mountGate } from './gate.js';

const STYLE_PRESETS = [
  { id: 'home', label: 'Home skin' },
  { id: 'compact', label: 'Compact rail' },
  { id: 'wireframe', label: 'Wireframe' },
  { id: 'ranger-idle', label: 'Ranger game idle' },
];

function renderTestSurface(main) {
  main.innerHTML = `
    <section class="home-class-showcase-test" aria-label="Choose your hero section preview">
      <header class="home-class-showcase-test__intro">
        <p class="home-class-showcase-test__eyebrow">Admin test / Home sections</p>
        <h1 class="home-class-showcase-test__title">Choose your hero</h1>
        <p class="home-class-showcase-test__hint">
          Preview the live class rail in isolation. Hover a hero to inspect its expanded copy and starting bags. Ranger game idle uses the extracted character animation.
        </p>
      </header>

      <div class="home-class-showcase-test__toolbar" role="toolbar" aria-label="Choose your hero preview controls">
        <span class="home-class-showcase-test__control-label">Preview style</span>
        <div class="home-class-showcase-test__controls">
          ${STYLE_PRESETS.map((preset, index) => `
            <button
              class="home-class-showcase-test__tab${index === 0 ? ' is-active' : ''}"
              type="button"
              data-style="${preset.id}"
              aria-pressed="${index === 0 ? 'true' : 'false'}"
            >${preset.label}</button>
          `).join('')}
        </div>
      </div>

      <section id="home-class-showcase" data-hero-preview data-style="home" aria-label="Choose your hero section"></section>

      <p class="home-class-showcase-test__note">
        This preview uses the same hero cards, starting-bag data, links, and tooltip behavior as the Home page.
      </p>
      <div class="home-class-showcase-test__scroll-space" aria-hidden="true"></div>
    </section>
  `;

  const preview = main.querySelector('[data-hero-preview]');
  const host = main.querySelector('#home-class-showcase');
  const showcase = host instanceof HTMLElement ? initHomeClassShowcase(host) : null;

  main.querySelectorAll('button[data-style]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!(button instanceof HTMLButtonElement)) return;
      const style = STYLE_PRESETS.some((preset) => preset.id === button.dataset.style)
        ? button.dataset.style
        : 'home';
      if (preview instanceof HTMLElement) preview.dataset.style = style;
      if (style === 'ranger-idle' && preview instanceof HTMLElement) {
        const rail = preview.querySelector('[data-home-mobs-rail]');
        if (rail instanceof HTMLElement) {
          rail.scrollLeft = Math.max(0, (rail.scrollWidth - rail.clientWidth) / 2);
        }
      }
      showcase?.setRangerAnimation(style === 'ranger-idle');
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
