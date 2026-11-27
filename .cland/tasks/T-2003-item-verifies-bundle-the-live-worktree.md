---
id: T-2003
kind: task
title: Item verifies bundle the live worktree after T0, so an untracked file written meanwhile fails delivery
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1807
branch: t/T-2003-item-verifies-bundle-the-live-worktree
created: 2026-11-19T10:53:04.604Z
updated: 2026-11-27T09:45:41.148Z
---

## Summary

An item `cland verify` bundles the live worktree after its local T0, so any untracked file written into the worktree between T0 and delivery fails the run with "dirty or changed worktree cannot be bundled for droplet". T-1728's run 81d5f3dc died that way on 2026-11-19 after a native test log landed in the worktree. T-1652 already made soak and periodic runs bundle the submitted commit's objects instead of the live root.

## What to build

Item verifies bundle the head commit that was submitted, captured at admission, from Git objects. Untracked or later working-tree changes neither enter the bundle nor fail delivery. A head that moved after admission is still refused, with its own message. Report-only notes may name untracked files seen at bundling.

## Acceptance criteria

- [x] C1. An untracked file created in the item worktree after T0 doesn't fail or enter the delivered bundle; the droplet receives exactly the submitted commit's tree (test with a fake executor).
  - done: impl-2003 · 2026-11-27T09:34:47.776Z
- [x] C2. A commit made to the item branch after admission is refused with a distinct "head moved" diagnostic (test).
  - done: impl-2003 · 2026-11-27T09:10:38.995Z
- [x] C3. Every bundle path is listed with whether it pins the submitted commit (rule 41), building on T-1652's census.
  - done: impl-2003 · 2026-11-27T09:10:39.085Z
  - verified: rev-35 [reviewer] · run rev-35-2003-source-3 · 2026-11-27T09:36:25.672Z · commit 5916199c324d5fcb616b71acaaadace61deeb241

## Comments

### impl-2003 · 2026-11-27T09:07:53.202Z

Consumer census (rule 20/41): searched runBundle, committedOnly, bundle create, old dirty-worktree/HEAD diagnostics across hub/src, hub/test, nvim/test, docs and shipped skills. Production: Suites single/shard launches and replacement/recovery; DropletExecutor.deliver forwarding; DropletRun initial and missing-base full retry; runBundle dependency seam. Native receiver regression extended; suite-cover asserts integrated committedOnly unchanged; executor-prepare-component stubs bundle bytes for transport (unaffected signature); scripted-machine fake keeps same arguments. No frozen CLI help or wire shape changed. prepareBundle image snapshot and host registry bootstrap are separate non-item paths; census documented in docs/hub/running.md. Admission still requires clean tree. New item delivery changes only post-admission dirtiness checks to HEAD fences.

