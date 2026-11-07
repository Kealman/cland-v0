---
id: T-1732
kind: task
title: Find the owner of the two loopback listeners in transport-forwards' census at its next attributed occurrence
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: topic-1433
branch: t/T-1732-find-the-owner-of-the-two-loopback
created: 2026-11-06T23:20:40.928Z
updated: 2026-11-07T20:44:28.226Z
closed: 2026-11-07T20:44:28.226Z
---

## Summary

`transport-forwards.test.ts` C1 failed twice on Linux droplets, each time in a single-member merge batch: A-16451 (T-1604) and A-17279/A-17280 (T-1727). Both times the census found two `MainThrea` listeners on 127.0.0.1 ephemeral ports. In both logs the only test file overlapping C1's window in the other T3 worker was `hub/test/tracker-ready-native.test.ts`, during its failed-adoption restart cases (A-17284).

T-1670 added census diagnostics: each offending PID's command, start identity, parent, and why it was censused. It could not reproduce the failure in a Linux `--init` container: 20/20 green next to that neighbour at load 9.8–11.3. So the cause is still open, and the next real occurrence will be attributed.

## What to build

At the next failure of this C1 case, read the T-1670 attribution from the failure output, name the listener's owner, and fix the cause with a regression test that is red before the fix. Possible owners: a hub from `tracker-ready-native` holding the control-socket path, or a worker-shared listener.

## Acceptance criteria

- [x] C1. The listener owner from the next attributed occurrence is named with its failure output, and the cause is fixed with a regression test that is red before the fix (test).
  - done: impl-1732 · 2026-11-07T18:26:07.495Z
  - verified: rev-36 [reviewer] · run rev-36-1732-final-1 · 2026-11-07T18:54:46.778Z · commit 07586d8e7e4989982a1078136529b5802c33ada5

## Comments

### coord · 2026-11-07T17:51:06.502Z

Third occurrence, now attributed: batch f5c21caf (T-1739 + T-1742), run ac27deb5, A-17562, Linux x64 c-8 lon1, 2026-11-07 17:50Z. C1 found two MainThrea listeners on 127.0.0.1:43491 and :34083, pid 206366, source=control-socket holder. T-1670's diagnostics give that pid's command as the node --test-isolation=process worker running hub/test/tracker-ready-native.test.ts. That file ran concurrently in the other T3 worker, which matches the overlap hypothesis above.

Cause: C1's census asserts that no TCP listener exists anywhere on the machine, so it counts listeners that belong to a concurrent test file's own process tree. The census should be scoped to processes that transport-forwards' own fixture started, the hub and its forwards, rather than all pids. As an alternative, tracker-ready-native could stop opening TCP loopback listeners, if those listeners are themselves unintended.

It has now made two merge batches red (T-1727 and this one), so the fix should come early.

### impl-1732 · 2026-11-07T17:52:05.437Z

Rule 20 sweep before census changes: listenerFailure is imported only by transport-forwards.test.ts and tcp-listener-census.test.ts. References also occur in docs/agents/tests/hub-test-{transport-forwards,tcp-listener-census}.test.ts.md, durations.json, tiers.json, test index and historical qa/briefs/E-1533-stage-2.md. No production caller, wire shape, persisted reader or startup probe. Preserve listenerFailure signature/diagnostics; add fixture-tree selection only and run both importers. Native regression is the requested C1 seam: unrelated socket-holder listener ignored, fixture-tree listener detected.

### impl-1732 · 2026-11-07T17:54:48.214Z

Attribution read directly from A-17562 lines 18563–18567: Unexpected TCP listeners: pid=206366 source=control-socket holder nativeStart=linux:7f048777-78f3-4897-9250-6256008e87e2:174517 parent=6950 command=/opt/node/bin/node ... /home/runner/cland/hub/test/tracker-ready-native.test.ts; TCP 127.0.0.1:43491 and :34083 (LISTEN). The log has no Unix FD/path receipt, so the label alone cannot establish that this process held our exact socket. Static isolation sweep: transport fixture mkdtemp(fw-), tracker tempProject, hostPaths uses hash(root+NUL+id), fixtureSocketPath allocates random per-root aliases. No common fixture root found. tracker-ready-native intentionally calls serveProject; daemon.ts:603 and :674 create loopback WebSocket and Web listeners. This is expected hub behavior, not an unintended TCP bind. Native lsof matching probe pending preservation slot.

### impl-1732 · 2026-11-07T18:03:28.683Z

Native pre-fix regression red, macOS arm64 Node24.21.0: C1 exit1, Unexpected TCP listeners: pid=28967 source=unrelated decoy candidate; TCP 127.0.0.1:64333 (LISTEN). The deterministic candidate injection models the attributed foreign-worker selection and uses a real unrelated listener. Linux arm64 docker run --init --network=none disjoint-root ctl.sock probe returned only /tmp/t1732-a-IkY6pM/ctl.sock, not the other root. No shared root found; historical A-17562 lacks the Unix FD/path necessary to distinguish a spurious match from actual same-path access. The exact lsof inclusion cause remains unproven; scope fix removes socket-holder-as-ownership inference. No tracker-ready-native fix needed: its hub loopback binds are intentional.

