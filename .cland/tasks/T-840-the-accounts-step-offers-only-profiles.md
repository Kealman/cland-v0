---
id: T-840
kind: task
title: The accounts step offers only profiles with their own directory, asks with the default No, and never registers a harness's default profile
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-839
topic: topic-644
branch: t/T-840-the-accounts-step-offers-only-profiles
created: 2026-10-19T06:34:13.082Z
updated: 2026-10-19T20:44:01.025Z
closed: 2026-10-19T20:44:01.025Z
---

## Summary

Setup shows the signed-in profiles not yet in `~/.config/cland/accounts.toml`, each with who it is signed in as (shown, never written). It appends them only on an explicit yes, with the default No, because every project's hub reads that file. From the human's run on 2026-10-16: a harness's default profile is never offered, since it is the harness default already, and a path-less Claude Code entry makes the hub poll a signed-out profile (the T-603 family).

## What to build

- **Candidates.**
  - `~/.claude-<x>/` profiles as `claude-<x>` with `config_dir`.
  - `~/.codex-<x>/` profiles as `codex-<x>` with `home`.
  - Only signed-in profiles count, and only those not already registered (same harness and directory).
  - Never the default profile of the hub's environment, and never an explicit `~/.claude`.
  - OpenCode offers nothing.
- **Who it is.** Claude Code's `auth status --json` gives email and org. Codex's comes from a short-lived app-server's `account/read`, whose process group is ended afterwards. Both are shown only.
- **The question.** Before it, setup says when Yes is worth it: several accounts per harness, or limits. It also says the file is machine-wide. `Write them to ~/.config/cland/accounts.toml? [y/N]`.
  - Yes appends names, harnesses and paths, extending the file without rewriting it, and gives `done`.
  - No records the declined names in `[setup] declined_accounts` and gives `skip` (question 4).
  - A later run reports `ok` "declined earlier: <names>; add them to accounts.toml by hand to use them" and asks only about profiles not seen before.
- **Flags.** `--no-accounts` gives `skip` and reads nothing. `--yes` takes the default, so nothing is written (question 3). Without a terminal the step is `ok` when nothing is new and `open` when there are candidates. It never writes.
- A malformed registry is `fail`, "repair it by hand", and is left untouched.

## Acceptance criteria

- [x] C1. With signed-in default Claude Code and Codex profiles and a signed-in `~/.claude-work`, the only candidate is `claude-work` with `config_dir = "~/.claude-work"` (T1).
  - done: impl-840 · 2026-10-19T20:23:43.671Z
  - verified: rev-30 [reviewer] · run rev-20261019-840-final · 2026-10-19T20:24:18.354Z · commit c2833c29167f2569189860d8f58b006bb33d8e62
  - verified: rev-30 [reviewer] · run rev-20261019-840-handover-integration-final · 2026-10-19T20:39:38.079Z · commit 1796322540b1e2b20edf93d8ad0c55b2c4c6b135
- [x] C2. Enter at the question writes nothing and leaves `accounts.toml` absent, and a second run asks nothing and reports `ok` naming the declined profile (T1).
  - done: impl-840 · 2026-10-19T20:23:44.284Z
  - verified: rev-30 [reviewer] · run rev-20261019-840-final · 2026-10-19T20:24:18.354Z · commit c2833c29167f2569189860d8f58b006bb33d8e62
  - verified: rev-30 [reviewer] · run rev-20261019-840-handover-integration-final · 2026-10-19T20:39:38.079Z · commit 1796322540b1e2b20edf93d8ad0c55b2c4c6b135
- [x] C3. Yes appends the entry to an existing registry, keeping its other bytes, and no line written holds an email or org (T1).
  - done: impl-840 · 2026-10-19T20:23:44.878Z
  - verified: rev-30 [reviewer] · run rev-20261019-840-final · 2026-10-19T20:24:18.354Z · commit c2833c29167f2569189860d8f58b006bb33d8e62
  - verified: rev-30 [reviewer] · run rev-20261019-840-handover-integration-final · 2026-10-19T20:39:38.079Z · commit 1796322540b1e2b20edf93d8ad0c55b2c4c6b135
- [x] C4. No run of the step ever writes a path-less `claude-code` entry or `config_dir = "~/.claude"` (T1 over every candidate set in the test).
  - done: impl-840 · 2026-10-19T20:23:45.487Z
  - verified: rev-30 [reviewer] · run rev-20261019-840-final · 2026-10-19T20:24:18.354Z · commit c2833c29167f2569189860d8f58b006bb33d8e62
  - verified: rev-30 [reviewer] · run rev-20261019-840-handover-integration-final · 2026-10-19T20:39:38.079Z · commit 1796322540b1e2b20edf93d8ad0c55b2c4c6b135
- [x] C5. `--no-accounts` reads no profile and reports `skip`, and `--yes` without a terminal leaves `accounts.toml` absent (T1).
  - done: impl-840 · 2026-10-19T20:23:46.098Z
  - verified: rev-30 [reviewer] · run rev-20261019-840-final · 2026-10-19T20:24:18.354Z · commit c2833c29167f2569189860d8f58b006bb33d8e62
  - verified: rev-30 [reviewer] · run rev-20261019-840-handover-integration-final · 2026-10-19T20:39:38.079Z · commit 1796322540b1e2b20edf93d8ad0c55b2c4c6b135
