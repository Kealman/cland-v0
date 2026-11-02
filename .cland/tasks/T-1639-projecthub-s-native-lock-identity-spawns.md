---
id: T-1639
kind: task
title: projectHub's native lock identity spawns sysctl on macOS, breaking the zero-child spawn census
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1617
topic: topic-1347
branch: t/T-1639-projecthub-s-native-lock-identity-spawns
created: 2026-11-02T19:50:28.431Z
updated: 2026-11-02T20:58:40.270Z
closed: 2026-11-02T20:58:40.270Z
---

## Summary

The macOS stage cover 71abddc6 at dev d82f45fb (A-15961) failed `hub/test/project-probes.test.ts:59` "projectHub defaults launch, signal and stop every harness with zero child processes" with `spawn census row must contain zero children, including imports and cleanup: { execFileSync: 1 }`. Since T-1617, `projectHub` defaults to the native lock identity. On Darwin that capture runs `sysctl` (kern.bootsessionuuid) through `execFileSync`, a child process inside the census window. Linux reads the boot id from a file, so Linux batches and verify runs pass. This blocks every macOS stage cover, and with it the stage closures of E-1532 s1, E-1536 s3 and E-1538 s1.

## What to build

Capture the native identity without a child process inside a test's spawn census. Two ways:
- the suite runner, or the harness at module load before any census, computes the identity once and hands it to fixtures through a test-only environment value or a cache;
- `projectHub` takes the identity lazily, only when a reader needs it.

Production lock code stays as it is.

## Acceptance criteria

- [x] C1. `project-probes.test.ts` passes on macOS under the suite runner at 4 workers, with the census still asserting zero children (test).
  - done: impl-1639 · 2026-11-02T19:54:09.606Z
  - verified: rev-35 [reviewer] · run rev-35-1639-final-1 · 2026-11-02T20:19:29.644Z · commit d3db531f6780a8986136e073448f2d191346921b
- [x] C2. Fixtures that start a real hub still record the native identity, so a dead holder on the same host stays reclaimable, and the foreign negative control is still refused (test).
  - done: impl-1639 · 2026-11-02T19:54:09.697Z
  - verified: rev-35 [reviewer] · run rev-35-1639-final-1 · 2026-11-02T20:19:29.644Z · commit d3db531f6780a8986136e073448f2d191346921b

## Comments

### impl-1639 · 2026-11-02T19:52:19.738Z

Reproduced C1 on Darwin via suite runner at 4 workers: census assertion reported actual { execFileSync: 1 } against {}. Consumer inventory: harness.fixtureLockIdentity is used by projectHub and hub-lock-identity.test.ts; projectHub's default covers pacing-owner fixtures. New test-only CLAND_TEST_LOCK_IDENTITY is produced by runSuite before worker launch, carried by runnerFixtureEnvironment's existing CLAND_TEST_* controls (including load-gate workers), read only by the harness; runner overwrites inherited values, direct calls retain live capture fallback. No production/wire contract changes.

### rev-35 · 2026-11-02T19:55:19.721Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1639-source-1
commit: c9542abd0f8835ecc494006a759bdf1d7f89d22e
scope: full
findings: [{"severity":"low","text":"Shared fixture guidance still says macOS captures one sysctl per test worker; suite-runner execution now captures once in the parent and workers use the supplied value. Distinguish runner handoff from direct harness fallback.","file":"docs/agents/tests.md","line":876}]
finding_counts: {"high":0,"medium":0,"low":1}

T-1639 full source review at c9542abd0f8835ecc494006a759bdf1d7f89d22e. Live claimant impl-1639; request38b513a3-caa6-4e70-b21f-15391cc49f86.

Spec: no findings. Runner captures actual host identity once per invocation before worker observation, replacing any inherited CLAND_TEST_LOCK_IDENTITY. It uses runnerFixtureEnvironment and supplies the resulting value through that builder's existing CLAND_TEST_* controls to base/load workers. Harness import remains lazy and reads the supplied JSON without spawning; direct callers retain native capture fallback. Production lock readers/acquisition/identity policy are unchanged. Unchanged census includes imports/launch/signals/stop/cleanup; unchanged identity/reader regressions retain dead same-host reclamation and explicit foreign negative control.

