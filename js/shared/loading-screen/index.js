/**
 * Reusable loading-screen preset. The admin test page drives it with a fake
 * progress timeline; production pages can call setProgress from real work.
 */
export function createLoadingScreen({
  host,
  root = './',
  title = 'Loading',
  subtitle = 'Preparing your adventure…',
  stages = ['Loading assets', 'Preparing the game', 'Almost ready'],
} = {}) {
  if (!(host instanceof HTMLElement)) return null;

  host.innerHTML = `
    <section class="bpb-loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div class="bpb-loading-screen__panel">
        <img
          class="bpb-loading-screen__logo"
          src="${root}assets/brand/logo-bpb.png"
          width="96"
          height="96"
          alt=""
          draggable="false"
        />
        <p class="bpb-loading-screen__eyebrow">Backpack Battles Builds</p>
        <h1 class="bpb-loading-screen__title">${title}</h1>
        <p class="bpb-loading-screen__subtitle" data-loading-subtitle>${subtitle}</p>
        <div class="bpb-loading-screen__track" aria-hidden="true">
          <span class="bpb-loading-screen__bar" data-loading-bar></span>
        </div>
        <div class="bpb-loading-screen__meta">
          <span data-loading-stage>${stages[0] || 'Loading'}</span>
          <output data-loading-percent>0%</output>
        </div>
        <ol class="bpb-loading-screen__stages" aria-label="Loading progress">
          ${stages.map((stage, index) => `
            <li data-loading-stage-item="${index}" class="${index === 0 ? 'is-active' : ''}">
              <span aria-hidden="true"></span>${stage}
            </li>
          `).join('')}
        </ol>
      </div>
    </section>
  `;

  const screen = host.querySelector('.bpb-loading-screen');
  const bar = host.querySelector('[data-loading-bar]');
  const stage = host.querySelector('[data-loading-stage]');
  const percent = host.querySelector('[data-loading-percent]');
  const subtitleNode = host.querySelector('[data-loading-subtitle]');
  const stageItems = [...host.querySelectorAll('[data-loading-stage-item]')];

  const setProgress = (value, status = '') => {
    const progress = Math.min(100, Math.max(0, Number(value) || 0));
    const stageIndex = Math.min(
      stages.length - 1,
      Math.floor((progress / 100) * Math.max(1, stages.length)),
    );
    if (bar) bar.style.width = `${progress}%`;
    if (percent) percent.value = `${Math.round(progress)}%`;
    if (stage) stage.textContent = stages[stageIndex] || 'Loading';
    if (subtitleNode && status) subtitleNode.textContent = status;
    stageItems.forEach((item, index) => {
      item.classList.toggle('is-complete', index < stageIndex || progress >= 100);
      item.classList.toggle('is-active', index === stageIndex && progress < 100);
    });
    if (screen) screen.setAttribute('aria-busy', String(progress < 100));
  };

  const reset = () => setProgress(0, subtitle);
  const complete = (message = 'Ready to play') => setProgress(100, message);

  const destroy = () => host.replaceChildren();

  return { host, screen, setProgress, reset, complete, destroy };
}
