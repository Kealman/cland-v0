---
id: T-1779
kind: task
title: Release at host stop, and the kept volume re-attached on the next host
state: open
status: in progress
size: L
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1774
  - T-1778
topic: topic-1465
branch: t/T-1779-release-at-host-stop-and-the-kept-volume
created: 2026-11-09T12:44:09.676Z
updated: 2026-11-10T14:26:51.877Z
---

## Summary

Before a host is deleted, the hub releases its logins in parallel: it ends every process using each disk, unmounts and detaches it, and returns the login to `ready` with the same volume. The next bind attaches that volume on another host, so a login rotated on host A is read at its newer generation on host B. A host found gone frees its logins once the provider reports their volumes detached.

## What to build

A release step in the confirmed destroy path shared by `cland host stop`, idle stop, `cland host destroy`, the 15-minute lost-host teardown and boot-failure cleanup. For each bound login, in parallel, before the provider's release:
1. `loginDisk umount`, whose helper first ends every writer on the disk;
2. `detachVolume`;
3. the binding removed, and the login `ready`.

When the hub cannot reach the agent (a lost host, or one reported gone), there is no unmount. The machine is deleted, and each of its logins reads `ready` only after `listVolumes` reports the volume detached. An unmount refused because writers remain keeps the host and its binding, and the Coordinator gets one Agents line.

## Acceptance criteria

- [ ] C1. `cland host stop` on a host with a bound login unmounts and detaches the volume before the machine's deletion is requested, and the login reads `ready` with the same volume id (test).
  - failed: rev-36 [reviewer] · 2026-11-10T14:26:51.877Z · note Required public host.stop confirmed-destroy case remains destroying in same-head configured run d590c9c8.
- [x] C2. With the fake harness, a login rotated over two turns on host A is read at that generation by the first turn on host B after A stops, from the same volume id (test).
  - done: impl-1779 · 2026-11-10T13:51:04.312Z
- [x] C3. A host holding two logins releases them concurrently: both unmounts are in flight before either detach completes (test).
  - done: impl-1779 · 2026-11-10T14:04:59.659Z
- [x] C4. A background process left holding the disk is ended before the unmount, and no other process on the host is signalled (test).
  - done: impl-1779 · 2026-11-10T13:51:04.897Z
- [x] C5. A host lost for 15 minutes or reported gone is deleted without an unmount, and its logins read `ready` only after the provider reports their volumes detached (test).
  - done: impl-1779 · 2026-11-10T14:04:59.926Z
- [x] C6. An unmount refused because writers remain keeps the host and its login bound, and the Coordinator gets one Agents line naming the host and the login (test).
  - done: impl-1779 · 2026-11-10T14:08:22.924Z

## Blocked by

- T-1774
- T-1778

## Notes

