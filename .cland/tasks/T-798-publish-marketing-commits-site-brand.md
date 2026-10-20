---
id: T-798
kind: task
title: Publish marketing commits (site, brand, README) to GitHub main and site without a release, then sync
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-617
blocked_by: []
topic: topic-694
branch: t/T-798-publish-marketing-commits-site-brand
created: 2026-10-18T10:27:50.246Z
updated: 2026-10-20T07:04:39.728Z
closed: 2026-10-20T07:04:39.728Z
---

## Summary

The human, 2026-10-18 10:27Z in General: marketing material should reach GitHub without waiting for a release, so the scheme needs to be worked out. Today it is done by hand (D56, D59): brand/identity commits are cherry-picked onto GitHub `site`, the same tip is pushed as `main`, the branch is merged into dev, and `cland sync` brings main back under dev so that the next `cland release` passes its behind check. Each step is easy to get wrong. In D56 the branch carried 282 unreleased dev commits and had to be cherry-picked instead of pushed.

## What to build

`cland publish <branch>` (name open) from the Coordinator's or the human's shell:
- takes the branch's commits that dev's last release lacks;
- refuses unless every changed path is in a configured allow-list (default `site/**`, `docs/brand/**`, `README.md`, `LICENSE`, `.github/workflows/pages.yml`);
- with the human's approval (an ask, the same as release), cherry-picks them onto GitHub `main` as a fast-forward and moves `site` to the same tip;
- merges the branch into dev and runs the sync step;
- comments the tip on a tracker item.
A dry run shows the commits, the paths and the resulting tips.

## Acceptance criteria

- [x] C1. A T3 test on a fixture territory with a fake GitHub remote (real Git, one file, about 10 s total) publishes two site-only commits: main and site fast-forward to one tip, dev contains them, and a following `cland release --dry-run` passes the behind check; allow-list, receipt and retry logic is covered in T2 with an injected Git adapter.
  - done: impl-798 · 2026-10-20T06:07:43.948Z
  - verified: rev-31 [reviewer] · run rev-20261020-798-final · 2026-10-20T06:21:31.542Z · commit 158b790d702e01586f3af7acef051edeabfcb1e6
- [x] C2. A commit touching a path outside the allow-list refuses the whole publish and names the path, proved by a test.
  - done: impl-798 · 2026-10-20T06:07:44.554Z
  - verified: rev-31 [reviewer] · run rev-20261020-798-source-corrected · 2026-10-20T06:09:51.561Z · commit 158b790d702e01586f3af7acef051edeabfcb1e6
  - verified: rev-31 [reviewer] · run rev-20261020-798-final · 2026-10-20T06:21:31.542Z · commit 158b790d702e01586f3af7acef051edeabfcb1e6
- [x] C3. The skill docs (`release`) and docs/agents describe publish as the only out-of-release GitHub push, with the human's approval.
  - done: impl-798 · 2026-10-20T06:01:46.296Z
  - verified: rev-31 [reviewer] · run rev-20261020-798-source-corrected · 2026-10-20T06:09:51.561Z · commit 158b790d702e01586f3af7acef051edeabfcb1e6
  - verified: rev-31 [reviewer] · run rev-20261020-798-final · 2026-10-20T06:21:31.542Z · commit 158b790d702e01586f3af7acef051edeabfcb1e6

## Comments

### impl-798 · 2026-10-20T06:01:44.831Z

Implemented cland publish <branch> --item T-n with configured marketing path validation, deterministic ref-free dry-run, atomic GitHub default/site publication, ancestry-preserving dev merge/sync (D59), pinned recovery receipt, tracker audit comment and Coordinator/human CLI authority. Fixture-only tests cover two site commits plus a following release preview, refusal by path, rejected atomic push, local-ref recovery and idempotent comments. Approval is the same documented Coordinator ask workflow as release. T2 retained as explicitly requested; native fixture Git produces report-only tier diagnostics. No real GitHub push, no publish command against this repository, no merge enqueue.

### rev-31 · 2026-10-20T06:05:28.431Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-798-source
commit: 46b08204b455ccd77d17bf7e5ead0be5b174b31a
scope: full
findings: [{"severity":"medium","text":"Pending unpublished receipts bypass current allowPaths checks, so a rejected push can later publish now-disallowed paths after policy tightens.","file":"hub/src/territory-publish.ts","line":40},{"severity":"medium","text":"Two new T2 case bodies measure 2.967992916 s and 2.351534750 s above the documented 2 s case budget; no explicit duration disposition exists.","file":"hub/test/publish-component.test.ts","line":25}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear; A-7120 records full Standards/Spec review, two medium findings. Revalidate current policy before any receipt retry requiring a new GitHub push, with unchanged-public-refs regression; permit local-only recovery after already-published tips. Reduce required T2 case costs or obtain explicit Coordinator duration disposition; preserve A-7117/A-7119 measured evidence. Native-Git T2 placement is explicitly requested and is not itself a finding. C3 documentation checked. Fresh corrected source review required before verification; no suite or merge action by Reviewer.

Criteria: C1 failed (New required T2 publication/recovery cases exceed the 2 s measured case budget without disposition.), C2 failed (Current allow-list is skipped for pending unpublished retries, permitting paths removed since a rejected push.).

### rev-31 · 2026-10-20T06:09:51.561Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-798-source-corrected
commit: 158b790d702e01586f3af7acef051edeabfcb1e6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Replacement source clear; A-7128. M1 resolved by current-policy validation before pending public mutation, with retained red/green regression and already-public local-only recovery. M2 resolved under Coordinator 01c7b6fb/amended C1: six injected resource-enforced T2 passes (max 0.0099525 s) and three native T3 passes (8.523069584 s file); expected three-identity T3 growth disclosed, no budget changes. Optional Git port threaded through shared helpers with production defaults preserved. C2/C3 verified; C1 awaits configured same-head green gate and actual new T1/T2 5/5 receipts, retaining targeted native proof A-7123. No real GitHub publication or merge action.

Criteria: C2 verified, C3 verified.

### rev-31 · 2026-10-20T06:21:31.542Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-798-final
commit: 158b790d702e01586f3af7acef051edeabfcb1e6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7146: current-head A-7138/fcd7d784 independently audited: 1933 ordinary passes, all seven new identities 5/5 (35 distinct repetition passes), no resource/duration failures. C1 verified with retained native 3/3 A-7123 under Coordinator's T3/T2 split; Linux T3 remains deferred, not claimed. C2/C3 reverified with source A-7128. All claimant done marks present. No real publication/merge authorized.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T07:04:39.728Z

Merged 8ed94bda3452ede3d8ff685f2eebc738eec0e94c onto dev.
