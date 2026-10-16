---
id: T-657
kind: task
title: "Quarantine manifest: a known flake still runs and is reported, but no longer fails the run"
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - flaky
  - verification
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: topic-399
branch: t/T-657-quarantine-manifest-a-known-flake-still
created: 2026-10-16T16:29:56.201Z
updated: 2026-10-16T16:31:43.152Z
---

## Summary

The costliest part of a flake is the resubmit, the review round and the second droplet run (A-4004, recommendation 2). A test red on two known-flake receipts and green 5/5 alone goes into `hub/test/quarantine.json`: it still runs and is reported, but doesn't fail the run. That turns the two-receipt gate into a hub rule.

## What to build

A committed `hub/test/quarantine.json` lists tests by file and name, each with an owner ticket, a reason, an added date and an expiry of at most 7 days. The suite runner runs quarantined tests as usual and reports their outcome in their own section of the result, but a quarantined failure doesn't make the run red. An entry past its expiry fails the manifest check by name; 20 consecutive green results are reported as "cleared" so the entry can be removed. An entry without an owner ticket or with an expiry over 7 days is refused like a TODO allowance. Task, integrated, close and release runs all honour it. docs/agents/tests.md describes the rule and who may add an entry (the Coordinator, on two receipts from different runs).

## Acceptance criteria

- [ ] C1. A quarantined test that fails is reported in its own section of the result and the run stays green, proved by a runner test with a planted failing quarantined test.
- [ ] C2. A non-quarantined failure still fails the run, and a quarantined pass is reported as a pass, proved by the same runner test file.
- [ ] C3. An expired entry fails the manifest check by name, and an entry without an owner ticket or with an expiry over 7 days is refused, proved by a manifest test.
- [ ] C4. Twenty consecutive green results for a quarantined test are reported as "cleared", proved by a test on recorded results.
- [ ] C5. docs/agents/tests.md and hub/README.md (Tests) describe the quarantine, its evidence bar and its expiry.
