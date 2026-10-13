import { COMBAT_BACKGROUND_PRESETS } from './combat-presets.js?v=falling-town-square-20261011';
import { SITE_BACKGROUND_PRESETS } from './site-presets.js?v=falling-town-square-20261011';

export const BACKGROUND_GROUPS = [
  { id: 'live', label: 'Live scene' },
  { id: 'time', label: 'Time of day' },
  { id: 'experimental', label: 'Experimental' },
  { id: 'scene', label: 'Site scenes' },
  { id: 'hills', label: 'Hill stills' },
  { id: 'surface', label: 'Panels & borders' },
  { id: 'utility', label: 'Utility' },
];

export const BACKGROUND_OPTIONS = [
  ...COMBAT_BACKGROUND_PRESETS,
  ...SITE_BACKGROUND_PRESETS,
  { id: 'blank', label: 'Blank', group: 'utility', mode: 'blank' },
];

export function getBackgroundPreset(id) {
  return BACKGROUND_OPTIONS.find((option) => option.id === id) ?? null;
}
