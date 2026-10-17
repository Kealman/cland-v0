---
id: T-705
kind: task
title: Doctor checks, init refusals, skill template commands and worktree discovery run in-process, with three real CLI runs each at most
state: open
status: ready
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: topic-437
branch: t/T-705-doctor-checks-init-refusals-skill
created: 2026-10-16T19:59:37.526Z
updated: 2026-10-17T12:43:17.958Z
---

## Summary

These files spawn the CLI once per matrix cell, for logic that their modules export (memo §2.2 win 4; report-slice4 #2 and #8, report-slice3 #7, report-slice2 territory-cli):

| File | Seconds | Note |
|---|---:|---|
| `doctor.test.ts` | 66.0 | ~40 `cland doctor` runs; its 45.5 s test is 13 subtests of pure check logic. `runDoctor` is already importable (`orphan-sweep-lock.test.ts`) |
| `init.test.ts` | 35.1 | ~45 `cland init`/`update` runs; an 8-manifest rejection loop and a 4-root symlink matrix |
| `skills-tracker.test.ts` | 31.8 | ~20 CLI runs that all exit `no hub running`; 4 parent kinds × a 3-ticket scenario |
| `worktree-cli.test.ts` | 35.1 | 4 commands × 4 cwds compared to the root |
| `territory-cli.test.ts` | 25.8 | 9 of 14 `cland init` runs are refusals |

## What to build

- **doctor.** The check matrix (Ghostty variants, version ranges, OpenCode majors, auth and config states) runs through `runDoctor` in-process. Three real CLI runs stay: the healthy machine in text and JSON with its exit code, the hanging-probe process-group kill, and the no-hub warning.
- **init and territory-cli.** Manifest rejections, the symlink matrix and the refusal cases call the init module directly; two or three real `cland init`/`update` runs keep the `git status` contract.
- **skills-tracker.** Template commands are parsed by the CLI's argv parser in-process. The parent-kind loop is one scenario plus a table on parent resolution.
- **worktree-cli.** One discovery proof per cwd (`hub status --json`) and one write command; the stale-discovery stop test stays.

## Acceptance criteria

- [x] C1. The five files' manifest seconds fall from 193.8 s (A-3877) to 95 s or less.
  - done: impl-705 · 2026-10-17T12:42:49.854Z
  - verified: rev-31 [reviewer] · run rev-20261017-705-final · 2026-10-17T12:43:17.168Z · commit 83db6bc3a40526c6a209f3bd96773630119feefb
- [x] C2. CLI subprocesses started by the five files fall by at least two thirds, counted by the spawn census's per-file row before and after.
  - done: impl-705 · 2026-10-17T11:57:38.561Z
  - verified: rev-31 [reviewer] · run rev-20261017-705-source-3 · 2026-10-17T12:05:10.197Z · commit 83db6bc3a40526c6a209f3bd96773630119feefb
- [x] C3. The moved matrices are T1 or T2 tests that pass the tier lint, and the kept CLI runs each name the CLI behaviour they prove.
  - done: impl-705 · 2026-10-17T11:49:10.200Z
  - verified: rev-31 [reviewer] · run rev-20261017-705-source-3 · 2026-10-17T12:05:10.197Z · commit 83db6bc3a40526c6a209f3bd96773630119feefb
- [x] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - done: impl-705 · 2026-10-17T12:02:03.403Z
  - verified: rev-31 [reviewer] · run rev-20261017-705-source-3 · 2026-10-17T12:05:10.197Z · commit 83db6bc3a40526c6a209f3bd96773630119feefb
- [x] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - done: impl-705 · 2026-10-17T12:42:50.211Z
  - verified: rev-31 [reviewer] · run rev-20261017-705-final · 2026-10-17T12:43:17.168Z · commit 83db6bc3a40526c6a209f3bd96773630119feefb

## Comments

### impl-705 · 2026-10-17T11:42:12.413Z

Implementation in progress: doctor matrices use runDoctor with injected output/probe boundaries; init and territory filesystem matrices use module entry points; skills commands parse exact template argv in-process with an injected stdin source; worktree discovery has one status proof per cwd. Retained doctor lifecycle and init binary/concurrent-writer contracts are split out and included in timing totals. Mac 5/5 serial run and per-file spawn census started. Required assertion migration audit will accompany review. Necessary runTask env forwarding bug confirmed red without the fix, as accepted by Coordinator.

### rev-31 · 2026-10-17T11:55:24.921Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-705-source-1
commit: c1f392d90687dd9916b4bb1185c4131d77cdc6fc
scope: full
findings: [{"severity":"medium","text":"Clock-pumping launch loop advances virtual deadlines while native I/O is pending without timer admission/completion; no delay is required, so keep the clock frozen and await the launch receipt.","file":"hub/test/doctor.test.ts","line":349},{"severity":"medium","text":"New real stdin child lacks registered cancellation ownership and a close join before fixture removal; preserve UTF-8 proof while owning and joining the child.","file":"hub/test/skills-tracker.test.ts","line":330},{"severity":"medium","text":"Pre-exec write-starting message can arrive before SQLite encounters the held lock; immediate parent commit/results-empty assertion does not prove actual contention or init waiting.","file":"hub/test/init-process.test.ts","line":94}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear; Standards 2 medium / Spec 1 medium, A-4493. Implementer4d7dfeae accepts all three; revised fixtures described in1a69e979 are not yet reviewed source. Production edits separately checked: native doctor/init defaults preserved; Coordinator2edf4a78 env-forwarding/stdin approval read, negative env control red, native stdin read line unchanged. Other declaration audit, retained doctor/CLI/hook/symlink/template/parent/discovery claims appear preserved. Independent 40 green Mac logs, eight files5/5 at loads5.3208–11.9761; median sum72.749332s. Census rows405→64 CLI entries,13→4 daemons with recorder limits disclosed. Six allowances removed, baselines/two territory entries unchanged. C1 Linux timing/C5 execution pending; C4 failed. Three EOF whitespace issues sent as tooling cleanup, not extra findings. Fresh corrected head/source review before verification. No Reviewer edits/tests/delegation.

Criteria: C4 failed (Migrated SQLite overlap proof is incomplete, and launch/child cleanup boundaries require correction before the preserved claims are reliable.).

### rev-31 · 2026-10-17T11:58:52.589Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-705-source-2
commit: 79d395018b14f54c98fac996fbfe352b6474ec49
scope: full
findings: [{"severity":"medium","text":"Worker termination is joined only in the test body finally, not registered fixture cleanup; cancellation can start root disposal before termination settles. Register idempotent resource ownership before waits and cover held-worker cancellation.","file":"hub/test/init-process.test.ts","line":135}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrected source not clear; Standards 1 medium / Spec 0 remaining, A-4498. Additional worker resource-ownership gap was missed on the first pass: body finally awaits terminate but test cancellation need not join that body before fixture after hooks. Explicit owner/termination join and held-worker cancellation proof requested. Prior three findings resolved: launch clock frozen, stdin owned/signal/close joined, actual SQLITE_BUSY on init connection plus observed production5000ms policy. Negative control removes only Store timeout line and fails0!=5000; source restored. No manufactured schema wait or claim of observing entry inside native call. Production unchanged; whitespace clean. A-4495 fifteen fresh green logs; recomputed combined Mac65.890596s. A-4496 corrected census405→65 CLI (84.0%),13→4 daemons accepted; prior audit remains current. C4 failed; C1 Linux/C5 runtime pending. No verification before corrected source. No Reviewer edits/tests/delegation.

Criteria: C4 failed (The migrated init writer proof still lacks registered cancellation teardown that joins the Worker before its database/root is removed.).

### rev-31 · 2026-10-17T12:05:10.197Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-705-source-3
commit: 83db6bc3a40526c6a209f3bd96773630119feefb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards 0 findings / Spec 0 findings, A-4501. Registered idempotent writer/Worker cleanup now precedes fixture directory disposal, including cancellation without a completed body finally. A-4500 negative registration control fails both receipt fields; restored held-worker proof and all five four-test whole-file receipts pass without asynchronous-activity diagnostics. Prior frozen launch clock, owned stdin and actual SQLite BUSY/observed 5000 ms policy corrections remain intact. Production and earlier assertion audit unchanged. Origin tip and whitespace checked at this exact head. Updated combined Mac median 66.310870 s; conservative CLI census 405→65 (84.0%), daemons 13→4. C2/C3/C4 source verified; C1 Linux timing and C5 exact-head droplet execution remain pending. No Reviewer edits, tests or delegation.

Criteria: C2 verified, C3 verified, C4 verified.

### rev-31 · 2026-10-17T12:43:17.168Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-705-final
commit: 83db6bc3a40526c6a209f3bd96773630119feefb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; Standards 0 / Spec 0 findings, A-4520. Exact-head A-4517 / 551194c2 ends exit 0, 2090 tests / 2085 passes / 0 failures / 5 prerequisite skips; hub-only plus 12/12 Neovim smoke. Independently extracted all 66 owned cases across eight resulting files, summed Linux 47.321158498 test-seconds and all 28 new owned identities with 5/5 passing load receipts. C1: both Mac median sum 66.310870 s and disclosed Linux sum are below 95 s, including all split files. C5: prior whole-file Mac 5/5 chain A-4487/A-4495/A-4500 plus current exact-head Linux pass. Source-3/A-4501 C2/C3/C4 remains current; conservative census 405→65 CLI entries, 13→4 daemons. Origin tip unchanged. All five criteria supported; no further run or per-item QA needed. No Reviewer edits/tests.

Criteria: C1 verified, C5 verified.
