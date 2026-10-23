---
id: T-1174
kind: task
title: "The installable app: manifest, icons, badge and the phone sign-in"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1165
topic: null
branch: null
created: 2026-10-23T07:00:04.518Z
updated: 2026-10-23T07:00:04.518Z
---

## Summary

The page installs as an app: a manifest named for the project, opening on the inbox, standalone in the panel colour, with 192, 512 and maskable icons and an apple-touch-icon; the app badge carries the needs-you count where the platform has it; the link `cland web --qr` prints signs a phone in.

## Parent

E-419 (§3.6 and §3.7 installing and signing in, P39; choice "The manifest"; the first part of tracer step 6).

## What to build

- **The manifest.** The bundle is shared by every project, so the build emits the fixed fields (`display: standalone`, `id`, `scope`, a start URL the shell reads to open the inbox, the icons) and takes the theme and background colour from the panel token in `tokens.css`, so no colour value lives outside the tokens. The web edge serves `/manifest.webmanifest` with the project's name and short name added. `index.html` links the manifest, an `apple-touch-icon` and a `theme-color` from the same token. The edge's CSP already allows `manifest-src 'self'`.
- **Icons** of 192 and 512 px and a maskable one come from the brand mark under `docs/brand/` (the 512 and 180 px PNGs exist; the 192 and the maskable are rendered once with the tools the repo has, no new dependency) and are committed as PNGs.
- **The start URL** opens the inbox whatever area was saved, then leaves a plain `/` in the address bar.
- **The badge.** Where `navigator.setAppBadge` exists the needs-you count sets it and 0 clears it; elsewhere nothing happens.
- **The phone sign-in.** `cland web --qr` already prints the link and its QR code; this ticket proves that link signs a fresh phone context in with the 30-day cookie. Installability itself and the real badge are QA's demo with the full Chromium build.

## Acceptance criteria

- [ ] C1. The edge serves `/manifest.webmanifest` as `application/manifest+json` with the project's name, `display: standalone`, a start URL that opens the inbox, the panel token's colour and icons of 192, 512 and maskable (test).
- [ ] C2. `index.html` links the manifest and an `apple-touch-icon`, every icon the manifest names is served as a PNG of its stated size, and the web typecheck finds no colour outside the tokens (test).
- [ ] C3. Opening the manifest's start URL at 390x844 after the saved area was Sessions opens the inbox (Web test).
- [ ] C4. With `setAppBadge` and `clearAppBadge` stubbed, the badge follows the needs-you count and clears at 0 (Web test).
- [ ] C5. The link `cland web --qr` prints, opened on the edge's loopback address in a fresh 390x844 context, signs it in with the 30-day cookie and opens the inbox (Web test).
