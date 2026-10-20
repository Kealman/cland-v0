---
id: T-964
kind: task
title: 'Sealed fixture environments drop the git identity: release/sync tests fail "Committer identity unknown" (T-961 regression)'
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - regression
assignee: null
parent: E-952
blocked_by: []
regression_of: T-961
found_by: cover
topic: topic-740
branch: t/T-964-sealed-fixture-environments-drop-the-git
created: 2026-10-20T11:54:58.184Z
updated: 2026-10-20T12:15:50.973Z
closed: 2026-10-20T12:15:50.973Z
---

## Summary

The periodic dev T3 run at 224d45cc (b5fc792c, log A-7568) is red. Three release.test.ts cases fail with `cland: git var GIT_COMMITTER_IDENT: Committer identity unknown` ("release publishes the recorded master default…", "sync imports master after release refuses…", "legacy publication receipts recover main…"). The culprit search pinned cover-quiet.test.ts "release worker admits its cover lease before isolated scratch startup" to eeb7e08e (T-961): green at f7ea5971, red at eeb7e08e (A-7583, A-7584). T-961's sealed builder replaces HOME and the Git config, so any fixture that commits, rebases or releases no longer has a committer identity.

## What to build

The sealed fixture environment supplies a fixed synthetic Git identity: GIT_AUTHOR_NAME/EMAIL and GIT_COMMITTER_NAME/EMAIL with an obviously fake test value, or an equivalent in the sealed Git config. That restores every fixture that writes commits without reintroducing the human's config. Check the other failures in A-7568 for the same cause (demo, doctor-isolation, orphan-servers, droplet-verify) and fix those that trace to the sealed builder. Name the ones that don't in your evidence, because the culprit search is still bisecting them.

## Acceptance criteria

- [x] C1. release.test.ts, cover-quiet.test.ts, demo.test.ts and scenarios/droplet-verify.test.ts pass in targeted local runs at the fix head with the sealed environment (their Linux T3 receipt is landing evidence from the next periodic dev T3).
  - done: impl-964 · 2026-10-20T12:01:10.494Z
  - verified: rev-23 [reviewer] · run rev-20261020-964-final · 2026-10-20T12:11:15.828Z · commit 9ca0384f85d46ac539910bc0a03a54ea4726e02d
- [x] C2. The T1 poisoned-parent self-test still shows no host Git config or HOME leaks; the synthetic identity is a fixed test value.
  - done: impl-964 · 2026-10-20T12:01:11.253Z
  - verified: rev-23 [reviewer] · run rev-20261020-964-final · 2026-10-20T12:11:15.828Z · commit 9ca0384f85d46ac539910bc0a03a54ea4726e02d
- [x] C3. The evidence lists each A-7568 failure as fixed here, or as not caused by T-961, with its reason.
  - done: impl-964 · 2026-10-20T12:01:12.016Z
  - verified: rev-23 [reviewer] · run rev-20261020-964-source · 2026-10-20T12:02:40.548Z · commit 9ca0384f85d46ac539910bc0a03a54ea4726e02d
  - verified: rev-23 [reviewer] · run rev-20261020-964-final · 2026-10-20T12:11:15.828Z · commit 9ca0384f85d46ac539910bc0a03a54ea4726e02d

## Comments

### impl-964 · 2026-10-20T11:59:51.306Z

Committed/pushed 9ca0384f. Adds fixed Fixture Test <fixture@example.test> author/committer defaults, preserves the demo restart's typed syntheticProvider, and restores only named project-contained core.excludesFile injection through typed scratchGitConfig. Arbitrary config/credentials stay filtered. Coordinator classified doctor-isolation, orphan-servers and Linux Neovim descriptor as T-807 follow-ups. Final-head targeted runs underway; source review will precede queued verification.

### rev-23 · 2026-10-20T12:02:40.548Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-964-source
commit: 9ca0384f85d46ac539910bc0a03a54ea4726e02d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Fixed synthetic author/committer defaults retain filtering; typed project-owned core.excludesFile and syntheticProvider restart preserve native assertions without arbitrary config/token admission. A-7596 records source review and direct Coordinator scope decision3c8ca998. A-7594 classifies all nine A-7568 failures; C3 verified. Exact-head local targets release22/cover15/demo5/droplet4 and pure4 are retained, Linux T3 expressly deferred as C1 says. C1/C2 final settlement awaits normal mode-free same-head task verification. No item QA. Reviewer ran no tests.

Criteria: C3 verified.

### rev-23 · 2026-10-20T12:11:15.828Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-964-final
commit: 9ca0384f85d46ac539910bc0a03a54ea4726e02d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7609 audits A-7607/run4ed24408 at exact source-clear head:2052/2052 ordinary tests;poisoned-env4/4,new Git-excludes5/5 load passes. C1 accepted local exact-head native targets in A-7594(release22,cover15,demo5,droplet4), not Linux task execution; C2 synthetic identity/isolation source+T1 proof; C3 nine-failure classification per Coordinator3c8ca998. Historical A-7568 red retained,three T-807 follow-ups separate. Linux T1/all-T2 includes Neovim;native T3/T4 deferred as C1 says. Host check35a1b40e not repeated;lint/budgets/ratchet report-only,missing/incomplete timings not passes. No item QA.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T12:15:50.973Z

Merged 97d9706d6d0e2002cd557030ad0e30eb42948534 onto dev.
