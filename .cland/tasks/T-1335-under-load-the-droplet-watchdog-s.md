---
id: T-1335
kind: task
title: Under load the droplet watchdog's identity probe fails its arm, and two T3 fixtures time out (macOS stage cover 18934ad8)
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-26T08:21:56.778Z
updated: 2026-10-27T08:41:51.560Z
---

## Summary

The macOS stage cover 18934ad8 at dev fb73592a (A-12337) went red at peak 1-minute load 16.2 with three T3 failures. Each passed 5/5 when rerun alone on a quiet machine. One of them may be a product robustness defect: under load, the droplet watchdog's process-identity probe fails and `acquire` throws "could not verify the droplet watchdog process identity" (T-1298 and T-543 code path).

## What to build

Make the watchdog arm path tolerate a transient identity-probe failure under load: retry the native probe within a bounded window before refusing, without ever signalling an unverified pid. Separately, make the two test fixtures robust under load:
- cli-identity's session-credential fixture opens hub.db while the hub holds it ("database is locked"): use a busy timeout or the hub's own credential path.
- executor-safety's 30 s "remote group started" wait.

Failing cases:
- hub/test/executor-droplet.test.ts::a watchdog rearm held across release cannot resurrect the released lease
- hub/test/cli-identity.test.ts::cland hub stop from a session's shell signals nothing when the hub does not answer: only a confirmed request, or the human, may fall back to the signal
- hub/test/executor-safety.test.ts::prepare, run, fallback, cancel and stopped-hub watchdog leave the sentinel nowhere

## Acceptance criteria

- [ ] C1. A transient identity-probe failure during watchdog arm is retried within a stated bound and never leads to a signal of an unverified pid, shown by a test that injects one failed probe (test).
- [ ] C2. The three named cases pass 10/10 under the load gate's CPU load at two workers (test).

## Comments

### coord · 2026-10-26T09:09:10.536Z

The periodic dev T3 run e8e961f3 at fb73592a (A-12344, Linux droplet, peak load only 6.8) failed two more times.
- **cli-identity:** the same `cli-identity` case failed again with "database is locked" (session-credential-fixture.ts:13 opens hub.db while the hub holds it). It fails on Linux at low load too, so it is a fixture race, not only load.
- **accounts:** a new case failed: hub/test/accounts.test.ts::opencode relaunch and hub restart retain the saved account after role and registry edits, with "name "retained" is in use by a live session" (accounts.test.ts:167). It passed 5/5 alone on macOS. The Linux stage cover 56552bb3 at the same commit was green.
When this item is triaged, include the accounts case: a name-reservation race across relaunch and restart.

### coord · 2026-10-27T07:11:32.881Z

Seen again, 2026-10-27 07:10Z: T-1361's rule 6 run 78578e27 (A-12635) at 994f534a went red on just this flake: cli-identity.test.ts "cland hub stop from a session's shell signals nothing when the hub does not answer…" failed with `database is locked` at new Store (store.ts:439) from session-credential-fixture.ts:13 actorCredential. Run alone at the same head, it passed 5 out of 5 on macOS. Web didn't run, because the run stopped after T3. Per the flaky-rerun rule, there's one resubmit.

### coord · 2026-10-27T08:41:51.560Z

2026-10-27 08:42Z: cli-identity "database is locked" failed twice in a row at T-1361's head 994f534a (78578e27/A-12635, then fb844ac9/A-12659) and passed 5/5 alone on macOS. The fixture part of this item (session-credential-fixture.ts opening a second Store on the live hub.db without a busy timeout) now rides with T-1361 as a Coordinator-posted shared fix: a busy timeout on that connection. The watchdog identity-probe and executor-safety parts stay here.
