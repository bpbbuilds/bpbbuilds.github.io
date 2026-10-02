/**
 * Damage-meter plot, one per sub-metric section (game DamageMeterPlot.tscn).
 *
 * Game geometry: Control 394×240, CoordinateSystem sprite 390×197 centred at
 * (195,111), data rect (8,18)-(387,203), Max label at (17,1), Time1 at (2,198),
 * Time2 right-aligned at 387. Lines + point symbols come from the plot palette.
 */

const W = 394;
const H = 240;
const X0 = 8;
const X1 = 387;
const Y0 = 18;
const Y1 = 203;

/** Game DamageMeter stepify(..., 0.1). */
function qty(n) {
  const x = Math.round((Number(n) || 0) * 10) / 10;
  return Number.isFinite(x) ? x.toFixed(1) : '0.0';
}

let plotSeq = 0;

/**
 * @param {{
 *   rows: { key: string, points: { t: number, cum: number }[], color: string, symbol: string, off: boolean }[],
 *   duration: number,
 *   t: number,
 *   cutoff: number,
 *   assetRoot: string,
 *   toPlotT: (engineT: number) => number,
 * }} opts
 */
export function sectionPlotHtml(opts) {
  const root = opts.assetRoot.endsWith('/') ? opts.assetRoot : `${opts.assetRoot}/`;
  const grid = `${root}assets/icons/sim/log/plot/CoordinateSystem.png`;
  const duration = Math.max(0.1, Number(opts.duration) || 1);
  const live = opts.rows.filter((r) => !r.off && r.points.length);
  const maxY = Math.max(
    1,
    ...live.map((r) => r.points[r.points.length - 1]?.cum || 0),
  );
  const xOf = (tt) => X0 + (Math.min(duration, Math.max(0, tt)) / duration) * (X1 - X0);
  const yOf = (c) => Y1 - (Math.min(1, c / maxY)) * (Y1 - Y0);

  const uid = `plot${(plotSeq += 1)}`;
  // Point symbols are white art; the game modulates them with the line color
  const tints = live
    .map(
      (r, i) =>
        `<filter id="${uid}-t${i}" x="0" y="0" width="100%" height="100%"><feFlood flood-color="${r.color}" result="c" /><feComposite in="c" in2="SourceGraphic" operator="in" /></filter>`,
    )
    .join('');

  const lines = live
    .map((r, i) => {
      const pts = [{ t: 0, cum: 0 }, ...r.points.filter((p) => p.t <= opts.cutoff + 1e-9)];
      const path = pts
        .map((p) => `${xOf(opts.toPlotT(p.t)).toFixed(1)},${yOf(p.cum).toFixed(1)}`)
        .join(' ');
      const marks = pts
        .slice(1)
        .map((p) => {
          const x = xOf(opts.toPlotT(p.t));
          const y = yOf(p.cum);
          return `<image class="sim-dmg__psym" href="${root}assets/icons/sim/log/plot/${r.symbol}" x="${(x - 7).toFixed(1)}" y="${(y - 7).toFixed(1)}" width="14" height="14" data-t="${p.t}" />`;
        })
        .join('');
      return `<g><polyline class="sim-dmg__pline" points="${path}" stroke="${r.color}" /><g class="sim-dmg__pmarks" filter="url(#${uid}-t${i})">${marks}</g></g>`;
    })
    .join('');

  const cursorX = xOf(opts.t).toFixed(1);
  return `<li class="sim-dmg__plotrow">
    <svg class="sim-dmg__plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative metric over time">
      <defs>${tints}</defs>
      <image href="${grid}" x="0" y="12.5" width="390" height="197" />
      ${lines}
      <line class="sim-dmg__vbar" x1="${cursorX}" y1="${Y0}" x2="${cursorX}" y2="${Y1}" />
      <text class="sim-dmg__plab" x="17" y="27">${qty(maxY)}</text>
      <text class="sim-dmg__plab" x="2" y="224">0.0s</text>
      <text class="sim-dmg__plab sim-dmg__plab--end" x="387" y="225">${qty(duration)}s</text>
    </svg>
  </li>`;
}
