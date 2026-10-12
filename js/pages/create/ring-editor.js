import {
  RING_STACKS,
  RING_TRIGGERS,
  encodeRingEffects,
  normalizeRingEffects,
  ringEffectCount,
  ringStackLabel,
  ringTriggerLabel,
} from '../../shared/ring-config.js';

const RING_IDS = new Set(['magic_ring', 'superior_ring']);

function optionHtml(options, selected, label) {
  return options
    .map((option) => {
      const value = typeof option === 'object' ? option.value : option;
      const text = typeof option === 'object' ? option.label : label(option);
      return `<option value="${value}"${String(value) === String(selected) ? ' selected' : ''}>${text}</option>`;
    })
    .join('');
}

/**
 * @param {{ root: HTMLElement, state: object, itemsById?: Map<string, object> }} opts
 */
export function mountRingEditor({ root, state, itemsById }) {
  if (!(root instanceof HTMLElement)) return { destroy() {} };
  let active = null;

  function close() {
    active?.button?.setAttribute('aria-expanded', 'false');
    active?.panel?.remove();
    active = null;
  }

  function onPanelClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('[data-ring-close]')) close();
    else if (target.closest('[data-ring-save]')) void save();
  }

  function placePanel(panel, button) {
    const rect = button.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = rect.bottom + 8;
    const height = panel.offsetHeight || 280;
    const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, rect.top - height - 8);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function open(button) {
    close();
    if (state.isHistoryLocked?.()) return;
    const item = button.closest('.bpb-bg__item');
    const key = item?.dataset?.placementKey;
    const id = item?.dataset?.itemId;
    if (!key || !RING_IDS.has(id)) return;
    const placement = state.getDraft().placements.find((p) => String(p.key) === String(key));
    if (!placement) return;
    const count = ringEffectCount(id);
    const persistent = placement.instance?.persistent;
    const effects = normalizeRingEffects(persistent?.effects, count);
    const panel = document.createElement('section');
    panel.className = 'bpb-ring-editor';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', `Configure ${id === 'magic_ring' ? 'Magic Ring' : 'Superior Ring'}`);
    panel.innerHTML = `
      <div class="bpb-ring-editor__head">
        <h2>${id === 'magic_ring' ? 'Magic Ring' : 'Superior Ring'}</h2>
        <button type="button" class="bpb-ring-editor__close" data-ring-close aria-label="Close ring settings">×</button>
      </div>
      <p class="bpb-ring-editor__hint">Choose the trigger and stack for each effect.</p>
      <div class="bpb-ring-editor__rows">
        ${effects
          .map(
            (effect, index) => `
              <label class="bpb-ring-editor__row">
                <span class="bpb-ring-editor__row-label">Effect ${index + 1}</span>
                <select data-ring-trigger aria-label="Effect ${index + 1} trigger">${optionHtml(RING_TRIGGERS, effect.trigger)}</select>
                <select data-ring-stack aria-label="Effect ${index + 1} stack">${optionHtml(RING_STACKS, effect.stack, ringStackLabel)}</select>
                <span class="bpb-ring-editor__amount" data-ring-amount></span>
              </label>`,
          )
          .join('')}
      </div>
      <div class="bpb-ring-editor__actions">
        <button type="button" class="bpb-ring-editor__cancel" data-ring-close>Cancel</button>
        <button type="button" class="bpb-ring-editor__save" data-ring-save>Save</button>
      </div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', onPanelClick);
    panel.addEventListener('change', syncAmounts);
    active = { button, panel, key, id };
    button.setAttribute('aria-expanded', 'true');
    placePanel(panel, button);
    panel.querySelector('select')?.focus();
    syncAmounts();
  }

  function syncAmounts() {
    if (!active) return;
    const params = itemsById?.get(active.id)?.params && typeof itemsById.get(active.id).params === 'object'
      ? itemsById.get(active.id).params
      : {};
    active.panel.querySelectorAll('.bpb-ring-editor__row').forEach((row) => {
      const trigger = Math.max(0, Math.min(3, Number(row.querySelector('[data-ring-trigger]')?.value) || 0));
      const stack = String(row.querySelector('[data-ring-stack]')?.value || 'lucky');
      const scale = Number(params[`scale${trigger + 1}`]) || [1, 0.75, 1.5, 1.5][trigger];
      const amount = Math.round(Number(params[stack] || 0) * scale);
      const out = row.querySelector('[data-ring-amount]');
      if (out) out.textContent = `${ringTriggerLabel(trigger)} · ${amount} ${ringStackLabel(stack)}`;
    });
  }

  async function save() {
    if (!active) return;
    const effects = [...active.panel.querySelectorAll('.bpb-ring-editor__row')].map((row) => ({
      trigger: Number(row.querySelector('[data-ring-trigger]')?.value),
      stack: row.querySelector('[data-ring-stack]')?.value,
    }));
    const normalized = normalizeRingEffects(effects, ringEffectCount(active.id));
    if (state.isHistoryLocked?.() && !(await state.requestHistoryUnlock?.())) return;
    const placement = state.getDraft().placements.find((p) => String(p.key) === String(active.key));
    if (!placement) return close();
    const instance = placement.instance && typeof placement.instance === 'object' ? placement.instance : {};
    const previous = instance.persistent && typeof instance.persistent === 'object' ? instance.persistent : {};
    state.updatePlacement(active.key, {
      instance: {
        ...instance,
        persistent: { ...previous, magicRing: encodeRingEffects(normalized), effects: normalized },
      },
    });
    close();
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('[data-ring-config]');
    if (button instanceof HTMLElement && root.contains(button)) {
      event.preventDefault();
      event.stopPropagation();
      if (active?.button === button) close();
      else open(button);
      return;
    }
    if (active?.panel && target && active.panel.contains(target)) return;
  }

  function onPointerDown(event) {
    if (!active?.panel) return;
    const target = event.target instanceof Node ? event.target : null;
    if (target && !active.panel.contains(target) && target !== active.button) close();
  }

  function onKey(event) {
    if (event.key === 'Escape' && active) {
      event.preventDefault();
      close();
    }
  }

  root.addEventListener('click', onClick);
  document.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('keydown', onKey);
  return {
    destroy() {
      close();
      root.removeEventListener('click', onClick);
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey);
    },
  };
}
