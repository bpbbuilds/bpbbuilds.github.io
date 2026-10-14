import { FOOTER_PRESETS, initFooter } from '../../shared/footer.js?v=footer-presets-20261013a';
import { resolveAdminAuth } from './api.js';
import { mountGate } from './gate.js';

const PRESET_ORDER = ['regular', 'slim'];

function renderPresetSurface(main) {
  main.innerHTML = `
    <section class="footer-presets-test" aria-label="Footer preset preview">
      <header class="footer-presets-test__intro">
        <p class="footer-presets-test__eyebrow">Admin performance / Shared elements</p>
        <h1 class="footer-presets-test__title">Footer presets</h1>
        <p class="footer-presets-test__hint">
          Switch between the reusable footer compositions without loading the site shell.
        </p>
      </header>

      <div class="footer-presets-test__toolbar" role="group" aria-label="Footer preset controls">
        <span class="footer-presets-test__label">Preset</span>
        <div class="footer-presets-test__controls">
          ${PRESET_ORDER.map((id, index) => `
            <button
              class="footer-presets-test__button${index === 0 ? ' is-active' : ''}"
              type="button"
              data-preset="${id}"
              aria-pressed="${index === 0 ? 'true' : 'false'}"
            >${FOOTER_PRESETS[id].label}</button>
          `).join('')}
        </div>
      </div>

      <section id="footer-preview" class="footer-presets-test__preview" data-preset="regular" aria-label="Selected footer preview"></section>
    </section>
  `;

  const preview = main.querySelector('#footer-preview');
  const mountPreset = (preset) => {
    if (!(preview instanceof HTMLElement)) return;
    preview.dataset.preset = preset;
    initFooter({ selector: preview, preset });
  };
  mountPreset('regular');

  main.querySelectorAll('button[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!(button instanceof HTMLButtonElement)) return;
      const preset = PRESET_ORDER.includes(button.dataset.preset) ? button.dataset.preset : 'regular';
      main.querySelectorAll('button[data-preset]').forEach((control) => {
        const active = control === button;
        control.classList.toggle('is-active', active);
        control.setAttribute('aria-pressed', String(active));
      });
      mountPreset(preset);
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

  renderPresetSurface(main);
}

void boot();
