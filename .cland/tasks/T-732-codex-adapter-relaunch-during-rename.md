---
id: T-732
kind: task
title: "codex-adapter: relaunch-during-rename case loses the race when the rename lands before session.resume (load)"
state: open
status: review
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-432
branch: t/T-732-codex-adapter-relaunch-during-rename
created: 2026-10-17T09:52:08.212Z
updated: 2026-10-17T10:35:00.967Z
---

## Summary

In integrated cover c91c6e1e (A-4440, droplet c-8) `session resume --relaunch on a live session that renames itself while it is being stopped relaunches it under its new name` failed at its session.resume with "no session \"coord\" was launched by this hub". The fake's turn renames the session 300 ms after injection, and under load that happened before the test's resume request reached the hub. It passes 5/5 alone on the Mac. The case means to prove a rename *during* the stop, so the rename must be ordered after the resume request, not after a wall-clock delay.

## What to build

Order the case's rename after the hub has started the relaunch's stop (for example, have the fake rename on a signal or hub event instead of a 300 ms timer). Keep the assertions: same thread, new name, old pid gone. If T-692's Codex contract migration rewrites this case, fold this fix into it and close this ticket as covered.

## Acceptance criteria

- [ ] C1. The rename is ordered by an event, not a timer, and the case passes 5/5 on the Mac and in the task's droplet verify.

## Comments

### impl-732 · 2026-10-17T10:32:32.448Z

Timer race replaced by a fake Codex SIGTERM-triggered spoke rename, awaited before MCP shutdown. Original assertions retained; added explicit signal-before-successful-rename assertion. Targeted red/green: changed test without knob implementation failed at the retained rename assertion (1.27 s); with knob passed (1.36 s). Typecheck and test:tiers pass. Whole-file 5/5 serial repetitions now running below load 15.

### rev-30 · 2026-10-17T10:35:00.967Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-732-source
commit: cafee6c248054065c0fa9a3ced2508c680884980
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review T-732 at cafee6c248054065c0fa9a3ced2508c680884980, fixed point parent dev f3a9f7d7763c8516bf78fa5fe41e6b094aaf8934. Origin matches. Two test-file changes only,9 additions/3 removals. Reviewed item criteria, the native contract case, fake app-server signal/MCP path and A-4463. Read-only review; no Reviewer execution.

Standards: no findings. The new optional FAKE_CODEX_RENAME_ON_TERM path runs after shutdown records receipt of the stop signal, calls the existing real spoke rename tool and awaits its tool reply before MCP closure and native process exit. The knob is absent for all other cases, preserving their shutdown behavior. It reuses the existing signal/process boundary and tool transport; no production code, new process or scheduling delay is introduced.

The test removes both its rename-turn trigger and1200ms exit-delay dependence, sends an ordinary injected message to establish the live native thread, then invokes session.resume relaunch under the old name. Only the hub's subsequent stop signal triggers the rename. The old successful-rename log assertion remains and an additional ordered SIGTERM→successful rename receipt assertion demonstrates the signal boundary. Every substantive original outcome assertion remains: successful subscribe/resume, injected delivery, new name/running state, different PID, bounded old-PID reaping plus final dead-PID assertion, same harness thread, exactly one matching new-name/live-PID row and Coordinator role retention. No timing bound or final assertion is relaxed.

Spec/evidence: this orders the rename during stop rather than assuming a300ms turn delay outlasts the resume request. Existing T3 contract scope is appropriate for real native signal, spoke RPC, identity and relaunch interaction. A-4463 records the targeted new case failing its retained rename assertion without the fake implementation, then passing with the signal path. Five serial whole Codex-file Mac passes execute12/12 each (60/60,zero failures/skips/cancellations), file15.675/15.506/15.454/15.447/15.542s, initial loads2.95–3.40<15. Static typecheck/tier-lint/diff checks are recorded green. No manifest changes.

Source clear, no findings. C1's event ordering, assertion preservation and Mac portion are established; C1 remains unverified until required exact-head droplet evidence. Normal mode-free droplet verification may proceed at this head. QA scope none, no QA criteria.
