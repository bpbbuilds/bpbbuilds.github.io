/**
 * Grouping-style custom dropdown for History filters.
 */

/**
 * @param {string} s
 * @returns {string}
 */
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{
 *   root: string,
 *   label: string,
 *   ariaLabel: string,
 *   options: { value: string, label: string }[],
 *   value: string,
 *   disabled?: boolean,
 *   onChange: (value: string) => void,
 * }} opts
 * @returns {{ el: HTMLElement, setValue: (v: string) => void, destroy: () => void }}
 */
export function mountFilterDropdown(opts) {
  const base = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  const arrowSrc = `${base}assets/icons/filters/DropdownArrow.png`;
  const el = document.createElement('div');
  el.className = `create-history__dd${opts.disabled ? ' is-disabled' : ''}`;
  el.dataset.filterDd = '';

  function currentLabel() {
    return (
      opts.options.find((o) => o.value === opts.value)?.label ||
      opts.options[0]?.label ||
      opts.label
    );
  }

  function paint() {
    const open = !menu.hidden;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    labelEl.textContent = currentLabel();
    menu.querySelectorAll('[data-dd-value]').forEach((btn) => {
      const v = btn.getAttribute('data-dd-value') || '';
      const on = v === opts.value;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  el.innerHTML = `
    <button
      type="button"
      class="create-history__dd-trigger"
      data-dd-trigger
      aria-haspopup="listbox"
      aria-expanded="false"
      aria-label="${escapeAttr(opts.ariaLabel)}"
      ${opts.disabled ? 'disabled' : ''}
    >
      <img class="create-history__dd-arrow" src="${escapeAttr(arrowSrc)}" alt="" width="16" height="16" draggable="false" />
      <span class="create-history__dd-sticker" data-dd-label>${escapeAttr(currentLabel())}</span>
    </button>
    <div class="create-history__dd-menu" data-dd-menu hidden role="listbox" aria-label="${escapeAttr(opts.ariaLabel)}">
      ${opts.options
        .map(
          (o) => `<button
            type="button"
            class="create-history__dd-option${o.value === opts.value ? ' is-active' : ''}"
            role="option"
            data-dd-value="${escapeAttr(o.value)}"
            aria-selected="${o.value === opts.value ? 'true' : 'false'}"
          >${escapeAttr(o.label)}</button>`,
        )
        .join('')}
    </div>
  `;

  const trigger = /** @type {HTMLButtonElement} */ (
    el.querySelector('[data-dd-trigger]')
  );
  const menu = /** @type {HTMLElement} */ (el.querySelector('[data-dd-menu]'));
  const labelEl = /** @type {HTMLElement} */ (el.querySelector('[data-dd-label]'));

  function close() {
    menu.hidden = true;
    paint();
  }

  function open() {
    if (opts.disabled) return;
    document
      .querySelectorAll('.create-history__dd-menu:not([hidden])')
      .forEach((m) => {
        if (m !== menu) {
          m.setAttribute('hidden', '');
          m.closest('.create-history__dd')
            ?.querySelector('[data-dd-trigger]')
            ?.setAttribute('aria-expanded', 'false');
        }
      });
    menu.hidden = false;
    paint();
  }

  /** @param {MouseEvent} e */
  function onTriggerClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (menu.hidden) open();
    else close();
  }

  /** @param {MouseEvent} e */
  function onMenuClick(e) {
    const t = e.target instanceof Element ? e.target : null;
    const opt = t?.closest?.('[data-dd-value]');
    if (!(opt instanceof HTMLElement)) return;
    e.preventDefault();
    const v = opt.getAttribute('data-dd-value') || '';
    opts.value = v;
    opts.onChange(v);
    close();
  }

  /** @param {MouseEvent} e */
  function onDocClick(e) {
    if (menu.hidden) return;
    const t = e.target;
    if (t instanceof Node && el.contains(t)) return;
    close();
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (e.key === 'Escape' && !menu.hidden) {
      e.preventDefault();
      e.stopPropagation();
      close();
      trigger.focus();
    }
  }

  trigger.addEventListener('click', onTriggerClick);
  menu.addEventListener('click', onMenuClick);
  document.addEventListener('click', onDocClick);
  el.addEventListener('keydown', onKey);

  return {
    el,
    setValue(v) {
      opts.value = v;
      paint();
    },
    destroy() {
      trigger.removeEventListener('click', onTriggerClick);
      menu.removeEventListener('click', onMenuClick);
      document.removeEventListener('click', onDocClick);
      el.removeEventListener('keydown', onKey);
      el.remove();
    },
  };
}
