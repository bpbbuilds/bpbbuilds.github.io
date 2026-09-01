/**
 * Port of Game.getLeague_exact / calcRunRating for History rankingDif.
 * Thresholds match current Game.gd (not history-decode.js display map).
 */

export const MAX_WINS = 10;
export const MAX_ROUNDS = 18;
export const MAX_TRIES = 5;

const RATING_DECAY = 0.96;
const RATING_VELO = 0.63;
const MAX_WINS_RATING = 5;
const PERFECT_RUN_RATING = 7.5;
const SURVIVED_RATING = 7;
const PERFECT_SURVIVAL_RATING = 12;
const RANK_UP_BONUS_RANKING = 10;
const LEAGUE_MASTER = 5;
const LEAGUE_GRANDMA = 7;

/** Game.leagueThresholds + soft ceiling for top bracket math */
export const GAME_LEAGUE_THRESHOLDS = [
  0, 50, 120, 200, 300, 400, 480, 550, 850, 10_000,
];

export const GAME_LEAGUE_NAMES = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'master',
  'grandmaster',
  'grandma',
];

/**
 * @param {number} rating
 * @returns {number}
 */
export function getLeagueExact(rating) {
  const r = Math.max(0, Number(rating) || 0);
  let league = -1;
  for (const threshold of GAME_LEAGUE_THRESHOLDS) {
    if (r >= threshold) league += 1;
    else break;
  }
  league = Math.max(0, Math.min(league, GAME_LEAGUE_THRESHOLDS.length - 2));
  const leftBorder = GAME_LEAGUE_THRESHOLDS[league];
  const rightBorder = GAME_LEAGUE_THRESHOLDS[league + 1];
  const bracketSize = rightBorder - leftBorder;
  if (bracketSize <= 0) return league;
  const interpolationPoint = (r - leftBorder) / bracketSize;
  return league + interpolationPoint;
}

/**
 * @param {number} leagueExact
 * @returns {number}
 */
export function getRatingFromLeague(leagueExact) {
  const league = Math.floor(leagueExact);
  const subrank = leagueExact - league;
  const leftBorder = GAME_LEAGUE_THRESHOLDS[league] ?? 0;
  const rightBorder =
    GAME_LEAGUE_THRESHOLDS[league + 1] ?? leftBorder + 1;
  const bracketSize = rightBorder - leftBorder;
  return subrank * bracketSize + leftBorder;
}

/**
 * @param {number} rating
 * @param {number} leagueExact2
 * @returns {number}
 */
function getRatingDifferenceForBonus(rating, leagueExact2) {
  return getRatingFromLeague(leagueExact2) - rating;
}

/**
 * @param {number} curRating
 * @param {number} numWins
 * @param {number} numLosses
 * @param {number} triesLeft
 * @param {boolean} survival
 * @param {boolean} perfectRunBeforeSurvival
 * @returns {number}
 */
export function calcRunRating(
  curRating,
  numWins,
  numLosses,
  triesLeft,
  survival,
  perfectRunBeforeSurvival,
) {
  const oldLeagueExact = getLeagueExact(curRating);
  let rating = 2 * numWins;

  if (triesLeft > 0) rating -= 0.5 * numLosses;
  else rating -= 1.0 * numLosses;

  if (survival) {
    let survivalBonus = 0;
    if (perfectRunBeforeSurvival) survivalBonus += PERFECT_RUN_RATING * 0.5;
    if (numLosses === 0) survivalBonus += PERFECT_SURVIVAL_RATING;
    else if (triesLeft > 0) survivalBonus += SURVIVED_RATING;
    if (Math.floor(oldLeagueExact) >= LEAGUE_MASTER) survivalBonus *= 0.6;
    rating += survivalBonus;
  } else if (numLosses === 0) {
    rating += PERFECT_RUN_RATING;
  } else if (triesLeft > 0) {
    rating += MAX_WINS_RATING;
  }

  const oldRating = curRating;
  let next = curRating + rating;
  next *= RATING_DECAY;
  let change = next - oldRating;
  if (change < 0) change *= 0.6;
  next = oldRating + change * RATING_VELO;

  const newLeagueExact = getLeagueExact(next);
  if (Math.floor(newLeagueExact) > Math.floor(oldLeagueExact)) {
    next += getRatingDifferenceForBonus(
      next,
      newLeagueExact + RANK_UP_BONUS_RANKING / 100,
    );
  }

  const clampVal = GAME_LEAGUE_THRESHOLDS[LEAGUE_GRANDMA + 1] - 0.5;
  return Math.max(0, Math.min(next, clampVal));
}

/**
 * @param {{ result: 'win' | 'loss' }[]} results
 * @returns {number} zero-based index of 10th win, or -1
 */
export function getSurvivalStartRound(results) {
  let numWins = 0;
  let survivalStartRound = -1;
  for (let i = 0; i < results.length; i += 1) {
    if (results[i].result === 'win') {
      numWins += 1;
      if (numWins === MAX_WINS) survivalStartRound = i;
    }
  }
  if (survivalStartRound !== -1 && results.length > survivalStartRound) {
    return survivalStartRound;
  }
  return -1;
}

/**
 * @param {number} rating pre-run rating (negative = unranked/lobby)
 * @param {{ result: 'win' | 'loss' }[]} results
 * @param {number} tries last-round lives
 * @returns {{
 *   showRanked: boolean,
 *   leagueName: string | null,
 *   leagueProgress: number,
 *   rankingDif: number | null,
 * }}
 */
export function computeHistoryRankDisplay(rating, results, tries) {
  if (!Number.isFinite(rating) || rating < 0) {
    return {
      showRanked: false,
      leagueName: null,
      leagueProgress: 0,
      rankingDif: null,
    };
  }

  const leagueExact = getLeagueExact(rating);
  const leagueIdx = Math.max(
    0,
    Math.min(LEAGUE_GRANDMA, Math.floor(leagueExact)),
  );
  const leagueProgress = Math.floor(100 * (leagueExact - Math.floor(leagueExact)));
  const leagueName = GAME_LEAGUE_NAMES[leagueIdx] || 'bronze';

  const wins = results.filter((r) => r.result === 'win').length;
  let losses = results.filter((r) => r.result === 'loss').length;
  const rounds = results.length;
  const survivalStartRound = getSurvivalStartRound(results);
  const survival = survivalStartRound !== -1;
  let triesLeft = Number(tries) || 0;

  let runWasConceded = false;
  if (triesLeft > 0) {
    if (survival) runWasConceded = rounds < MAX_ROUNDS;
    else runWasConceded = wins < MAX_WINS;
  }
  if (runWasConceded) {
    const roundsLeft = MAX_ROUNDS - rounds;
    losses += Math.min(roundsLeft, triesLeft);
    losses = Math.min(losses, MAX_TRIES);
    triesLeft = 0;
  }

  const perfectBeforeSurvival =
    results.slice(0, MAX_WINS).filter((r) => r.result === 'win').length ===
    MAX_WINS;

  const newRating = calcRunRating(
    rating,
    wins,
    losses,
    triesLeft,
    survival,
    perfectBeforeSurvival,
  );
  const rankingDif =
    Math.floor(getLeagueExact(newRating) * 100) -
    Math.floor(leagueExact * 100);

  return {
    showRanked: true,
    leagueName,
    leagueProgress,
    rankingDif: rankingDif === 0 ? null : rankingDif,
  };
}
