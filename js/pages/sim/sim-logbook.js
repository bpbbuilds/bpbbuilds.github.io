/**
 * Game-style Open Log button + floating / draggable combat report
 * (Damage Dealt meters + Combat Log).
 * Art: Interface/CombatLog/CombatLogButton.png (assets/icons/sim/).
 */

const POS_KEY = 'bpb-sim-logbook-pos';

/**
 * @param {HTMLElement} btnHost
 * @param {{
 *   assetRoot?: string,
 *   mountContents: (body: HTMLElement) => {
 *     setTime: (t: number) => boolean | void,
 *     setPlaying?: (playing: boolean) => void,
 *     setMeters?: (t: number, barOpts?: { bars?: boolean }) => void,
 *     destroy: () => void,
 *   },
 * }} opts
 */
export function mountLogbookShell(btnHost, opts) {
  const root = opts.assetRoot || '../';
  const icon = `${root}assets/icons/sim/CombatLogButton.png`;
  const iconHover = `${root}assets/icons/sim/CombatLogButton_hovered.png`;

  btnHost.innerHTML = `
    <button
      type="button"
      class="sim-logbook-btn"
      data-logbook-toggle
      aria-expanded="false"
      aria-controls="sim-logbook-panel"
      title="Open Log"
    >
      <img
        class="sim-logbook-btn__art"
        src="${icon}"
        alt=""
        width="120"
        height="136"
        draggable="false"
        data-art-normal="${icon}"
        data-art-hover="${iconHover}"
      />
      <span class="sim-logbook-btn__label">Open<br />Log</span>
    </button>
  `;

  const toggleBtn = btnHost.querySelector('[data-logbook-toggle]');
  const artEl = btnHost.querySelector('.sim-logbook-btn__art');

  const panel = document.createElement('div');
  panel.id = 'sim-logbook-panel';
  panel.className = 'sim-logbook';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Combat report');
  panel.innerHTML = `
    <div class="sim-logbook__frame" data-logbook-frame>
      <header class="sim-logbook__chrome sim-logbook__drag" data-logbook-drag title="Drag to move">
        <span class="sim-logbook__chrome-title">Combat report</span>
        <span class="sim-logbook__chrome-hint">Drag</span>
        <button type="button" class="sim-logbook__close" data-logbook-close aria-label="Close combat report">×</button>
      </header>
      <div class="sim-logbook__body" data-logbook-body></div>
    </div>
  `;
  document.body.appendChild(panel);

  const frame = panel.querySelector('[data-logbook-frame]');
  const body = panel.querySelector('[data-logbook-body]');
  const closeBtn = panel.querySelector('[data-logbook-close]');
  const handle = panel.querySelector('[data-logbook-drag]');
  if (!(body instanceof HTMLElement) || !(frame instanceof HTMLElement)) {
    return { setTime() {}, setPlaying() {}, setMeters() {}, destroy() {} };
  }

  const contents = opts.mountContents(body);

  /** @type {{ x: number, y: number } | null} */
  let pos = readPos();
  let open = false;
  /** @type {{ ptr: number, ox: number, oy: number } | null} */
  let drag = null;

  function applyPos() {
    if (!pos) {
      frame.style.left = '';
      frame.style.top = '';
      frame.style.transform = '';
      return;
    }
    frame.style.left = `${pos.x}px`;
    frame.style.top = `${pos.y}px`;
    frame.style.transform = 'none';
  }

  function clampPos(x, y) {
    const pad = 8;
    const w = frame.offsetWidth || 720;
    const h = frame.offsetHeight || 420;
    const maxX = Math.max(pad, window.innerWidth - w - pad);
    const maxY = Math.max(pad, window.innerHeight - h - pad);
    return {
      x: Math.min(maxX, Math.max(pad, x)),
      y: Math.min(maxY, Math.max(pad, y)),
    };
  }

  function setOpen(next) {
    open = next;
    panel.hidden = !open;
    if (toggleBtn instanceof HTMLElement) {
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggleBtn.classList.toggle('is-open', open);
    }
    if (open) {
      void frame.offsetWidth;
      if (!pos) {
        const rect = frame.getBoundingClientRect();
        pos = clampPos(
          (window.innerWidth - rect.width) / 2,
          Math.max(48, (window.innerHeight - rect.height) / 4),
        );
      } else {
        pos = clampPos(pos.x, pos.y);
      }
      applyPos();
      savePos(pos);
    }
  }

  toggleBtn?.addEventListener('click', () => setOpen(!open));
  closeBtn?.addEventListener('click', () => setOpen(false));

  if (artEl instanceof HTMLImageElement && toggleBtn) {
    toggleBtn.addEventListener('pointerenter', () => {
      artEl.src = artEl.dataset.artHover || iconHover;
    });
    toggleBtn.addEventListener('pointerleave', () => {
      artEl.src = artEl.dataset.artNormal || icon;
    });
  }

  function onPointerDown(e) {
    if (!(e instanceof PointerEvent) || e.button !== 0) return;
    const t = e.target;
    if (t instanceof Element && t.closest('button, input, a, label')) return;
    if (!(handle instanceof HTMLElement)) return;
    const rect = frame.getBoundingClientRect();
    pos = { x: rect.left, y: rect.top };
    applyPos();
    drag = {
      ptr: e.pointerId,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
    };
    handle.setPointerCapture?.(e.pointerId);
    frame.classList.add('is-dragging');
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.ptr) return;
    pos = clampPos(e.clientX - drag.ox, e.clientY - drag.oy);
    applyPos();
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.ptr) return;
    drag = null;
    frame.classList.remove('is-dragging');
    if (pos) savePos(pos);
  }

  handle?.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  function onKey(e) {
    if (e.key === 'Escape' && open) setOpen(false);
  }
  window.addEventListener('keydown', onKey);

  function onResize() {
    if (!open || !pos) return;
    pos = clampPos(pos.x, pos.y);
    applyPos();
  }
  window.addEventListener('resize', onResize);

  return {
    setTime(t) {
      return contents.setTime(t);
    },
    setPlaying(playing) {
      contents.setPlaying?.(playing);
    },
    setMeters(t, barOpts) {
      contents.setMeters?.(t, barOpts);
    },
    destroy() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      contents.destroy();
      panel.remove();
      btnHost.replaceChildren();
    },
  };
}

/** @returns {{ x: number, y: number } | null} */
function readPos() {
  try {
    const raw = sessionStorage.getItem(POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y)
    ) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** @param {{ x: number, y: number }} p */
function savePos(p) {
  try {
    sessionStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
