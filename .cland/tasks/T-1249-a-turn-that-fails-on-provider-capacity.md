---
id: T-1249
kind: task
title: A turn that fails on provider capacity stays idle until someone messages the session
state: open
status: review
size: S
criterion_seq: 3
labels:
  - bug
  - needs-triage
assignee: null
parent: E-1280
blocked_by: []
topic: topic-1063
branch: t/T-1249-a-turn-that-fails-on-provider-capacity
created: 2026-10-24T13:35:17.533Z
updated: 2026-10-25T17:36:19.213Z
---

## Summary

A Codex session's turn fails with `Selected model is at capacity. Please try a different model.` and the session sits idle until someone messages it. On 2026-10-24 this hit impl-998 and impl-422 (09:06Z), rev-23 holding T-1098's evidence review (12:25Z), and rev-23 holding T-1214's review (13:34Z). T-1214 blocked five branches. Each time the hub posted the failure, and the work resumed only after a Coordinator message.

## Acceptance criteria

- [x] C1. When a session's turn fails with a provider-capacity error, the hub re-delivers the last turn input after a bounded backoff (for example 30 s, 60 s, then 120 s, at most 3 tries) without a Coordinator message, and posts each retry (test).
  - done: impl-1249 · 2026-10-25T17:30:55.435Z
- [x] C2. Other turn failures are not retried this way, and a session that is stopped, archived or reassigned is never retried (test).
  - done: impl-1249 · 2026-10-25T17:35:38.141Z
- [x] C3. After the last try fails, the hub tells the item lead or Coordinator once, as today (test).
  - done: impl-1249 · 2026-10-25T17:30:55.614Z

## Comments

### impl-1249 · 2026-10-25T17:17:48.722Z

Implementation seam: triage A-11669 explicitly selects adapter-seam tests. Use existing T2 scriptedCodex/projectHub + fake clock, retaining exact native input/readback, delivery receipts and Agents retry notices; no processes/browser needed. Rule 20 inventory before the optional internal AdapterHost.turnFailed replay argument: production Sessions host; Codex and OpenCode callers; Claude signal-to-Sessions path; scriptedCodex/fakeHarness hosts and native/adapter/composition tests; Agents lifecycle/journal/inbox consumers of existing turn-failed notices; shipped implement skill, hub README and test docs. Full repository search covers src/test, nvim/web/shared, QA briefs, docs and skills. Keep 3-argument callers and wire notices unchanged; optional replay applies only to Codex provider-capacity failures.

### impl-1249 · 2026-10-25T17:27:08.403Z

Consumer inventory results: AdapterHost.turnFailed production callers are Codex and OpenCode, with Sessions.host receiving it; Claude Code uses Sessions.signal's unchanged 3-argument failure path. Tests: codex-native, codex-adapter, codex-delivery, opencode-native, opencode-adapter, claude-code-sessions/adapter/schedule, account-limited; generic fake host consumers retain optional callbacks. Protocol/persisted readers: hub protocol + shared/wire NotificationKind, hub journal, Agents lifecycle mapper and Inbox; existing turn-failed/redelivered shapes are retained, so web/nvim and historical records need no migration. QA brief hits E-424 and T-272 concern Claude sign-out/authentication and remain unaffected. No native wire/schema/refusal/credential/admission shape changed; optional replay is internal, only provided by Codex. CLI usage frozen fixture changes with the advertised policy. Ordinary-error and existing uncertain-admission regressions retain previous public-frame shape. Matching role clauses contain no failed-turn recovery description; no role grants or clause lines changed (byte reserve).

### rev-32 · 2026-10-25T17:33:58.495Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261025-1249-source
commit: ead35459a4442d6eb9dfa941bc539029d91442ef
scope: full
findings: [{"severity":"medium","text":"M1: New native work that starts during held capacity readback is reported as replay failure instead of cancellation. check() invokes authorize() before checking changed turnSequence/lastStartedTurn; if the newer turn is still busy, Sessions' idle guard throws and its still-current retry entry calls capacityExhausted, sending an unnecessary terminal failure to the lead/Coordinator. Check supersession as cancellation before this error path and add a held-readback/new-turn-still-busy regression retaining no replay and no terminal report.","file":"hub/src/adapters/codex.ts","line":1013}]
finding_counts: {"high":0,"medium":1,"low":0}

Full Standards/Spec source review recorded in A-12060. Standards: no independent finding. Spec: M1 medium at codex.ts:1013; authorize's idle guard runs before native supersession detection, so newer still-busy native work during held readback is falsely reported through capacityExhausted. Add that precise ordering control, retain no obsolete replay/no terminal failure assertions, and preserve real readback/admission failure reporting. C2 failed; C1/C3 remain unverified pending corrected source and same-head configured evidence. Local A-12054 is a Darwin T2 implementation summary, not configured runtime evidence. No tests run by Reviewer. Verification is not cleared at this head.

Criteria: C2 failed (M1: newer native work during held readback is escalated as terminal replay failure instead of cancellation.).

### rev-32 · 2026-10-25T17:36:19.213Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261025-1249-source2
commit: c80d86ca04dc077e4378ceced5b034ee6bc9cc5a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear; A-12064 records unchanged baseline plus all correction hunks. M1 resolved by checking native supersession before idle authorization and immediately after held readback. The new stays-busy regression observes readback completion and retains no obsolete submission/no terminal failure assertions. Standards and Spec: no remaining findings. C1–C3 remain runtime-unverified pending one same-head mode-free configured receipt. Local A-12063 is attributed precommit Darwin T2 output, not configured Linux evidence. No tests run by Reviewer.
