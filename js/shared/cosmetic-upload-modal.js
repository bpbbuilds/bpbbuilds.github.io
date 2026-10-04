/**
 * Shared blob cosmetic upload modal — player submit + admin “Upload ours”.
 * One step: fields left, blob preview right. Artist locked to display name.
 */

/** Wardrobe slots (mirror js/pages/u/blob/slots.js — keep in sync). */
const WARDROBE_SLOTS = Object.freeze([
  { id: 'hat', label: 'Hat' },
  { id: 'face', label: 'Face' },
  { id: 'neck', label: 'Neck' },
  { id: 'head', label: 'Full head' },
  { id: 'body', label: 'Body' },
  { id: 'hand', label: 'Hand' },
]);

const TITLE_ID = 'cosmetic-upload-title';

const GRANTS = Object.freeze([
  { id: 'starter', label: 'Starter (everyone)' },
  { id: 'premium', label: 'Premium / Founding' },
  { id: 'founding', label: 'Founding only' },
  { id: 'event', label: 'Event grant' },
]);

const RARITIES = Object.freeze([
  'Common',
  'Rare',
  'Epic',
  'Legendary',
  'Godly',
  'Unique',
]);

/**
 * @typedef {'player' | 'admin'} CosmeticUploadRole
 * @typedef {{
 *   id: string,
 *   name: string,
 *   slot: string,
 *   grant: string,
 *   rarity: string,
 *   artist: string,
 *   description: string,
 *   file: File,
 *   source: CosmeticUploadRole,
 * }} CosmeticUploadPayload
 */

/** @type {ReturnType<typeof createCosmeticUploadModal> | null} */
let singleton = null;

/**
 * @param {string} s
 */
function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} name
 */