- Hot files: `hub/src/host/login-binding.ts` (release), `hub/src/host/provision-host.ts` (`destroyHost`: release before the provider's release), `hub/src/host/settle.ts`, `hub/src/host/host-health.ts` (the lost-host path).
- Tests: new `hub/test/login-release.test.ts` (T2, fake clock); new `hub/test/login-write-back.test.ts` (T3: two fake hosts and the fake harness, for C2 and C4).
- Serves epic C2.

## Comments

### impl-1779 · 2026-11-10T13:43:39.285Z

Rule 20 sweep: shared graph reached 686 test consumers across all tiers, including 15 unknowns counted reached; full lists published in item artifacts. Explicit field/function sweep covers production, skills, QA, docs, persisted readers and tests. Destroy callers: dispatch host.stop/host.destroy and pool idle; daemon restored lease expiry; provision-host creation lease expiry and boot-failure rollback; host-health loseHost (provider gone / 15-minute lost); host-restart failed acquisition. All use destroyHost except boot failure, which will invoke the same release boundary before owner.remove. No wire/record shape changes; existing legacy absent binding phase remains settled. New indexed store method adds host lookup, existing consumers unaffected. One approved additive dispatch composition registration supplies snapshot/Host/notice hooks.

### rev-36 · 2026-11-10T13:54:30.909Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1779-source-1
commit: 0bb45b8cd927822adef3f6c670363793544a2c99
scope: full
findings: [{"severity":"high","text":"Normal beginRelease runs before lost/gone classification; a retained snapshot freeze requires unreachable-host thaw and blocks C5 deletion. Add the approved explicit snapshot-owner lost-host handoff while preserving reachable thaw fences.","file":"hub/src/host/login-release.ts","line":15},{"severity":"high","text":"A failed/still-attached post-deletion volume read has no automatic durable retry owner. HostHealth drops its one-shot outage on destroying; the test's manual second destroy hides the C5 liveness gap. Own current-lifetime and restart reconciliation.","file":"hub/src/host/login-release.ts","line":39},{"severity":"high","text":"C3 parallel unmounts meet one real-agent-wide loginDisk busy flag, so the second disk is refused while the first helper runs. The recording double permits behavior the actual Host rejects; add safe per-disk admission and native two-disk proof.","file":"hub/src/host/login-release.ts","line":21},{"severity":"medium","text":"FIFO onCleanup closes Store before later held-destroy/HostHealth joins on early failure. Join all writers and health work before database close and root removal, with forced early-failure coverage.","file":"hub/test/login-release.test.ts","line":20}]
finding_counts: {"high":3,"medium":1,"low":0}

Full source review not clear; all four gaps confirmed by Implementer. A-18393 separates Standards (1 medium) and Spec (3 high), documents source/evidence scope and the approved lost-host repair direction. C1/C2/C4/C6 remain unverified; no configured receipt exists yet, and A-18391's local narrative/native predecessor sample is qualified evidence only. Finish the consolidated corrections, commit/push and request fresh source review before verification; native operation changes require closure/boundary preservation.

Criteria: C3 failed (Actual agent rejects concurrent disk unmounts through its shared busy flag; only the permissive T2 double supports the required concurrency.), C5 failed (Retained freezes block lost/gone deletion, and delayed detached inventory lacks an automatic durable retry owner.).

### impl-1779 · 2026-11-10T13:55:55.909Z

Review repair consumer additions: beginRelease new optional hostLost option preserves existing one-argument calls; all callers found by explicit beginRelease/backup.freeze/outcome/loginDiskOperation/busy/enterMutation search, including login-snapshots and login-release tests, host-login-disk native tests, host-agent closure/boundary, snapshot and binding documentation and dispatch registration. Graph sweep A-18388 already reaches these through logins.ts; unknown consumers remain reached. Per-disk exclusion preserves same-disk refusal and global enterMutation refusal. No wire shape changes; abandonment records in existing optional backup.outcome string.

### impl-1779 · 2026-11-10T14:02:21.409Z

Rule 20 additional shared leaf consumers: listFakeVolumes canonical-name filtering is used by FakeHostProvider.listVolumes and agent fakeLoginMount. Explicit consumers include fake volume/snapshot coverage from T-1772, host-login-disk T-1776 tests, login-snapshots T-1781/T-1803 tests, login binding/add/release/write-back and agent closure/boundary. Temp-write coexistence control observed red (failed != listed); malformed canonical record remains a failed inventory. Actual durableJson temp filename is <volume>.json.<uuid>.tmp; canonical filtering also ignores other noncanonical names. No wire/record shape change.

### impl-1779 · 2026-11-10T14:06:04.916Z

Repair sweep at ced7a1058: shared transitive graph reaches 708 tests, 15 unknowns conservatively reached, full list in repair graph artifact. Explicit snapshot, fake volume, login-disk and native consumers are listed in prior consumer comment. Exact-head macOS native receipts published; Linux mode-free verification awaits fresh source verdict. No new TMPDIR roots across final native slot.

### rev-36 · 2026-11-10T14:07:22.797Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1779-source-2
commit: ced7a1058c7ba55757104abb77db2393b27f9836
scope: full
findings: [{"severity":"medium","text":"After an initial unmount-refusal notice, deadline deletion with a still-attached first inventory emits an independent :detach notice, then eventual automatic detach success emits :destroyed: three lines rather than the approved two total. Suppress/reconcile the intermediate identity and cover refusal→deleted-but-attached→automatic detached retry.","file":"hub/src/host/login-release.ts","line":17}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18401 records the complete correction pass. Earlier four findings are repaired: explicit snapshot-owned hostLost handoff; Clock-driven durable/restart-aware detached retry with ordered close; safe fixture teardown; and real sshHost two-disk hub-boundary ordering under Coordinator 560dba27's accepted lower-level serialization. Standards 0 findings; Spec 1 medium, confirmed by Implementer f15e6aad. All other runtime criteria remain unverified. Commit/push the single notice repair and request source review before mode-free verify; retain exact-head native producers and qualified local/configured evidence boundaries.

Criteria: C6 failed (Combined refusal/deadline/delayed-detach path emits three host/login notices instead of the approved two total.).

### rev-36 · 2026-11-10T14:09:04.022Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1779-source-3
commit: 19283386a9587179bb740f0a9fe9521095b3ce38
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings; A-18402. Exact three-file notice correction suppresses the intermediate deleted-but-attached line after a prior refusal; combined FakeClock regression retains one line before automatic retry, two after positive detach, and no later repeats. Earlier accepted release/snapshot/retry/fixture repairs and Coordinator 560dba27's C3 hub-boundary interpretation remain unchanged. All runtime criteria remain unverified pending same-head configured verification and named/consumer receipts. Proceed with mode-free verify at this pinned head after the directed native slot; retain its original producer and native completion evidence. Full T3/T4 and affected after-stage QA remain separate.

### rev-36 · 2026-11-10T14:26:51.877Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1779-evidence-1
commit: 19283386a9587179bb740f0a9fe9521095b3ce38
scope: evidence
findings: [{"severity":"medium","text":"Required migration rollback fault control fails: Missing expected exception /forced migration index failure/. New login_bindings_host prefix prevents the old db.exec startsWith injection from matching; retain the rollback/public-row assertions and migrate the fault boundary.","file":"hub/test/login-selection.test.ts","line":75},{"severity":"medium","text":"Required public stop confirmation case fails with actual destroying versus expected destroyed. Diagnose/migrate its release integration or fixture while preserving confirmed-destroy/session-exit assertions; no shared-defect classification established.","file":"hub/test/host-stop.test.ts","line":50}]
finding_counts: {"high":0,"medium":2,"low":0}

A-18408: d590c9c8/A-18407 is red at reviewed 19283386a. Independently read both native assertion outputs and named failed timing finishes. T0/T1 pass; T2 fails twice; changed T3 and Web unexecuted, browser facts null. Executed-prefix 5430 tests/5428 pass/2 fail is partial evidence, not complete-suite success. Report-only advisories are not the failure cause. Other criteria remain unverified. Resolve item-local regressions or follow Coordinator shared-defect direction; any correction needs fresh source review before new verify.

Criteria: C1 failed (Required public host.stop confirmed-destroy case remains destroying in same-head configured run d590c9c8.).
