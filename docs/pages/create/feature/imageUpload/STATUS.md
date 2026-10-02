# Status

## Disposition

Paused for launch on 2026-10-01. This is a product-scope pause, not a cancellation.

| Surface | Launch behavior | Preserved implementation |
|---|---|---|
| Create image picker / Media onboarding | Hidden | `board-import.js`, `board-onboard.js`, screenshot modules |
| Image drag/drop and paste | Does not start premium or inference | `board-import.js` |
| Create label query flow | Disabled with the same browser gate | `board-editor.js`, `label-tool.js` |
| `/dev/screenshot-import/` | Redirects to `/create/` | dev harness remains intact |
| `screenshot-to-build` Edge Function | 404 before auth, catalog, or model calls | legacy OpenAI fallback remains intact |
| Manual editor and `history.db` | Unchanged | normal Create paths |

## Feature switches

- Client: set `SCREENSHOT_IMPORT_ENABLED` to `true` in `js/shared/feature-flags.js` only after the resume checklist passes.
- Server: set Edge Function environment variable `SCREENSHOT_IMPORT_ENABLED=true` when, and only when, the client flag is re-enabled.

The gates intentionally default to off. An enabled server alone is insufficient to expose the user feature; an enabled client alone cannot invoke the paused server fallback.
