---
id: T-999
kind: task
title: Any of the four panels opens on either side from the palette
state: open
status: ready
size: M
criterion_seq: 10
labels:
  - ready-for-agent
assignee: null
parent: E-789
blocked_by: []
topic: topic-753
branch: t/T-999-any-of-the-four-panels-opens-on-either
created: 2026-10-20T16:57:43.127Z
updated: 2026-10-20T17:26:18.279Z
---

## Summary

The workbench stops assuming that the left panel is Items. Each of the four panels (Items, Inbox, Sessions, Topics) has a home side, the left or the right, that the human chooses from the palette or with `:Cland panel`, and each side shows one of the panels assigned to it, as the right side does today (human, 2026-10-20). Each panel keeps its own keys and its live updates on whichever side it is shown.

## What to build

The human opens the palette and picks "Sessions on the left", then "Items on the right". Sessions becomes the left side's panel and Items the right side's, and both follow hub events as they do today. Every panel key (Enter, the Sessions keys, the Items filters and folds, digits on an Inbox ask, `n` on Topics) works there. Only these four panels are placeable; Events, Artifacts, Accounts and the verification queue stay what they are (human, 2026-10-20).

A panel is never shown on both sides at once. When a panel is asked for on the other side, it moves there, closing on the old side, and that side becomes its home side (Coordinator decision, 2026-10-20). When two panels have the same home side, opening one replaces the other on that side, as Sessions, Inbox and Topics do on the right today. With no choice made, the default homes apply: Items on the left, Sessions, Inbox and Topics on the right, and the workbench opens exactly as it does today.

This slice removes the hard-coded "left = Items" from the layout and from its callers' window bookkeeping (`layout`, `panels`, `actions`, `qa.state`). Keys, persistence, widths and the other openers come in the tickets that follow.

## Acceptance criteria

- [x] C1. The palette offers "<Panel> on the left" and "<Panel> on the right" for Items, Inbox, Sessions and Topics, and `:Cland panel <kind> left|right` does the same, proved by a T2 component test on the stub hub.
  - done: impl-999 · 2026-10-20T17:12:52.135Z
  - verified: rev-23 [reviewer] · run rev-20261020-999-final · 2026-10-20T17:24:15.939Z · commit 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
- [x] C2. With Sessions on the left and Items on the right, both panels render and follow hub events (a `session.state` frame and a `task` frame change the visible rows), proved by a T2 stub-hub test.
  - done: impl-999 · 2026-10-20T17:12:52.766Z
  - verified: rev-23 [reviewer] · run rev-20261020-999-final · 2026-10-20T17:24:15.939Z · commit 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
- [x] C3. With the panels swapped, each panel's keys still work (Enter opens the row in the centre; `x` and `c` on Sessions; `1`-`6` and `za` on Items; a digit on an Inbox ask; `n` on Topics), proved by a T2 stub-hub test.
  - done: impl-999 · 2026-10-20T17:12:53.395Z
  - verified: rev-23 [reviewer] · run rev-20261020-999-final · 2026-10-20T17:24:15.939Z · commit 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
- [x] C4. Asking for a panel on the other side moves it there, closes it on the old side and makes the new side its home, so a panel is never shown twice, proved by a T2 test.
  - done: impl-999 · 2026-10-20T17:12:53.918Z
  - verified: rev-23 [reviewer] · run rev-20261020-999-final · 2026-10-20T17:24:15.939Z · commit 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
- [x] C5. When two panels share a home side, opening one replaces the other on that side and the replaced panel keeps its home, proved by a T2 test.
  - done: impl-999 · 2026-10-20T17:12:54.546Z
  - verified: rev-23 [reviewer] · run rev-20261020-999-final · 2026-10-20T17:24:15.939Z · commit 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
- [x] C6. Closing either panel with `:q` or `CTRL-W c` clears only that side's state, and the centre is re-made when it was the sole column, proved by a T2 test.
  - done: impl-999 · 2026-10-20T17:12:55.146Z
  - verified: rev-23 [reviewer] · run rev-20261020-999-final · 2026-10-20T17:24:15.939Z · commit 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
- [x] C7. `qa.state().panels` reports which panel each side shows, and the shipped PANELS-005 to PANELS-016 and ITEMS-001/002 cases pass unchanged under `cland --headless --qa`.
  - done: impl-999 · 2026-10-20T17:12:55.806Z
  - verified: rev-23 [reviewer] · run rev-20261020-999-source · 2026-10-20T17:15:39.642Z · commit 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
  - verified: rev-23 [reviewer] · run rev-20261020-999-final · 2026-10-20T17:24:15.939Z · commit 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
- [x] C8. A new headless-grid case PANELS-017 opens Sessions on the left and Items on the right from the palette, then reads both panels' headers and one live row change from the grid.
  - done: impl-999 · 2026-10-20T17:12:56.426Z
  - verified: rev-23 [reviewer] · run rev-20261020-999-final · 2026-10-20T17:24:15.939Z · commit 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
