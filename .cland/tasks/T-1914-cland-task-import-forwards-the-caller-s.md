---
id: T-1914
kind: task
title: cland task import forwards the caller's ambient CLAND_LAUNCH_TOKEN on its nested hub frame even when an explicit environment or human actor is given
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: topic-1730
branch: t/T-1914-cland-task-import-forwards-the-caller-s
created: 2026-11-16T14:56:30.107Z
updated: 2026-11-24T12:01:48.202Z
closed: 2026-11-24T12:01:48.202Z
---

## Summary

`hub/src/cli/task-import.ts:186` accepts an explicit environment for discovery and the actor, but its nested `askHubFrame` call omits that environment. An in-process caller's ambient `CLAND_LAUNCH_TOKEN` can therefore be attached to a frame that claims an explicit human actor, mixing a session credential into a human action. Found by impl-1904 during T-1904, 2026-11-16 (topic-1556); T-1904 seals only its test helper.

## What to build

Pass the explicit environment to every nested hub frame in `task-import`, so a frame carries only the credential of the identity it claims. Do the rule 20 sweep for other CLI commands that take an explicit environment but use the ambient one on a nested frame.

## Acceptance criteria

- [x] C1. With an ambient session launch token set, `task import` given an explicit human actor and environment sends its nested frames with no session credential, shown by the frame the fake hub receives (test, red before the fix).
  - done: impl-1914 · 2026-11-24T10:02:40.009Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1914-final · 2026-11-24T10:37:45.516Z · commit 34b2bb5958ca3f19fac3b95e969833c20176cab2
- [x] C2. Other CLI commands with explicit environment parameters are swept; each nested frame uses the explicit environment or is named as unaffected (test).
  - done: impl-1914 · 2026-11-24T09:43:24.016Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1914-final · 2026-11-24T10:37:45.516Z · commit 34b2bb5958ca3f19fac3b95e969833c20176cab2

## Comments

### impl-1914 · 2026-11-24T09:05:25.395Z

Rule 20/41 sweep: searched askHubFrame, runImportGithub, task.import, CLAND_LAUNCH_TOKEN and explicit NodeJS.ProcessEnv signatures across hub/src/cli, shared, hub/test (all tiers), nvim, docs, .agents/skills and qa including frozen CLI bytes. Affected production caller: runImportGithub (task.ts delegates env unchanged); one send closure owns all batch/reconciliation frames and now passes env. Unaffected explicit-env CLI callers: runTask and runCrew forward env directly; runHost and runLogin forward env on every askHubFrame; runSuiteCommand wraps asks with options.env; terminalLogin uses raw socket requests and sessionOf(env), no ambient credential attachment; runKeyLoginAdd delegates metadata to login.ts env-bound closure; startProjectHub only invokes identity-free probeHub and forwards env to child; actorOf and bridgeGraceMs send no frames. Doctor checks project/users/hosts/remotes/release and setup/hub request closure all pass env. Remaining CLI frame callers have no explicit environment parameter, retaining intentional ambient CLI identity. Shared socket-client credential/actor/file-fallback projection unchanged; no wire shape or reply/schema changes. Direct consumers: import-github.test.ts (T2 runtime peer regression); cli-imports.test.ts (T3 erased/lazy imports unchanged). import-github-unit.test.ts (T1 label mapping) and import-github-lifecycle.test.ts (T3 absent-hub refusal) unaffected. Existing credential/identity suites, startup probes, raw socket readers, persisted credential readers, frozen help fixture, skills and QA briefs require no migration: argument forwarding only, same wire shape and defaults. New fake-peer tests also protect unaffected runTask/runCrew explicit environments. No user-visible text changed.

### rev-35 · 2026-11-24T09:45:49.844Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1914-source-1
commit: 77c644f913cd6773b90c43c126586a491b18728b
scope: full
findings: [{"severity":"medium","text":"M1: the four new callbacks install an unfenced native guard and use importPeerFixture's admission-only steps without separate setup/action observation bounds. Its finally restores process.env even after peer.close rejects, and default unfenced drainage can restore the native guard after a failed join/close. Enroll these callbacks before acquisition with bounded setup/action ownership and positive peer-close-gated environment/native restoration; retain exact wire assertions and add cancellation/rejected-then-confirmed close controls through the actual removal guard.","file":"hub/test/import-github.test.ts","line":97},{"severity":"low","text":"L1: the guide still explains environment scoping by saying the production nested request uses its default environment. The fix now passes the explicit env; replace that stale explanation and document the new explicit-human/session peer regressions.","file":"docs/agents/tests/hub-test-import-github.test.ts.md","line":5}]
finding_counts: {"high":0,"medium":1,"low":1}

Source review not clear at 77c644f913cd6773b90c43c126586a491b18728b. A-22794 separates Standards and Spec: M1 medium for the four new callbacks' unbounded admission-only setup/action and restoration after failed peer close/join; L1 low for superseded default-environment wording in the matching test guide. The one-argument production forwarding and other explicit-env caller dispositions check out by source. C1 failed for unsafe proof ownership; C2 stays done/unverified pending final evidence. Implementer confirmed both findings in 3752f2ad. No tests, probes, edits or configured verification run by this review. Hold concluded/released for consolidated correction; fresh source review required before verification. No dev merge or full task-head suite requested.

Criteria: C1 failed (New peer-proof callbacks lack separate setup/action bounds and positive peer-close-gated environment/native guard restoration.).

### rev-40 · 2026-11-24T10:04:47.407Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1914-source2
commit: 34b2bb5958ca3f19fac3b95e969833c20176cab2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source clear, no findings. Prior rev35M1/L1 resolved: pre-acquisition fenced deadline owner, separate setup/action/close observation bounds, original work join, positive server/socket close receipt, real root-removal gate and retryable failed close retain environment/native seams. Held-action cancellation/rejection and rejected-close repair controls preserve exact wire actor assertions; guide stale default-env wording replaced. Production closure forwards explicit env to every task.import batch/retry, matching discovery/actor; shared credential projection unchanged. Other explicit-env CLI caller census inspected with task/crew peer regressions. A-22810 retains11T2passes/static output and earlier TS2379 failure, local macOSNode24.21/no browser; no configured exact-head receipt yet. C1/C2 remain unverified pending configured named-case evidence. No reviewer tests/probes/edits.

### rev-40 · 2026-11-24T10:37:45.516Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1914-final
commit: 34b2bb5958ca3f19fac3b95e969833c20176cab2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged34b2bb595. Exact-head finished/passed18240152/A-22832; canonical4384f50e matches executable head. Independently checked all11import-github structured base outcomes pass, including human/session actual actor frames, task/crew explicit-env forwarding, held-work/setup-failure disposal and rejected-close retention/repair. Five enrolled actor/forwarding/rejected-close identities each5/5 load-gate; no other repetitions inferred. C1/C2 verified using source2 consumer/assertion audit A-22812 plus these receipts and retained red-before evidence. T0/T1/fallbackT2/selectedT3/Web exit0;9selected processfiles110identities once, restT3 mergebatch/T4unexecuted;7476pass/1Mac-selector skip/0fail. Noncached Linuxx64 c8nyc1 workers2 Node24.21.0/Nvim0.12.5, HeadlessShell1248/CfT156.0.8078.4. Advisory budgets remain report-only, no performance claim. A-22833 records both axes/provenance/line receipts. No findings or reviewer runs/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-24T12:01:48.202Z

Merged fa98700f79029d4ce7955f765f17f6c8f5b90a52 onto dev.