Standards: one low finding — docs/agents/tests.md:876 still says macOS uses one bounded sysctl per test worker. Update shared guidance to distinguish runner-owned once-per-invocation capture from standalone first-use fallback. New per-file guide accurately describes the runner path. No high/medium findings.

Reviewed complete three-file diff, runner phase setup/worker environment, shared fixture builder and helper consumers. No assertion weakened or new child introduced inside the census. A-15962 reports Darwin arm64 Node24.21 targeted red {execFileSync:1}→green2/2 at4workers plus identity27/readers14/typecheck/lint; these are supplementary local observations, not queued evidence.

C1/C2 remain unverified pending post-source-clear same-head queued results plus named macOS four-worker census outcome/zero-child/native exit receipt at the reviewed source. Linux queued verification alone cannot establish the Darwin criterion. Tier/duration advisories remain report-only. QA scope none. Reviewer ran no tests/browser and made no edits.

### rev-35 · 2026-11-02T19:56:03.085Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1639-source-2
commit: d3db531f6780a8986136e073448f2d191346921b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1639 source re-review at d3db531f6780a8986136e073448f2d191346921b. Scope full, unchanged code carried from rev-35-1639-source-1/A-15963.

Standards: no findings. Complete c9542abd0→d3db531f diff changes only the shared fixture guide, correctly distinguishing once-per-suite-runner native capture through CLAND_TEST_LOCK_IDENTITY from direct harness once-per-process first-use fallback. Sole low resolved; no assertion or production code changed, no dev merge.

Spec: no findings. Earlier runner/environment/identity/census source reasoning remains applicable. C1/C2 stay unverified pending same-head queued evidence and review of the new exact-head Darwin4-worker native census receipt. Reported local census2/2/zerochildren/code0/signalnull is awaiting artifact inspection; not yet a final mark. QA scope none. Reviewer ran no tests/browser and made no edits.

### rev-35 · 2026-11-02T20:19:29.644Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1639-final-1
commit: d3db531f6780a8986136e073448f2d191346921b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1639 final evidence at d3db531f6780a8986136e073448f2d191346921b. Scope evidence. Source clear rev-35-1639-source-2/A-15965 remains applicable; branch tip unchanged. Standards: no findings. Spec: no findings. C1/C2 verified.

C1: independently read A-15964's exact-head local macOS arm64 suite-runner transcript. Both unchanged generated case names pass: "importing the project harness starts zero child processes" and "projectHub defaults launch, signal and stop every harness with zero child processes". Both census diagnostics are exactly0 children including imports/launch/signals/stop/teardown; final file observation remains intact. Transcript records workers4, tests2/pass2/zero fail,cancel,skip,todo; producer reports observed native exit0/signalnull in its exact-head delivery. Local Node v24.21.0, no browser. Prior red {execFileSync:1} is retained in A-15962; it is not a passing run. This Darwin receipt establishes the platform-specific criterion, rather than extrapolating from Linux.

C2: independently streamed A-15971's exact-head timing outcomes: identity27 and reader14 pass, including "native-to-embedded fixture handoff reclaims a dead same-host holder and preserves foreign refusal", with durable native identity/token and explicit foreign no-PID-probe assertions retained. Census2 also pass on Linux. Source review established runner captures current native identity, overwrites inherited values, preserves explicit fixture overrides and direct native fallback, with production lock policy unchanged. All three regression files unedited.

Queued run db884fd3-06e2-433d-a6dc-d1128580dc60/A-15971: exit0,4834 pass,zero fail/cancel/skip/todo. T0/T1/fallback allT2/Web complete; T3 deferred to merge batch,T4 unexecuted. Not full merge-batch coverage.

Provenance: runner tree4cade9d80ff56e19d41c2fe370c41489216b4e24, uncached c-8 sfo2 Linux x64 6.8.0-142-generic droplet Node v24.21.0/Neovim v0.12.5. Isolated browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Host typecheck at runner tree not repeated remotely. Duration/tier/lint/ratchet/skip-reason advisories report-only; skips[]/missing0/occasion null. Executor1306s/$0.0907 are billing, not suite wall time. Projections not execution evidence. QA scope none. Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-02T20:58:40.270Z

Merged 0e824676ecd743d6c10f34dd63687c19d0d3e0a1 onto dev.
