import { createLoadingScreen } from '../index.js';

export const genericLoadingPreset = Object.freeze({
  id: 'generic',
  label: 'Generic progress',
  create: createLoadingScreen,
});
