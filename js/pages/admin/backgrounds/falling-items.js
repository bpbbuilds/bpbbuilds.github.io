const FALLBACK_ITEM_FILES = [
  'AceofSpades.png',
  'AmethystEgg.png',
  'Anvil.png',
  'ArcaneBoots.png',
  'ArtifactStoneHeat.png',
  'FlameWhip.png',
  'DraconicOrb.png',
  'WoodenSword.png',
];

const MAX_ITEMS = 18;
const BASE_SPAWN_INTERVAL_MS = 620;
const BASE_GRAVITY = 720;
const BOUNCE_RESTITUTION = 0.62;
// Matches the audited Godot PhysicsMaterial bounce value (0.23).
const SURFACE_RESTITUTION = 0.23;
// The canvas applies friction once at contact instead of simulating a rigid body.
const SURFACE_FRICTION = 0.32;
const GAME_SCENE_WIDTH = 1920;
const GAME_SCENE_HEIGHT = 1080;
/** Matches the game's Sprite/Icon source cell size in sprite-display.json. */
const GAME_CELL_PX = 80;
const DISALLOWED_FILE = /potion|flask|hatchparticles/i;

/*
 * Audited from the installed game's Core/Main.tscn:
 * TitleScreen/Node2D/Background/StaticBody2D2/CollisionPolygon2D.
 * The full polygon describes the blue market tent. Falling objects meet its
 * two upper edges first, so those are the only edges used as bounce planes.
 * Coordinates are in the game's 1920×1080 title-screen space.
 */
const GAME_SURFACE_SEGMENTS = [
  {
    id: 'blue-tent-left-roof',
    side: 'left',
    a: { x: 1284.52, y: 649.48 },
    b: { x: 1344.52, y: 599.95 },
  },
  {
    id: 'blue-tent-right-roof',
    side: 'right',
    a: { x: 1344.52, y: 599.95 },
    b: { x: 1551.19, y: 701.86 },
  },
];

