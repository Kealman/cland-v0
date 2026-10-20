---
id: T-928
kind: task
title: "suite-runner.test.ts takeover/sweep cases see a shared suite lock inside a local integrated run (macOS cover #3)"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-915
found_by: cover
topic: topic-683
branch: t/T-928-suite-runner-test-ts-takeover-sweep
created: 2026-10-20T02:12:06.171Z
updated: 2026-10-20T02:27:49.933Z
closed: 2026-10-20T02:27:49.933Z
---

## Summary

In stage cover #3's macOS run fb3edd9f (A-6951), five `hub/test/suite-runner.test.ts` cases fail: takeover removes a root…, takeover reaps a child paused…, a SIGKILL after launching a real daemon…, the final sweep reports and kills an orphan…, and the phase receipt counts and reaps a detached hook bridge…. One shows `waiting for the suite lock held by pid 13973 since 02:06:56Z; queue position 1/1; holder worktree /Users/evgeniyivanov/Projects/cland/v0`. So the fixture runner saw a real or shared suite lock, not its own isolated one. They passed in macOS cover #2 (A-6795, 23:27Z). Suspects among tonight's landings: T-918 (socket and temp placement now falls back to short /tmp paths), T-916 (admission identity before an env swap), T-924/T-925.

## What to build

Find why the runner fixtures resolve a lock or root shared with the live machine (or with each other) inside a local integrated run, and restore per-fixture isolation. Keep production lock behaviour unchanged.

## Acceptance criteria

- [x] C1. The cause is named, with the commit that introduced it.
  - done: impl-928 · 2026-10-20T02:16:23.379Z
  - verified: rev-23 [reviewer] · run rev-20261020-928-source · 2026-10-20T02:20:24.259Z · commit 96690bdfaefb4f21cc8c44bb4f1f489f9076d6dc
  - verified: rev-23 [reviewer] · run rev-20261020-928-final · 2026-10-20T02:23:56.373Z · commit 96690bdfaefb4f21cc8c44bb4f1f489f9076d6dc
- [x] C2. suite-runner.test.ts passes locally on macOS 3/3 while a fake outer integrated run holds the machine lock (simulated in the test or by fixture), with receipts.
  - done: impl-928 · 2026-10-20T02:18:21.618Z
  - verified: rev-23 [reviewer] · run rev-20261020-928-source · 2026-10-20T02:20:24.259Z · commit 96690bdfaefb4f21cc8c44bb4f1f489f9076d6dc
  - verified: rev-23 [reviewer] · run rev-20261020-928-final · 2026-10-20T02:23:56.373Z · commit 96690bdfaefb4f21cc8c44bb4f1f489f9076d6dc
- [x] C3. A mode-free verify at the reviewed head is green.
  - done: impl-928 · 2026-10-20T02:23:08.659Z
  - verified: rev-23 [reviewer] · run rev-20261020-928-final · 2026-10-20T02:23:56.373Z · commit 96690bdfaefb4f21cc8c44bb4f1f489f9076d6dc

## Comments

### impl-928 · 2026-10-20T02:17:02.172Z

Cause: 03711a4299e87bac9dbb9e19a03f6e32c2669ed7 (T-915) enables budget.mode=enforce. Four low-level runSuite fixture call sites inherited repository cwd and therefore its duration/tier manifests; generated .mjs targets have no repository tier. A-6951 shows missing-tier budget errors after successful fixture assertions/cleanup. Its stale-holder pid is the intentionally killed fixture runner, whose worktree field inherited ROOT. Fix pins fixture cwd at all four calls; production locks unchanged. Audit of all runSuite/runPackageSuite fixtures in hub/test and nvim/test found no other omitted cwd. Original red A-6966, cwd assertion red A-6967; post-fix targeted assertion green. npm run check passed. origin/dev fetched and merged (already up to date); reviewed candidate 96690bdfaefb4f21cc8c44bb4f1f489f9076d6dc pushed to local origin. Fake-outer-held file repetitions still completing.

### impl-928 · 2026-10-20T02:18:22.207Z

C2 complete: macOS darwin arm64, Node v24.21.0, 3/3 full suite-runner.test.ts targeted-file runs green; each executed all 43 tests (43 pass, 0 fail), durations 64.17s / 64.61s / 62.26s. Fake integrated-holder harness A-6972 holds private broker compatibility fences AND the private machine phase lock for all three runs, passes its inherited lease to each worker, and asserts both owner sidecars and holder.json files remain byte-for-byte unchanged after each run. Discovery explicitly points to an absent temporary hub file; no real machine lock/live hub touched. Run logs A-6973, A-6977, A-6978; summary A-6979. Commit 96690bdfaefb4f21cc8c44bb4f1f489f9076d6dc.

### rev-23 · 2026-10-20T02:20:24.259Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-928-source
commit: 96690bdfaefb4f21cc8c44bb4f1f489f9076d6dc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at exact 96690bdf; Standards 0 findings, Spec 0 findings. A-6987 records the full audit. T-915 commit 03711a42 enabled enforce mode, exposing four runSuite fixtures inheriting repository cwd/manifests; A-6966 shows successful inner fixture followed by missing-tier budget failure, and A-6967 protects cwd with a red-before assertion. All four now pass fixture cwd; private locks and all existing lifecycle assertions remain, no production change. Independently inspected private outer-holder harness A-6972, summary A-6979 and complete Mac logs A-6973/A-6977/A-6978: 3/3 whole-file passes, 43/43 each, 129 total, zero nonpasses, owner/holder records unchanged. C1/C2 verified. C3 remains unverified pending normal mode-free verify at this unchanged head; task T0–T2 does not execute the T3 runner file, whose Mac proof is C2 and Linux execution remains periodic/integrated. Reviewer ran no tests.

Criteria: C1 verified, C2 verified.

### impl-928 · 2026-10-20T02:23:09.251Z

C3 complete: normal mode-free verify 1182ae67-cd0b-4150-8242-a5b76897a00b at reviewed 96690bdfaefb4f21cc8c44bb4f1f489f9076d6dc, auto exit 0, A-6989. Actual execution: T1 exit 0 (37s, 101 files / 559 measured tests); T2 command exit 0 (1s, no selected T2 tests); overall 561 pass / 0 fail. T3 deferred by task policy (absent configured batch tiers); C2 separately proves all 43 suite-runner T3 tests 3/3 on macOS. Configured droplet: Linux x64, c-8 lon1, lifetime 105s, cost $0.0073. No source/head changes since review.

### rev-23 · 2026-10-20T02:23:56.373Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-928-final
commit: 96690bdfaefb4f21cc8c44bb4f1f489f9076d6dc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged 96690bdf. A-6991 records independent A-6989 audit: mode-free 1182ae67 exits 0 at this exact head; 561 canonical test passes, 101 file passes, zero nonpasses/budget/resource/admission failures. Host check green; T1 executes 101 files (559 measured timing identities), selected T2 command exits 0 with no tests. This does not execute the T3 suite-runner file. C1/C2 remain established by source A-6987 and the three complete Mac 43/43 receipts under the private fake outer integrated holder (A-6972/A-6973/A-6977/A-6978/A-6979); C3 now verified by the normal task gate. Linux T3 remains periodic/integrated landing evidence. No source change, no Reviewer test execution, no findings on either axis. All C1–C3 verified.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T02:27:49.933Z

Merged ef6078e978286476bd7b248ee94735bdd9fd0e44 onto dev.
