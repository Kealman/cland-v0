---
id: T-1137
kind: task
title: Two-line session rows below 640 px
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1136
topic: topic-880
branch: t/T-1137-two-line-session-rows-below-640-px
created: 2026-10-22T15:16:15.881Z
updated: 2026-10-23T00:18:31.236Z
closed: 2026-10-23T00:18:31.236Z
---

## Summary

Below 640 px the Sessions area draws the two-line rows of P27 with no row actions, and a tap or Enter opens the session's page.

## Parent

E-418 (§3.6 the two-line row, P27 and P30; tracer step 3). E-419 places these rows and the page on the phone.

## What to build

Below 640 px each row is two lines: the glyph, the name and the role in its colour, with the state and its age at the right; then the harness and the item (the claim, a verifier's hold with its role and +N, or a requested item dimmed); a waiting row adds the command it waits on. The model, the account and the usage move to the session's page. The list has no row actions and does not unfold; a tap or Enter opens the session's page in the pane, with Stop, Resume, Archive and Capabilities and their confirmations, and Esc returns to the list at the same row. The header, the groups, their counts and their folds stay.

## Acceptance criteria

- [x] C1. At 600 px wide each session row is two lines with the facts of P27, a waiting row adds its command, and no row offers an action (Web test).
  - done: impl-1137 · 2026-10-23T00:00:04.216Z
  - verified: rev-23 [reviewer] · run rev-20261023-1137-final · 2026-10-23T00:13:55.114Z · commit 7de08a7aba77eae484138065b4212345e21b3b6c
- [x] C2. A tap on a row at 600 px opens the session's page, Stop there asks for the confirmation, and Esc returns to the list at the same row (Web test).
  - done: impl-1137 · 2026-10-23T00:02:54.493Z
  - verified: rev-23 [reviewer] · run rev-20261023-1137-final · 2026-10-23T00:13:55.114Z · commit 7de08a7aba77eae484138065b4212345e21b3b6c
- [x] C3. At 1440 px the same sessions draw as the rows of P22 (Web test).
  - done: impl-1137 · 2026-10-23T00:00:04.532Z
  - verified: rev-23 [reviewer] · run rev-20261023-1137-final · 2026-10-23T00:13:55.114Z · commit 7de08a7aba77eae484138065b4212345e21b3b6c
- [x] C4. `web/README.md` describes the narrow rows and the page's entry (docs).
  - done: impl-1137 · 2026-10-23T00:00:04.616Z
  - verified: rev-23 [reviewer] · run rev-20261023-1137-source-2 · 2026-10-23T00:03:32.620Z · commit 7de08a7aba77eae484138065b4212345e21b3b6c
  - verified: rev-23 [reviewer] · run rev-20261023-1137-final · 2026-10-23T00:13:55.114Z · commit 7de08a7aba77eae484138065b4212345e21b3b6c

## Comments

### impl-1137 · 2026-10-23T00:00:04.144Z

Implemented P27 two-line 52 px rows below 640 px, waiting command, page-only metadata, no list actions/drawer, and page Esc return with focus restored. Test-first red/green at the approved Web seam. Local macOS typecheck and targeted sessions, session-actions, key-contexts, palette and area-slots passed. origin/dev merge before first review was already up to date. Review head 0e50e6b0; mode-free verification awaits source verdict. QA is after-stage.

### rev-23 · 2026-10-23T00:02:06.188Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1137-source
commit: 0e50e6b080d36958231a8fde34265d5b80f7420c
scope: full
findings: [{"severity":"medium","text":"Returning from an archived session's page remounts SessionsArea with local archived=false; its selected archived row is not rendered, so Esc cannot restore the promised same-row focus. Preserve archive-list context and add the archived-row public Web regression.","file":"web/src/Shell.tsx","line":331}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear: one medium C2 finding, archived-session page return loses local list context on component remount. Complete finding set in A-9619: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9619-t-1137-source-review-archived-row-return-loses-list-context.md. Layout/desktop/token/test-seam review otherwise has no findings. Local summarized/precommit targeted receipts are not configured proof. Fresh source review before verify; no Reviewer runtime execution.

Criteria: C2 failed (At 600 px opening an archived session then Esc hides its archive list and cannot return focus to the same row.).

### rev-23 · 2026-10-23T00:03:32.620Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1137-source-2
commit: 7de08a7aba77eae484138065b4212345e21b3b6c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear. M1 resolved: archive toggle survives page remount via small browser-memory external store; existing narrow Web identity retains archived-row visibility/focus/toggle regression and running-row Stop/Enter coverage. Both axes no findings. C4 verified; C1–C3 await exact-head configured mode-free receipt. A-9623: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9623-t-1137-corrected-source-clear-at-7de08a7a.md. Targeted local summary A-9622 remains separately attributed; no Reviewer runtime execution. After-stage QA separate.

Criteria: C4 verified.

### rev-23 · 2026-10-23T00:13:55.114Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1137-final
commit: 7de08a7aba77eae484138065b4212345e21b3b6c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, C1–C4 verified at unchanged 7de08a7aba77eae484138065b4212345e21b3b6c. A-9638/6fd84e88: 2560 ordinary passes, 0 fail/skip/cancel; actual Linux T1/all hub+Neovim T2/Web. Extended P22/P27 merged-facts 2.319873296s and narrow-page/archived-return 1.594102409s pass; M1 resolved. Host check reused remotely; T3/T4 absent; generic budgets/lint/ratchet report-only. A-9640: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9640-t-1137-final-evidence-clear-narrow-rows-and-archived-page-return.md. No findings; after-stage QA and Coordinator landing separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-23T00:18:31.236Z

Merged ab8d5d6b9d338d36a8aa5c91d7acedd14a6d669f onto dev.
