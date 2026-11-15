---
id: T-1870
kind: task
title: "Integrated pass on the fakes: hosts, logins, users and restart in one scenario"
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1539
blocked_by: []
topic: topic-1524
branch: t/T-1870-integrated-pass-on-the-fakes-hosts
created: 2026-11-15T13:08:09.345Z
updated: 2026-11-15T14:29:52.814Z
---

## Summary

One scenario test runs the paths across R-1530's epics that no single epic's demo covers, on the fake host provider, the fake transport and the test messengers only. It is the integrated pass of E-1539 (C2): hosts, logins, users and the workbenches meeting in one scratch project.

## What to build

A T3 scenario test, `hub/test/scenarios/integrated-v04.test.ts`, on a scratch project with:
- an `agents` pool of two fake hosts, Implementer and Reviewer roles placed on it, and the Coordinator local;
- a fake DigitalOcean API and fake transport, with no real host, token or network.

It walks these five paths in order, asserting each outcome where a human would see it (the hub's state and the web/Neovim projections the existing component tests read):
1. **Login from a card.** A launch waits for a login (`waiting for a login <harness>`). A login added from a remote card (Telegram fake) releases it, and the session runs on a fake host.
2. **Sign-in again with sessions running.** A login is signed out. The web hosts view's sign-in flow (through the hub, as the hosts view does) signs it in again, and that host's running sessions keep running throughout.
3. **Two users.** In users mode with two users, one answers an ask from a remote, and the other sees the answer and who answered in the web.
4. **Restart with busy hosts.** A hub restart with sessions on both hosts loses no session, row or pending delivery.
5. **The sub-cap.** When the hosts' daily sub-cap is reached, new host creation is refused, and the live hosts and their sessions are untouched.

Reuse the existing fixtures: `sshHostFixture`/fake host provider, `projectHub`, the remote fakes, and the users-mode helpers. Where a step needs a helper that only exists inside one test file, lift it into a shared fixture (rule 20 sweep). Invite links are credentials: never in titles, output or evidence. Per-test docs under docs/agents/tests/.

## Acceptance criteria

- [x] C1. The scenario passes on the fakes through all five paths, asserting each outcome where a human would see it, with no real host, token or network (test).
  - done: impl-1870 · 2026-11-15T13:43:45.438Z
- [x] C2. Each path fails when its product behaviour is broken: show a red run per path, for example by withholding the login release, signalling the host's sessions, dropping the second user's projection, losing a row across restart, or letting a new host past the sub-cap (test).
  - done: impl-1870 · 2026-11-15T13:43:45.673Z
- [ ] C3. The file is registered in T3 with a duration allowance if it needs one, and an exact `/private/tmp` and per-user TMPDIR name set is unchanged around it (test).

## Comments

### impl-1870 · 2026-11-15T13:27:12.503Z

Draft scenario and opt-in host-create setup/start helper implemented; Rule 20 sweep A-19685. Qualifying scoped reds recorded in topic-1524 for login release, native renewal and second-user projection. Busy restart and cap controls in progress. Native slots on pre-T-1806 dev are development-only; retained socket aliases are recorded and untouched. No criterion is marked done yet.

### impl-1870 · 2026-11-15T13:43:46.023Z

Five qualifying boundary reds and full development green recorded in A-19690; full green system/user/suite name sets A-19691/A-19692. All five paths pass including four queued native replies, both births and credential scans. C1/C2 done. C3 remains outstanding until T-1806 lands and quiet full-name preservation passes. Coordinator82821e8a directed initial source review now, followed by one dev merge, evidence slot, delta review and mode-free verification.

### rev-35 · 2026-11-15T13:52:53.253Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1870-source-1
commit: 58e5b3e9c061ef27549fbf9399439b520ec83e1a
scope: full
findings: [{"severity":"medium","text":"New setup/start sequences lack pre-acquisition ownership and a teardown fence/join. start publishes its stop only after projectHub resolves; root guard/drain registration follows initial startup. Timeout/body failure can dispose DB/root before late continuation/startup is adopted. Fence starts and join whole admitted sequences before disposal, with held setup/restart controls.","file":"hub/test/host-create-fixture.ts","line":62},{"severity":"medium","text":"secretAnswer and Bob-answer pre-arm waitFor before upload without a failure-path owner. A synchronous upload/setup throw bypasses await, and messenger/client close does not cancel or join waiter timers. Add abortable/joined receipt ownership and thrown-upload controls.","file":"hub/test/scenarios/integrated-v04.test.ts","line":56}]
finding_counts: {"high":0,"medium":2,"low":0}

A-19704 completes all six changed paths, both axes: Standards two medium rule12 findings confirmed by lead0dd9391c/614ef0e3; Spec no additional finding. Five intended paths, scoped faults, T3 registration/guide and current18s development allowance inspected; Linux resizing remains directly recorded Coordinator requirement. Independently checked raw five intended reds and green/all-five diagnostics. A-19703 binds precommit chronology/unknown immutable source, raw-versus-transcribed native fields, current-launcher and publication limits; no retroactive proof. A-19695 all983 tiers/47originalhits/12reached+17unknown retained; Web planned-disposition clarification pending. Development system+2/user-equal and derived prefix suite field are not C3 preservation. C1/C2 final verification pending; C3 authorized-pending, not failed. Hold released for consolidated correction and fresh source review. Coordinator82821e8a single later dev merge/quiet preservation/delta review/mode-free sequence retained; no Reviewer producer/native/cleanup run.

### impl-1870 · 2026-11-15T14:13:26.342Z

Corrected both source findings in f2e11bb614e6b7e3c421dfe0231588369e3cf79b: initialization/setup/start tracked and fenced before acquisition, late hubs stopped/joined before handles/root; pre-armed remote results cancel and join on thrown upload. Authorized development cleanup6/6 and scenario1/1 pass; captured receipts/logs A-19712, evidence labels clarified A-19711. Full workspace typecheck, child-env/tier/guide/wording checks pass; test lint report-only122 findings59 files, zero refusals. C3 and Linux remain pending T-1806 merge and directed evidence. Fresh source review requested; no configured verification yet.

### rev-35 · 2026-11-15T14:17:29.120Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1870-source-2
commit: f2e11bb614e6b7e3c421dfe0231588369e3cf79b
scope: full
findings: [{"severity":"medium","text":"New owner controls lack cleanup registered before admission/readiness. Late-acquisition assertions can leave its gate/action/close pending; thrown-upload controls enter finally only after an unrelated receipt is armed and readiness awaited. Register an outer release-first, attempt-all join owner before work starts; apply consistently to receipt controls.","file":"hub/test/host-fixture-cleanup.test.ts","line":73}]
finding_counts: {"high":0,"medium":1,"low":0}

A-19713 completes reworked nine-path correction pass; Standards one medium confirmed fd4295d0, Spec no additional finding. Both original A-19704 owners fixed: whole setup/start registration, fencing, late adoption/stop-once/drain before handles/root; exact-ID reply exchange cancellation and attempt-all teardown. New actual fixture controls and all five scenario paths inspected. A-19712 independently6/6+1/1/direct0-null and selective executable/launcher hashes match; development-only dirty-tree limits, per-harness unknowns and system+2 retained, not C3. New cleanup root T3/sortedmanifest984 and guides present; prior consumer union retained/additive helper hits checked; A-19711 Web/suite clarification accepted. C1/C2 final pending; C3 authorized-pending not failed. Hold released for correction/fresh review, preserving Coordinator506c0e4d/82821e8a sequence. No Reviewer runtime/native/census/provenance run.

### impl-1870 · 2026-11-15T14:27:18.279Z

Corrected A-19713 control cleanup finding in 454f64a8aed177b0c83baf599dcd20e7725c41f8. Every control registers release-first, attempt-all cleanup before admission; initialization/restart/disposal and individual receipt/loop promises join even after another failure. Cancelled synthetic initialization gets a final late-hook pass. Added direct late-hook and rejected-owner controls. Authorized cleanup-file-only development run8/8, close0/null, full system/user name sets unchanged; A-19714 retains launch/close/selective hashes and redacted output. Runtime fixture/scenario sources unchanged; no scenario rerun or C3 claim. Coordinator2982c54f bar/cap included in fresh review request.

### rev-35 · 2026-11-15T14:29:52.814Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1870-source-3
commit: 454f64a8aed177b0c83baf599dcd20e7725c41f8
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear A-19717 across complete two-path correction. A-19713 resolved: every control registers release-first/attempt-all owner before admission, including initialization and all reply tests; late synthetic hooks receive a final cursor pass after admitted work joins. Added cancelled-init and rejected-owner controls; no product assertion weakened. Directly read Coordinator2982c54f bar/cap; no follow-up/waiver needed. Independently checked A-19714 eight pass/direct child0-null/selective hashes, and A-19715/16 published original arrays byte-identical1,535,438bytes/SHA b61b33d2, sorted unique full15624system/10027user names equal. Development-only/selective-dirty-tree and native/provenance limits retained; no scenario or C3 upgrade. C1/C2 final pending; C3 authorized-pending not failed. Hold released. Coordinator82821e8a one laterdevmerge/quietpreservation/merged-head delta review/mode-free sequence and Linux-duration resizing remain binding. No Reviewer runtime/native/census/cleanup/merge.
