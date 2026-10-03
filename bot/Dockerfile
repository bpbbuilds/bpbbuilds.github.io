FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV BOT_HEALTH_PORT=8787
WORKDIR /app

# Install only production dependencies. The repository root is the build
# context so the watcher can use its existing shared render/data modules.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY bot ./bot

# Runtime assets used by the existing Discord embeds, board renderer, and
# blob/item commands. Keeping this list explicit avoids shipping the website
# and screenshot-detector assets in the bot image.
COPY assets/data/item-shapes.json assets/data/sprite-display.json assets/data/socket-offsets.json assets/data/item-live-art.json assets/data/blob-cosmetics.json ./assets/data/
COPY assets/item-sprites ./assets/item-sprites
COPY assets/blob ./assets/blob
COPY assets/brand/logo-bpb.png ./assets/brand/logo-bpb.png
COPY assets/icons/history/VoteUp.png assets/icons/history/VoteDown.png ./assets/icons/history/
COPY assets/icons/FilledSlot.png ./assets/icons/
COPY assets/theme/ui/ui-ranked-banner.png ./assets/theme/ui/
COPY assets/events ./assets/events

# Shared modules imported by the board still renderer and event catalog.
COPY js/pages/build/map-item.js ./js/pages/build/
COPY js/shared/board-still/paint.js ./js/shared/board-still/
COPY js/pages/events ./js/pages/events
COPY js/shared/youtube.js ./js/shared/
COPY js/shared/backpack-grid ./js/shared/backpack-grid
COPY js/shared/item-live-art ./js/shared/item-live-art

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:8787/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "bot/watch.js"]
