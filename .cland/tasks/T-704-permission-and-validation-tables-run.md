---
id: T-704
kind: task
title: Permission and validation tables run through the dispatcher, with one CLI proof per command family
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-687
topic: topic-436
branch: t/T-704-permission-and-validation-tables-run
created: 2026-10-16T19:59:37.407Z
updated: 2026-10-17T12:41:01.547Z
---

## Summary

`cland(...)` is the default client in 1206 call sites, each a Node start (memo §2.3 anti-pattern 6). In these files it is mostly a transport for permission and validation tables that `decide()` or the dispatcher answer in microseconds (report-slice1 #9, report-slice3 #9 and anti-pattern 3, report-slice4 #9 and anti-pattern I). `docs/agents/tests.md` already allows validation duplicates to call the dispatcher directly while keeping one real frame proof per tool or refusal family.

| File | Seconds | CLI sites | Note |
|---|---:|---:|---|
| `cli-identity.test.ts` | 31.0 | 30 | |
| `rule-cli.test.ts` | 19.3 | 18 | 6 hub starts for rulebook numbering and reload rules |
| `permissions.test.ts` | 14.1 | 11 | re-reads the whole `hub.log` twice per table row |
| `permission-integrity.test.ts` | 12.6 | 11 | the same fixture as `permissions` |
| `tracker-criterion-write.test.ts` | 16.1 | 16 | six spokes for a 6 × 6 matrix |
| `release-item.test.ts` | 24.6 | 27 | |
| `merge-policy.test.ts` | 35.7 | 29 | override path classification is a pure function |

## What to build

- **Tables in-process.** Table rows run through `decide()` or dispatcher-direct requests with `as:` on `projectHub`, asserting on the frame result, not on `hub.log`. Rulebook numbering, reload and high-water rules, and merge-policy path classification are T1 tests on their modules. `permission-integrity.test.ts` merges into `permissions.test.ts`.
- **One CLI proof per command family stays:** `$CLAND_SESSION_ID` makes a call the session's, an exit code, a `--json` shape, and a refusal's rendering.
- **Writers keep their proofs.** The concurrent-writes test in `rule-cli` and the hub's down-signal test in `cli-identity` stay.

## Acceptance criteria

- [x] C1. The seven files' manifest seconds fall from 153.4 s (A-3877) to 85 s or less.
  - done: impl-704 · 2026-10-17T11:46:58.321Z
- [x] C2. Their CLI call sites fall from 142 to 50 or less, and `startDaemon` sites from 18 to 3 or less.
  - done: impl-704 · 2026-10-17T11:46:58.792Z
  - verified: rev-31 [reviewer] · run rev-20261017-704-source-2 · 2026-10-17T11:51:36.795Z · commit 17ea9073f0f81e3b8f38be3481cd0dd057457f16
- [x] C3. No table row reads `hub.log` as its only oracle, and each command family keeps exactly one CLI proof, named in an audit.
  - done: impl-704 · 2026-10-17T11:46:59.304Z
  - verified: rev-31 [reviewer] · run rev-20261017-704-source-2 · 2026-10-17T11:51:36.796Z · commit 17ea9073f0f81e3b8f38be3481cd0dd057457f16
- [x] C4. The audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - done: impl-704 · 2026-10-17T11:50:50.299Z
  - verified: rev-31 [reviewer] · run rev-20261017-704-source-2 · 2026-10-17T11:51:36.796Z · commit 17ea9073f0f81e3b8f38be3481cd0dd057457f16
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - failed: rev-31 [reviewer] · 2026-10-17T12:41:01.547Z · note Task verification fails the deterministic frozen legacy-path comparison after retiring permission-integrity.test.ts, plus an owned CLI duration budget; Neovim is not reached.

## Blocked by

T-687 (in-process spoke).

## Comments

### impl-704 · 2026-10-17T11:36:09.793Z

Migration underway: consolidated permission-integrity into permissions (launched Bash-shell identity proof retained in cli-identity), dispatcher tables replace repeated CLI calls; rulebook operations moved to a module fixture with an injected Clock; criterion crash recovery isolated as a lifecycle test. New pure merge-override classifier preserves the production predicate, with component landing effects still covered. First permissions and rulebook-file runs pass; serial file validation and assertion audit next.

### rev-31 · 2026-10-17T11:50:07.597Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-704-source-1
commit: a0def18e300f56ac2c5b6b98a527e4e41164db2b
scope: full
findings: [{"severity":"medium","text":"Unbounded, unowned native writer can survive cancellation or a missed crash point while its fixture is removed; own/bound/join it and distinguish intended SIGKILL from timeout with a capture receipt.","file":"hub/test/tracker-criterion-crash.test.ts","line":31},{"severity":"medium","text":"Fixture book.stop runs before the later barrier-release after hook; failure/cancellation while editing is held deadlocks teardown. Release/join editing and restore native export before stopping book/removing root.","file":"hub/test/rulebook-file.test.ts","line":21}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear; Standards 2 medium, Spec 0 additional findings, A-4488. Implementer d2ba4204 confirms both cleanup gaps and will correct them before fresh review. Reviewed all 18 paths and A-4485 audit against seven old snapshots, which independently match audit base. No other dropped behavior found: typed permission/notice/audit/identity tables, real MCP/CLI witnesses, launched Bash spoof protection, hub-down signals, concurrent rule writers, criterion recovery, release pinned retries and merge QA/override provenance retained. Override extraction preserves filter; optional RulebookFile Clock keeps real default. Census 30 CLI / 2 daemon / 0 spoke sites; 45 green Mac whole-file receipts independently checked, median sum 65.383845 s at loads 5.49–11.71. Baselines untouched; three obsolete allowances removed, hub-down cap shrinks to 11 s. C1/Linux and C5 execution pending. C4 failed for cleanup proof regression. Exact tip/diff check clean; no Reviewer edits/tests/delegation. Fresh corrected source review before verification.

Criteria: C4 failed (Moved crash/stale-write proofs lack safe cancellation cleanup; release-before-stop ordering was lost in the module split.).

### rev-31 · 2026-10-17T11:51:36.796Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-704-source-2
commit: 17ea9073f0f81e3b8f38be3481cd0dd057457f16
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards 0 / Spec 0 findings, A-4490. Both prior mediums resolved: crash writer immediately owned, bounded and follows test signal, close joined before recovery/removal; flushed capture plus killed===false distinguishes real self-SIGKILL from timeout. Rulebook release now precedes stop, body finally releases/joins/restores export. All original assertions retained. A-4489 ten fresh whole-file passes and four intentional failure/cancellation probes inspected; probes finish under1s with removed roots/no live writer. Only these two tests change, no dev merge; A-4488 full 18-path audit, unchanged seven-file Mac evidence and source seams remain current. Census 30 CLI / 2 daemon / 0 spoke; refreshed Mac median sum 65.332644s. C2/C3/C4 verified. C1 Linux timing and C5 same-head execution await mode-free diff-selected droplet. Exact origin/diff whitespace checked; static checks reported green; no item QA. No Reviewer edits/tests/delegation.

Criteria: C2 verified, C3 verified, C4 verified.

### rev-31 · 2026-10-17T12:41:01.547Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-704-evidence-1
commit: 17ea9073f0f81e3b8f38be3481cd0dd057457f16
scope: evidence
findings: [{"severity":"medium","text":"Frozen legacy comparison still expects permission-integrity.test.ts deleted by this migration; ordinary failure and 0/5 show deterministic incompatibility. Preserve phase/worker assertions while accounting for deliberately retired baseline paths.","file":"hub/test/suite-tiers.test.ts","line":110},{"severity":"medium","text":"Retained real-Claude --as case passes behavior at 5.457659001 s but fails its unallowed five-second duration budget; preserve assertions and resolve the measured budget.","file":"hub/test/cli-identity.test.ts","line":204}]
finding_counts: {"high":0,"medium":2,"low":0}

Evidence not clear; Standards 1 medium / Spec 1 medium, A-4516. Exact-head A-4514 / 9012d29f exits 1 with 2073 passes, one failure, five skips; Neovim not reached. Missing baseline path is the file deliberately deleted by T-704, not an external flake. All 61 owned behavioral cases pass; their summed recorded Linux seconds are 81.518842465, versus established Mac median 65.332644. Twenty owned identities pass 5/5 load repetitions (corrects A-4516's count of twenty-one). External verifier-routing budget is separately addressed by T-734. C5 failed; C1 remains pending final evidence, C2/C3/C4 source continuity retained. Corrected head requires new source review before verification; no unchanged-head retry. No Reviewer edits/tests.

Criteria: C5 failed (Task verification fails the deterministic frozen legacy-path comparison after retiring permission-integrity.test.ts, plus an owned CLI duration budget; Neovim is not reached.).
