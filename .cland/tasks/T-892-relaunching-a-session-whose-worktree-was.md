---
id: T-892
kind: task
title: Relaunching a session whose worktree was removed reports 'spawn codex ENOENT'
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - v0.1.4
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: topic-631
branch: t/T-892-relaunching-a-session-whose-worktree-was
created: 2026-10-19T19:08:57.886Z
updated: 2026-10-19T19:44:12.008Z
---

## Summary

After T-882 landed at 19:02:41Z (2026-10-19), impl-882 was released and its worktree .cland/worktrees/T-882 was removed. `cland session resume impl-882 --relaunch` then failed with "codex --version: spawn codex ENOENT". The adapter's version probe runs execFile(codex, --version) with the session's recorded cwd, and Node reports a missing cwd as ENOENT on the binary. That sent the Coordinator after a PATH problem that wasn't there (the stand-in diagnosed it from the serving pid).

## Acceptance criteria

- [ ] C1. (T1) The harness version probe checks the cwd first and reports "session cwd <path> no longer exists" instead of a spawn ENOENT, and resume --relaunch of a session whose recorded worktree is gone refuses with that reason and suggests a fresh launch for its open item, if any.
  - failed: rev-31 [reviewer] · 2026-10-19T19:44:09.369Z · note Configured task run A-6464 is red on shared T-891 fixture failures; owned diagnostic/guidance controls are positive.

## Comments

### impl-892 · 2026-10-19T19:25:21.574Z

Red/green regression: node --test hub/test/session-cwd.test.ts first produced codex --version: spawn codex ENOENT where the explicit missing-cwd diagnostic was expected. Added shared directory preflight before Codex version cache/probe and resume --relaunch. Transport-free T1 tests now cover uncached/cached probes, refusal without adapter calls, open-item fresh-launch guidance, and suppression for closed/absent items. No separate QA policy applies (scope none).

### impl-892 · 2026-10-19T19:27:24.091Z

Review head a80e244073d622d46fcf5471a3f0477290d44dbf pushed; source review requested from Reviewer in topic-631. Evidence A-6412. Final test uses a direct missing-cwd adapter call and transport-free resume; the earlier cached-version mock check was removed to satisfy strict T1 resource rules. Strict T1 2/2 0.349s, resume component 3/3 1.361s, admission 16/16 1.007s, typecheck and test lint pass.

### rev-31 · 2026-10-19T19:28:48.637Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-892-source
commit: a80e244073d622d46fcf5471a3f0477290d44dbf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Shared async directory check precedes Codex version cache/probe; relaunch preflight preserves lifecycle serialization and authorization/identity rechecks, refusing before role reservation or adapter stop/resume. New T1 tests use memory/fake boundaries, preserve stopped row and verify no adapter calls. Spec: no findings. Missing cwd gets the specified reason; only an open recorded item gets a fresh named-launch suggestion, with no same-cwd --fresh offer. C1 source behavior accepted; execution verification waits for the exact-head mode-free configured task receipt. A-6412 reports strict T1 and existing related tests/typecheck/lint green; raw receipts not supplied there. Detailed source artifact in topic-631.

### impl-892 · 2026-10-19T19:42:08.114Z

Run 0fdb0389 (A-6464) failed solely in verify-tool.test.ts, matching the launch brief's shared T-891 fix. Applied the two posted shared commits as b941f7b1 and fcde0d49; T-892 source unchanged, no dev merge. New pushed head fcde0d49b9210bbbbf017f24630e0a8819eff08b. Targeted verify-tool 3/3, strict T1 cwd 2/2, typecheck and merge-tree pass. Requesting fresh source review before retry.

### rev-31 · 2026-10-19T19:44:09.369Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-892-runtime-1
commit: a80e244073d622d46fcf5471a3f0477290d44dbf
scope: evidence
findings: [{"severity":"medium","text":"A-6464 exits 1 on the two shared T-891 fixture identities, ordinary plus 0/5 load gates; configured task acceptance is blocked despite both owned C1 controls and ten repetitions passing.","file":"hub/test/verify-tool.test.ts","line":43}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete-log audit: 1397 ordinary pass/2 fail, twelve failed verify-tool finishes, both shared gates 0/5. Owned session-cwd tests and ten repetitions pass; no resource mismatch or owned budget failure. Nine external report-only budget rows retained in the companion artifact. Runtime not clear at a80e2440; next shared-fix head needs source review and its own receipt.

Criteria: C1 failed (Configured task run A-6464 is red on shared T-891 fixture failures; owned diagnostic/guidance controls are positive.).

### rev-31 · 2026-10-19T19:44:12.008Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-892-source-2
commit: fcde0d49b9210bbbbf017f24630e0a8819eff08b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards/Spec: no findings in the exact +7/-1 shared T-891 fixture delta. Existing helper supplies verification commands and cland-shaped root/worktree candidates; fake candidate/clock and all assertions retained. Independently read Coordinator's shared-fix post 151c645e. T-892 product/tests unchanged from A-6416 source clearance. C1 final verification awaits this exact head's fresh mode-free configured task receipt; A-6464 remains recorded failed. No task-head full run requested.
