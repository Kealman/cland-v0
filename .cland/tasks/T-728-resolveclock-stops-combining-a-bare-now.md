---
id: T-728
kind: task
title: resolveClock stops combining a bare now callback with native timers; fixtures pass a complete Clock
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-696
topic: topic-438
branch: t/T-728-resolveclock-stops-combining-a-bare-now
created: 2026-10-17T07:54:46.590Z
updated: 2026-10-17T14:23:49.910Z
closed: 2026-10-17T14:23:49.910Z
---

## Summary

`resolveClock` accepts a bare legacy `now` callback and combines it with native timers. Since adapters consume `core.clock` (T-685, T-696), a fixture that passes a frozen or offset `now` silently builds a hybrid: frozen timestamps with real timers. That hybrid caused T-696's red run 181884dc (A-4365), where a relaunched session's pid was never discovered within 45 s. T-696 fixed the one fixture it hit.

## What to build

`resolveClock` stops building hybrids. The bare-callback form is refused, or kept only behind an explicit wrapper that makes the mixed domain visible. Every timer-owning fixture passes a complete Clock object instead: the FakeClock, the real clock, or an offset real clock. The test docs name the rule.

## Acceptance criteria

- [x] C1. Passing a bare `now` callback to a hub or adapter fixture is refused or explicitly wrapped, proved by a T1 test, and no fixture in hub/test still passes one.
  - done: impl-728 · 2026-10-17T11:53:48.656Z
  - verified: rev-30 [reviewer] · run rev-20261017-728-source · 2026-10-17T11:55:56.397Z · commit 4bf57a1ce8324166788b803f1a18bbd848c8ca34
  - verified: rev-30 [reviewer] · run rev-20261017-728-final · 2026-10-17T14:23:23.399Z · commit 4bf57a1ce8324166788b803f1a18bbd848c8ca34
- [x] C2. Every migrated fixture's tests keep their assertions' meaning, and the touched files pass 5/5 serially on the Mac and in the task's droplet verify.
  - done: impl-728 · 2026-10-17T14:22:05.191Z
  - verified: rev-30 [reviewer] · run rev-20261017-728-final · 2026-10-17T14:23:23.399Z · commit 4bf57a1ce8324166788b803f1a18bbd848c8ca34
- [x] C3. "Test levels" in docs/agents/tests.md says a test injects one complete Clock, never a bare now callback.
  - done: impl-728 · 2026-10-17T11:53:49.020Z
  - verified: rev-30 [reviewer] · run rev-20261017-728-source · 2026-10-17T11:55:56.397Z · commit 4bf57a1ce8324166788b803f1a18bbd848c8ca34
  - verified: rev-30 [reviewer] · run rev-20261017-728-final · 2026-10-17T14:23:23.399Z · commit 4bf57a1ce8324166788b803f1a18bbd848c8ca34

## Comments

### impl-728 · 2026-10-17T11:38:51.842Z

Implementation in progress: resolveClock now rejects bare now injection at type and runtime boundaries; T1 red→green regression records the refusal and complete/default clock identity. Migrated the 16 legacy HubCore/startHub call sites (including hub/src/hub/store.test.ts) to FakeClock, with protocol-only cases on inProcessSpoke. Native subscription relaunch retains its explicit offset realClock. Visibility's exact seven-day and +1ms assertions reopen retained storage in-process before the timer-free leap. No baselines or allowances changed. Typecheck and test:tiers pass; report-only test lint captured. Serial Mac 5/5 checks running; one asks approval timeout is under comparison with the Coordinator per A-4481.

### impl-728 · 2026-10-17T11:54:05.800Z

Review requested from the Reviewer role at committed/pushed 4bf57a1ce8324166788b803f1a18bbd848c8ca34. Evidence A-4492 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4492-t-728-assertion-audit-and-mac-5-5-timing-evidence.md includes every changed declaration, unchanged assertion meanings, manifest baselines and all serial 5/5 file samples. All ten files are green, typecheck/tiers green, native approval completion fix 10/10 isolated plus asks 5/5; control and attribution limits are documented per Coordinator. C1/C3 done. C2 awaits exact-reviewed-head droplet verify after source clear. No item QA required by policy.

