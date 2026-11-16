---
id: T-1907
kind: task
title: cland verify times out at 15 s ("submission sent; no reply") while the hub admits the run, three times in a row on 2026-11-16
state: open
status: in progress
size: S
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: t/T-1907-cland-verify-times-out-at-15-s
created: 2026-11-16T08:08:22.188Z
updated: 2026-11-16T13:41:48.165Z
---

## Summary

On 2026-11-16, three consecutive `cland verify` submissions from crew sessions exited 75 with `submission sent; no reply within 15s; check cland verify queue before resubmitting`:
- T-1879 (run a9f2ed5e, 07:45Z, during a hub slowdown);
- T-1697 (run 1270b05e, 08:04Z, with the Mac load at 4.7 and the hub at 4 % CPU);
- T-1889 (run d9ae394b, 08:07Z).

Each time the hub did admit exactly one run, which the queue showed later. The submission path apparently does something slow before it replies: bundling, a tree-hash computation, or the local host gate's start. The CLI bound is shorter than that work at a normal load. The outcome is safe, because nobody resubmitted, but every submitter has to reconcile by hand, and a less careful caller would double-submit.

## What to build

Find what the hub does between receiving a verify submission and replying. Reply with the admission (run id) as soon as the run is recorded, and do the slow work after the reply. Alternatively, give the CLI a bound that matches the measured submit path, with a named reason. Keep exit 75's safe wording for a real timeout.

## Acceptance criteria

- [ ] C1. A verify submission on a quiet machine returns the run id within the CLI bound, with the slow step measured and named (test with a fake slow step).
- [ ] C2. A real timeout still reports "submission sent; check the queue" and never resubmits (test).
