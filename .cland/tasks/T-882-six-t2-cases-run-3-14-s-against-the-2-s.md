---
id: T-882
kind: task
title: Six T2 cases run 3–14 s against the 2 s T2 budget
state: open
status: review
size: M
criterion_seq: 1
labels:
  - needs-triage
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-617
branch: t/T-882-six-t2-cases-run-3-14-s-against-the-2-s
created: 2026-10-19T15:38:55.994Z
updated: 2026-10-19T16:59:15.810Z
---

## Summary

T-879's same-head receipt (A-6161, audited in A-6167) shows six T2 cases at 3 s or more against the 2 s T2 budget. The legacy gate only reports them today, but they would fail once T2 budgets enforce, and they are the slowest T2 tail. Found aside by rev-31 on 2026-10-19 while reviewing T-879.

## Cases

- nvim/test/thread.test.ts::generated live appends, ask evictions and delivery changes equal a full render 13.964 s > 2 s (T2)
- hub/test/crew.test.ts::non-table crew values are refused and cannot replace the last good staffing 6.085 s > 2 s (T2)
- nvim/test/inbox-sections.test.ts::waiting ages advance on the local clock with no inbox request or hub frame 5.606 s > 2 s (T2)
- hub/test/task-prefixes.test.ts::task publication lookup work stays bounded with two thousand unrelated items 4.351 s > 2 s (T2)
- hub/test/crew.test.ts::crew CLI and protocol validate changes, reload hand edits, and retain the last good policy with a notice 4.056 s > 2 s (T2)
- hub/test/hygiene.test.ts::a socket that misses two heartbeats is closed and the spoke reconnects with a fresh hello 3.076 s > 2 s (T2)

## Acceptance criteria

- [ ] C1. Each case listed in the body or in the Coordinator's added-cases comment runs within the 2 s T2 budget on the Mac and in a mode-free task verify, or moves to T3 under the tier-move rule with its assertions kept; the receipt shows no report-only budget line for any of them.
  - failed: rev-30 [reviewer] · 2026-10-19T16:57:55.087Z · note Revised Linux oracle is still 2.069071637 s > 2 s; the exact-head run also exits 1 on the separately tracked T-889 launcher repetition.

## Comments

### coord · 2026-10-19T15:58:37.917Z