### rev-35 · 2026-11-27T09:18:09.983Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2003-source-1
commit: edd9f8c1065281d0c1128fae6c0facac0c301a0f
scope: full
findings: [{"severity":"medium","text":"M1: HEAD-only post-T0 fence permits tracked edits while #hostGate records only its pre-command tree1665/1672. Remote delivery can reuse that stale receipt and skip T0 for the pinned commit. Re-observe source identity, invalidate uncertain/changed reuse and run T0 remotely without refusing dirty-byte delivery; retain moved-head refusal (rules17/25–26).","file":"hub/src/hub/suites.ts","line":1319}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at corrected full SHA; A-23774 records one confirmed M1 and the correction/control bar. Fake gate mutation returning ref.tree masks reuse-identity gap, acknowledgedc86af43f. Keep pinned-object bundles and later-worktree-write delivery; establish host T0 identity before reuse or recheck remotely, with changed-during-gate and unchanged positive controls. Commit-move diagnostic and receiver tree/ref proofs otherwise match scope. C3 bundle-path census independently established in source; C2/runtime and final criteria remain unverified. A-23771 is authored selected macOS/native-Git/fake-executor evidence, not configured/Linux/full tiers; graph736/19 is not coverage. Hold released for correction/authorized checks; fresh committed-head review before verify, no dev merge. No Reviewer edits or runs.

Criteria: C1 failed (M1: pinned verification must not reuse a host T0 receipt whose source identity changed or became unknown during the command.).

### impl-2003 · 2026-11-27T09:23:14.537Z

M1 correction: host T0 re-observes candidate identity after command close, clears reusable tree when changed/unavailable, retains native exit in hostGate/log and emits no submitted-tree tier proof for uncertain inputs. Native tests add unchanged positive reuse control; actual production detached-check shell executes in fetched checkout with durable command receipt. hostCheckCommand extraction is consumed by DropletRun and native regression only; no signature/protocol/schema change. Meaningful red: unchanged passed, dirty cases failed stale identity; corrected native file 7/7. Initial draft run had bounded test-fixture deadlines after a caught delivery assertion; outcome asserted before start wait now prevents masking such failures.

### rev-35 · 2026-11-27T09:30:53.191Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2003-source-2
commit: 648f07d4ce279337a98a3e49385e53db799874fa
scope: delta
findings: [{"severity":"medium","text":"M1-R: record clears uncertain host identity but still throws for every nonzero native exit, so later dirty bytes can fail pinned-commit delivery before detached T0 decides. New controls return zero and miss this path.","file":"hub/src/hub/suites.ts","line":1662}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23776 records the five-file correction review at Git tree 889f267800fc386ff74b99234c038464bad3491d. Passing-host reuse is now correctly invalidated after changed/unavailable post-command identity, and production hostCheckCommand execution is positively controlled at the detached receiver. Sole remaining medium M1-R is the unconditional nonzero branch. Preserve native diagnostics and unknown identity, cancellation/interruption policy, positively unchanged-input failures and moved-head refusal; add uncertain-nonzero remote-check/final-outcome and known-unchanged failure controls while retaining existing assertions. C1 failed; C2 remains runtime-unverified; C3 census remains a positive source subproof without a formal verified mark on this not-clear pass. A-23775 remains scoped local macOS arm64 Node24.21.0 evidence; no configured run credited. Review hold/freeze released for this correction and Coordinator-authorized checks. Fresh committed-head source review required before verification; no dev merge or Reviewer execution.

Criteria: C1 failed (Uncertain nonzero host T0 remains a terminal delivery failure instead of diagnostic evidence followed by pinned remote T0.).

### impl-2003 · 2026-11-27T09:33:19.662Z

M1-R red/green: three uncertain-nonzero host cases failed first with 'host check failed (exit 1); no droplet created', while unchanged-failure and interruption controls passed. Final native file 13/13 after correction. Host exit remains durable/logged, ordinary unknown-source failure defers to detached T0, whose actual shell exit 0/2 feeds fake executor final outcome. Positive identity must equal admitted tree as well as post-command observation. Cancellation/interruption and bound unchanged failures still refuse. No new wire shape or consumer interface; existing bundle/hostGate consumer census retained.

### rev-35 · 2026-11-27T09:36:25.672Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2003-source-3
commit: 5916199c324d5fcb616b71acaaadace61deeb241
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23778 records the final-round delta review under Coordinator 4b43f870 at Git tree 84d051d2dacfe86767195769828bae8ed809b542. Standards and spec: no remaining findings. M1-R resolved: identity must match both post-command inputs and admitted tree; uncertain ordinary nonzero host exits retain diagnostics and defer to detached T0, while positively unchanged failure, cancellation and interruption remain authoritative. Six new cases exercise actual production remote-check rendering, native remote exit0/2 and independent final completion, with host exit/log retention and zero-delivery negative controls; prior seven assertions remain. C3 bundle census verified from source; C1/C2 remain run-dependent and unverified. A-23777 and request counts are authored selected local macOS arm64 Node24.21.0 evidence, not configured/Linux/full-tier proof. Prior failures remain historical. Source clear only: request Coordinator window for exact-head configured verify; final evidence settlement still required. No Reviewer execution or edits.

Criteria: C3 verified.