- [x] C9. With no side chosen, the workbench opens as today (General in the centre, Sessions on the right, Items on the left when opened), and the existing T2 panel-key and preset tests in `shell-component.test.ts` pass unchanged.
  - done: impl-999 · 2026-10-20T17:12:56.973Z
  - verified: rev-23 [reviewer] · run rev-20261020-999-final · 2026-10-20T17:24:15.939Z · commit 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
- [x] C10. `ui.test.ts` and `shell.test.ts` pass as targeted local runs on the branch, since their layout cases are T3 and batches run T1 only.
  - done: impl-999 · 2026-10-20T17:12:57.595Z
  - verified: rev-23 [reviewer] · run rev-20261020-999-source · 2026-10-20T17:15:39.642Z · commit 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
  - verified: rev-23 [reviewer] · run rev-20261020-999-final · 2026-10-20T17:24:15.939Z · commit 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f

## Comments

### impl-999 · 2026-10-20T17:02:17.410Z

Implementation seam: generic placement/open/lookup in layout, retaining boolean ui.left and adding runtime left_kind/panel_homes so shipped QA shape remains compatible. ui.json stays v2; side persistence/reset belongs to T-1001. First targeted T2 attempt did not reach assertions: fixture admission refused `no hello received`; escalated under rule 5.

### impl-999 · 2026-10-20T17:11:29.708Z

Committed implementation at 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f after fetching/merging origin/dev (57795675; tracker-only fast-forward). Runtime side-neutral placement and eight palette commands, preserved QA fields plus panels.kinds, existing default/preset behavior, PANELS-017 grid proof and docs. Per Coordinator decision daf8922a: source review only now; full stage QA after T-1002 on dev marks C2/C3/C8. Final exact-head targeted local checks are running; no cland verification submitted before source review.

### rev-23 · 2026-10-20T17:15:39.642Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-999-source
commit: 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Generic layout owns four homes/occupants/windows; placement moves without duplicate, replacement retains other home, rendering/keys remain buffer-owned, native closes use side-specific repair. Eight palette/CLI placements, default behavior, additive QA kinds and PANELS-017 match this slice. Existing legacy test/case sources and protocol entries are unchanged. A-7760 retained local macOS logs establish 129 targeted passes including ui 9/9, shell 25/25 and all requested headless cases; C7/C10 verified. Direct tests are not load/duration or Linux/integrated receipts. Other runtime criteria await exact-head mode-free gate. Coordinator daf8922a explicitly defers full QA/C2,C3,C8 to E-789 after T-1002; no per-item brief required. Full audit A-7773. Reviewer ran no tests.

Criteria: C7 verified, C10 verified.

### impl-999 · 2026-10-20T17:16:05.729Z

Source review clear, no findings: rev-20261020-999-source at 2d8f5db4, artifact A-7773. Submitted mode-free verify 9a56dd9b-efd3-476e-b212-4d12a3e81643 at that exact clean/pushed head, reporting to Reviewer and Implementer in topic-753. Awaiting hub receipt; no T0–T2 suite pass claimed yet. Full after-stage QA remains with E-789 after T-1002.

### impl-999 · 2026-10-20T17:23:53.437Z

Mode-free verification 9a56dd9b-efd3-476e-b212-4d12a3e81643 returned exit 0 at reviewed head 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f: T0–T2, fallback selected all T2, 2068 tests passed, zero failures/cancellations/skips. Executor droplet c-8 lon1, Linux x64, Node v24.21.0, Neovim v0.12.5; lifetime 428 s, cost $0.0297. Duration/test-lint gates report-only (131 lint findings, one missing duration baseline); load gate five sequential repetitions/new test at 2 workers. Log A-7796. No T3 task gate claimed: requested macOS targeted T3 logs remain in A-7760; merge batches T1 only. Awaiting Reviewer final same-head verdict; E-789 stage QA deferred per Coordinator.

### rev-23 · 2026-10-20T17:24:15.939Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-999-final
commit: 2d8f5db4468bfa23b9f71fe84e3a11b53127dc7f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7796/run9a56dd9b audited at exact reviewed head: Linux T1/all-T2 fallback, 2068 ordinary tests / 328 files all pass, including panel6/6, shell-component56/56, palette-component13/13; each of six new panel identities has actual5/5 load passes. C1–C6/C9 runtime review established; C7/C8/C10 retain separately attributed source/local headless/UI/shell receipts A-7760/A-7773. All review criteria verified. This is not full QA: E-789 dev-stage QA after T-1002 still owns C2/C3/C8 under daf8922a. No T3/T4/integrated or QA gate claimed. Host37a4894f not repeated remotely; lint/budgets report-only. Lifetime428s/estimated$0.0297. Audit A-7800. Reviewer ran no tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified, C10 verified.