- [x] C6. The Codex identity read starts one app-server and ends its process group when it returns (T1 with an injected spawner recording the kill).
  - done: impl-840 · 2026-10-19T20:23:46.590Z
  - verified: rev-30 [reviewer] · run rev-20261019-840-final · 2026-10-19T20:24:18.355Z · commit c2833c29167f2569189860d8f58b006bb33d8e62
  - verified: rev-30 [reviewer] · run rev-20261019-840-handover-integration-final · 2026-10-19T20:39:38.079Z · commit 1796322540b1e2b20edf93d8ad0c55b2c4c6b135

## Comments

### impl-840 · 2026-10-19T20:11:48.563Z

Accounts implementation committed and targeted T1 C1–C6 checks pass. The accounts step is wired into runner and CLI; managed config preserves declined_accounts. Review evidence and criterion map are in the item topic artifact. npm run check/typecheck and individual accounts/flow/CLI/config files passed; source review precedes queued verification.

### rev-30 · 2026-10-19T20:13:17.751Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-840-source
commit: bdc946e1f803df7f56be67ef91928915db888720
scope: full
findings: [{"severity":"medium","text":"M1/C6: success/read-error identity tests inject spawn/connect/kill but omit Clock, so readCodexIdentity uses real 15 s and 2 s timers in T1. Supply FakeClock in each iteration (as the timeout case already does), retain exact start/read/close/group-kill assertions and check cleanup drains timers. No production seam or tier change needed.","file":"hub/test/setup-accounts.test.ts","line":116}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear, A-6585. One medium Standards finding: C6's injected process test still uses realClock deadlines/cleanup timers because clock dependency is omitted. Add FakeClock per success/failure iteration and retain lifecycle assertions. Account candidate/path/privacy/decline/append/CLI behavior otherwise matches C1–C5 in source; all runtime criteria await exact-head mode-free gate after fresh corrected source review. A-6581 targeted results are reported prose, not independently audited raw output. QA none.

Criteria: C6 failed (T1 success/read-error Codex identity proof omits Clock dependency and schedules real deadline/cleanup timers; inject existing FakeClock before verification.).

### rev-30 · 2026-10-19T20:14:00.114Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-840-clock-corrected-source
commit: c2833c29167f2569189860d8f58b006bb33d8e62
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, A-6588; A-6585 M1 resolved by injecting FakeClock per success/read-error loop iteration and asserting no pending timers. All exact process/account-read/close/group-kill assertions retained; production/tier/config unchanged. C1–C6 runtime marks remain pending exact-head mode-free overall green and fresh controls' five repetitions within T1 budget/no owned resource mismatch. Prior C6 failure is historical, not a current source finding. QA none.

### rev-30 · 2026-10-19T20:24:18.355Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-840-final
commit: c2833c29167f2569189860d8f58b006bb33d8e62
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6621. Independent A-6616/72470c61 audit: 1713/1713, zero fail/cancel/skip/TODO, all122 load groups5/5, no resource mismatch or owned budget row. All8 account controls plus new config parser control pass ordinary +5 repetitions within T1 (max account .052378081 s). C1–C6 candidate/path/privacy/append/decline/flags and injected process-group cleanup verified. Source M1 fake-clock correction retained; no native identity process claim. QA none. Three previously uncovered unowned report-only cost cases disclosed separately for lead triage; no duplicate T-883/T-904 aside.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-30 · 2026-10-19T20:28:25.146Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-840-handover-integration-source
commit: 1796322540b1e2b20edf93d8ad0c55b2c4c6b135
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear, A-6632. Both --no-accounts and --attach parser/help/routing retained; setup and post-summary handOver share one prompter. Accounts production/config/all criterion controls unchanged. Independent task-patch comparison finds only expected CLI context integration and extended existing T1 handover combinations with original assertions retained. Reported targeted24/24/typecheck qualified as claimant evidence. C1–C6 await fresh exact-head mode-free runtime evidence; prior A-6621 historical. QA none.

### rev-30 · 2026-10-19T20:39:38.079Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-840-handover-integration-final
commit: 1796322540b1e2b20edf93d8ad0c55b2c4c6b135
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6661. Independent raw A-6653 audit: 1760/1760, zero fail/cancel/skip/TODO, all 170 load groups 5/5, zero tier/resource mismatch or owned budget overrun. All eight account controls ordinary+five repetitions fit T1 (maximum .040957777 s), including C6 process-group cleanup and timeout; nine handover controls ordinary+five also pass. Source A-6632 integration and retained full source basis settle C1–C6 at this head. Covered report-only rows follow Coordinator 798ff31d. Injected control evidence; no native harness claim. QA none.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-19T20:44:01.025Z

Merged 1d7e6137087296a474048414443404156fd82360 onto dev.
