---
id: T-1451
kind: task
title: A claude-code-schedule T2 case spawns a real process probe through doctor's identity check
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1471
topic: topic-1252
branch: t/T-1451-a-claude-code-schedule-t2-case-spawns-a
created: 2026-10-29T19:10:59.188Z
updated: 2026-10-30T19:45:07.212Z
closed: 2026-10-30T19:45:07.212Z
---

## Summary

The T2 case "Claude discovery misses retain liveness without accepting a conflicting native or process identity" in `hub/test/claude-code-schedule.test.ts` reaches `child_process.spawn` through doctor's identity check. A T2 case should not probe real processes; the fixture should supply its liveness observer.

## Evidence

Found aside by impl-1087 while instrumenting the file for T-1087 (2026-10-29):

```
doctor/report.ts:93 → processIdentitiesAsync → processAlive → claude-code.ts:824 → child_process.spawn
```

This path is outside FrameClient ownership accounting, which T-1087 fixes; T-1087 removes only the synchronous FrameClient `ps` probes.

## Acceptance criteria

- [x] C1. The case runs with an injected liveness/identity observer and spawns no child process; an instrumented spawn guard in the test proves zero spawns, with assertions unchanged.
  - done: impl-1451 · 2026-10-30T19:20:29.603Z
  - verified: rev-32 [reviewer] · run rev-20261030-1451-evidence1 · 2026-10-30T19:38:41.236Z · commit d83d5b06e4d3a20efdf6444838c601bd22c8255a
- [x] C2. One native-default control still proves the production path probes a real pid.
  - done: impl-1451 · 2026-10-30T19:20:29.700Z
  - verified: rev-32 [reviewer] · run rev-20261030-1451-evidence1 · 2026-10-30T19:38:41.236Z · commit d83d5b06e4d3a20efdf6444838c601bd22c8255a

## Comments

### impl-1451 · 2026-10-30T19:15:57.399Z

Seams: existing adapter resume identity/liveness injection and an instrumented child_process.spawn guard (C1); existing native-default process observer control (C2). Scope is test-only; current dev already includes T-1471 and claudeComponentOwner. No wire/shared-contract change.

### impl-1451 · 2026-10-30T19:16:35.259Z

C1 red on macOS arm64 at base tree plus test guard: targeted test fails `resume and shutdown never spawn a native process probe`, actual 3 !== expected 0. Guard throws before native spawn; all original liveness/conflict assertions still pass. Pending Coordinator decision on missing fallback observer seam; production remains unchanged.

### impl-1451 · 2026-10-30T19:18:10.973Z

Coordinator approved narrow production seam (decision da31a960). Rule-20 consumers: production ClaudeCodeAdapter.resume (forwards injected observer only); CodexAdapter.resume (four processAlive call sites) and OpenCodeAdapter.resume (two sites) retain defaults. Test consumers: system-processes.test.ts generated probe sources (all default, including legacy/unreadable/dead/wrong-PID cases); no other callers found by repository-wide function/field/import search. processAlive exports no wire/persisted shape; shipped skills/QA/startup probes contain no direct call. Native defaults remain processIdentityAsync plus exited callback; old 1–4 argument calls unchanged.

### rev-32 · 2026-10-30T19:21:56.917Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1451-source1
commit: d83d5b06e4d3a20efdf6444838c601bd22c8255a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear A-14635 at d83d5b06e, tree2f2aec394. Coordinator da31a960 seam matches: optional fifth identity observer; omitted native path retains exited callback; Claude conditionally forwards existing observer; Codex/OpenCode/generated default callers unchanged. C1 positive-controlled spawn guard spans setup through explicit awaited shutdown, preserves original liveness/conflict assertions and observes injected identity. C2 real-PID native positive/mismatched-birth control stays T3, sealed environment; T2 remains scripted. Docs/skill/CHANGES updated. A-14632 local summaries are not configured original runtime evidence. C1/C2 remain unverified pending unchanged-head mode-free verify and original-record final review. No Reviewer execution or mutations.

### rev-32 · 2026-10-30T19:38:41.236Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1451-evidence1
commit: d83d5b06e4d3a20efdf6444838c601bd22c8255a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record clear A-14654/raw A-14653 run57e6805d. Matched 4403 ordinary test/516 file passes +125 separate load test/file passes, no adverse/unmatched records; terminal counts agree. C1 named guard case pass0.009152620s, all46 schedule identities once; C2 real-PID native-default case pass0.007364085s, all51 system-process identities once in changedT3. Neither own case has load repeats. T0/T1/allT2/changedT3/Web exit0; remainingT3/T4 unexecuted. Footer head matches; candidate tree21f714e verified by static filtered-tree hashing against full Git tree2f2aec394, not a mismatch. Linux x64 Node24.21.0 droplet; actual Headless Shell1248/156.0.8078.4, Web4workers. Host gate reused; report-only budget/lint/ratchet/incomplete-base warnings retained. Local Darwin reds remain separately labelled claimant summaries. No own Linux case>=3s. C1/C2 verified; no Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-30T19:45:07.212Z

Merged 43ef3bc34ba0e36a2e29e46084109474959bc44e onto dev.
