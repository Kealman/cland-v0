---
id: T-1662
kind: task
title: cland doctor reports a remote hub that refuses admission as 'does not answer'
state: open
status: planned
size: XS
labels: []
assignee: null
parent: E-1884
blocked_by: []
regression_of: T-1600
topic: null
branch: null
created: 2026-11-03T17:52:10.072Z
updated: 2026-11-16T07:31:15.495Z
---

## Summary

Found while writing the E-1532 stage-3 QA brief. On a host without a session credential, `cland doctor` reports `remote hub does not answer on <socket> (forbidden…)`, although the hub did answer, with an admission refusal. A user reading that line looks for a dead tunnel or hub, when the real cause is a missing or refused credential.

## What to build

Doctor tells "no answer" (connect refused, timeout) apart from "answered and refused admission". For a refusal it names the refusal class, for example missing credential or revoked host, and the remedy, without printing any credential.

## Acceptance criteria

- [ ] C1. Against a fake host whose hub answers but refuses admission, `cland doctor` reports the refusal class and not "does not answer"; against a socket with no listener, it still reports "does not answer" (test).
