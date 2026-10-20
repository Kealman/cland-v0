---
id: T-561
kind: task
title: A verify that fell back to local keeps waiting for the local slot after remote slots free up
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - bug
  - hub
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-732
branch: t/T-561-a-verify-that-fell-back-to-local-keeps
created: 2026-10-16T01:25:55.841Z
updated: 2026-10-20T11:03:01.175Z
closed: 2026-10-20T11:03:01.175Z
---

## Summary
On 2026-10-16 at about 01:24Z, `cland verify queue` showed T-523's and T-548's verifies as waiters 1 and 2, each waiting about 1,780 s. Both had been answered "remote budget full; running locally" at submission (00:11Z and 01:02Z). The local slot was held by T-488's suite from 01:04Z, while 3 of 6 remote slots were free. A no-flag verify that falls back to local at admission stays bound to the local slot for its whole wait, so free droplets sit idle while task verifies queue behind one Mac suite. The workaround was to cancel the waiter and resubmit with `--executor droplet --fresh`.

## Acceptance criteria
- [x] C1. A no-flag verify waiting for the local slot is re-evaluated when a remote slot frees and moves to the droplet, keeping its queue order and reporting the change. An explicit `--executor local` stays local.
  - done: impl-561 · 2026-10-20T10:22:41.812Z
  - verified: rev-26 [reviewer] · run rev-20261020-561-final-1 · 2026-10-20T10:30:16.018Z · commit 335ff737ca60c619a7d8539207419a34cab1d310
  - verified: rev-26 [reviewer] · run rev-20261020-561-final-2 · 2026-10-20T10:48:24.531Z · commit fbaff1f7cc8627a4897f89c8662959ef67c01eca
  - verified: rev-26 [reviewer] · run rev-20261020-561-final-3 · 2026-10-20T10:58:12.660Z · commit b4a18abd3506f1b3a7932e45c3abfb885b7b6ba1
- [x] C2. A test fills the remote budget, submits a no-flag verify (local fallback, waiting behind a local holder), then frees one remote slot, and sees the verify admitted remotely.
  - done: impl-561 · 2026-10-20T10:22:42.709Z
  - verified: rev-26 [reviewer] · run rev-20261020-561-source-2 · 2026-10-20T10:23:08.091Z · commit 335ff737ca60c619a7d8539207419a34cab1d310
  - verified: rev-26 [reviewer] · run rev-20261020-561-final-1 · 2026-10-20T10:30:16.018Z · commit 335ff737ca60c619a7d8539207419a34cab1d310
  - verified: rev-26 [reviewer] · run rev-20261020-561-source-3 · 2026-10-20T10:40:22.650Z · commit fbaff1f7cc8627a4897f89c8662959ef67c01eca
  - verified: rev-26 [reviewer] · run rev-20261020-561-final-2 · 2026-10-20T10:48:24.531Z · commit fbaff1f7cc8627a4897f89c8662959ef67c01eca
  - verified: rev-26 [reviewer] · run rev-20261020-561-source-4 · 2026-10-20T10:50:16.723Z · commit b4a18abd3506f1b3a7932e45c3abfb885b7b6ba1
  - verified: rev-26 [reviewer] · run rev-20261020-561-final-3 · 2026-10-20T10:58:12.660Z · commit b4a18abd3506f1b3a7932e45c3abfb885b7b6ba1

## Comments

### impl-561 · 2026-10-20T10:13:51.379Z

Reproduced with targeted T2 real lease-budget test (scripted provider/worker). With local held and a preparation lease filling remote_budget=1, the no-flag verify records local fallback; after scheduler restart and confirmed lease release it still has executor local. Actual assertion: 'local' !== 'droplet' (a freed remote slot must reclaim the earlier local fallback). No full verification receipt yet.

### rev-26 · 2026-10-20T10:21:07.208Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-561-source-1
commit: 088f1e0db6e9655b0b9eacd72a1a17ba35c44c5a
scope: full
findings: [{"severity":"medium","text":"Project Implementer and QA overrides (also line179) still omit the reclaim policy added to built-in clauses. Rule16 requires both delivered project copies to match.","file":".cland/roles.toml","line":110},{"severity":"medium","text":"Reclaimed executor/fallback state is saved before the one-shot notice callback, without a pending announcement checkpoint. Callback failure or restart after the save permanently loses the required move notice. Persist and retry publication idempotently through recovery; cover failed first callback/reopen.","file":"hub/src/hub/suites.ts","line":990},{"severity":"medium","text":"Admission's two-second deadline starts before lease release completes, so setup/release latency consumes the downstream budget (rule9). Arm observation before the trigger, observe confirmed release separately, then start the bounded admission wait; retain pre-release concurrency assertions.","file":"hub/test/suite-accounting.test.ts","line":48}]
finding_counts: {"high":0,"medium":3,"low":0}

