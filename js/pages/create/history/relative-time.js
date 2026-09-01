/**
 * Relative time labels for History list rows.
 */

/**
 * @param {number} unix
 * @returns {string}
 */
export function formatRelativeTime(unix) {
  if (!Number.isFinite(unix) || unix <= 0) return '';
  const ms = unix > 1e12 ? unix : unix * 1000;
  const diff = Date.now() - ms;
  if (!Number.isFinite(diff) || diff < 0) return 'just now';
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'just now';
  if (diff < 2 * hour && diff < day) {
    const m = Math.floor(diff / minute);
    if (m < 60) return m === 1 ? '1 minute ago' : `${m} minutes ago`;
  }
  const h = Math.floor(diff / hour);
  if (h < 24) return h === 1 ? '1 hour ago' : `${h} hours ago`;
  const d = Math.floor(diff / day);
  if (d === 1) return '1 day ago';
  if (d < 14) return `${d} days ago`;
  try {
    return new Date(ms).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return '';
  }
}
