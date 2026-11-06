---
id: T-1721
kind: task
title: host-agent-restart "version delivery reconnect" runs at 15–17 s against a 20 s test timeout and times out under load
state: open
status: in progress
size: XS
labels:
  - needs-triage
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1612
found_by: cover
topic: topic-1406
branch: t/T-1721-host-agent-restart-version-delivery
created: 2026-11-06T11:09:04.236Z
updated: 2026-11-06T12:21:52.098Z
---

## Summary

`hub/test/host-agent-restart.test.ts` "C1-C3 version delivery reconnect reads retained table without signalling harness" took 15.4 s in the Linux stage cover A-17045 and 17.1 s in the macOS cover A-17051, both green, against a 20 s test timeout. In impl-1707's preservation batch on 2026-11-06 at 11:08Z, with a host load of about 10, it ran 21.2 s and was cancelled with `test timed out after 20000ms`. The margin is too thin for loaded runs.

## What to build

Find which part of the case is setup (agent restart, delivery, reconnect) and which is the behaviour the test asserts. Setup waits use `testWaitMs()`/`eventually()`, the test timeout sits above its allowance, and the case gets a duration allowance sized from the worst sample. Behaviour bounds stay exact and named; never weaken an assertion. If profiling shows a product slowdown since T-1612, name it instead.

## Acceptance criteria

- [ ] C1. The case passes 10/10 on macOS at a one-minute load of 12 or more, with its assertions unchanged (evidence).
- [ ] C2. The case's test timeout exceeds its duration allowance, and the allowance is sized at about 1.5 times the worst sample, with the samples in the reason (test-lint or durations check).

## Comments

### coord · 2026-11-06T11:45:43.410Z

More samples (impl-1707, 2026-11-06, macOS arm64, sealed environment). The case took 14.71 s at a peak load of 3.9 and 19.18 s at a peak load of 5.9, against its 20 s timeout. So even moderate load brings it within a second of the timeout, and this is more urgent than "loaded runs only". Earlier: 21.19 s cancelled at a load of about 10 (A-17072); 15.4 s Linux (A-17045); 17.1 s macOS (A-17051).

### impl-1721 · 2026-11-06T11:46:58.389Z

Rule 20 scope audit before edits: host-agent-restart.test.ts has 10 generated cases: kill-agent/version delivery reconnect, corrupt/escaping bundles, close joining installation, held mismatch close/quiesce, compiler-free registry startup, adopted Claude replacement, closed/unresolved downtime recovery. Shared helpers sshHostFixture, eventually/testWaitMs, agentBundle/deliverAgent/retainAgentVersions/agentVersionHandoff, AgentClient, sshHost and ownProcess remain unchanged. Only first loop's version-delivery setup waits and whole-case envelope plus exact duration allowance will change; kill-agent's 5000ms kill-to-retained-table assertion remains exact. No production or wire contract changes; other cases and shared helper consumers unaffected.

### impl-1721 · 2026-11-06T12:21:52.098Z

C1 measured on macOS arm64 local Node24.21.0: ten qualifying native full-file children, each exact10 named cases/pass10/fail0/cancelled0/skipped0/native exit0. Sampled1m load12.1538–17.3965 at250ms; feedback yes burners and owner-checked preservation lock. Version seconds [18.155473459,15.750507917,19.842925292,18.628617833,19.199364208,17.3376325,19.761022375,19.424526875,17.378785125,18.179632458]. Two other all-green children excluded for load windows. Test source SHA pinned in evidence; all50 assertion lines preserved (named5000ms constant resolved for audit). Current/historical profiles12.056/11.161s show repeated handoff/upgrades dominate; no repeatable product regression established. Kept chain together because it proves same worker survival after pruning original supervisor version. C2 allowance32s C-216 expiry2026-11-13, ceil1.5x21.19 historical incomplete observation retained conservatively; reason includes every sample and incomplete distinction. Default timeout90s, exact5s kill behaviour remains. No browser; no duration gate in targeted runs; manifest report mode. T0 npm run check in disposable archive is running; source review follows.