Standards: medium M1 project Implementer/QA clause copies missing (rule16); medium M3 admission wait includes lease release/setup (rule9). Spec: medium M2 reclaim is saved before a one-shot announcement without durable retry, so restart/callback failure can lose the required notice. Main queued-budget/order/explicit-local/worker-policy paths otherwise checked. A-7410 original red and exact-head targeted12+14 passes retained, A-7411 sealed launcher checked; no suite or Reviewer execution claimed. Corrected head needs source re-review before verification.

Criteria: C1 failed (Project clause overrides omit reclaim behavior and reclaim notices lack persisted retry/recovery after publication failure.), C2 failed (Regression starts downstream admission deadline before confirmed lease-release completion, violating rule9's separate boundaries.).

### rev-26 · 2026-10-20T10:23:08.091Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-561-source-2
commit: 335ff737ca60c619a7d8539207419a34cab1d310
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: M1 both project clause copies now match; M3 observer is armed pre-release but downstream admission deadline starts only after confirmed release. Spec: M2 remoteReclaimPending persists with the move, retries stable-id publication through inspection/restart, and clears only after callback/journal success. Failed-callback/reopen regression and committed-no-repeat assertions checked; queue order, explicit-local and workers remain covered. A-7425 raw red and A-7431/A-7433 corrected local accounting 13/13 + remote-budget 14/14 checked, no suite/duration gate claimed. C2 source verified; C1/final execution stays pending mode-free task receipt at 335ff737. Reviewer ran no tests.

Criteria: C2 verified.

### impl-561 · 2026-10-20T10:29:52.067Z

Same-head verification d53dbbac-c390-4dbe-b579-a813b1e808c8 passed at 335ff737ca60c619a7d8539207419a34cab1d310. Linux x64 droplet c-8 lon1, Node v24.21.0 / Neovim v0.12.5; T0–T2, 1971 passed, 0 failed/cancelled/skipped. Task selection fell back to all T2; T3 absent (periodic dev/integrated occasions). Lint/duration gates report-only; two missing baselines reported. Actual droplet lifetime 343 s, cost $0.0238. Durable suite log A-7455. Reviewer received the same-head result directly; final evidence verdict pending.

### rev-26 · 2026-10-20T10:30:16.018Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-561-final-1
commit: 335ff737ca60c619a7d8539207419a34cab1d310
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no finding. A-7455 accepted exact-head task gate passed host check and T0–T2; existing lint/budgets/ratchet report-only, unrelated missing baselines disclosed. Own accounting base 13/13, all below 2 s. Spec: run d53dbbac at 335ff737 passed 1971/1971, no failures/skips/cancellations. Actual live/restart/failed-notice-restart base cases and 5/5 repetitions each checked; maximum repetition .433399 s. Tests exercise durable budget with scripted provider/worker I/O, retaining queue order, explicit-local and publication recovery checks. Linux c-8 lon1, two workers, lifetime 343 s/$0.0238; Neovim T2 included, T3 deferred/not claimed. C1/C2 verified. Reviewer ran no tests or edits.

Criteria: C1 verified, C2 verified.

### rev-26 · 2026-10-20T10:40:22.650Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-561-source-3
commit: fbaff1f7cc8627a4897f89c8662959ef67c01eca
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Coordinator-authorized dev merge and compact clause repair checked; both built-in/project Implementer and QA copies retain executor ownership and explicit-local rules. QA epic command/preconditions/ownership/slot rules remain, with detailed caps/shards/evidence in existing docs. Reserve guard unchanged; retained local roles-clauses 27/27 and requested native roles 4/4, default QA 7383/7680 bytes (297 reserve headroom), A-7490–A-7494. Spec: no findings. Scheduler, dispatch, protocol and accounting/remote-budget regressions are byte-identical to 335ff737; C2 source renewed. A-7496 has the audit. C1/final execution awaits a new accepted mode-free task receipt at fbaff1f7; old A-7455 is not new-head evidence. Reviewer ran no tests or edits.

Criteria: C2 verified.

### impl-561 · 2026-10-20T10:47:32.582Z

Fresh same-head mode-free verification ca5b3b21-b35a-4216-87ae-66a616530198 passed at fbaff1f7cc8627a4897f89c8662959ef67c01eca. Linux x64 droplet c-8 lon1, Node v24.21.0 / Neovim v0.12.5; T0–T2, 2011 passed, 0 failed/cancelled/skipped. Task fallback ran all T2; T3 absent (periodic dev/integrated occasions). Lint/duration gates report-only; five missing baselines reported. Actual droplet lifetime 375 s, cost $0.0260. Durable log A-7511. Reviewer received same-head result directly; final evidence verdict pending.

### rev-26 · 2026-10-20T10:48:24.531Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-561-final-2
commit: fbaff1f7cc8627a4897f89c8662959ef67c01eca
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. A-7511 exact-head accepted task receipt passes host check and T0–T2 fallback; 27 clause T1 base identities pass, including both QA reserve guards. Own accounting 13/13 base cases fit the 2 s T2 budget (max 1.965951 s). Existing lint/budgets/ratchet report-only, five missing baselines and incomplete T3 timing basis disclosed. Spec: run ca5b3b21 at fbaff1f7 exits 0, 2011/2011 passed, no fail/skip/cancel. Live/restart/failed-notice-restart reclaim cases execute and each has five passing repetitions; maximum repetition .404410 s. Linux c-8 lon1, two workers, lifetime 375 s/$0.0260; Neovim T2 included, T3 deferred/not claimed. A-7512 contains the final audit; C1/C2 verified. Prior A-7455 covers only old 335ff737. Reviewer ran no tests or edits.

Criteria: C1 verified, C2 verified.

### rev-26 · 2026-10-20T10:50:16.724Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-561-source-4
commit: b4a18abd3506f1b3a7932e45c3abfb885b7b6ba1
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Coordinator 88d40e7d authorizes dev merge; sole manual skill metadata conflict retains every parent entry, including T-561/T-959, with dictionary-guard instruction and fallback paragraph intact. Imported own-property dispatch/protocol checks retain reclaim handling. Spec: scheduler/accounting regression and both role-clause sources are byte-identical to fbaff1f7; eligibility/order/explicit-local/publication recovery retained. C2 source renewed. A-7516–A-7518 preserve current-head local clauses 27/27, typecheck/provenance lint exit 0 and default QA 7383/7680 (297 reserve headroom). A-7522 records audit. C1/final pending a fresh accepted mode-free receipt at b4a18abd; prior A-7511 is stale for this changed head. Reviewer ran no tests or edits.

Criteria: C2 verified.

### impl-561 · 2026-10-20T10:57:36.182Z

Same-head mode-free verify cf6d8764-d44d-4d57-be91-a5011b855de7 passed at b4a18abd3506f1b3a7932e45c3abfb885b7b6ba1. Linux x64 droplet c-8 lon1, Node v24.21.0 / Neovim v0.12.5; T0–T2 including Neovim, 2013 passed, 0 failed/cancelled/skipped. Task fallback ran all T2; T3 absent. Lint/duration diagnostics remain report-only: six missing baselines and suite-accounting duration regression 2.572 s → 3.983 s reported. Actual droplet lifetime 378 s, cost $0.0262. Durable log A-7532; Reviewer received this same-head result directly.

### rev-26 · 2026-10-20T10:58:12.660Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-561-final-3
commit: b4a18abd3506f1b3a7932e45c3abfb885b7b6ba1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. A-7532 pins reviewed head and host check; enforcing dictionary/static guards green, existing test lint/budgets/ratchet report-only. Six missing baselines/incomplete T3 timing basis disclosed. Clause T1 27/27 pass; accounting 13/13, existing 50-acquirer case 2.098442 s fits retained 2.792889 s allowance. Own new cases all <2 s. Spec: accepted cf6d8764 at b4a18abd exits 0, 2013/2013 passed, no fail/skip/cancel. Live/restart/failed-notice-restart reclaim cases and five repetitions each pass (max .384912 s), preserving queue/local/publication assertions. Linux c-8 lon1, two workers, lifetime 378 s/$0.0262; T1/all T2 fallback includes Neovim, T3 deferred/not claimed. C1/C2 verified. A-7533 records audit. Reviewer ran no tests or edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T11:03:01.175Z

Merged 224d45cc6101ef93ecb375b1309da0a99d4c090c onto dev.
