---
id: T-653
kind: task
title: cland release and cland sync move the territory's recorded default branch, not a hard-coded main
state: open
status: ready
size: M
criterion_seq: 4
labels:
  - v0.1.4
  - init
  - hub
assignee: null
parent: E-612
blocked_by:
  - T-652
topic: topic-552
branch: t/T-653-cland-release-and-cland-sync-move-the
created: 2026-10-16T16:24:02.732Z
updated: 2026-10-19T05:12:02.203Z
---

## Summary

A project whose default branch is `master` keeps it (spec v0.1.4 §3.2): its releases fast-forward `master` to `dev`, tag it and push `master` to GitHub, and `cland sync` imports GitHub's `master`. The release and sync code read ticket T-652's recorded default branch wherever they name `main` today; a project without the record behaves exactly as before. Whether this belongs to E-612 is an open question in the README.

## What to build

- In `hub/src/territory-release.ts` and the hub's release and sync paths (`hub/src/hub/releases.ts`, `hub/src/cli/release.ts`): every `refs/heads/main` (the local ref, the territory's, GitHub's in `ls-remote` and the fetch, the receipt's `main` field as the branch's tip, the "main is checked out" and "main is not an ancestor of dev" refusals) takes `defaultBranch(root)`.
- Refusal messages name the branch (`master is checked out; …`, `github/master has commits dev lacks`).
- The receipt (`.cland/release.tmp`) keeps its shape; a receipt written before this change still resumes.
- The release skill (`.agents/skills/release/SKILL.md`) and the hub README's release and sync sections say "the default branch (`main` unless the territory records another)" where they say `main`.

## Acceptance criteria

- [x] C1. In a test project whose territory records `master`, `cland release v0.1.0 --dry-run` previews `<dev>:refs/heads/master` and the tag (release.test.ts with the on-disk GitHub stand-in).
  - done: impl-653 · 2026-10-19T04:52:15.985Z
  - verified: rev-30 [reviewer] · run rev-20261019-653-final · 2026-10-19T05:12:00.704Z · commit c2f5a91810e6b69837789b6c4192087ce712ed85
- [x] C2. The release itself fast-forwards local and territory `master` to `dev`, pushes `master` and the tag to the stand-in, and creates no `main` anywhere.
  - done: impl-653 · 2026-10-19T04:52:16.337Z
  - verified: rev-30 [reviewer] · run rev-20261019-653-final · 2026-10-19T05:12:00.704Z · commit c2f5a91810e6b69837789b6c4192087ce712ed85
- [x] C3. With a commit on the stand-in's `master` that `dev` lacks, the release refuses with `release-behind` naming `github/master`, and `cland sync` imports it.
  - done: impl-653 · 2026-10-19T04:52:16.775Z
  - verified: rev-30 [reviewer] · run rev-20261019-653-final · 2026-10-19T05:12:00.704Z · commit c2f5a91810e6b69837789b6c4192087ce712ed85
- [x] C4. A project without `cland.defaultBranch` releases and syncs `main` as before (the existing release, release-item and sync tests pass unchanged).
  - done: impl-653 · 2026-10-19T04:52:17.333Z
  - verified: rev-30 [reviewer] · run rev-20261019-653-final · 2026-10-19T05:12:00.704Z · commit c2f5a91810e6b69837789b6c4192087ce712ed85

## Comments

### impl-653 · 2026-10-19T04:50:23.005Z

Test-first progress: master preview/publication failed with hard-coded main before implementation, then passed; master sync failed on the remaining main ref in completion, then passed. Added isolated T3 native Git fixtures (scratch HOME/XDG, fixture identity, local bare stand-in, in-process hub). Receipt/result field names stay compatible. Host typecheck and test:lint pass; release.test.ts 20/20 green in 52.03s before final legacy coverage addition. Source review will precede the mode-free droplet T0–T2 run; T3 batch evidence remains deferred.

### rev-30 · 2026-10-19T04:55:46.669Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-653-source
commit: c2f5a91810e6b69837789b6c4192087ce712ed85
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards and Spec audits A-5780 have no findings. Recorded default reaches advertisement/fetch, preview, atomic pushes/leases, local/territory completion, recovery, sync replay and branch-specific refusals. Async hub config read and compatibility receipt/result field names retained; missing setting uses main. Three isolated native Git T3 controls cover master/no-main publication, ahead refusal/sync, and legacy main receipt recovery; existing assertions retained. C1–C4 await accepted runtime evidence, no criteria verified here. One normal mode-free configured droplet task gate may now run at unchanged c2f5a918; T3 execution remains merge-batch evidence. QA scope none.

### impl-653 · 2026-10-19T05:10:49.376Z

Same-head mode-free task verification passed: 4ab2f1c5-8f2a-4174-8505-e8696d4cf463 at c2f5a91810e6b69837789b6c4192087ce712ed85, log A-5783. Linux x64 droplet c-8 lon1, lifetime 860s, cost $0.0597; 1463/1463 tests passed, no failures/cancellations/skips. Queue-enabled T0–T2 task evidence is green; T3 is deferred to the merge batch. Source remains unchanged after rev-20261019-653-source. Reviewer received the receipt directly and owns final runtime settlement; supervising Lead/Coordinator receives the hub ready event.

### rev-30 · 2026-10-19T05:12:00.704Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-653-final
commit: c2f5a91810e6b69837789b6c4192087ce712ed85
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; audit A-5787 combines source A-5780, exact-head T0–T2 gate 4ab2f1c5/A-5783 (1463/1463, zero fail/cancel/skip; 383 repetition groups all 5/5), and native host evidence A-5784–A-5786. Master preview/publication/no-main, github/master ahead refusal/sync, and legacy main/receipt recovery pass; unchanged item and scenario controls pass. Host logs are pre-commit implementation-worktree evidence with the final CLI fallback edit/provenance limit explicitly disclosed, not exact-SHA T3 invocations. Three existing report-only T-803 trips disclosed. T3 remains deferred to the hub-owned merge batch; no task T3 execution claimed. C1–C4 verified; no findings, QA scope none.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
