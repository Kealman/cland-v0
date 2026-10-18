---
id: T-645
kind: task
title: cland release refuses with release-version when dev's package.json version differs from the release's
state: open
status: review
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - init
  - hub
assignee: null
parent: E-612
blocked_by:
  - T-644
topic: topic-504
branch: t/T-645-cland-release-refuses-with-release
created: 2026-10-16T16:23:58.697Z
updated: 2026-10-18T11:15:51.122Z
---

## Summary

The version a release tags must be the version its build reports. `cland release` and `cland release --dry-run` read the root `package.json` at `dev`'s tip and refuse with the code `release-version` when its version differs from the release's; the bump is an ordinary commit merged before the dry run, and the release never writes it (spec v0.1.4 §3.1; Q-599 resolution 7, Q-592).

## What to build

- **The check**, in the release's preparation (`hub/src/territory-release.ts`, beside the existing `release-version` checks in `hub/src/hub/releases.ts`), for the item flow (`--item R-<n>`) and the version flow (`cland release vX.Y.Z`) alike, dry run included: `git show <dev tip>:package.json`, its `version` compared with the release's `X.Y.Z`. A mismatch throws `ReleaseError('release-version', 'dev's package.json says 0.1.3, the release is v0.1.4: commit the bump on dev, merge it, then preview again')`. The working copy is never read, so an uncommitted bump does not pass.
- **Scope.** The check applies when `dev`'s root `package.json` declares a `version`; a project without that file or that key releases as today (an open question in the README).
- **Never a write.** The release creates no commit and changes no file to fix the version.
- **The release skill.** `.agents/skills/release/SKILL.md` step 2 names the bump: before the dry run, the root `package.json` version equals the release's, through an ordinary merged commit. The hub README's release section lists the refusal.

## Acceptance criteria

- [x] C1. `cland release --item R-<n> --dry-run` on a test project whose `dev` says 0.1.3 while the item's version is 0.1.4 refuses with `release-version` and names both versions (release-item.test.ts).
  - done: impl-645 · 2026-10-18T11:14:53.568Z
- [x] C2. The same refusal for `cland release v0.1.4 --dry-run` and for the release without `--dry-run`, and nothing moves: `main`, the tags and the territory are unchanged (release.test.ts).
  - done: impl-645 · 2026-10-18T11:14:54.020Z
- [x] C3. A bump committed on `dev` to 0.1.4 lets the dry run pass; the bump left uncommitted in the working copy does not.
  - done: impl-645 · 2026-10-18T11:14:54.895Z
- [x] C4. A project whose root has no `package.json` previews and releases as before (the existing release tests pass unchanged).
  - done: impl-645 · 2026-10-18T11:14:55.381Z
- [x] C5. The release skill's step 2 names the bump commit before the dry run.
  - done: impl-645 · 2026-10-18T11:14:55.742Z
  - verified: rev-31 [reviewer] · run rev-20261018-645-source · 2026-10-18T11:15:51.122Z · commit 0d5f74a57d376eb4b87a91185b3109621d735b9a

## Comments

### impl-645 · 2026-10-18T11:12:34.056Z

Red confirmed: the version-flow test accepted a dry run while dev's package.json said 0.1.3 and the uncommitted checkout said 0.1.4 (test 1.96 s). Testing the agreed native-Git release seam in existing T3 files: selecting the committed build and proving no refs move requires real fixture repositories; no new hub processes. New test timeout is 5 s.

### rev-31 · 2026-10-18T11:15:51.122Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-645-source
commit: 0d5f74a57d376eb4b87a91185b3109621d735b9a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-645 source review

Commit: 0d5f74a57d376eb4b87a91185b3109621d735b9a
Fixed base: 80e90ab25609479ccb8a664ff45b1987e23da3bc
Run: rev-20261018-645-source
Scope: full
Result: clear

Reviewed the five-file diff, releaseGit preparation and receipt recovery, item/version callers, shared Git fixture ownership, release skill step 2, hub README, task C1–C5 and spec v0.1.4 §3.1. Origin matches the requested commit. No Reviewer test execution or edits.

## Standards
No findings. The three new tests remain in existing T3 release files, explain their native Git commit/ref boundary and add no hub process, worker or elapsed-time wait. Each has a five-second hard timeout. Existing harness ownership remains in use. No duration allowance or tier change. The read-only guard uses the shared async Git boundary and existing resumed exception handling.

A-5230 reports the pre-fix preview acceptance despite committed 0.1.3/uncommitted 0.1.4 (red), release-item 9/9 in 14.71 s, release 18/18 in 62.75 s, new cases 2.46/3.49/1.98 s and host typecheck/lint/diff checks green. This retained summary is targeted evidence, not a post-source-clear task result.

## Spec
No findings. Both release forms share releaseGit, where ls-tree establishes whether the pinned dev commit contains root package.json and git show reads that exact commit. A declared version is compared to the release tag without its v prefix; mismatch raises release-version naming both versions and explaining the ordinary bump/merge/preview sequence. There is no working-copy read, auto-bump or version commit.

The guard runs before new tag preparation, recovery receipt creation, ref updates or publication. Already published receipt recovery remains ahead of the guard so a later dev version cannot strand a published build. Required Git/JSON reads do not silently pass after failure. Missing package metadata or its version key retains previous compatibility.

Tests cover item preview refusal; version preview and real publication refusal with unchanged local/territory/fixture-GitHub refs and checkout bytes; an uncommitted bump failing versus a committed bump previewing the selected dev SHA; and an unversioned package previewing and publishing unchanged. Existing absent-package tests are unmodified. C1–C4 require the post-source-clear exact-head task receipt.

C5 verified by source: release skill step 2 explicitly requires an ordinary reviewed version bump merged onto dev before preview, describes release-version refusal and says release never writes the bump. README documents both forms, absent-file/key compatibility and pinned receipt recovery.

Source clear; no per-item QA. Submission must wait for the Coordinator's hub-restarted notice as requested; this verdict does not release the restart hold.

Standards: zero findings. Spec: zero findings.

Artifact A-5231.

Criteria: C5 verified.
