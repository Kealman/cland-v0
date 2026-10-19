---
id: T-905
kind: task
title: The hub warns when it runs below normal priority (nice > 0)
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: topic-646
branch: t/T-905-the-hub-warns-when-it-runs-below-normal
created: 2026-10-19T19:41:14.642Z
updated: 2026-10-19T21:41:05.184Z
closed: 2026-10-19T21:41:05.184Z
---

## Summary

A hub started from a background shell job inherits zsh's BG_NICE (nice 5). On 2026-10-19 hub pid 14662 ran at nice 5 after restart #20 (direct serve inside `zsh -ic` with `&`). Under crew load 51 it stopped answering `hub status` and MCP calls for about 5 minutes (19:34–19:39Z). Lowering niceness on a live pid needs root.

## Acceptance criteria

- [x] C1. (T1) At start the hub reads its own niceness. When it is above 0 it logs a warning and shows it in `cland hub status` and `cland doctor`, naming the cause (for example BG_NICE) and how to restart at nice 0. A test injects the niceness probe.
  - verified: rev-30 [reviewer] · run rev-20261019-905-final · 2026-10-19T20:41:09.516Z · commit 7203f32210aea95437019aec099c3ac9c12663c4
  - verified: rev-30 [reviewer] · run rev-20261019-905-liveness-integration-final · 2026-10-19T21:32:31.639Z · commit 4944530b9838ac3ca277df0a1eb97929c0495a77
  - done: impl-905b · 2026-10-19T21:36:44.358Z

## Comments

### impl-905b · 2026-10-19T20:28:55.829Z

Implementation uses node:os getPriority(0) behind an injected priorityProbe at serveProject startup. One shared warning carries cause and restart guidance through structured logging, hub.status, hub status text/JSON and doctor. Validation: T1 probe policy and T2 projectHub fixture; no live hub restart.

### rev-30 · 2026-10-19T20:30:58.354Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-905-source
commit: 7203f32210aea95437019aec099c3ac9c12663c4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-6637. Single injected/default getPriority(0) observation warns only for positive niceness, logs at startup and propagates cached warning to status and doctor text/JSON; names BG_NICE and nice0 foreground restart. No priority mutation or child process. Probe failures leave unknown without blocking startup. T1 policy and FakeClock/in-process T2 public-report controls preserve deterministic boundaries, optional protocol field backward compatible. C1 awaits exact-head mode-free runtime/five-repetition evidence with no owned budget/resource mismatch. QA none.

### impl-905b · 2026-10-19T20:40:35.611Z

Exact reviewed-head verification 58d79f51-8d0d-431c-9c7f-63cc4fbdce77 at 7203f322 passed: 1754/1754, zero failures/skips; log A-6662. Each of the three new identities passed 5/5 load repetitions. Owned test times: T1 0.00124 s and 0.00081 s; T2 0.15470 s, within tier budgets. Linux droplet c-8 lon1, lifetime 496 s, cost $0.0345. Awaiting Reviewer final evidence verdict; no source changes since review.

### rev-30 · 2026-10-19T20:41:09.516Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-905-final
commit: 7203f32210aea95437019aec099c3ac9c12663c4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6664. Independently audited A-6662/58d79f51: 1754/1754, zero fail/cancel/skip/TODO, all 164 load groups 5/5, zero tier/resource mismatch or owned overrun. Both T1 probe controls and the startup/public-status/doctor T2 control pass ordinary+five repetitions; maxima .002036880 s and .215237548 s respectively. Source A-6637 plus current receipt settle C1. Covered report-only accounting/admission rows follow Coordinator 798ff31d. No Reviewer tests or native priority mutation/restart claim; QA none.

Criteria: C1 verified.

### impl-905b · 2026-10-19T21:14:36.914Z

Coordinator-requested one-time origin/dev merge committed/pushed at 4944530b. CLI source auto-merged preserving both T-905 priority warnings and T-906 serving/full-status behaviour; resolved sole manifest conflict by retaining both T2 entries. Typecheck, tier manifest and targeted priority (2+1), hub-status (3), doctor (18) tests pass. Requesting delta source review before new mode-free verify.

### rev-30 · 2026-10-19T21:15:06.386Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-905-liveness-integration-source
commit: 4944530b9838ac3ca277df0a1eb97929c0495a77
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear, A-6713. Direct Coordinator merge authorization read. Independent comparison confirms all9 owned patches identical to prior clear/final head against new dev. Manifest retains priority+status entries; CLI preserves T-906 lightweight liveness/full-status fallback and T-905 warning on successful full-status output. Startup/cache/log/doctor policy unchanged. A-6712 targeted checks reported green as prose, not raw execution audit. C1 requires fresh exact-head mode-free green; prior A-6664 historical. QA none; no Reviewer tests or hub actions.

### impl-905b · 2026-10-19T21:29:43.679Z

Fresh exact-head verification 01b65b74-225e-45e2-959c-e089037562e5 at merged/reviewed 4944530b passed 1893/1893, no failures/skips. A-6728 contains all three owned priority identities passing 5/5 load repetitions; ordinary T1 times .001269/.000792 s, T2 .155055 s. Linux droplet c-8 lon1, lifetime 830 s, cost $0.0577. Awaiting Reviewer final evidence verdict before the requested ready transition. No source changes since delta review.

### rev-30 · 2026-10-19T21:32:31.639Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-905-liveness-integration-final
commit: 4944530b9838ac3ca277df0a1eb97929c0495a77
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6729. Independently audited A-6728/01b65b74 at reviewed merged head: 1893/1893, zero fail/cancel/skip/TODO, all 302 load groups 5/5, zero tier/resource mismatch or owned overrun. Both T1 priority controls and T2 startup log/status/doctor control pass ordinary plus five repetitions; maxima .002543777 s and .167858338 s respectively. All three inherited liveness controls also pass ordinary plus five repetitions. Source A-6713 plus current receipt settle C1. Covered report-only rows follow Coordinator guidance. No Reviewer tests, native priority mutation or hub restart claim; QA none.

Criteria: C1 verified.

### coord · 2026-10-19T21:41:05.184Z

Merged 2e3b4f8cf929e2e7ef1ace60e94947753acdf9ac onto dev.
