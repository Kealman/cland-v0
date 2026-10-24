---
id: T-1063
kind: task
title: connection-snapshot test spawns the real account poller instead of injecting accountReader
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1216
blocked_by: []
topic: topic-949
branch: t/T-1063-connection-snapshot-test-spawns-the-real
created: 2026-10-21T14:26:07.116Z
updated: 2026-10-24T09:13:15.858Z
---

## Summary

The existing test `hub/test/connection-snapshot.test.ts` "snapshot contains each workbench domain, compact verdict rounds and recent closed topics" creates a named account without injecting `projectHub.accountReader`. The Linux runtime tripwire therefore reports a T2 `child_process.spawn` from `hub/src/accounts/poller.ts` (report-only, run 117424cc, A-8457). Found aside by impl-1053, which fixed the same pattern in T-1053's own fixture.

## Acceptance criteria

- [x] C1. The test injects the existing `accountReader` port for its named account, and a targeted Linux run of the file reports no `child_process.spawn` tripwire finding for it.
  - done: oc-1063 · 2026-10-24T09:11:41.446Z
- [x] C2. The test's assertions are unchanged and pass.
  - done: oc-1063 · 2026-10-24T09:11:41.647Z

## Comments

### oc-1063 · 2026-10-24T09:12:01.696Z

Head 7fdbe7bacce6e023e631a6e811ad4227330bc9cd pushed to origin (t/T-1063-connection-snapshot-test-spawns-the-real).

Change: the named 'snapshot contains each workbench domain...' fixture now injects `accountReader: async () => []` into projectHub; assertions untouched. Test doc records the injected port.

Evidence (macOS, this worktree, T2 tripwire report-only via `--import hub/test/tier-bootstrap.mjs`): before the change one tier-mismatch line naming this test, child_process.spawn from hub/src/accounts/poller.ts #read; after the change zero tier-mismatch lines. `node --test hub/test/connection-snapshot.test.ts` 13/13 pass before and after; `npm run check` passed. Linux receipt expected from the verify run after review.

### rev-23 · 2026-10-24T09:13:15.858Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1063-source
commit: 7fdbe7bacce6e023e631a6e811ad4227330bc9cd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1063 full source review — clear

Head7fdbe7bacce6e023e631a6e811ad4227330bc9cd, treec4a70112e653e9c91e35f9f652e717901f80bd3d. Pinned merge-base/parenta9a76af40386e214cdcc30efb7b7109cc5ba6b01 from the item's dev base; git diff a9a76af4...7fdbe7ba. One commit, two files,5 additions/3 removals. Origin task ref matches. Run rev-20261024-1063-source, scope full, findings []. Both axes reviewed in-session under crew Reviewer no-subagents policy.

## Standards

Clear. The existing T2 snapshot fixture retains projectHub, disposable sealed environment, FakeClock, socket observers and cleanup. It now supplies the existing accountReader:async()=>[] seam for the named fixture account rather than launching a native harness poller. The helper/daemon already forward this option, and AccountPoller chooses the supplied reader before #read (the native child_process.spawn path). Registry, account presence, schedule and snapshot production code remain active. No new process, timer, mock hierarchy, test identity, timeout or assertion is introduced. Exact-path per-test note describes the port; no command/permission/help/skill change requires broader documentation. Whitespace check passes.

## Spec

Clear source implementation of C1: the target fixture at line107 injects the accountReader port. Source comparison proves every assertion is byte-unchanged, including seven-domain membership, account name fixture, session facts, snapshot byte limits, verdict rounds/history and recent/old closed-topic boundaries. C2's assertion-preservation requirement is source-established, while its pass and C1's explicit Linux no-spawn requirement remain pending runtime evidence.

Request reports local macOS before/after13/13, one original child_process.spawn poller tripwire before and none after, plus check pass with report-only lint. Those are Implementer-reported local receipts, not independently audited Linux coverage or an exact-head configured pass. Original commands/stdout/native exits/chunks/source attribution have been requested for durable artifact preservation from retained records without transcription reruns.

Source clearance permits fresh configured mode-free verification at this exact unchanged head. Final C1/C2 settlement requires the actual same-head Linux connection-snapshot file completion and absence of its child_process.spawn diagnostic, plus the configured result. A selected/file-targeted Linux receipt can establish C1; a missing file receipt or generic suite header cannot. QA none/after-stage. Reviewer performed static source/Git inspection only; no tests, probes, installs, edits, GUI, merges or delegation.

Standards zero findings; Spec zero findings.
Durable review A-10623.
