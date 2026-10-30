---
id: T-1479
kind: task
title: Landing page and README name Telegram and Discord remote control
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1480
topic: topic-1231
branch: t/T-1479-landing-page-and-readme-name-telegram
created: 2026-10-30T10:14:48.049Z
updated: 2026-10-30T11:35:22.672Z
closed: 2026-10-30T11:23:21.417Z
---

## Summary

The landing page, the repository README and the features page name remote control through Telegram and Discord, which v0.3.0 shipped. Today the landing and README only say "answer an ask from your phone", and features.md names Telegram but not Discord (the human, 2026-10-30 09:16Z, relayed by cland-impl).

## What to build

A visitor reading the landing page or the README learns that the human can follow and steer the crew from Telegram or Discord: General mirrored both ways, asks and approvals as cards, photos, files and voice notes, pairing through `cland setup` or `cland remote pair`. Each mention links to the Remote control docs page. Wording follows the brand rules in docs/brand/ (English only, no claims beyond what v0.3.0 ships) and the install story already on the site.

## Acceptance criteria

- [x] C1. site/src/pages/index.astro names remote control through Telegram and Discord in its feature list and links /docs/remote-control/.
  - done: impl-1479 · 2026-10-30T10:52:32.939Z
  - verified: rev-26 [reviewer] · run rev-20261030-1479-source-1 · 2026-10-30T10:53:49.430Z · commit 498b757fa18b612fde1305bce24594fef0350d78
  - verified: rev-26 [reviewer] · run rev-20261030-1479-evidence-1 · 2026-10-30T11:16:51.712Z · commit 498b757fa18b612fde1305bce24594fef0350d78
- [x] C2. The root README.md names Telegram and Discord remote control in its feature summary and links the Remote control docs page.
  - done: impl-1479 · 2026-10-30T10:52:33.017Z
  - verified: rev-26 [reviewer] · run rev-20261030-1479-source-1 · 2026-10-30T10:53:49.430Z · commit 498b757fa18b612fde1305bce24594fef0350d78
  - verified: rev-26 [reviewer] · run rev-20261030-1479-evidence-1 · 2026-10-30T11:16:51.712Z · commit 498b757fa18b612fde1305bce24594fef0350d78
- [x] C3. site/src/content/docs/docs/features.md names Discord beside Telegram, and every remote claim on the three pages matches docs/spec/v0.3.md and the v0.3.0 notes (no deferred feature such as Telegram groups or a thread per item).
  - done: impl-1479 · 2026-10-30T10:52:33.095Z
  - verified: rev-26 [reviewer] · run rev-20261030-1479-source-1 · 2026-10-30T10:53:49.430Z · commit 498b757fa18b612fde1305bce24594fef0350d78
  - verified: rev-26 [reviewer] · run rev-20261030-1479-evidence-1 · 2026-10-30T11:16:51.712Z · commit 498b757fa18b612fde1305bce24594fef0350d78
- [x] C4. The site builds (`npm run build` in site/) and the docs link check passes at the final head.
  - done: impl-1479 · 2026-10-30T10:52:33.171Z
  - verified: rev-26 [reviewer] · run rev-20261030-1479-evidence-1 · 2026-10-30T11:16:51.712Z · commit 498b757fa18b612fde1305bce24594fef0350d78

## Publication

README.md reaches GitHub with the 0.3.1 release. The site pages go out through `cland publish` after an ask to the human, as for every marketing path.

## Comments

### impl-1479 · 2026-10-30T10:19:23.448Z

Scope: three public-copy consumers (landing slides, root README Features, Features docs); site/test/remote-docs.test.ts imported by hub/test/remote-docs.test.ts covers their source boundary. No shared runtime/wire contract changes. Red: 3 new cases failed (missing landing/README linked entry, missing Discord in Features); existing 15 passed. Green wrapper: 19/19 on macOS arm64, Node 24.21.0; source-only, no browser/transport coverage. C4 is build/link validation, not a new behavior with a meaningful red state.

### rev-26 · 2026-10-30T10:53:49.430Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1479-source-1
commit: 498b757fa18b612fde1305bce24594fef0350d78
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14293 full source clear against pinned basecdf3f53d0. All three linked remote feature entries match shipped A-14232/v0.3 spec and brand/install scope, existing carousel/test seams retained. C1–C3 source verified. C4 build/link original records requested; unverified pending final audit and configured same-head result. No Reviewer execution or publication authority. Coordinator restart hold remains binding.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-26 · 2026-10-30T11:16:51.712Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1479-evidence-1
commit: 498b757fa18b612fde1305bce24594fef0350d78
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final A-14302 clear: original A-14301 parsed4242ordinary+105load passes, all3 marketing cases base+5/5load;T0/T1/allfallbackT2/Web complete,T3/T4unrun. C4 original same-head local build nativeexit0/completion and full link driver/output A-14294 establish1005localhrefs/zeroerrors, retaining missing fullstdout/external/non-index limits. C1–C4verified; no Reviewer workloads or publication authority.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-30T11:23:21.417Z

Merged 062e6c48a1ec882f3bf470e778a910bc8b1e5895 onto dev.

### coord · 2026-10-30T11:35:22.672Z

Published marketing marketing/t1479-remotes at 871f09864e8503e64c91896731538abde211aa1d (GitHub default branch and site); dev 793fd5096bca64b65b47d9c2046f1d007362825d.
