---
id: T-1784
kind: task
title: Login verdicts, regions and pool growth
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1778
  - T-1779
topic: topic-1468
branch: t/T-1784-login-verdicts-regions-and-pool-growth
created: 2026-11-09T12:44:10.743Z
updated: 2026-11-10T21:00:36.326Z
---

## Summary

The scheduler's verdict hook is filled from the logins. For each host and harness it answers `serves` (a healthy binding there), `can-bind` (a free login in the host's region), `signed-out` (the host's binding is signed out) or `no-login`. A pool creates a host only when every harness the launch needs has a free login, so its effective size is min(`max_hosts`, free logins of its scarcest harness), and a launch with none waits as "waiting for a login <harness>". A login belongs to its volume's region, and a pool in another region cannot bind it.

## What to build

A verdict function over the login rows and bindings, wired into `decidePlacement`:
- `serves` hosts come first, then `can-bind` hosts, where the launch binds as in T-1778.
- A login is free when it is `ready`, exclusive and unbound, in the pool's region. Non-exclusive logins and key logins never run out.
- The create decision requires a free login for the launch's harness. Without one, the decision is "waiting for a login <harness>".
- A pool's `min_hosts` hosts boot without logins (question 9).
- A create for `cland login add` is exempt from the rule.

A `creating` login is never free. The note "E-1535 supplies login eligibility" in `scheduler.ts` is retired.

## Acceptance criteria

- [ ] C1. The verdict is `serves` for a host holding a healthy binding, `can-bind` with a free login in its region, `signed-out` for a signed-out binding and `no-login` otherwise, and placement skips `signed-out` and `no-login` hosts (test).
- [ ] C2. With `max_hosts = 2`, one exclusive login in use and none free, a launch with no room decides "waiting for a login <harness>" and creates no host (test).
- [ ] C3. A login in region `fake-1` is never bound by a host of a pool in `fake-2`, and that pool's launch waits for a login of its own (test).
- [ ] C4. A non-exclusive login or a key login lets every host of the pool serve its harness (test).
- [ ] C5. A pool's `min_hosts` hosts are created with no free login, and a create for `cland login add` is not held back by the login rule (test).
- [ ] C6. A `creating` login is never counted free (test).

## Blocked by

- T-1778
- T-1779

## Notes

- Hot files: `hub/src/host/scheduler.ts`, `hub/src/host/pool-runtime.ts`, `hub/src/host/login-verdicts.ts` (new; reads bindings, does not edit `login-binding.ts`).
- Tests: `hub/test/host-scheduler.test.ts` (T1, new cases); new `hub/test/login-capacity.test.ts` (T2).
- Serves epic C4 and C6.