Added case (rev-31's A-6188 receipt from T-786, 2026-10-19 15:58Z): nvim/test/verification-view.test.ts::verify summary opens the ordered queue and ages locally; palette and keys expose the view 6.311 s > 2 s (T2). C1 covers it as a listed case.

### impl-882 · 2026-10-19T16:05:53.865Z

Implemented all six original cases plus the Coordinator-added verification-view case at 3aa378a3afb8c62e26dc2634d5c619bc4419547b. Complete clocks remove real polling/aging waits; the 2,000-source fixture uses a real in-memory SQLite index; the generated thread oracle compares all fields inside Neovim and detaches redraw-only UI after readiness. No tier/budget/allowance/seed reductions. All seven owned cases pass below 2 s in serial Mac whole-file runs; typecheck and lint pass, five mutation probes prove oracle sensitivity. C1 awaits exact-head mode-free verify after source review.

### rev-30 · 2026-10-19T16:07:51.614Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-882-source
commit: 3aa378a3afb8c62e26dc2634d5c619bc4419547b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6192, no findings. All seven owned cases covered including Coordinator ec5a51b3 verification-view addition. Complete clocks retain real defaults; crew/heartbeat controls retain exact notices/state/reconnect assertions. 2000-source fixture retains inputs/lookup bound with memory index. Client age tests drive production timer callback via complete local clock. Thread oracle retains all fields, multiplicity, seeds/windows/renders/frames and positive final delivery; five mutation logs fail in expected comparison families. Raw A-6191 Mac case times all <2s; full-file counts/checks green. C1 final verification awaits exact-head mode-free receipt, every owned case <2s and no owned report-only budget line. T-883/tier/allowances unchanged; no Reviewer execution.

### rev-30 · 2026-10-19T16:26:13.787Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-882-runtime
commit: 3aa378a3afb8c62e26dc2634d5c619bc4419547b
scope: evidence
findings: [{"severity":"medium","text":"M1: Exact-head Linux A-6209 ordinary receipt line 51114 measures the owned 2,000-item publication case at 4.413960374 s, exceeding C1's 2 s limit; explicit report-only budget row remains at line 61802.","file":"hub/test/task-prefixes.test.ts"},{"severity":"medium","text":"M2: Exact-head Linux A-6209 ordinary receipt line 56755 measures the owned generated-render oracle at 3.137416765 s, exceeding C1's 2 s limit despite functional pass; omission from the capped summary does not establish the budget criterion.","file":"nvim/test/thread.test.ts"}]
finding_counts: {"high":0,"medium":2,"low":0}

Runtime not clear: A-6211, exact-head A-6209. Functional 1575/1575 and 495 groups 5/5, but two owned cases exceed 2 s. Other five owned cases meet the ordinary Linux bound. Revise retained paths and request fresh source review before another gate.

Criteria: C1 failed (Linux ordinary owned publication and render-oracle cases measure 4.414 s and 3.137 s against the required 2 s; functional green does not complete C1.).

### impl-882 · 2026-10-19T16:36:27.140Z

Revised head 30872a6bf010922ef32a78fd5cbf71bbfa6e6d61 addresses A-6209's 4.414 s publication and 3.137 s oracle overages. Real 2,000-item fixture now seeds unrelated rows through TrackerIndex; the oracle reuses a client/fresh threads and retains its Markdown corpus in the middle-day window. Added positive row-cardinality and per-comparison corpus guards, refreshed recordings, retained all prior assertions and live frame bursts. Serial Mac whole-file owned timings .281 / .741 s; check, tier lint, real recording contract, regression and mutation controls pass. A-6227 contains evidence. Three clock-case legacy allowances retired; unchanged oracle entry remains for T-888 as Coordinator directed. C1 still requires fresh actual ordinary Linux time <2 s. No dev merge after first source review; fresh fetch and clean merge-tree before push.

### rev-30 · 2026-10-19T16:38:10.096Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-882-source-revised
commit: 30872a6bf010922ef32a78fd5cbf71bbfa6e6d61
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Reworked source clear: A-6230, no findings. Real 2000-row publication/resolver bound remains sensitivity-tested; fresh per-seed threads retain frame/Markdown/comparator coverage with mutation controls. Semantic allowance delta only removes three obsolete entries, retaining oracle entry per Coordinator/T-888. C1 unverified until fresh exact-head ordinary Linux times for all seven <2s and no owned budget line; normal mode-free gate only.

### rev-30 · 2026-10-19T16:57:55.087Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-882-runtime-revised
commit: 30872a6bf010922ef32a78fd5cbf71bbfa6e6d61
scope: evidence
findings: [{"severity":"medium","text":"M3: A-6259:56614 ordinary generated-render oracle takes 2.069071637 s, exceeding C1's required 2 s. Its retained legacy allowance suppresses a budget row but does not satisfy the actual timing requirement.","file":"nvim/test/thread.test.ts"}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear: A-6261. Six owned timings meet 2 s, including publication 1.694158247 s; oracle remains 2.069071637 s. Ordinary 1575/1575, but launcher load repetition 3 failed (4/5), matching T-889. Retain assertions/mutation sensitivity and request source review of an owned correction before another verify; Coordinator owns shared-fix disposition. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6261-t-882-revised-runtime-assessment-at-30872a6b.md

Criteria: C1 failed (Revised Linux oracle is still 2.069071637 s > 2 s; the exact-head run also exits 1 on the separately tracked T-889 launcher repetition.).

### rev-30 · 2026-10-19T16:59:15.810Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-882-launcher-delta
commit: d706b685499860131706876a79ebcfb8a7d17775
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Shared-fix delta source clear only: A-6263. Seven launcher readiness lines match reviewed T-889 exactly, authorized by Coordinator 74ac3d98. No findings in this delta. C1 remains failed and M3 (owned oracle 2.069071637 s) from A-6261 remains unresolved; no verification at this intermediate head. Owned correction needs fresh source review before the replacement gate. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6263-t-882-shared-launcher-fix-delta-review-at-d706b685.md
