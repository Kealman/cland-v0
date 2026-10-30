---
id: T-1479
kind: task
title: Landing page and README name Telegram and Discord remote control
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1480
topic: topic-1231
branch: t/T-1479-landing-page-and-readme-name-telegram
created: 2026-10-30T10:14:48.049Z
updated: 2026-10-30T10:20:18.495Z
---

## Summary

The landing page, the repository README and the features page name remote control through Telegram and Discord, which v0.3.0 shipped. Today the landing and README only say "answer an ask from your phone", and features.md names Telegram but not Discord (the human, 2026-10-30 09:16Z, relayed by cland-impl).

## What to build

A visitor reading the landing page or the README learns that the human can follow and steer the crew from Telegram or Discord: General mirrored both ways, asks and approvals as cards, photos, files and voice notes, pairing through `cland setup` or `cland remote pair`. Each mention links to the Remote control docs page. Wording follows the brand rules in docs/brand/ (English only, no claims beyond what v0.3.0 ships) and the install story already on the site.

## Acceptance criteria

- [ ] C1. site/src/pages/index.astro names remote control through Telegram and Discord in its feature list and links /docs/remote-control/.
- [ ] C2. The root README.md names Telegram and Discord remote control in its feature summary and links the Remote control docs page.
- [ ] C3. site/src/content/docs/docs/features.md names Discord beside Telegram, and every remote claim on the three pages matches docs/spec/v0.3.md and the v0.3.0 notes (no deferred feature such as Telegram groups or a thread per item).
- [ ] C4. The site builds (`npm run build` in site/) and the docs link check passes at the final head.

## Publication

README.md reaches GitHub with the 0.3.1 release. The site pages go out through `cland publish` after an ask to the human, as for every marketing path.

## Comments

### impl-1479 · 2026-10-30T10:19:23.448Z

Scope: three public-copy consumers (landing slides, root README Features, Features docs); site/test/remote-docs.test.ts imported by hub/test/remote-docs.test.ts covers their source boundary. No shared runtime/wire contract changes. Red: 3 new cases failed (missing landing/README linked entry, missing Discord in Features); existing 15 passed. Green wrapper: 19/19 on macOS arm64, Node 24.21.0; source-only, no browser/transport coverage. C4 is build/link validation, not a new behavior with a meaningful red state.
