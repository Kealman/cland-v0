---
id: T-794
kind: task
title: Retire the legacy ~/.cland spend ledger write-through once every project hub runs the new state directory
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-952
blocked_by: []
topic: topic-733
branch: t/T-794-retire-the-legacy-cland-spend-ledger
created: 2026-10-18T09:36:59.772Z
updated: 2026-10-20T10:53:30.724Z
closed: 2026-10-20T10:53:30.724Z
---

## Summary

T-609 moves the droplet spend ledger out of ~/.cland into the new user state directory. While the legacy file exists, every mutation writes through to it first, so that an old hub of another project on the same machine still respects the shared cap (coord's disposition, 2026-10-18 09:35Z). Once every hub this user runs is on the new code, the write-through and the legacy file can go.

## Acceptance criteria

- [x] C1. A documented, checkable condition decides when the legacy ledger can be retired, for example no hub of an older version registered for this user. The retirement refuses while that condition does not hold.
  - done: impl-794 · 2026-10-20T10:23:53.031Z
  - verified: rev-23 [reviewer] · run rev-20261020-794-final · 2026-10-20T10:34:09.098Z · commit b936df802e1dfa1584d0a7b5f1f9682c52bc0d11
  - verified: rev-23 [reviewer] · run rev-20261020-794-merge-final · 2026-10-20T10:49:10.857Z · commit d5b7695f8983222de7c75185132d82f340d43524
- [x] C2. Retirement removes the write-through, leaves the legacy file's bytes in place (never moved or deleted) and records a durable snapshot/receipt beside the new ledger; a T1 test shows the cap still holds afterwards.
  - done: impl-794 · 2026-10-20T10:18:26.579Z
  - verified: rev-23 [reviewer] · run rev-20261020-794-final · 2026-10-20T10:34:09.098Z · commit b936df802e1dfa1584d0a7b5f1f9682c52bc0d11
  - verified: rev-23 [reviewer] · run rev-20261020-794-merge-final · 2026-10-20T10:49:10.857Z · commit d5b7695f8983222de7c75185132d82f340d43524

## Comments

### impl-794 · 2026-10-20T10:18:02.541Z

Implemented explicit executor retire-legacy --confirm-registered-hubs. Coordinator clarified C2 (375038cc): retain legacy bytes in place and record a durable snapshot/receipt beside primary ledger. Compatibility requires live authenticated executor.status reporting the exact primary path from every project in either ledger; operator flag covers never-registered hubs, and downgrade limits are documented. Added T1 refusal/archive/cap/interrupted-activation/alias coverage and T2 authenticated socket + CLI/authorization coverage. Source merged with freshly fetched origin/dev before first review; preparing review head cdc5c84d.

### rev-23 · 2026-10-20T10:21:52.900Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-794-source
commit: cdc5c84d46d1367b88a66c7b7ebe2e1589678f06
scope: full
findings: [{"severity":"medium","text":"Matching the new spend path does not prove that a registered hub honors legacyRetired. Pre-T-794 state-directory code already reports that path, passes this probe, then its next locked() reconciles the retained legacy file into a fresh Ledger without the marker and resumes write-through. Require an authenticated live retirement-marker capability as well as the path, and reject a same-path/non-capable hub before activation.","file":"hub/src/executor/droplet/spend.ts","line":122}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: 0 independent findings. Spec: 1 medium finding at spend.ts:122 (A-7424 references adjacent refusal line124). Path equality accepts a pre-T-794 state-directory hub, whose existing locked()/reconcile() code drops legacyRetired and resumes retained-file write-through on its next mutation. This is not a never-registered hub or later downgrade. Require a live authenticated retirement-marker capability plus path and a same-path/non-capable refusal regression, updating the operational condition. Current-code locking, durable receipt-before-activation, legacy-byte retention, cap, interruption and permission tests otherwise reviewed; local targeted A-7408 is not a normal gate. C1 failed; C2 unverified. No Reviewer tests or real ledger inspection. Fresh corrected source review before verification.

Criteria: C1 failed (Same-path registered hubs can lack retirement-marker support and undo activation on their next ledger mutation.).

### impl-794 · 2026-10-20T10:23:54.317Z

Corrected source at b936df802e1dfa1584d0a7b5f1f9682c52bc0d11 requires authenticated live spend.legacyRetirement=1 plus exact primary path, rejecting existing same-path hubs without marker support. A-7440 records targeted local macOS T1 15/15, T2 2/2 and npm run check exit 0 on this source tree; lint report-only with 0 refusals. New pushed head requested source review; no post-review dev merge, no task verify yet.

### rev-23 · 2026-10-20T10:24:38.719Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-794-source-corrected
commit: b936df802e1dfa1584d0a7b5f1f9682c52bc0d11
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no remaining findings. A-7424 resolved: live authenticated status must report exact shared path AND numeric spend.legacyRetirement=1, whose advertised contract preserves marker and suppresses old reads/write-through. T1 same-path/non-capable refusal and actual socket T2 capability-stripped response both reject before retirement snapshot/activation; restored capable response succeeds. Receipt records capability. Existing durability, original-byte retention, interruption, alias, restart cap and authorization assertions retained; docs/help/Coordinator clauses reconciled. A-7444 covers corrected source, consumer search and evidence limits. A-7440 local Mac targeted T1 15/15, T2 2/2/check exit0, test lint report-only, is not a task gate. C1 source failure resolved; C1/C2 await normal exact-head runtime/final evidence. No post-review dev merge or Reviewer execution.

### rev-23 · 2026-10-20T10:34:09.098Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-794-final
commit: b936df802e1dfa1584d0a7b5f1f9682c52bc0d11
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no remaining findings. Spec: no remaining findings. Exact unchanged source-clear head matches green mode-free f5f9c841/A-7462: independently counted 1974 ordinary tests/318 files pass, no other outcomes. Actual T1/all-T2 hub+Neovim; host check5a25eb00 not repeated remotely. All15 spend+2 socket/CLI cases pass; four new T1 and two new T2 retirement identities each pass5/5 distinct load repetitions. C1 verified by live marker capability+exact path and same-path/non-capable refusal; C2 by snapshot-before-marker, retained bytes, interrupted activation/retry and cap/restart assertions. Prior A-7424 finding corrected before run. Lint/missing baseline/budget/ratchet and observed timing regressions report-only; T3/T4 deferred, no integration or real-user retirement claim. A-7471 has platform/executor and operator-limit details.

Criteria: C1 verified, C2 verified.

### rev-23 · 2026-10-20T10:38:45.045Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-794-merge-source
commit: d5b7695f8983222de7c75185132d82f340d43524
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no findings. Coordinator-authorized integration and three-file clause correction reviewed against prior b936df80 and incoming dev13e652a7. Default/project Coordinator clauses retain executor catalog including retire-legacy and point to README; README still explicitly contains re-prepare/tag checks plus full capability/path/confirmation/durability/retained-byte requirements. Updated T1 wording pin retains byte reserve and other policy assertions. Production retirement transaction/protocol/CLI behavior unchanged in compared files. A-7480 local Mac targeted27/27 T1 and4/4 role checks is functional evidence, not new-head task/Linux/timing-budget proof. A-7488 details scope. C1/C2 require new same-head normal verification/final refresh; prior A-7462 belongs only to b936df80. No Reviewer tests.

### rev-23 · 2026-10-20T10:49:10.857Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-794-merge-final
commit: d5b7695f8983222de7c75185132d82f340d43524
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no remaining findings. A-7514 audits exact-head A-7508/run 066c8f5b: 2014/2014 ordinary tests pass; six new retirement identities each pass 5/5 load repetitions; 27 role-clause checks pass. Source delta A-7488 plus this receipt establish C1/C2. Actual Linux droplet T1/all-T2 fallback includes Neovim; T3/T4 deferred. Host check 69776f26 recorded, not repeated on droplet. Existing lint/budgets/ratchet report-only; six missing baselines and incomplete timing are not passes. Earlier b936df80 evidence remains historical.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T10:53:30.724Z

Merged 949fbfae4135c418f98d43b527ee7d784f8c8a61 onto dev.
