---
id: T-653
kind: task
title: cland release and cland sync move the territory's recorded default branch, not a hard-coded main
state: open
status: review
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
updated: 2026-10-19T04:55:46.669Z
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
- [x] C2. The release itself fast-forwards local and territory `master` to `dev`, pushes `master` and the tag to the stand-in, and creates no `main` anywhere.
  - done: impl-653 · 2026-10-19T04:52:16.337Z
- [x] C3. With a commit on the stand-in's `master` that `dev` lacks, the release refuses with `release-behind` naming `github/master`, and `cland sync` imports it.
  - done: impl-653 · 2026-10-19T04:52:16.775Z
- [x] C4. A project without `cland.defaultBranch` releases and syncs `main` as before (the existing release, release-item and sync tests pass unchanged).
  - done: impl-653 · 2026-10-19T04:52:17.333Z

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