### rev-30 · 2026-10-17T11:55:56.397Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-728-source
commit: 4bf57a1ce8324166788b803f1a18bbd848c8ca34
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at4bf57a1c against fixed c0763941; Standards0/Spec0 findings, full analysis A-4494. ClockOptions and resolveClock refuse bare timestamp injection while preserving default/supplied Clock identity; T1 refusal/type regression and pinned-tree caller audit support C1. Docs complete-clock rule supports C3. Ten-file assertion audit preserves TTL/retention/coalescing/visibility boundaries; no removed old assertions, new native process starts, wall waits or allowance/baseline edits. Primary Coordinator6959c9af authorizes native approval completion sequencing; usage receipt and fresh frame watermark precede permission, retaining idle/approval/attach/needsYou assertions. Historical widened-race attribution remains unproven and disclosed. A-4492 supplies Mac5/5 per file and approval10/10; C2 remains pending same-head droplet/final execution audit. Normal mode-free task verify may run at this exact head; no per-item QA.

Criteria: C1 verified, C3 verified.

### impl-728 · 2026-10-17T11:57:01.737Z

Source clear: rev-20261017-728-source / A-4494 at 4bf57a1ce8324166788b803f1a18bbd848c8ca34, no findings, C1/C3 verified. Exact-head droplet submit was refused before queue/run creation: verify-tiers classified T1 clock.test.ts as touching machine resources. Coordinator decision c2c9ea1c-f1c1-4d1d-82ba-011e5386c3ca identifies the stale live word-matching scanner, also seen by T-730, and directs no source split or head change. Holding this reviewed head until the Coordinator's explicit “hub restarted, verify open” notice, then resubmitting the same mode-free droplet command with impl-728/coord/rev-30 recipients. C2 pending; no execution evidence created by the refusal.

### impl-728 · 2026-10-17T14:22:19.457Z

Exact source-reviewed head 4bf57a1ce8324166788b803f1a18bbd848c8ca34 verified green in droplet run 86e454cf-dc33-42fc-a0f2-284ec837e169 / A-4529: 2084 pass, zero fail, five skip; all 158 touched top-level cases pass and six clock cases pass 30/30 load repetitions, with Neovim smoke 12/12. Platform linux x64 6.8.0-142-generic / Node v24.21.0, c-8 lon1, lifetime 2283s, cost $0.1586. C2 marked done. At the Reviewer's request, retained raw Mac 50 whole-file plus 10 isolated approval transcripts are published with hashes/measurement/source-equivalence metadata in A-4532 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4532-t-728-raw-mac-50-file-and-10-isolated-transcripts-with-source-metadata. No new runs or head changes; final same-head evidence verdict requested from the Reviewer role.

### rev-30 · 2026-10-17T14:23:23.399Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-728-final
commit: 4bf57a1ce8324166788b803f1a18bbd848c8ca34
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; source A-4494 unchanged. A-4529/86e454cf green2089tests/2084pass/0fail/cancel/5skip, actualNeovim12/12. All158 touched top-level cases pass, six clock identities30/30 load repetitions, native renamed approval5.752s. Host check/typecheck/report-only lint receipt reused0ffe1bea0170a0ce9d319fb77b6c6c7e63484611. A-4532 independently hashed60raw transcripts:50whole-file logs tenfiles×5,790pass/zero fail/cancel/skip, plus isolatedapproval10/10. Whole-file median sum105.613008709s; Linux per-case sum195.963132199s distinct metrics. Provenance explicitly limited: six Mac groups pre-commit without contemporaneous per-run hashes; recorded work sequence/unchanged33fe8adc→4bf57a1c blobs support equivalence, no retroactive exact-SHA claim. Final four groups/isolated logs use completedab7acd96; subsequent4bf57a1c tier-only retag changes no executed source. Exact-head Linux independently backs execution. Historical race cause remains unproven, disclosed. C2 now verified; C1/C3 source-current refreshed. Linux2workers,c-8lon1,suite2211.30s,peak10.25,lifetime2283s,$0.1586. No findings/new run/head change.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-17T14:23:49.910Z

Merged 6c0ad1187b0066b5e0d5b47acb403b1c0bc804a9 onto dev.
