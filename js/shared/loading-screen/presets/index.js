import { createBuildCreatorLoadingScreen } from './build-creator.js?v=build-creator-20261011h';
import { genericLoadingPreset } from './generic.js';
import { videoLoadingPreset } from './video.js?v=video-20261011j';

export const LOADING_SCREEN_PRESETS = Object.freeze({
  generic: genericLoadingPreset,
  'build-creator': {
    id: 'build-creator',
    label: 'Build creator animation',
    create: createBuildCreatorLoadingScreen,
  },
  video: videoLoadingPreset,
});

export function getLoadingScreenPreset(id = 'build-creator') {
  return LOADING_SCREEN_PRESETS[id] || LOADING_SCREEN_PRESETS['build-creator'];
}
