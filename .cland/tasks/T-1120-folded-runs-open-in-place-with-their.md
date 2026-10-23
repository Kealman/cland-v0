---
id: T-1120
kind: task
title: Folded runs open in place with their anchor
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1119
topic: topic-879
branch: t/T-1120-folded-runs-open-in-place-with-their
created: 2026-10-22T15:16:13.033Z
updated: 2026-10-23T00:18:42.957Z
closed: 2026-10-23T00:18:42.957Z
---

## Summary

A run of agent-to-agent messages shows as the hub's fold line and opens in place, never in the drawer, with its anchor line kept; asks, verdicts, answers and anything to or from the human never fold.

## Parent

E-417 (§3.4 folded runs; v0.1 §3.14 folds; P13; choice "Long runs"; tracer step 1).

## What to build

The thread folds the runs the hub reports (T-1056): one quiet row carrying the hub's fold line built from facts (who, how many messages, the latest step, the age), replaced by the run's id on every message delta. Enter, a click or `za` on the row opens the run in place: the fold line stays as the run's anchor at the position the human saw it, and while the run is open the anchor stays pinned at the top of the thread as the human scrolls through it. The same keys close it back to one row. Which messages belong to a run is the hub's decision; the web never folds an ask, a verdict, an answer or a message to or from the human or an Aide. A run growing while open shows the new message in place; a closed run's line updates from the hub's facts.

## Acceptance criteria

- [x] C1. A run shows as the hub's fold line, and Enter, a click or `za` opens it in place with the anchor line at the position it had (Web test).
  - done: impl-1120 · 2026-10-22T23:50:06.584Z
  - verified: rev-32 [reviewer] · run rev-20261023-1120-final · 2026-10-23T00:02:05.612Z · commit b252be17a36399d88b51a96645ebf143b3683111
  - verified: rev-32 [reviewer] · run rev-20261023-1120-final-2 · 2026-10-23T00:15:41.051Z · commit 2e6f7b427adb0222c9183ffbe984c1c7f7a296a8
- [x] C2. While a run is open its anchor line stays pinned at the top of the thread, and the same keys close it back to one row (Web test).
  - done: impl-1120 · 2026-10-22T23:50:06.670Z
  - verified: rev-32 [reviewer] · run rev-20261023-1120-final · 2026-10-23T00:02:05.612Z · commit b252be17a36399d88b51a96645ebf143b3683111
  - verified: rev-32 [reviewer] · run rev-20261023-1120-final-2 · 2026-10-23T00:15:41.051Z · commit 2e6f7b427adb0222c9183ffbe984c1c7f7a296a8
- [x] C3. An ask, a verdict, an answer and a message to the human between agent messages stay unfolded, and a new message in a run updates its fold line from the hub (Web test).
  - done: impl-1120 · 2026-10-22T23:50:06.757Z
  - verified: rev-32 [reviewer] · run rev-20261023-1120-final · 2026-10-23T00:02:05.612Z · commit b252be17a36399d88b51a96645ebf143b3683111
  - verified: rev-32 [reviewer] · run rev-20261023-1120-final-2 · 2026-10-23T00:15:41.051Z · commit 2e6f7b427adb0222c9183ffbe984c1c7f7a296a8

## Comments

### impl-1120 · 2026-10-22T23:48:24.508Z

TDD on local Darwin arm64 working tree: C1 initially failed on absent data-run-anchor; C2 initially failed its pinned geometry boundary. All run tests now pass targeted. Additional targeted regressions exposed and fixed native item-link Enter interception, open-run prepend anchoring, and a no-scroll toggle failing to reschedule read marks (actual red: 'visible open-run read frame: not within 3000 ms'). Run membership and fold-line text stay hub-owned. No configured suite run yet; preparing source review.

### rev-32 · 2026-10-22T23:51:51.510Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1120-source
commit: b252be17a36399d88b51a96645ebf143b3683111
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear A-9585 against parent24a7220c; no Standards or Spec findings. Hub-owned runId/foldLine grouping, inline click/Enter/physical za, stable sticky anchor and collapse focus, real-message prepend anchoring, protected standalone traffic and same-id live closed/open growth match C1–C3. Read presentation changes reschedule visible marks; closed anchor names last loaded member and open rows retain offscreen exclusion. Shared dispatcher keeps native link/button Enter; keymap/help/palette and matching docs/tests updated. Five new Web cases use sealed shared Headless Shell fixtures and explicit bounded DOM/frame/peer receipts; no reviewer tests/browser. A-9579 local macOS check/keymap/targeted evidence supplemental, not configured/Linux pass. C1–C3 remain run-dependent and await fresh same-head mode-free verification.

### rev-32 · 2026-10-23T00:02:05.612Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1120-final
commit: b252be17a36399d88b51a96645ebf143b3683111
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear A-9618 at unchanged b252be17. A-9616/run538cf60d: Linux x64 c-8 lon1 droplet, T1/all-T2 hub+Neovim/Web exit0, aggregate2545 pass/zero fail/cancel/skip/todo. All five new run Web cases pass (actual3.164/1.760/1.167/1.514/1.232s, all<4s new-identity allowance trigger); no allowance edit required. C1 verbatim fold text/inline physical toggles/anchor, C2 sticky geometry/collapse/focus, C3 protected traffic and real closed/open delta growth established; paged prepend/read mark/native link/help/palette regressions pass. T1 resolver and configured area-slots also pass. Host check/typecheck gate reused, not remotely repeated. Generic budgets/lint/ratchet report-only; actual Web phase59.424s>40s report budget, no timing-budget pass claim. No configured T3/T4 or per-item QA. No remaining findings; source A-9585 retained.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-32 · 2026-10-23T00:04:12.668Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1120-delta
commit: 2e6f7b427adb0222c9183ffbe984c1c7f7a296a8
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear A-9625 after Coordinator-authorized dev merge. All8 own-only and25 incoming-only paths preserve exact parent blobs. Shared docs/manifest retain both additions; keyboard.ts keeps unchanged thread and Sessions native-Enter guards with disjoint context predicates plus thread-leader prefix dispatch. Renderer/CSS/read-mark logic, Topics forwarding, physical key map and run Web tests unchanged; incoming Sessions integration retained. No Standards/Spec findings. C1–C3 remain run-dependent; require fresh exact-head mode-free receipt. A-9624 reported local Darwin root check/46 targeted passes supplemental, parent Linux A-9616 historical only. No reviewer execution.

### rev-32 · 2026-10-23T00:15:41.051Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1120-final-2
commit: 2e6f7b427adb0222c9183ffbe984c1c7f7a296a8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final clear A-9645 carrying delta A-9625. Fresh A-9642/runab5c2e17: Linux x64 c-8 lon1 droplet, T1/all-T2 hub+Neovim/Web exit0, aggregate2565 pass/zero fail/cancel/skip/todo. All five run Web cases pass3.583/1.952/1.159/1.514/1.001s (below4s allowance trigger); resolver, area-slots, key-contexts, palette and Sessions-actions files pass. C1–C3 verified for hub fold/inline keys/anchor, sticky collapse and protected/live growth, plus paging/read/native Enter integration. Host check/typecheck reused, not remotely repeated. Generic lint/duration/ratchet report-only; measured Web wall64.608s>40s report budget, no timing-budget pass claim. No configured T3/T4/per-item QA. No remaining findings. Claimant's dev conflict projection is separate from runtime evidence; verdict covers unchanged2e6f7b42.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-23T00:18:42.957Z

Merged 535012cf64240ce5c07fac3ade93ffed57f66faa onto dev.
