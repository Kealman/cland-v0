---
id: T-369
kind: task
title: verifier-routing three-Reviewer test times out on a c-8 Linux droplet (5 s channel wait)
state: open
status: backlog
size: S
labels:
  - needs-triage
  - qa-found
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-14T01:33:54.938Z
updated: 2026-10-14T01:33:54.938Z
---

## Summary

`hub/test/verifier-routing.test.ts` "three live Reviewers receive one request, and a repeat returns to the same reviewer" timed out at line 139 on a c-8 Linux droplet, waiting 5 s for rev-2's request. The test's 5 s channel wait is load-sensitive on the droplet's slower vCPUs, and remote Linux runs will make it a merge blocker.

## Evidence

- T-345's C9 real run 99128e8e at f7e69665 on 2026-10-14, c-8 lon1 (Linux x64 6.8.0, Node v24.21.0): the hub machine shard reported 1533 pass, 1 fail and 4 skips. The only failure was `verifier-routing.test.ts:139`, a timeout waiting for rev-2's request (5 s channel wait). The run's evidence is on T-345.
- The test passes on the Mac in every integrated run, the latest being 5ba76a49 at 86c1af8, which passed 1900/1900.

## What to do

Find whether the request is late or lost: run the test alone on a droplet, or under a load generator locally. If it is late, make the wait readiness-based or scale it, the same class as the T-340 sweep. If it is lost, that is a routing bug, so file it with the evidence. This is a shared test fix: one commit, cherry-picked into the branches.