### rev-36 · 2026-11-07T18:20:53.335Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1732-source-1
commit: 0f657a0e8f11b1cf8dcd9654f400baf659d65bb6
scope: full
findings: [{"severity":"medium","text":"The new decoy cleanup uses a separate raw t.after after fixture()'s throwing hook. Earlier carrier/agent cleanup rejection can prevent this hook, leaving the native listener/IPC child live; rejection of closed also skips removeDecoy. Use the shared all-steps owner and prove forced cleanup failure still joins the decoy before directory disposition/outer completion.","file":"hub/test/transport-forwards.test.ts","line":85}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17592 source not clear, one medium lifecycle finding (corrected line85; supersedes artifact A-17591 location). Census scoping/helper/native positive-control source otherwise clear; A-17562 independently names tracker-ready-native pid206366 listeners, historical Unix-holder inclusion still unproven. Original deterministic decoy red retainedA-17583; predecessor campaignsA-17585 qualified. No Reviewer tests run. Implementer acknowledged9367ce4e, will finish/join active batch before correction and fresh review; configured evidence still pending, qaPolicy none.

Criteria: C1 failed (New regression decoy cleanup is not guaranteed after fixture cleanup failure; require owned native drainage before outer completion.).

### rev-36 · 2026-11-07T18:27:16.098Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1732-source-2
commit: 07586d8e7e4989982a1078136529b5802c33ada5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17598 corrected source clear; prior A-17592 medium cleanup finding resolved. All resource owners independently share aggregation, DB closes after resources, directories follow, decoy process remembered/close rejection observed. Same-helper forced cleanup failure retains original error and asserts native close tuple/root disposition; A-17596red/A-17597green read with focused receipt limits. Census/native planted controls otherwise retained; historical Unix-holder inclusion still unproven. C1 remains unverified until current-head solo/paired/helper completion and configured evidence. No Reviewer tests run; qaPolicy none.

### impl-1732 · 2026-11-07T18:33:09.792Z

Reviewed head07586d8e7e4989982a1078136529b5802c33ada5 native receipts A-17599: macOS arm64 local Node24.21.0, transport-forwards solo10/10 (7/7 generated cases each), alongside concurrent tracker-ready-native via node --test --test-concurrency=2 paired10/10 (22/22 cases each), tcp-listener-census8/8. All native exits0/null, no skips/cancellations. Preservation slot held18:24–18:32Z, producer joined before release. Whole-host max sampled 1-minute load5.10400390625; no burners. New cleanup case samples0.595849..1.019029625s (20 observations); no new duration allowance threshold reached. Original census red A-17583, cleanup ownership red/green A-17596/A-17597. Source clear rev-36-1732-source-2, A-17598. Targeted native evidence only: no suite or duration gate executed, report-mode manifest unchanged; configured verification follows at exact reviewed head. No browser or real external provider API. Historical Unix-holder match cause remains explicitly unproven.

### impl-1732 · 2026-11-07T18:53:09.842Z

Configured verify baadbca9 passed at exact reviewed head07586d8e7, tree6307cb0aedf4e215d17eb65d1c344f99e3c9464a (A-17610): T0, all T1, fallback all T2, changed transport-forwards T3 once, Web; 5422/5422 pass, no skips/cancellations. Remaining T3 belongs to merge batch; T4 not run. Linux x64 6.8.0-147-generic droplet c-8 lon1, Node24.21.0, Neovim0.12.5; browser chrome-headless-shell1248, Chrome for Testing156.0.8078.4. Not cached. Droplet lifetime1083s, cost$0.0752. Required generated facts independently read: fixture census includes launch roots and every descendant but excludes sibling socket holders pass0.000956s; C1 Unix and host-loopback forwards answer with no hub TCP listener; C2 cancellation removes both pass3.558654s with excluded-holder PID/command/requestedPath/matchedPaths diagnostic; cleanup rejection still joins fixture and decoy before removing their roots pass0.852364s. Task T3 one base execution, not repeated Linux evidence; repeated macOS evidence remains A-17599. Duration/lint/ratchet/Web wall advisories report-only, no enforcement switch. Reviewer already received hub result; waiting for same-head final settlement, claim retained.

### rev-36 · 2026-11-07T18:54:46.778Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1732-final-1
commit: 07586d8e7e4989982a1078136529b5802c33ada5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17611 final clear; C1 verified. Independently matched actual foreign owner attributionA-17562, deterministic native redA-17583, fresh Linuxbaadbca9/A-17610 green5422/5422 including C1/cleanup7T3 identities+helper8/8/newhelper5load passes. A-17599 current-head solo10x7/paired10x22/helper8 nativecode0/signalnull checked, published hashes match reviewed blobs. Cleanup finding resolved. Historical exact Unix-holder selection remains unproven; no same-case overlap/Linux load claim. Actual phases T0/T1/fallbackT2/changedT3/Web; remainingT3/T4 separate, report advisories retained. No Reviewer execution; qaPolicy none.

Criteria: C1 verified.

### coord · 2026-11-07T20:44:28.226Z

Merged 10b63fc8cb6a1086700cae0f1ec33ded98277c05 onto dev.
