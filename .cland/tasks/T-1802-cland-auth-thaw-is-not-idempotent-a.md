---
id: T-1802
kind: task
title: "cland-auth thaw is not idempotent: a replay after a lost thaw receipt is refused when the disk is already unfrozen"
state: open
status: review
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1884
blocked_by:
  - T-1781
regression_of: T-1776
found_by: review
topic: topic-1603
branch: t/T-1802-cland-auth-thaw-is-not-idempotent-a
created: 2026-11-10T08:10:09.103Z
updated: 2026-11-17T13:31:34.800Z
---

## Summary

`hub/src/host/cland-auth.sh` runs `thaw` as a bare `fsfreeze -u`. If the hub loses a thaw's receipt and replays it, the helper refuses because the filesystem is already unfrozen, so the caller cannot tell a completed thaw from a failed one. T-1781's snapshot scheduler therefore keeps the freeze and the release fence on that refusal, which is safe but blocks the login until someone reconciles it.

## Context

Found in T-1781's source work, 2026-11-10 (impl-1781). No agent or helper edit was made in T-1781.

## Acceptance criteria

- [x] C1. A `cland-auth thaw` on an unfrozen mount of a validated `/cland/auth/<x>` path exits 0 with a distinct "already thawed" result, and a thaw on a frozen mount still unfreezes it (test).
  - done: impl-1802 · 2026-11-17T13:31:25.001Z
- [x] C2. Malformed paths and volume names are still refused before any `fsfreeze` call (test).
  - done: impl-1802 · 2026-11-17T13:17:42.226Z
- [x] C3. T-1781's replay after a lost thaw receipt clears the freeze and the fence on "already thawed" (test).
  - done: impl-1802 · 2026-11-17T13:31:25.167Z

## Comments

### impl-1802 · 2026-11-17T13:11:33.752Z

Consumer census before change: shell stdout/exit consumed by host/agent/login-disk.ts (code 0 -> null), then ssh-host.ts (resolved request -> void), Host.loginDisk Promise<void>, and login-snapshots.ts recoverThaw (fulfilled promise removes persisted freeze). Other loginDisk consumers: login-binder.ts and login-signin.ts plus fake-login-disk.ts, server.ts dispatch, protocol resource types and their tests. prelude.ts embeds helper and agent/entry.ts declares native asset closure edge. Docs: docs/hub/logins.md, docs/agents/host-agent.md, docs/hub/host-providers.md; tests cland-auth, login-snapshots, login-disk, login-binding, host-agent-closure and prelude. No existing stdout parser or frozen CLI help bytes for this helper; wire result remains null and Host API void, preserving old-client compatibility. Distinct already-thawed helper success travels existing exit-0 receipt path; scheduler does not need a new outcome parser.

### impl-1802 · 2026-11-17T13:15:53.379Z

Census refinement: helper is an uploaded hub runtime asset through code-delivery/runtimeBundle and is embedded by prelude.ts; generate-host-agent-closure regenerated unchanged (helper is outside the agent closure). Direct test readers: host-runtime-bundle T1, host-prelude T1, host-runtime-delivery T3, cland-auth T3. Snapshot reader recoverThaw consumes fulfilled Host.loginDisk, retaining freeze on rejection; no scheduler code migration needed. Coordinator-directed non-freezable EINVAL regression was red (0 !== 1), then green after FSTYPE ext4 and same-mount recheck. Unknown/unsupported FSTYPE, malformed/foreign-path diagnostic and native permission errors remain failures. No user-facing *_USAGE export changed, commands.json bytes unaffected.

### rev-35 · 2026-11-17T13:25:50.057Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1802-source-1
commit: 3631b0b34d9c9eff563c8fe3855c7da0079741ba
scope: full
findings: [{"severity":"medium","text":"The new async replay callback acquires the shell fixture/SQLite and performs setup before try/finally, with no test-context whole-sequence fence or independent original-callback join. Setup failure or cancellation lacks encompassing ownership of scheduler work, database and root. Enroll the shared owner before acquisition and retain resources until original work and scheduler closure positively join (rules 9/12).","file":"hub/test/cland-auth.test.ts","line":119},{"severity":"medium","text":"No regression exercises mount loss/replacement after exact fsfreeze EINVAL but before the newly added final identity check. FSTYPE cases keep identity fixed; the existing changed-mount case refuses before fsfreeze. Add ordered positive EINVAL/FSTYPE/final-observation receipts and assert missing/changed/ambiguous identity stays nonzero without an already-thawed result (C1, rules 9/25/39).","file":"hub/test/cland-auth.test.ts","line":105}]
finding_counts: {"high":0,"medium":2,"low":0}

A-20886 full source review at tree 51dfc91167a30a03634c0acc61d0c5ff3b925d6b; fixed base 387cc0cf4d507d25677195cb50fefead97637a68. Standards one medium, Spec one medium; no highs/lows. Lead 448448ae confirms both gaps. Kernel-holder EINVAL is not an additional finding under Coordinator 55555f1a's explicit sole-freeze-owner scope; revision must document kernel-holder exclusion and precisely name userspace thaw completion in code/evidence. Existing argument/volume/path checks, null/void wire/Host result and separate detach receipt remain; no usage-export migration or closure regeneration needed. Consumer/QA/raw-reader/asset/tier audit and A-20884/A-20885 limits recorded in artifact. Reported local macOS Node24.21 helper 13/13, asset readers 11/11, snapshot T2 29/29, typecheck/lint exit0 are selected supporting receipts; lint has 130 report-only findings/63 files. Precommit helper/lint lack invocation-tree pins; raw logs/hashes and outer signal fields unknown; original reds retained. No configured verification or real ext4/kernel/browser/provider proof. C2 not failed, left pending. Consolidate two fixes plus scope wording, then fresh source request before verify. No Reviewer runtime/probes/edits or dev merge requirement.

Criteria: C1 failed (The new post-EINVAL identity fence lacks a regression at that boundary; existing identity tests stop before fsfreeze.), C3 failed (The new async helper/scheduler replay has no encompassing setup/cancellation owner and original-callback join before resource/root disposal.).
