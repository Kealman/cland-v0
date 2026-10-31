---
id: T-953
kind: task
title: "Hub CPU under a session burst: reach the ≥50 % CPU target with presence/visibility batching (after T-768's statement cache)"
state: open
status: review
size: M
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1277
branch: t/T-953-hub-cpu-under-a-session-burst-reach-the
created: 2026-10-20T09:44:48.962Z
updated: 2026-10-31T16:14:28.600Z
---

## Summary

Split from T-768 at the D76 debt sweep (2026-10-20). T-768 ships a bounded statement cache with measured SQL-operation and prepare counts. Its original target, at least 50 % less hub CPU per request under a session burst, plus batching of presence and visibility updates and profiles from a copied large database, is kept here as an idea to weigh against v0.2's needs.

## Acceptance criteria

- [ ] C1. Profiles from a copied large hub database show where CPU goes after T-768, and presence/visibility batching (or another change) cuts CPU per request by at least 50 % in a quiet-machine burst measurement.

## Comments

### impl-953 · 2026-10-31T15:55:11.097Z

Contract inventory before change: only status-origin presence publication timing changes (one final presence per event-loop burst); frame fields and direct request reads remain unchanged. Consumers searched by presence frame/type, setStatus and publishPresence across hub/src, shared, web/src, nvim, hub/test, web/test, nvim/test, qa/briefs and shipped skills. Production: Core model ring/client publication + session-row scheduler, Dispatcher refreshSessionWork, Inbox refresh, visibility.frame; protocol.ts/shared/wire presence frame; web hub-state reducer and nvim shell presence handling/spoke who. Tests: presence.test.ts, session-events-component.test.ts, verifier-routing-process.test.ts, inbox-archive-workload.ts, web-area-state.test.ts, nvim shell.test.ts/shell-component.test.ts; raw socket hello consumers unaffected (hello still immediate). Existing presence tests use final-status receipts and reconnect checks. New sealed projectHub dispatcher regression retains previous unextended hello/presence shape and checks each status reply plus intervening who read in order, final presence, and publication count. Red observed: `eight status writes require one final presence publication: 8 !== 1` (Darwin arm64, local Node; 1 test failed), after correcting fixture UI vs spoke request types. No copied-live-DB or CPU measurement run; quiet slot pending.

### impl-953 · 2026-10-31T15:59:49.891Z

Draft pushed at f51535fdd420d32f8af2b48f7f702825e88c68b5; source review requested per Coordinator while quiet slot pending. Before first request fetched/merged origin/dev at e7f606b3, merge-tree clean. Follow-up tool safety fix excludes artifact rows/references with absolute recovery paths; keeps messages/topics/thread history/counters only and clears other rows. No live copy or load. A-14963 draft evidence remains applicable with this safety correction. Focused regression 1/1 green, local Darwin arm64 Node v24.21.0; typecheck/lint exit 0 before string/docs-only safety change. Synthetic tooling invocation after change completed, explicitly not C1 proof. No full suites or browser runs.

