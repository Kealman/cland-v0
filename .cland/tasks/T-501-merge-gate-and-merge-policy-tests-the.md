---
id: T-501
kind: task
title: "merge-gate and merge-policy tests: the CLI gives up after 3000 ms waiting for a loaded test hub (Linux)"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-394
branch: t/T-501-merge-gate-and-merge-policy-tests-the
created: 2026-10-15T14:44:32.893Z
updated: 2026-10-16T16:51:49.734Z
closed: 2026-10-16T16:51:49.734Z
---

## Problem

`hub/test/merge-gate.test.ts:220` and `hub/test/merge-policy.test.ts:96` both failed on Linux under load (peak 1-min load 14) in T-495's droplet verify af207517 (A-3076). Each time the CLI reported that the hub didn't answer within 3000 ms, and `ok()` in merge-support.ts:18 expects success. These are T-395's split files; the statements are byte-identical to the old merge.test.ts. So the 3 s CLI-to-hub request budget is probably older than T-395 and just too tight for a test hub under load. The stand-in also saw `cland hub status` time out at 3 s under load at 12:04Z.

## Acceptance criteria

- [x] C1. Find where the 3000 ms CLI request deadline comes from. Either the merge tests pass a deadline matched to the hub operation they wait on, citing its source line, or the CLI's own default is shown to be wrong under load and fixed with the reason. Every other assertion stays, and the root cause is recorded in the commit.
  - done: impl-501 · 2026-10-16T16:16:29.008Z
  - verified: rev-31 [reviewer] · run rev-20261016-501-source · 2026-10-16T16:18:30.847Z · commit 4978a192d0115fb5354f938a4bf26bd0595ee729
- [x] C2. merge-gate.test.ts and merge-policy.test.ts each pass 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-501 · 2026-10-16T16:51:12.281Z
  - verified: rev-31 [reviewer] · run rev-20261016-501-final · 2026-10-16T16:51:22.848Z · commit 4978a192d0115fb5354f938a4bf26bd0595ee729

## Comments

### impl-501 · 2026-10-16T16:12:42.688Z

Cause: both reported lines (merge-gate.test.ts:220, merge-policy.test.ts:96) run `cland role set`. hub/src/cli/role.ts:48 used askHubFrame's default 3000 ms total connection/hello/result deadline (hub/src/cli/socket-client.ts:20,37). This is not a fixture-startup wait: project() observes Reviewer presence before returning. Dispatcher role.set awaits core.roles.fresh() before assigning/persisting the role and publishing its clause (hub/src/hub/dispatch.ts:1280–1297); async configuration I/O under load can outlast 3 s. Controlled regression using RolesFile's injected file reader delayed 3100 ms reproduced the exact CLI error on Mac (exit 1, 3266 ms). Fix gives only role.set an explicit 10 s operation budget, matching tracker CLI requests (hub/src/cli/task.ts:358); no merge/permission assertions changed. Existing load report af207517/A-3076 supplies original Linux evidence; no machine-wide stress introduced.

### rev-31 · 2026-10-16T16:18:30.847Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-501-source
commit: 4978a192d0115fb5354f938a4bf26bd0595ee729
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards0/Spec0 findings. A-3993 records trace. Both reported failing merge lines invoke role.set; its CLI inherited askHubFrame's3000ms connection+hello+result timer, while dispatcher awaits roles.fresh before assignment/clause publication. Only role.set now gets explicit10000ms matching existing tracker mutation budget; all merge/permission assertions unchanged. Commit records cause. A-3987 controlled3100ms RolesFile read reproduces exact old timeout then whole roles-snapshot11/11 passes; test checks CLI output and actual holder. Typecheck reportedgreen, independent tip/diffcheck clear. C1 verified; C2 pending completed Mac serial wholefiles and fresh same-head droplet evidence.

Criteria: C1 verified.

### impl-501 · 2026-10-16T16:43:32.528Z

Mac repetition proof complete at unchanged source 4978a192: merge-gate 10/10 whole files (8/8 tests each; completed before Coordinator corrected launch ten to ticket five), merge-policy 5/5 whole files (12/12 each). Scheduler stopped at five policy runs. All invocations serial, one file at a time; new local runs after load notice admitted only at uptime 1-minute load <15. A-4029 is the durable log bundle at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4029-t-501-serial-mac-receipts-gate-10-10-and-policy-5-5. Policy run 2 has a partial live log plus an observed OS zombie exit-status-0 receipt, because its scheduler was suspended to apply the five-run correction; other reported runs have full logs. Typecheck exit 0 at exact head retained. C2 awaits droplet c7e542bb; source/head unchanged since clear review.

### impl-501 · 2026-10-16T16:51:12.235Z

C2 complete: Mac A-4029 accepted by Reviewer (10/10 whole merge-gate, 5/5 whole merge-policy, with disclosed partial policy run-2 TAP plus OS exit-0 receipt). Same reviewed head 4978a192d0115fb5354f938a4bf26bd0595ee729 passed droplet verify c7e542bb, log A-4033: full mode, exit 0, 2342 tests / 2334 pass / 0 fail / 8 prerequisite skips. Log includes all 8 merge-gate tests and all 12 merge-policy tests; the new configuration-read CLI regression also passed its 5/5 load gate and measured 3.359 s. Linux x64, Node v24.21.0, Neovim v0.12.5, c-8 lon1, workers 4, peak 1m load 11.92. Source and clean head unchanged since review; no further verification required.

### rev-31 · 2026-10-16T16:51:22.848Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-501-final
commit: 4978a192d0115fb5354f938a4bf26bd0595ee729
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards0/Spec0 findings. A-4034 evidence analysis. MacA-4029 accepted: gate10wholefile8of8, policy5wholefile executions; four policy full12of12 summaries, one partial log plus disclosed directly observed OSexit0 receipt (not represented as full TAP). Coordinatorcb4111fe requires ticket5of5, not10. Same-head post-review Linuxc7e542bb/A-4033 full exit0:2334pass/0fail/8skip, hub38+1906passes and Neovim390passes, all mergecasesgreen. Delayed role-set regression ordinary3.359s and5of5 load. Exact origin unchanged. C2 verified; C1 source verification current. Lifetime/cost unknown. No further run or gate exception needed.

Criteria: C2 verified.

### coord · 2026-10-16T16:51:49.734Z

Merged 62b40a73850751681faa3b7368a26afaae0d570c onto dev.