export function slugCosmeticId(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

/**
 * @param {string} root
 */
function assetRoot(root) {
  const r = String(root || '../').trim() || '../';
  return r.endsWith('/') ? r : `${r}/`;
}

/**
 * @param {{
 *   role?: CosmeticUploadRole,
 *   displayName?: string,
 *   root?: string,
 *   onSubmit?: (payload: CosmeticUploadPayload) => void | Promise<void>,
 * }} [opts]
 */
export function openCosmeticUploadModal(opts = {}) {
  if (!singleton) singleton = createCosmeticUploadModal();
  singleton.open(opts);
}

/**
 * @returns {{
 *   open: (opts?: {
 *     role?: CosmeticUploadRole,
 *     displayName?: string,
 *     root?: string,
 *     onSubmit?: (payload: CosmeticUploadPayload) => void | Promise<void>,
 *   }) => void,
 *   destroy: () => void,
 * }}
 */
function createCosmeticUploadModal() {
  const root = document.createElement('div');
  root.className = 'cr-modal cosmetic-upload';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', TITLE_ID);
  root.hidden = true;
  document.body.appendChild(root);

  /** @type {HTMLElement | null} */
  let lastFocus = null;
  /** @type {string | null} */
  let objectUrl = null;
  /** @type {CosmeticUploadRole} */
  let role = 'player';
  let displayName = '';
  let siteRoot = '../';
  /** @type {((payload: CosmeticUploadPayload) => void | Promise<void>) | null} */
  let onSubmitCb = null;
  let idOverride = false;

  const slotOptions = WARDROBE_SLOTS.map(
    (s) => `<option value="${escapeAttr(s.id)}">${escapeHtml(s.label)}</option>`,
  ).join('');
  const grantOptions = GRANTS.map(
    (g) => `<option value="${escapeAttr(g.id)}">${escapeHtml(g.label)}</option>`,
  ).join('');
  const rarityOptions = RARITIES.map(
    (r) => `<option value="${escapeAttr(r)}">${escapeHtml(r)}</option>`,
  ).join('');

  /**
   * @param {CosmeticUploadRole} nextRole
   * @param {string} blobSrc
   */
  function paintShell(nextRole, blobSrc) {
    const isAdmin = nextRole === 'admin';
    const title = isAdmin ? 'Upload cosmetic' : 'Submit cosmetic';
    const submitLabel = isAdmin ? 'Save cosmetic' : 'Submit';
    const blurb = isAdmin
      ? 'Official Smojo cosmetic. PNG/WebP aligned to the blob base.'
      : 'Share original blob art for review. Ownership is Starter (everyone).';

    const idBlock = isAdmin
      ? `<div class="cosmetic-upload__field">
          <div class="cosmetic-upload__id-row">
            <label class="cosmetic-upload__label" for="cosmetic-upload-id">Id</label>
            <button type="button" class="cosmetic-upload__id-edit" data-cos-upload-id-edit>
              Edit id
            </button>
          </div>
          <input
            id="cosmetic-upload-id"
            class="cosmetic-upload__input"
            name="id"
            type="text"
            maxlength="48"
            required
            readonly
            autocomplete="off"
            pattern="[a-z0-9_]+"
            title="lowercase letters, numbers, underscores"
            data-cos-upload-id
          />
          <p class="cosmetic-upload__hint" data-cos-upload-id-hint>Auto from name. Use Edit id only if you must override.</p>
        </div>`
      : `<input type="hidden" name="id" value="" data-cos-upload-id />`;

    const grantBlock = isAdmin
      ? `<div class="cosmetic-upload__field">
          <label class="cosmetic-upload__label" for="cosmetic-upload-grant">Ownership</label>
          <select id="cosmetic-upload-grant" class="cosmetic-upload__input" name="grant" required>
            ${grantOptions}
          </select>
        </div>`
      : `<input type="hidden" name="grant" value="starter" />`;

    root.innerHTML = `
      <div class="cosmetic-upload__backdrop" data-cos-upload-close tabindex="-1"></div>
      <div class="cosmetic-upload__panel bpb-panel--rewards" role="document">
        <header class="cosmetic-upload__head">
          <h2 class="cosmetic-upload__title" id="${TITLE_ID}">
            <span class="cosmetic-upload__title-line" aria-hidden="true"></span>
            <span class="cosmetic-upload__title-text">${escapeHtml(title)}</span>
            <span class="cosmetic-upload__title-line" aria-hidden="true"></span>
          </h2>
          <button type="button" class="cosmetic-upload__close" data-cos-upload-close aria-label="Close">×</button>
        </header>
        <form class="cosmetic-upload__form" data-cos-upload-form>
          <p class="cosmetic-upload__hint cosmetic-upload__blurb">${escapeHtml(blurb)}</p>
          <div class="cosmetic-upload__grid">
            <div class="cosmetic-upload__fields">
              <div class="cosmetic-upload__field">
                <label class="cosmetic-upload__label" for="cosmetic-upload-name">Name</label>
                <input
                  id="cosmetic-upload-name"
                  class="cosmetic-upload__input"
                  name="name"
                  type="text"
                  maxlength="64"
                  required
                  autocomplete="off"
                  placeholder="Leaf Crown"
                  data-cos-upload-name
                />
              </div>
              ${idBlock}
              <div class="cosmetic-upload__field">
                <label class="cosmetic-upload__label" for="cosmetic-upload-slot">Slot</label>
                <select id="cosmetic-upload-slot" class="cosmetic-upload__input" name="slot" required>
                  ${slotOptions}
                </select>
              </div>
              ${grantBlock}
              <div class="cosmetic-upload__field">
                <label class="cosmetic-upload__label" for="cosmetic-upload-rarity">Rarity</label>
                <select id="cosmetic-upload-rarity" class="cosmetic-upload__input" name="rarity">
                  ${rarityOptions}
                </select>
              </div>
              <div class="cosmetic-upload__field">
                <span class="cosmetic-upload__label" id="cosmetic-upload-image-label">Art</span>
                <label class="cosmetic-upload__file">
                  <span class="cosmetic-upload__file-name" data-cos-upload-file-name>PNG / WebP</span>
                  <span class="cosmetic-upload__file-meta">Same canvas size and placement as the blob.</span>
                  <input
                    id="cosmetic-upload-image"
                    class="cosmetic-upload__file-input"
                    name="image"
                    type="file"
                    accept="image/png,image/webp"
                    required
                    aria-labelledby="cosmetic-upload-image-label"
                    data-cos-upload-image
                  />
                </label>
              </div>
              <div class="cosmetic-upload__field">
                <label class="cosmetic-upload__label" for="cosmetic-upload-desc">Description</label>
                <textarea
                  id="cosmetic-upload-desc"
                  class="cosmetic-upload__input cosmetic-upload__textarea"
                  name="description"
                  rows="3"
                  maxlength="400"
                  placeholder="Tooltip blurb…"
                ></textarea>
              </div>
            </div>
            <div class="cosmetic-upload__preview">
              <p class="cosmetic-upload__label">Preview</p>
              <div class="cosmetic-upload__preview-stage" data-cos-upload-preview>
                <img class="cosmetic-upload__preview-base" src="${escapeAttr(blobSrc)}" alt="" width="128" height="128" draggable="false" />
                <img class="cosmetic-upload__preview-layer" data-cos-upload-layer hidden alt="" draggable="false" />
              </div>
              <p class="cosmetic-upload__hint" data-cos-upload-preview-hint>Pick an image to stack on the blob.</p>
              <a class="cosmetic-upload__btn cosmetic-upload__btn--quiet cosmetic-upload__download" href="${escapeAttr(blobSrc)}" download="blob-canvas.png">Download canvas</a>
            </div>
          </div>
          <p class="cosmetic-upload__hint cosmetic-upload__status" data-cos-upload-status hidden></p>
          <div class="cosmetic-upload__actions">
            <button type="submit" class="cosmetic-upload__btn">${escapeHtml(submitLabel)}</button>
            <button type="button" class="cosmetic-upload__btn cosmetic-upload__btn--quiet" data-cos-upload-close>Cancel</button>
          </div>
        </form>
      </div>
    `;
  }

  function clearPreview() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    const layer = root.querySelector('[data-cos-upload-layer]');
    const hint = root.querySelector('[data-cos-upload-preview-hint]');
    const fileName = root.querySelector('[data-cos-upload-file-name]');
    if (layer instanceof HTMLImageElement) {
      layer.hidden = true;
      layer.removeAttribute('src');
    }
    if (hint instanceof HTMLElement) {
      hint.textContent = 'Pick an image to stack on the blob.';
    }
    if (fileName instanceof HTMLElement) fileName.textContent = 'PNG / WebP';
  }

  function bindForm() {
    const form = root.querySelector('[data-cos-upload-form]');
    if (!(form instanceof HTMLFormElement)) return;

    const nameInput = form.querySelector('[data-cos-upload-name]');
    const idInput = form.querySelector('[data-cos-upload-id]');
    const imageInput = form.querySelector('[data-cos-upload-image]');
    const idEditBtn = form.querySelector('[data-cos-upload-id-edit]');
    const idHint = form.querySelector('[data-cos-upload-id-hint]');

    const syncIdFromName = () => {
      if (!(nameInput instanceof HTMLInputElement)) return;
      if (!(idInput instanceof HTMLInputElement)) return;
      if (idOverride && !idInput.readOnly) return;
      idInput.value = slugCosmeticId(nameInput.value);
    };

    nameInput?.addEventListener('input', syncIdFromName);

    idEditBtn?.addEventListener('click', () => {
      if (!(idInput instanceof HTMLInputElement)) return;
      idOverride = true;
      idInput.readOnly = false;
      idInput.focus();
      if (idHint instanceof HTMLElement) {
        idHint.textContent = 'Manual id override on. Keep lowercase letters, numbers, underscores.';
      }
      if (idEditBtn instanceof HTMLButtonElement) idEditBtn.hidden = true;
    });

    imageInput?.addEventListener('change', () => {
      const layer = root.querySelector('[data-cos-upload-layer]');
      const hint = root.querySelector('[data-cos-upload-preview-hint]');
      const fileName = root.querySelector('[data-cos-upload-file-name]');
      if (!(imageInput instanceof HTMLInputElement) || !(layer instanceof HTMLImageElement)) {
        return;
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      const file = imageInput.files?.[0];
      if (!file) {
        layer.hidden = true;
        layer.removeAttribute('src');
        if (hint instanceof HTMLElement) {
          hint.textContent = 'Pick an image to stack on the blob.';
        }
        if (fileName instanceof HTMLElement) fileName.textContent = 'PNG / WebP';
        return;
      }
      objectUrl = URL.createObjectURL(file);
      layer.src = objectUrl;
      layer.hidden = false;
      if (hint instanceof HTMLElement) hint.textContent = file.name;
      if (fileName instanceof HTMLElement) fileName.textContent = file.name;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = root.querySelector('[data-cos-upload-status]');
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const id =
        String(data.get('id') || '').trim() || slugCosmeticId(name);
      const slot = String(data.get('slot') || '').trim();
      const grant =
        role === 'admin'
          ? String(data.get('grant') || 'starter').trim() || 'starter'
          : 'starter';
      const file = data.get('image');
      if (!name || !id || !slot || !(file instanceof File) || !file.size) return;

      /** @type {CosmeticUploadPayload} */
      const payload = {
        id,
        name,
        slot,
        grant,
        rarity: String(data.get('rarity') || 'Common').trim() || 'Common',
        artist: displayName || 'Unknown',
        description: String(data.get('description') || '').trim(),
        file,
        source: role,
      };

      try {
        if (onSubmitCb) await onSubmitCb(payload);
        else {
          console.info('[cosmetic-upload]', {
            ...payload,
            file: payload.file.name,
            bytes: payload.file.size,
          });
        }
        if (status instanceof HTMLElement) {
          status.hidden = false;
          status.textContent =
            role === 'admin'
              ? 'Saved to the live catalog as a draft. Publish its catalog row when it is ready.'
              : 'Thanks — saved locally for now. Review / upload pipeline comes later.';
        }
        window.setTimeout(() => close(), 1400);
      } catch (err) {
        console.error(err);
        if (status instanceof HTMLElement) {
          status.hidden = false;
          status.textContent = 'Could not save. Try again.';
        }
      }
    });
  }

  /**
   * @param {{
   *   role?: CosmeticUploadRole,
   *   displayName?: string,
   *   root?: string,
   *   onSubmit?: (payload: CosmeticUploadPayload) => void | Promise<void>,
   * }} [opts]
   */
  function open(opts = {}) {
    role = opts.role === 'admin' ? 'admin' : 'player';
    displayName = String(opts.displayName || '').trim();
    siteRoot = assetRoot(opts.root);
    onSubmitCb = typeof opts.onSubmit === 'function' ? opts.onSubmit : null;
    idOverride = false;

    const blobSrc = `${siteRoot}assets/blob/blob-base.png`;
    paintShell(role, blobSrc);
    bindForm();
    clearPreview();

    const form = root.querySelector('[data-cos-upload-form]');
    if (form instanceof HTMLFormElement) form.reset();

    const idInput = root.querySelector('[data-cos-upload-id]');
    if (idInput instanceof HTMLInputElement) {
      idInput.value = '';
      if (role === 'admin') idInput.readOnly = true;
    }

    const status = root.querySelector('[data-cos-upload-status]');
    if (status instanceof HTMLElement) {
      status.hidden = true;
      status.textContent = '';
    }

    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.hidden = false;
    document.body.classList.add('cr-modal-open');
    const name = root.querySelector('#cosmetic-upload-name');
    if (name instanceof HTMLElement) name.focus();
  }

  function close() {
    if (root.hidden) return;
    clearPreview();
    root.hidden = true;
    document.body.classList.remove('cr-modal-open');
    lastFocus?.focus?.();
    lastFocus = null;
  }

  /** @param {MouseEvent} e */
  function onClick(e) {
    const t = e.target;
    if (t instanceof Element && t.closest('[data-cos-upload-close]')) {
      e.preventDefault();
      close();
    }
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (e.key === 'Escape' && !root.hidden) {
      e.preventDefault();
      close();
    }
  }

  root.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  return {
    open,
    destroy() {
      clearPreview();
      root.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('cr-modal-open');
      root.remove();
      singleton = null;
    },
  };
}
