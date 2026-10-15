---
id: T-481
kind: task
title: executor-prepare test reads the executor-lease-released record before the journal publishes it (Linux)
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-432
topic: topic-283
branch: t/T-481-executor-prepare-test-reads-the-executor
created: 2026-10-15T09:14:01.095Z
updated: 2026-10-15T11:34:49.395Z
---

## Summary

`hub/test/executor-prepare.test.ts:165` ('prepare keeps its snapshot when builder deletion is unconfirmed, then the hub confirms release and cost') read `released.lifetimeMs` after the leases reached zero, but the `executor-lease-released` journal record was still undefined. This was a TypeError in T-461's Linux droplet run 2bef23b0 (A-2810), 2026-10-15. T-432 fixed this case's 422 and unconfirmed staging. What remains is ordering: zero leases is observed before the release record is flushed. Wait for the release record itself, after the journal's flushLogs barrier.

## Acceptance criteria

- [x] C1. The case waits for the published `executor-lease-released` record, with no read before it, and passes 5/5 beside a full run, with one droplet run green.
  - verified: rev-30 [reviewer] · run rev-20261015-481-final · 2026-10-15T11:34:27.385Z · commit 327b1ea0292d379169d61caa179aa19c2cab0636
  - done: impl-481 · 2026-10-15T11:34:49.394Z

## Comments

### impl-481 · 2026-10-15T09:21:14.390Z

Read task, E-482 and v0.1.3 spec. Fix scope: replace the single release-journal read with eventually polling after flushProjectLogs; retain lease/spend, resource deletion, lifetime and cost assertions with no timeout widening. Epic's 5/5 load validation remains separate QA evidence.

### impl-481 · 2026-10-15T09:29:20.906Z

Head 327b1ea0292d379169d61caa179aa19c2cab0636 committed/pushed after origin/dev merge. Typecheck passed. Full executor-prepare.test.ts passed 5/5 serially (17/17 tests each), all labelled loaded with queue evidence for impl-454's local full run 7a4f3460. Run 1 evidence A-2818; runs 2–5 raw evidence published in the item topic. Source review request is queued; Linux verify remains pending the clear source verdict, so C1 is not yet marked done.

### rev-30 · 2026-10-15T09:33:20.258Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-481-source
commit: 327b1ea0292d379169d61caa179aa19c2cab0636
scope: full

Source review clear; no high, medium or low findings.

Standards: no findings; existing eventually/flushProjectLogs pattern and explanatory ordering comment follow repo test guidance.
Spec: hub/test/executor-prepare.test.ts:164–168 now waits for the published executor-lease-released record, flushing before each read, before dereferencing lifetime/cost. Other assertions are unchanged. Production source confirms released lease state can precede the journal event.

Reviewed A-2818/A-2826: 5/5 serial loaded full-file passes, 17/17 each beside impl-454 local full run 7a4f3460. C1 remains unverified pending green same-head Linux droplet verification. Source verdict only.

### impl-481 · 2026-10-15T10:15:42.982Z

Linux 8cd787ee/A-2864 at reviewed 327b1ea0 passed all 17 executor-prepare cases, fixed release-publication case 6.484s. Overall red solely on known T-461 latch-count mismatch in claude-code-adapter.test.ts:389 (3 != 2), 1716 pass/1 fail/3 skips. Coordinator standing gate rule cb6eaf4c authorizes one same-head local merge gate with this positive Linux touched-file evidence. Submitted --executor local without source/head changes; C1/final verdict await accepted gate result.

### rev-30 · 2026-10-15T10:16:05.691Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-481-linux-gate
commit: 327b1ea0292d379169d61caa179aa19c2cab0636
scope: evidence

Evidence review not clear pending accepted green gate.

Medium — hub/test/claude-code-adapter.test.ts:389: Linux gate 8cd787ee / A-2864 fails the unchanged signed-out latch test, counting 3 CLI calls instead of 2 (`the latched watch makes no CLI calls`). Direct task.view T-461 confirms this exact known flake; no T-481 source defect is established.

Standards: no new source findings; source verdict rev-20261015-481-source stands.
Spec/evidence: touched executor-prepare.test.ts passes 17/17 on Linux; changed release-journal case passes in 6.484 s. A-2818/A-2826 establish five loaded file passes. Overall droplet remains red: 1716 pass, 1 fail, 3 platform skips, exit 1, exact reviewed/current head 327b1ea0292d379169d61caa179aa19c2cab0636.

Coordinator standing rule cb6eaf4c permits one unchanged-head local merge gate with this known-flake-only droplet run as Linux file evidence. Implementer is applying it. C1 remains unverified until that accepted green gate arrives; no new failed criterion mark for the unrelated T-461 defect.

### impl-481 · 2026-10-15T11:06:06.355Z

Replacement human gate rule e6264b46 (ask 9183a54c) applied: local 53242041 cancelled while queued (A-2914; no tests executed). Submitted one default-droplet retry 161a261d-8463-4b96-bbee-853049fc9bd2 at unchanged clean reviewed 327b1ea0. First Linux A-2864 touched file 17/17 green; sole failure known T-461. Final verdict awaits retry per new two-Linux-receipt rule.

### impl-481 · 2026-10-15T11:34:07.928Z

Second same-head Linux 161a261d/A-2939: touched executor-prepare file again 17/17 green, repaired release case 6.024s. Sole outside failure differs from first Linux: exact T-447 unconfirmed-inject retry timeout at claude-code-adapter.test.ts:251. First 8cd787ee/A-2864 had only known T-461 latch count mismatch. Both overall reds preserved (1716 pass/1 fail/3 skips each); source unchanged at reviewed 327b1ea0. Submitted both receipts and 5/5 loaded evidence A-2818/A-2826 to rev-30 for final gate/C1 settlement under human decision e6264b46. No mixed nvim diff, no extra run planned.

### rev-30 · 2026-10-15T11:34:27.385Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-481-final
commit: 327b1ea0292d379169d61caa179aa19c2cab0636
scope: evidence

Final evidence review clear under replacement human gate rule e6264b46 (ask 9183a54c). No unresolved T-481 source finding. Reviewed/current head remains 327b1ea0292d379169d61caa179aa19c2cab0636.

Standards: source verdict rev-20261015-481-source stands, no findings.
Spec: C1 verified with the explicit rule's accepted gate disposition. Source waits for the flushed release journal record before field assertions. A-2818/A-2826 provide 5/5 serial loaded file passes, 17/17 each beside impl-454's full local run.

First Linux 8cd787ee/A-2864: executor-prepare 17/17 green, fixed case 6.484 s; sole failure known T-461 signed-out latch at Claude :389 (3 vs 2). Second Linux 161a261d/A-2939: executor-prepare again 17/17, fixed case 6.024 s; sole failure is the different unconfirmed-inject retry case at Claude :251 (`the clause injected on the retry: not within 15000 ms`), confirmed by task.view T-447. Both exact heads match source. Both receipts remain red overall: 1716 pass/1 fail/3 platform skips, exit 1; Linux x64 c-8. The human rule accepts this pair with different known outside failures and green touched files as the gate, rather than claiming either full suite passed. Neovim smoke not reached; no nvim diff, so mixed-diff addition does not apply.

Local 53242041/A-2914 cancelled while queued, no tests/evidence. No further tests started. C1 done remains the claimant's mark.

Criteria: C1 verified.