function itemDimensions(item) {
  const width = item.width;
  const height = item.height;
  return { width, height, radius: Math.max(width, height) * 0.46 };
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function fallbackEntries() {
  return FALLBACK_ITEM_FILES.map((file) => ({
    file,
    width: GAME_CELL_PX,
    height: GAME_CELL_PX,
  }));
}

function catalogEntries(payload) {
  const cellPx = Number(payload?.cellSize) > 0 ? Number(payload.cellSize) : GAME_CELL_PX;
  return Object.entries(payload?.byImage || {})
    .filter(([file, meta]) => (
      !DISALLOWED_FILE.test(file) &&
      meta?.bag !== true &&
      Number(meta?.w) > 0 &&
      Number(meta?.h) > 0
    ))
    .map(([file, meta]) => ({
      file,
      width: Number(meta.w) * cellPx,
      height: Number(meta.h) * cellPx,
    }));
}

export function createFallingItemsBackground({
  root,
  hostClassName = 'background-test__falling-items',
  canvasClassName = 'background-test__falling-canvas',
} = {}) {
  const host = document.createElement('div');
  host.className = hostClassName;
  host.hidden = true;
  host.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.className = canvasClassName;
  host.append(canvas);
  document.body.insertBefore(host, document.body.firstChild);

  const ctx = canvas.getContext('2d');
  const imageCache = new Map();
  const items = [];
  let itemEntries = [];
  let itemDeck = [];
  const pointer = { x: 0, y: 0, active: false };
  let width = 0;
  let height = 0;
  let dpr = 1;
  let active = false;
  let raf = 0;
  let lastTime = 0;
  let lastSpawn = 0;
  let dropRate = 1;
  let dropSpeed = 1;
  let bounceOnce = false;
  let gameSurfaces = false;
  let surfaceSegments = [];

  const rebuildSurfaceSegments = () => {
    const scale = Math.max(width / GAME_SCENE_WIDTH, height / GAME_SCENE_HEIGHT);
    const offsetX = (width - GAME_SCENE_WIDTH * scale) / 2;
    const offsetY = (height - GAME_SCENE_HEIGHT * scale) / 2;
    surfaceSegments = GAME_SURFACE_SEGMENTS.map((segment) => {
      const ax = offsetX + segment.a.x * scale;
      const ay = offsetY + segment.a.y * scale;
      const bx = offsetX + segment.b.x * scale;
      const by = offsetY + segment.b.y * scale;
      const dx = bx - ax;
      const dy = by - ay;
      const length = Math.hypot(dx, dy) || 1;
      // Choose the normal that points toward the sky (negative y).
      let nx = -dy / length;
      let ny = dx / length;
      if (ny > 0) {
        nx *= -1;
        ny *= -1;
      }
      return { ...segment, ax, ay, bx, by, dx, dy, length, nx, ny };
    });
  };

  const loadImage = (entry) => {
    let image = imageCache.get(entry.file);
    if (image) return image;
    image = new Image();
    image.decoding = 'async';
    image.src = `${root}assets/item-sprites/${entry.file}`;
    imageCache.set(entry.file, image);
    return image;
  };

  const loadCatalog = fetch(`${root}assets/data/sprite-display.json`, {
    cache: 'force-cache',
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => {
      const entries = catalogEntries(payload);
      itemEntries = entries.length ? entries : fallbackEntries();
      itemDeck = shuffle(itemEntries.slice());
    })
    .catch(() => {
      itemEntries = fallbackEntries();
      itemDeck = shuffle(itemEntries.slice());
    });

  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    host.style.setProperty('--falling-stage-scale', String(Math.max(
      width / GAME_SCENE_WIDTH,
      height / GAME_SCENE_HEIGHT,
    )));
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildSurfaceSegments();
  };

  const spawn = (initial = false) => {
    if (items.length >= MAX_ITEMS) return;
    if (!itemDeck.length) itemDeck = shuffle(itemEntries.slice());
    const entry = itemDeck.pop();
    if (!entry) return;
    const image = loadImage(entry);
    items.push({
      // Span both sides of the blue tent instead of beginning past its peak.
      // This preserves the right-side presentation while allowing natural
      // left- and right-facing roof bounces.
      x: width * 0.58 + Math.random() * width * 0.28,
      y: -entry.height - (initial ? Math.random() * height * 0.18 : 0),
      vx: -24 + Math.random() * 48,
      vy: 20 + Math.random() * 70,
      width: entry.width,
      height: entry.height,
      angle: Math.random() * Math.PI * 2,
      spin: -1.8 + Math.random() * 3.6,
      image,
      bounced: false,
      radius: itemDimensions(entry).radius,
      previousX: 0,
      previousY: 0,
    });
    const item = items[items.length - 1];
    item.previousX = item.x;
    item.previousY = item.y;
  };

  const drawItem = (item) => {
    if (!ctx) return;
    const { width: itemWidth, height: itemHeight } = itemDimensions(item);
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.36)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    if (item.image.complete && item.image.naturalWidth > 0) {
      ctx.drawImage(item.image, -itemWidth / 2, -itemHeight / 2, itemWidth, itemHeight);
    } else {
      ctx.fillStyle = '#eac914';
      ctx.fillRect(-itemWidth / 2, -itemHeight / 2, itemWidth, itemHeight);
    }
    ctx.restore();
  };

  const tick = (time) => {
    raf = 0;
    if (!active || !ctx) return;
    const dt = Math.min(0.032, Math.max(0.001, (time - lastTime) / 1000 || 0.016));
    lastTime = time;

    const spawnInterval = BASE_SPAWN_INTERVAL_MS / Math.max(0.25, dropRate);
    if (itemEntries.length && time - lastSpawn >= spawnInterval) {
      lastSpawn = time;
      spawn();
    }

    for (const item of items) {
      item.previousX = item.x;
      item.previousY = item.y;
      item.radius = itemDimensions(item).radius;
      item.vy += BASE_GRAVITY * dropSpeed * dt;
      if (pointer.active) {
        const dx = item.x - pointer.x;
        const dy = item.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < 150) {
          const impulse = (1 - distance / 150) * 840 * dropSpeed * dt;
          item.vx += (dx / distance) * impulse;
          item.vy += (dy / distance) * impulse;
        }
      }
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.angle += item.spin * dt;
      item.vx *= 0.998;

      if (item.x < width * 0.6) item.vx += 80 * dt;

      if (gameSurfaces) {
        let surfaceContact = null;
        const tentPeakX = surfaceSegments[0]?.bx ?? width / 2;

        for (const segment of surfaceSegments) {
          const segmentLengthSquared = segment.length * segment.length;
          const projection = Math.min(1, Math.max(0, (
            ((item.x - segment.ax) * segment.dx) + ((item.y - segment.ay) * segment.dy)
          ) / segmentLengthSquared));
          const closestX = segment.ax + segment.dx * projection;
          const closestY = segment.ay + segment.dy * projection;
          const previousDistance = (
            (item.previousX - closestX) * segment.nx + (item.previousY - closestY) * segment.ny
          );
          const currentDistance = (
            (item.x - closestX) * segment.nx + (item.y - closestY) * segment.ny
          );
          const distanceX = item.x - closestX;
          const distanceY = item.y - closestY;
          const distanceSquared = distanceX * distanceX + distanceY * distanceY;
          const crossedFromAbove = previousDistance >= item.radius && currentDistance < item.radius;
          const overlapping = distanceSquared <= item.radius * item.radius;
          const movingIntoSurface = item.vx * segment.nx + item.vy * segment.ny < 0;
          if (!overlapping || (!crossedFromAbove && !movingIntoSurface)) continue;

          const isCloser = !surfaceContact || distanceSquared < surfaceContact.distanceSquared - 0.001;
          const isTie = surfaceContact && Math.abs(distanceSquared - surfaceContact.distanceSquared) <= 0.001;
          const isOnRightOfPeak = item.x >= tentPeakX;
          const isCorrectSideForTie = isOnRightOfPeak
            ? segment.side === 'right'
            : segment.side === 'left';

          if (isCloser || (isTie && isCorrectSideForTie)) {
            surfaceContact = { segment, closestX, closestY, distanceSquared };
          }
        }

        // Resolve one roof face per frame. At the peak an item can overlap both
        // collision areas; resolving both made the left face incorrectly win.
        if (surfaceContact) {
          const { segment, closestX, closestY } = surfaceContact;
          item.x = closestX + segment.nx * item.radius;
          item.y = closestY + segment.ny * item.radius;
          const normalVelocity = item.vx * segment.nx + item.vy * segment.ny;
          if (normalVelocity < 0) {
            item.vx -= (1 + SURFACE_RESTITUTION) * normalVelocity * segment.nx;
            item.vy -= (1 + SURFACE_RESTITUTION) * normalVelocity * segment.ny;
          }
          item.vx *= 1 - SURFACE_FRICTION * 0.05;
        }
      }

      const atFloor = item.y + item.radius >= height;
      if (bounceOnce && !item.bounced && atFloor && item.vy > 0) {
        item.y = height - item.radius;
        const incomingVelocity = Math.max(0, item.vy) * BOUNCE_RESTITUTION;
        item.vy = -Math.max(260, incomingVelocity);
        item.bounced = true;
      }
    }
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].y - items[i].radius > height + 80) items.splice(i, 1);
    }

    ctx.clearRect(0, 0, width, height);
    for (const item of items) drawItem(item);
    raf = requestAnimationFrame(tick);
  };

  const onPointerMove = (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  };
  const onPointerLeave = () => {
    pointer.active = false;
  };
  const onResize = () => resize();

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  resize();

  const show = () => {
    active = true;
    host.hidden = false;
    lastTime = performance.now();
    lastSpawn = lastTime;
    void loadCatalog.then(() => {
      if (!active || items.length) return;
      for (let i = 0; i < 5; i += 1) spawn(true);
    });
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const hide = () => {
    active = false;
    host.hidden = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    pointer.active = false;
    items.length = 0;
  };

  const setSettings = (next = {}) => {
    if (Number.isFinite(Number(next.dropRate))) {
      dropRate = Math.min(3, Math.max(0.25, Number(next.dropRate)));
    }
    if (Number.isFinite(Number(next.dropSpeed))) {
      dropSpeed = Math.min(2.5, Math.max(0.5, Number(next.dropSpeed)));
    }
    if (typeof next.bounceOnce === 'boolean') bounceOnce = next.bounceOnce;
    if (typeof next.gameSurfaces === 'boolean') gameSurfaces = next.gameSurfaces;
  };

  return { host, show, hide, setSettings };
}