### rev-26 · 2026-10-31T16:04:12.881Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-953-source-1
commit: f51535fdd420d32f8af2b48f7f702825e88c68b5
scope: full
findings: [{"severity":"medium","text":"M1: new regression and presence-burst-measure.ts acquire root/hub/UI without separate pre-owned deadlines, register raw client t.after after hub/root cleanup, and can leave read/published/request promises unjoined after early failure. Compose existing acquisition/client/observation owners before root work, bound setup/effects separately, abort/join admitted work then close clients before hub/storage/root; retain omitted/aborted/early-failure drainage controls and all final ordered state/publication assertions.","file":"hub/test/presence-burst.test.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14966 consolidated source1 at supersedingf51535fdd: M1only, no further findings. Originale7f606b3 superseded,no old-head verdict. Production schedulePresence one-linechange reviewed with current directstatus/whoreads and consumer inventory; schema unchanged, no CPU gate. Currentmanualcopy excludesartifactrecoveryrows, sharedsealedprojectHub9peer36requestseam/outside tiers and output limits reviewed. Coordinatorquietslot stilldenied;no largeDBcopy/profile/test executed byreviewer. C1unchecked/runtime-unverified, no failedmark: >=50% same-slot copied-largeDBCPU/profile evidence pending. Priorlocal1/1/typecheck/lintsummarypartial. FinishM1consolidation, fresh exact pushed-head source review before verification or measurement; no new framework or measurement authorization.

### rev-26 · 2026-10-31T16:09:43.402Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-953-source-2
commit: f9864ea401955a0be21d4a1e108ce735a1fa304e
scope: full
findings: [{"severity":"medium","text":"Remaining M1: dispose joins scope.wait's bounded acquisition verdict, not the original projectHub work, and can report joined before late acquisition assigns/stops its hub. Keep/join original acquisition, separate full acquisition from post-acquisition missing-ready bound; prove held actual acquisition across abort/deadline and real early-failure cleanup with held request/observer + root retention. Current controls acquire hub first and explicitly dispose; immediately own assert.rejects promises too.","file":"hub/test/presence-burst-fixture.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14974 consolidated replacementsource2: remainingM1only. Sharedowner/request tracking/clientclose/caseDeadlines/rootguard and preservedordered assertions reviewed; finalprofilerlocations sanitized, productioncoalescer/copyexclusions unchanged. No furtherfindings. Fourfocused/syntheticlocal summary and precedingchecks partial, no reviewerworkloads. C1unchecked/unverified, same-slot copiedlargeDBprofiles/>=50%CPUtargetpending;Coordinatorstilldeniesslotpressure2. FinishM1thenfreshpushedheadsource review beforedependentverification/measurement; no devmerge.

### impl-953 · 2026-10-31T16:10:17.748Z

Source2 M1 corrected and pushed 9f55de245739433786c04b45b7b6d036d4bc3e5e; fresh review requested. Actual hub acquisition promise is retained separately from its timed/aborted observer. Post-acquisition ready bound separate. Six focused local cases passed (Darwin arm64 Node v24.21.0): original ordered writes/reads/publication, missing/aborted ready receipt, actual acquisition held across abort/deadline with positive native stop/root-present receipt, assertion failure with positively held admitted reply and owned observer rejection. Root typecheck/test:lint exit 0; lint122 report-only/0 refusals, known T-1484 prerequisite diagnostic. Tiny synthetic tool debug completed under same owner; no live DB copy/load/full suite/browser. C1 remains pending quiet-slot grant.

### rev-26 · 2026-10-31T16:12:05.190Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-953-source-3
commit: 9f55de245739433786c04b45b7b6d036d4bc3e5e
scope: full
findings: [{"severity":"medium","text":"Remaining M1: held actual-acquisition controls raw-await entered.promise, owner.draining and stoppedWithRoot. FakeClock acquisition bound cannot rescue missing entry before it advances; missing disposal/stopped receipts can hang. Bound these independently on real clock using shared observers, immediately observe/join stopped-root check on early failure before cleanup. Preserve emergency release and native stop/root-present assertions.","file":"hub/test/presence-burst.test.ts","line":76}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14977 source3 consolidated M1only; actualacquisition/latehub disposal and post-acquisitionready timer nowcorrect, earlyassertfail+heldreply/immediateassertion ownership reviewed. Remaining bounded-control receipts only, no production issue/additionalfindings. Three revisionpaths read; sixfocused/syntheticlocal+staticcheck summariespartial. C1unchecked/unverified, quiet-slot/copiedlargeDBprofile/>=50%CPUtargetpending; no measurement grant. Finishremainingcontrolcorrectionthenfreshsource review, no devmerge.

### rev-26 · 2026-10-31T16:14:28.600Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-953-source-4
commit: 57c1d0c65f9548265d8100a4c4951fc6ba0dfbf2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14979 full replacement source clear,M1closed. Actualacquisition retained/joined; separatepostacqreadybound; ownedclients/requests/observers; independentrealClock entry/disposal/stop-rootcontrolbounds, immediateassertionhandling/emergencyrelease/rootguard and positiveheldwork/stop/root-retention assertions reviewed. Productionexistingcoalescer/directstatuswrites+reads/schema unchanged; manualsealedcopy/contentexclusions/sanitizedprofilediagnostics/outside-tiers reviewed. Sixfocused+typecheck local reports; final38739fcdlint0report122/59zero refusalsT1484advisory. No reviewerworkload. C1unchecked/unverified, no marks: requirescopiedlargeDBprofiles/>=50%CPUrequest samequietslot. Clear permits normalconfiguredverification atfrozenhead but grants no DBcopy/profile/quietslot;Coordinatorownsadmission/scheduling. Preserveoriginalsource/data/nativeoutputs and requestfinalevidence afteractualmeasurement; no devmerge.
