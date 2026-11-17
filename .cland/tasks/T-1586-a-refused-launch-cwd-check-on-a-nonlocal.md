---
id: T-1586
kind: task
title: A refused launch-cwd check on a nonlocal host names the host's refusal
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1884
blocked_by: []
regression_of: T-1553
found_by: qa
topic: topic-1582
branch: t/T-1586-a-refused-launch-cwd-check-on-a-nonlocal
created: 2026-11-02T01:53:50.628Z
updated: 2026-11-17T04:29:04.398Z
closed: 2026-11-17T04:29:04.398Z
---

## Summary

A launch on a nonlocal host whose cwd check is refused by that host reports `invalid-cwd: launch cwd "<path>" is not an accessible directory`, which hides that the host refused the operation. The refusal names the host and its reason.

## What to build

When the launch's cwd check (`statDirectory`) on a nonlocal host fails because the host refused or failed the operation, the launch result names the host and carries the host's error, for example `host t1 could not check launch cwd "<path>": test host t1 refuses statDirectory`. A cwd that the host reports missing or not a directory keeps today's `invalid-cwd` wording. The local host keeps today's message unchanged.

Found by qa-678 in E-1531 stage-2 QA (E1531S2-18, topic-1315, 2026-11-02 01:53Z): an Implementer launched on test host t1 returned `invalid-cwd` after the only Host operation `t1:statDirectory` was refused.

## Acceptance criteria

- [x] C1. A launch on a nonlocal host whose `statDirectory` of the cwd is refused returns an error naming the host and the host's refusal, with no process row left.
  - done: impl-1586 · 2026-11-17T02:32:56.143Z
  - verified: rev-36 [reviewer] · run rev-36-1586-final-1 · 2026-11-17T03:08:05.999Z · commit bec32badf31b68b211924ccf60253420973d8213
- [x] C2. A cwd the host reports missing or not a directory keeps the `invalid-cwd` code and wording.
  - done: impl-1586 · 2026-11-17T02:24:40.934Z
  - verified: rev-36 [reviewer] · run rev-36-1586-final-1 · 2026-11-17T03:08:05.999Z · commit bec32badf31b68b211924ccf60253420973d8213
- [x] C3. On the local host, launch cwd errors are byte-identical to today's, proven by the existing launch tests passing unchanged.
  - done: impl-1586 · 2026-11-17T02:24:41.257Z
  - verified: rev-36 [reviewer] · run rev-36-1586-final-1 · 2026-11-17T03:08:05.999Z · commit bec32badf31b68b211924ccf60253420973d8213

## Comments

### impl-1586 · 2026-11-17T02:21:24.931Z

Rule 20 consumer inventory: searched invalid-cwd, launch cwd, statDirectory and InvalidLaunchCwd across hub/src, hub/test (all tiers), nvim, web, shared, docs and shipped skills. Producers: Sessions normal launch and #restartPool; requests.ts maps InvalidLaunchCwd to invalid-cwd. Protocol and shared/wire already allow error-only failures. Clients render generic errors, with no invalid-cwd-specific branch. Pins: session-host.test.ts exact local wording; session-launch-component.test.ts invalid-cwd code. Host contracts, adapter resume callers and host placement/remote fixtures consume unchanged statDirectory shape. Relevant docs: web-edge.md, roles.md, host API docs. Preserve resolved directory refusals and local errors, use existing error-only shape for rejected nonlocal checks, and retain previous launch wire-shape control. No new wire field or class.

### rev-35 · 2026-11-17T02:30:49.651Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1586-source-1
commit: 1dcff4a968f9840b2747673c3875db03e18cab96
scope: full
findings: [{"severity":"medium","text":"The five new placement callbacks and pool-restart callback have no whole-sequence owner before fixture acquisition; returned-resource hooks cannot join complete setup/body or adopt late acquisitions before root removal/storage closure. Also session-host.test.ts:213–221.","file":"hub/test/session-host-placement.test.ts","line":210}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review not clear; A-20551. One medium Standards finding at session-host-placement.test.ts:210 and session-host.test.ts:213–221: new callbacks do not register a whole-sequence owner before fixture acquisition, so setup/body continuations and late resources can outlive cleanup. Lead confirms no earlier owner or approved disposition. No production/Spec findings: the shared helper preserves local InvalidLaunchCwd bytes and resolved missing/file behavior, returns Host/native reason for rejected nonlocal checks, and retains post-I/O authorization before raising; pool checks precede stopping its old member. Prior-wire generic error mapping remains compatible. C1 failed for incomplete regression lifetime ownership; C2/C3 remain unverified pending corrected-source review and configured same-head evidence. A-20546 plus retained supplement 9e1da9dc preserve precommit targeted 16/16,9/9,unchanged6/6 observations, initial TS2345 failure and repaired typecheck, with missing tree/raw/hash/signal/scan-control facts explicit. No Reviewer tests, edits or full verification.

Criteria: C1 failed (The new refusal/no-row regression callbacks lack pre-acquisition whole-sequence ownership and late-resource adoption before cleanup.).

### rev-36 · 2026-11-17T02:35:57.618Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1586-source-2
commit: bec32badf31b68b211924ccf60253420973d8213
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear A-20555, Standards0/Spec0. All6new callbacks resolve A-20551 ownership finding: fixtureWork before async acquisition, late root/resource adoption, fenced body, Sessions-before-storage bundle closure and guarded root removal; exact diagnostic/code/no-row/no-stop assertions retained. Production unchanged from first review: shared Error|null cwd helper preserves post-I/O authorization, remote thrown Host reason/error-only reply, resolved missing/file and local byte-identical invalid-cwd; pool refuses before idle stop. Independent mapping/Host policy/consumer search and unchanged local launch-component confirmed. A-20553 corrected-source25/25/localtyping/lint0 plus original A-20551 raw/hash/red/candidate limits retained; no configured/Linux/browser/native or Reviewer runtime. C1-C3 implementation accepted, all unverified until completed same-head configured evidence or explicit waiver. No dev merge; holdreleased. Claimant obtains Coordinator window before verify.

### rev-36 · 2026-11-17T03:08:05.999Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1586-final-1
commit: bec32badf31b68b211924ccf60253420973d8213
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: 0 findings. Spec: 0 findings. Final same-head evidence clear; C1-C3 verified using current source clearance rev-36-1586-source-2/A-20555 and completed run 97ccc4bc-ee08-45ef-a003-e7a34d76583a/A-20577. Independent retained-log reconciliation in A-20583: all six new cwd identities each ordinary pass plus five typed load passes/matching 5/5 receipt; unchanged local launch-component file has empty fixed-point diff and all six existing cases pass. Exact Host reason/no-row/no-stop and invalid-cwd/local byte assertions retained. 6547 ordinary test passes, 708 file passes; separate 50 load test/file passes, no nonpass/skips/unmatched emitted starts. T0/T1/all fallback T2/mapped T4 base/Web complete; 269 T3 and 16 other T4 files unexecuted, no T4 repetition claim. Positive actual browser receipt Headless Shell1248/CfT156.0.8078.4; uncached Linuxx64 Node24.21, exact reviewed head. Execution snapshot tree85a0763c is explicitly separate from source Git tree2187e6a2. Budgets/lint/ratchet/advisories remain report-only; original local capture limits retained. Full 14-source-hit inventory plus mapped guard disposition preserved in A-20583. No Reviewer runtime/probe/edit or merge.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-17T04:29:04.398Z

Merged d012671e6a6e35a931c4399bb6a45fffb51af2ca onto dev.
