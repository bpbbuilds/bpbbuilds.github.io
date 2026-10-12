import { createFallingItemsBackground } from '../admin/backgrounds/falling-items.js?v=home-falling-items-20261011';

export function initHomeFallingItemsBackground() {
  if (!document.body.classList.contains('page-home')) return null;
  if (document.querySelector('.home-falling-background')) return null;

  const root = document.body.dataset.root || './';
  const background = createFallingItemsBackground({
    root,
    hostClassName: 'home-falling-background',
    canvasClassName: 'home-falling-background__canvas',
  });
  const backgroundUrl = new URL('assets/theme/backgrounds/bg-town-square.jpg', document.baseURI).href;
  background.host.style.setProperty(
    '--falling-background-image',
    `url('${backgroundUrl}')`,
  );
  background.setSettings({ gameSurfaces: true });
  background.show();
  return background;
}
