/**
 * Item.playOutOfStaminaAnimation — Fanfare_sadtoot.ogg
 * Player inventory: −3 dB, pitch 1. Opponent: −4 dB, pitch 1.4.
 * Sound.playSound plays that stream once per frame.
 */

const PLAYER_VOL = 10 ** (-3 / 20);
const FOE_VOL = 10 ** (-4 / 20);

/**
 * @param {string | undefined} assetRoot
 */
export function createStaminaHonk(assetRoot) {
  const root = assetRoot?.endsWith('/') ? assetRoot : `${assetRoot || '../'}`;
  const reduced =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** @type {HTMLAudioElement | null} */
  let audio = null;
  let playedThisTurn = false;
  let muted = false;

  /**
   * @param {boolean} on
   */
  function setMuted(on) {
    muted = on === true;
    if (muted && audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  /**
   * @param {{ actor?: string }} ev
   */
  function play(ev) {
    if (reduced || muted || playedThisTurn) return;
    playedThisTurn = true;
    queueMicrotask(() => {
      playedThisTurn = false;
    });
    const foe = ev?.actor === 'dummy';
    try {
      if (!audio) {
        audio = new Audio(`${root}assets/fx/stamina/Fanfare_sadtoot.ogg`);
      }
      audio.volume = foe ? FOE_VOL : PLAYER_VOL;
      audio.playbackRate = foe ? 1.4 : 1;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    } catch {
      /* autoplay blocked or missing file */
    }
  }

  return { play, setMuted };
}
