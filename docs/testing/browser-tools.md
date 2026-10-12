# Browser tools for local development

BPB Builds has two complementary browser tools:

- Chrome DevTools MCP is the interactive debugging surface for DOM/CSS inspection, console and runtime errors, network requests, screenshots, and performance traces.
- Playwright is the existing project dependency for focused browser automation and smoke checks. It is already listed in `package.json` as `playwright` `^1.62.1`; no second browser-test framework is required.

## Local server

The site is static. From the repository root, start a local server when one is not already running:

```powershell
python -m http.server 8123 --bind 127.0.0.1
```

Then use `http://127.0.0.1:8123/`. Cursor Live Server may use a different port in an existing workspace; pass that URL explicitly to the smoke script. Do not use production URLs for destructive debugging or test actions.

## Chrome DevTools MCP configuration

The project-level Cursor configuration is [`.cursor/mcp.json`](../../.cursor/mcp.json). Codex uses the same launcher from the user-level `config.toml` MCP entry at `C:\Users\justi\.codex\config.toml`; that file is intentionally not committed because it is personal agent configuration.

Both clients start `scripts/start-chrome-devtools-mcp.mjs`. The launcher:

1. Prefers an installed Google Chrome executable.
2. Falls back to the Chromium binary already managed by Playwright when Chrome is not installed.
3. Uses an isolated temporary browser profile, so existing cookies and signed-in browser data are not shared.
4. Disables Chrome DevTools MCP usage statistics and CrUX lookups and redacts network headers before returning them to the agent.

Restart Cursor or Codex after changing MCP configuration. In Cursor, confirm `chrome-devtools` is connected in Settings → MCP. In Codex, use `codex mcp list` from a terminal or start a new Codex session so the user-level configuration is loaded.

The official server is launched on demand with `npx chrome-devtools-mcp@latest`; it is not bundled into the production site or browser JavaScript. Its supported Chrome requirement is documented by the [Chrome DevTools MCP project](https://github.com/ChromeDevTools/chrome-devtools-mcp). If the Playwright fallback is used, installing current Google Chrome later is recommended; the launcher will select it automatically.

## Targeted Playwright smoke check

Run the generic check against the local page you are debugging:

```powershell
node scripts/browser-smoke.mjs --url http://127.0.0.1:8123/ --viewport 1280x720
```

Capture a temporary screenshot when visual verification matters:

```powershell
node scripts/browser-smoke.mjs `
  --url http://127.0.0.1:8123/builds/view/?slug=missing-test `
  --viewport 1920x1080 `
  --screenshot output/playwright/browser-smoke.png
```

The script reports navigation status, page errors, console errors/warnings, failed requests, HTTP errors, viewport geometry, and the screenshot path. It fails on navigation errors, JavaScript errors, console errors, or failed requests. Add `--strict-network` when HTTP 4xx/5xx responses should also fail the check.

Existing focused scripts can be run directly, for example:

```powershell
node scripts/audit-multiselect.mjs
```

Those scripts may expect a particular Live Server port; inspect the script or set its documented environment variable before running it.

## Integrated debugging workflow

1. Start the local server and note its URL.
2. Open the local URL through Chrome DevTools MCP.
3. Check console/runtime errors and failed network requests before editing.
4. Inspect the relevant DOM, computed styles, and responsive viewport.
5. Reproduce the issue with the smallest interaction needed.
6. Make the source change.
7. Reload the same local page and repeat the DevTools checks.
8. Run the narrow Playwright smoke or existing focused script for the changed surface.
9. Capture a screenshot or trace when the change is visual or timing-sensitive.

Do not run a full browser suite after every trivial edit. Choose checks based on the changed page and behavior.

## Troubleshooting

- **MCP is not listed:** restart Cursor/Codex after saving the configuration and confirm `npx --version` works.
- **Chrome cannot launch:** install current Google Chrome, or confirm Playwright has a browser under `%LOCALAPPDATA%\ms-playwright`. Set `CHROME_DEVTOOLS_MCP_EXECUTABLE` to a supported Chrome executable if needed.
- **The local page does not load:** confirm the server is listening on the chosen port and use `Test-NetConnection 127.0.0.1 -Port 8123`.
- **Playwright cannot launch:** run `npx playwright install chromium` once, then rerun the targeted command.
- **Stale UI or assets:** use the local server's no-cache/reload controls and confirm the page URL is local rather than GitHub Pages.
- **Authentication prompts:** use an isolated local session and test public behavior unless authenticated behavior is specifically in scope. Never paste tokens or cookies into the agent conversation.

## Limitations

- Chrome DevTools MCP is not automatically available inside an already-running Codex conversation until the MCP client reloads its configuration; this setup is for subsequent sessions and Cursor after restart.
- If Google Chrome is not installed on another development machine, the launcher falls back to that machine's Playwright Chromium binary. Installing current Google Chrome is preferred because it is the browser officially supported by Chrome DevTools MCP.
- Browser screenshots and network response bodies can contain page data. Keep debugging sessions local and avoid opening private or production data in an agent-controlled browser.
