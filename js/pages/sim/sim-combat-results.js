/**
 * Damage Dealt + Combat Log — both live inside the Open Log book (hidden until opened).
 */

import { mountDamageMeter } from './sim-damage-meter.js';
import { mountCombatLog } from './sim-combat-log.js';
import { mountLogbookShell } from './sim-logbook.js';

/**
 * @param {HTMLElement} host
 * @param {{
 *   run: import('./sim-events.js').SimRun,
 *   itemsById?: Map<string, object> | null,
 *   assetRoot?: string,
 *   onSeek?: (t: number) => void,
 *   onHighlight?: (placementKey: string | null, itemId: string | null) => void,
 *   onPlay?: () => void,
 *   onPause?: () => void,
 *   getPlaying?: () => boolean,
 * }} opts
 */
export function mountSimCombatResults(host, opts) {
  host.innerHTML = `
    <div class="sim-results sim-results--dock">
      <div class="sim-results__open" data-results-open></div>
    </div>
  `;
  const openHost = host.querySelector('[data-results-open]');
  if (!(openHost instanceof HTMLElement)) {
    return { setTime() {}, setPlaying() {}, destroy() {} };
  }

  /** @type {{ setTime: Function, setFocus: Function, destroy: Function } | null} */
  let meter = null;
  /** @type {{ setTime: Function, setFocus: Function, destroy: Function } | null} */
  let themMeter = null;
  /** @type {{ setTime: Function, setPlaying?: Function, destroy: Function } | null} */
  let log = null;

  /**
   * @param {string | null} placementKey
   * @param {string | null} [itemId]
   */
  function highlight(placementKey, itemId) {
    opts.onHighlight?.(placementKey, itemId ?? null);
    const key = placementKey || itemId || null;
    meter?.setFocus(key);
    themMeter?.setFocus(key);
  }

  const logbook = mountLogbookShell(openHost, {
    assetRoot: opts.assetRoot,
    mountContents(body) {
      body.innerHTML = `
        <div class="sim-results sim-results--logbook">
          <div class="sim-results__dmg" data-results-dmg></div>
          <div class="sim-results__log" data-results-log></div>
          <div class="sim-results__dmg sim-results__dmg--them" data-results-dmg-them></div>
        </div>
      `;
      const dmgHost = body.querySelector('[data-results-dmg]');
      const dmgThemHost = body.querySelector('[data-results-dmg-them]');
      const logHost = body.querySelector('[data-results-log]');
      if (
        !(dmgHost instanceof HTMLElement) ||
        !(dmgThemHost instanceof HTMLElement) ||
        !(logHost instanceof HTMLElement)
      ) {
        return {
          setTime() {},
          setPlaying() {},
          destroy() {
            body.replaceChildren();
          },
        };
      }

      meter = mountDamageMeter(dmgHost, {
        run: opts.run,
        itemsById: opts.itemsById,
        assetRoot: opts.assetRoot,
        onSeek: opts.onSeek,
        onHighlight: highlight,
        side: 'player',
        panelLabel: 'You',
      });
      themMeter = mountDamageMeter(dmgThemHost, {
        run: opts.run,
        itemsById: opts.itemsById,
        assetRoot: opts.assetRoot,
        onSeek: opts.onSeek,
        onHighlight: highlight,
        side: 'dummy',
        panelLabel: 'Opponent',
      });
      log = mountCombatLog(logHost, {
        run: opts.run,
        itemsById: opts.itemsById,
        assetRoot: opts.assetRoot,
        onSeek: opts.onSeek,
        onHighlight: highlight,
        onPlay: opts.onPlay,
        onPause: opts.onPause,
        getPlaying: opts.getPlaying,
      });

      return {
        setTime(t) {
          return log?.setTime(t);
        },
        setPlaying(playing) {
          log?.setPlaying?.(playing);
        },
        /**
         * @param {number} t
         * @param {{ bars?: boolean }} [barOpts]
         */
        setMeters(t, barOpts) {
          meter?.setTime(t, barOpts);
          themMeter?.setTime(t, barOpts);
        },
        destroy() {
          meter?.destroy();
          themMeter?.destroy();
          log?.destroy();
          meter = null;
          themMeter = null;
          log = null;
          body.replaceChildren();
        },
      };
    },
  });

  return {
    setTime(t) {
      const lineChanged = logbook.setTime(t);
      const playing = opts.getPlaying?.() ?? false;
      const barOpts = { bars: !playing || lineChanged };
      logbook.setMeters?.(t, barOpts);
    },
    setPlaying(playing) {
      logbook.setPlaying?.(playing);
    },
    destroy() {
      logbook.destroy();
      host.replaceChildren();
    },
  };
}
