---
id: T-1249
kind: task
title: A turn that fails on provider capacity stays idle until someone messages the session
state: open
status: in progress
size: S
labels:
  - bug
  - needs-triage
assignee: null
parent: E-1280
blocked_by: []
topic: topic-1063
branch: t/T-1249-a-turn-that-fails-on-provider-capacity
created: 2026-10-24T13:35:17.533Z
updated: 2026-10-25T17:17:48.722Z
---

## Summary

A Codex session's turn fails with `Selected model is at capacity. Please try a different model.` and the session sits idle until someone messages it. On 2026-10-24 this hit impl-998 and impl-422 (09:06Z), rev-23 holding T-1098's evidence review (12:25Z), and rev-23 holding T-1214's review (13:34Z). T-1214 blocked five branches. Each time the hub posted the failure, and the work resumed only after a Coordinator message.

## Acceptance criteria

- [ ] C1. When a session's turn fails with a provider-capacity error, the hub re-delivers the last turn input after a bounded backoff (for example 30 s, 60 s, then 120 s, at most 3 tries) without a Coordinator message, and posts each retry (test).
- [ ] C2. Other turn failures are not retried this way, and a session that is stopped, archived or reassigned is never retried (test).
- [ ] C3. After the last try fails, the hub tells the item lead or Coordinator once, as today (test).

## Comments

### impl-1249 · 2026-10-25T17:17:48.722Z

Implementation seam: triage A-11669 explicitly selects adapter-seam tests. Use existing T2 scriptedCodex/projectHub + fake clock, retaining exact native input/readback, delivery receipts and Agents retry notices; no processes/browser needed. Rule 20 inventory before the optional internal AdapterHost.turnFailed replay argument: production Sessions host; Codex and OpenCode callers; Claude signal-to-Sessions path; scriptedCodex/fakeHarness hosts and native/adapter/composition tests; Agents lifecycle/journal/inbox consumers of existing turn-failed notices; shipped implement skill, hub README and test docs. Full repository search covers src/test, nvim/web/shared, QA briefs, docs and skills. Keep 3-argument callers and wire notices unchanged; optional replay applies only to Codex provider-capacity failures.
