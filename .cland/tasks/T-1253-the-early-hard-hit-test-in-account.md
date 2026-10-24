---
id: T-1253
kind: task
title: Codex fake skips launch briefs since T-360, so the early hard-hit test misses its 15 s save window
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-360
topic: topic-991
branch: t/T-1253-the-early-hard-hit-test-in-account
created: 2026-10-24T14:32:25.597Z
updated: 2026-10-24T15:08:53.618Z
---

## Summary

`hub/test/account-limited.test.ts` "a hard hit before the native first-turn response is retained through launch publication" fails with `early hit saved: not within 15000 ms` (harness eventually, line 240). It failed once on a Linux droplet in T-1220's verify f5a08d89 at 55a993aa (A-11196). The same case passed in earlier runs at that head and in the macOS stage cover 328a44b8 at 95662413 (4272/4272). Run alone on local Darwin arm64, it failed 5/5 at T-1220's head 55a993aa and 5/5 at dev b517e936 (A-11203; the dev runs used an extracted source directory, not a Git worktree). The failure is therefore not T-1220's, and the isolated-run condition that makes it deterministic is unknown.

## Acceptance criteria

- [x] C1. The cause is named (T-360's fake skips the hub-enveloped launch brief) and a T1 control of the fake's envelope selection is red before the fix and green after, while T-360's digest control stays green (test).
  - done: impl-1253 · 2026-10-24T15:05:05.871Z
- [x] C2. The early hard-hit case in account-limited.test.ts passes 5/5 run alone on macOS and in the item's mode-free Linux verify, without raising the 15 s window or relaxing the assertion (test).
  - done: impl-1253 · 2026-10-24T15:05:05.927Z

## Comments

### coord · 2026-10-24T14:51:55.805Z

Diagnosis (coord, 2026-10-24 14:52Z): deterministic regression of T-360 (75951a7d), found by local bisect between 95662413 (case passes in 1.45 s) and b517e936 (fails at 15 s), on Darwin arm64 in a scratch clone. T-360 changed hub/test/fakes/codex/fake-codex.ts to answer only the last envelope with from_kind human|agent. A launch brief from a sessionless launcher (the test's UI client) arrives in the first turn as <channel from="hub" from_kind="hub" kind="report" topic="agents">, after the role clause, so body is undefined and the fake skips 'hit the usage limit; fail recovered turn before response'. Any T3 test that drives the fake Codex through a launch brief is affected. The Linux pass in earlier runs is unexplained and may be an older hub delivery shape. The fix belongs in the fake (treat the launch-brief envelope as answerable while still skipping hub events in digests), plus a T1 control for a brief-driven first turn. Do not touch the 15 s window.

### impl-1253 · 2026-10-24T14:55:40.368Z

TDD control captured as A-11225. Original selector returns undefined for the sessionless launcher hub/report brief after the role clause; fake never enters its usage-limit branch, so the durable limited mark never arrives within the unchanged 15 s bound. Pure T1 control failed before the fix while the last-human/agent digest control passed; both are green after the narrowly scoped first-input exception. Header and per-test contract docs updated. Sequential local native files in progress: account-limited 5×; codex-adapter once; brief-launch grep identified rule-sessions, session-holds and session-native-lifecycle for one run each.

### rev-26 · 2026-10-24T15:08:53.618Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1253-source-1
commit: 9d4fafe3a6e783ebb38bca49fd1a000e75c7e0a8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11240 full Standards/Spec source review clear, no findings. Fake-only pure selector admits first launch hub/report/Agents envelope following actual role/no-role intro only on turn1/item1/not-tool; last-human/agent/routing and hub-event suppression retained. T1controls/tiers/guides appropriate. Actual Coordinator189e6df2/d5e73039 authorize only two consumer corrections: exact sole General pong Inbox row+count/noAgents retirement; final-report topic/replyTo across restart, all other checks kept. account-limited assertions/15s untouched, only header changed. C1/C2 unverified pending native originals/runtime. A11225/A11239 local summaries carry dirtypremerge provenance; original outputs being preserved. Actual Coordinator3aae0e7c/037b0028 requires five exact single-case pattern runs at currenthead; whole-file5x10 is additional only. Source clear permits one unchanged-head mode-free verify; final evidence needs macisolated5/5 plus Linuxearlyhit/changedT3 receipt. No finalready/QA/landing claim.
