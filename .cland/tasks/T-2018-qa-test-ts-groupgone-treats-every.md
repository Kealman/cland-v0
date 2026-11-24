---
id: T-2018
kind: task
title: qa.test.ts groupGone treats every process-group probe error as absence; only ESRCH proves the group is gone
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1732
branch: t/T-2018-qa-test-ts-groupgone-treats-every
created: 2026-11-20T00:18:35.899Z
updated: 2026-11-24T10:15:44.176Z
---

## Summary

The `groupGone` helper in `nvim/test/qa.test.ts` treats every exception from `process.kill(-pgid, 0)` as proof that the process group is gone. Only `ESRCH` establishes that. A permission error or another probe failure is an unknown, which should fail the check rather than pass it. This is a static finding from T-1798's source review; none of the retained runs hit such an error.

## What to build

Treat only `ESRCH` as absence. Any other error from the probe fails the assertion with its literal code.

## Acceptance criteria

- [x] C1. A probe that throws a non-ESRCH error makes the no-spinning-Neovim check fail, naming the code, while ESRCH still passes (test).
  - done: impl-2018 · 2026-11-24T10:09:52.171Z

## Comments

### impl-2018 · 2026-11-24T10:06:33.017Z

Consumer audit: groupGone has exactly three callers in nvim/test/qa.test.ts (timeout, SIGTERM and sandbox no-spinning checks); all now use processGroupGone via the shared eventually wait. No production or wire contract changed. Fake-probe T1 regression red: Missing expected exception /EPERM/; green: 1/1 on Node 24.21.0 macOS arm64. Native QA scenarios deferred to configured verify.

### rev-40 · 2026-11-24T10:15:44.176Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2018-source
commit: 2f353bde9f7391e71935d014c7bbc5a7deb97e27
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 2f353bde9f7391e71935d014c7bbc5a7deb97e27. Standards: no findings; pure injected T1 classifier regression is registered, shared bounded/load-scaled wait preserves terminal probe errors and all three native callers retain final assertions. Spec: only ESRCH proves group absence; successful probes remain present and EPERM/EIO/unknown errors throw their code with original cause. A-22824 records source review and A-22822 local evidence limitations. C1 remains unverified pending same-head configured test receipt; no configured/native T3 pass claimed. Reviewer ran no tests/probes and made no edits.
