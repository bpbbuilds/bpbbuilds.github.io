# Agent instructions

Read both handoffs before starting work:

- Cursor: [`docs/CURSOR_HANDOFF.md`](docs/CURSOR_HANDOFF.md)
- Codex: [`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md)

After a completed task, update **only your own** handoff (facts, scores, blockers, owned paths, next step). Do not edit the other handoff. Do not invent progress.

[`AGENTS.md`](AGENTS.md) is shared. Only one assistant edits it at a time. Do not change it in the same window as the other assistant.

## Who owns which files

Claim work in your handoff before editing product code. Do not edit paths listed as owned in the other handoff.

Separate features can still meet in a shared file. Do not edit these at the same time:

- `AGENTS.md`
- `package.json` (and the lockfile)
- `css/theme.css`, `css/shared.css`
- `js/shared/nav.js`, `js/shared/footer.js`
- `docs/db/`

Current claim: Codex owns screenshot import as of 2026-10-01. Cursor released those paths in its handoff and did not move or delete any files. Codex lists them in its handoff before editing.

## Legal page maintenance

- When authentication, payments, uploads, analytics, storage, moderation, or other material site behavior changes, review `legal/about/index.html`, `legal/terms/index.html`, and `legal/privacy/index.html` in the same task.
- Update each affected page's “Last updated” date and factual description before considering the feature complete. Keep the maintenance language on those pages current as well.

## Sources (do not copy these here)

- Product: [`docs/purpose.md`](docs/purpose.md)
- Screenshot import: [`docs/features/screenshot-detector.md`](docs/features/screenshot-detector.md)
- Schema: [`docs/db/tables.md`](docs/db/tables.md)
- Cursor-only rules: [`.cursor/rules/`](.cursor/rules/)

## Stack

- Static site on GitHub Pages. Supabase for database and item image Storage.
- Vanilla HTML/JS + Tailwind (page-specific) + `css/theme.css`.
- Each page loads only `js/pages/<page>/index.js`. Shared UI is in `js/shared/` (`nav.js`, `footer.js`).
- About 500 lines per `.js` file. One feature per file.
- Never commit `.env` or secrets. Env names: `SUPABASE_PROJECT_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`.

## Security rules for new work

- Treat every browser value, URL, hidden element, and client-side feature gate as attacker-controlled. Authorization must be repeated on the server or in Supabase RLS; never rely on the Admin page, Private-mode boot gate, or disabled UI as a security boundary.
- Keep service-role keys, database passwords, webhook secrets, bot tokens, emergency credentials, and model/API keys server-side only. Before committing or generating Pages assets, scan the diff and built files for secrets. The publishable Supabase key is the only Supabase credential allowed in browser code.
- For every Edge Function, explicitly authenticate the request when `verify_jwt = false`, validate the JWT with Supabase Auth, and perform the ownership/role check with a trusted service-role query. Use allow-listed actions and fail closed on missing configuration or authorization errors.
- For every new table or Storage bucket, enable RLS/private Storage by default, revoke broad grants, and add explicit least-privilege policies. Use signed URLs or an authenticated proxy for non-public files. Never expose sensitive profile, payment, ownership, voter, membership-verification, or moderation fields through a broad public select.
- Validate request methods, content types, body size, JSON shape, string lengths, numeric ranges, enum values, and referenced record ownership before writes. Add server-side rate limits and cost budgets to public or expensive endpoints; client throttling is not sufficient.
- Escape untrusted text before HTML insertion and avoid `innerHTML` for user-controlled content. Keep CSP restrictive; meta CSP cannot enforce `frame-ancestors`, so do not treat that directive as active without a response-header proxy/CDN.
- For payments, verify provider signatures, make webhook handling idempotent, and grant entitlements only from verified server-side payment state. Never accept plan, premium, owner, coins, grants, or membership-verification fields from the browser.
- Add regression coverage for every authorization/RLS path (anonymous, authenticated non-owner, owner, and cross-user access), then run syntax checks, migration/deployment validation, and a targeted production smoke test before calling the feature complete.
- Review the legal pages when a security change alters authentication, payments, uploads, Storage, analytics, moderation, or other material data behavior. Do not weaken an existing control to make a test or UI path convenient.

## Screenshot import (hard constraints)

- Do not publish a model unless it beats live v1 on the held-out 8 shots (item cells ≥ 58/150, and ideally ≥ the cached v5-80 score of 64/150).
- Ship the ONNX and the class list together. Live v1 is 426 classes. A 518-class head needs the 518 list.
- Do not retrain bags-v1b.
- Do not start training unless asked.
- Restore `assets/data/detector-manifest.json` with `Copy-Item` of the backup bytes. PowerShell `Set-Content -Encoding utf8` writes a BOM and can break eval.
- Do not re-run `mix-item-real` on the already-mixed v5 train folder (it double-copies).
