---
id: T-1173
kind: task
title: The disconnected strip and nothing queued
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1168
  - T-1171
topic: topic-916
branch: t/T-1173-the-disconnected-strip-and-nothing
created: 2026-10-23T07:00:04.276Z
updated: 2026-10-23T20:29:58.447Z
closed: 2026-10-23T19:33:44.709Z
---

## Summary

When the socket drops, the phone shows a strip under the header saying since when and when the next retry runs, with Retry; the last snapshot stays with its time; answers, approvals and Send are disabled and nothing is queued; on reconnect the client resumes and the strip goes.

## Parent

E-419 (§3.6 the disconnected strip, P41 and P42; tracer step 5).

## What to build

- **The connection** exposes when it dropped, when the next attempt runs on its backoff, the time of the last frame it applied, and a retry that connects at once and resets the backoff. Resume from the sequence number and the fresh snapshot after a refused resume stay as they are.
- **The strip** sits under the header at phone width: "Disconnected since 14:10 · retry in 8 s", counting down, with a Retry at least 44 px tall. The desktop keeps its hub dot.
- **The last snapshot** stays on screen; the inbox title adds "as of" with the time of the last applied frame.
- **Disabled while disconnected:** ask options, the free answer, Decline, approval buttons, the composer's Send and the reply's Send, whose label row reads unsent. Nothing is queued: no command leaves the page while disconnected and none is replayed after reconnecting, since another client may answer first; drafts stay drafts.
- **On reconnect** the strip goes and the screens show the current state without a reload.

## Acceptance criteria

- [x] C1. With the hub stopped, the strip at 390x844 shows when the socket dropped and a counting retry time, and Retry starts an attempt at once (Web test).
  - done: impl-1173 · 2026-10-23T19:14:35.026Z
  - verified: rev-23 [reviewer] · run rev-20261023-1173-final · 2026-10-23T19:28:47.136Z · commit 29222014bf9840610f248152a327d9d852952044
- [x] C2. While disconnected the inbox keeps its rows with "as of" and the time, and ask options, approval buttons and Send are disabled with the reply's label reading unsent (Web test).
  - done: impl-1173 · 2026-10-23T19:14:35.102Z
  - verified: rev-23 [reviewer] · run rev-20261023-1173-final · 2026-10-23T19:28:47.136Z · commit 29222014bf9840610f248152a327d9d852952044
- [x] C3. A draft written while disconnected is not sent after the hub restarts, as the topic's history reads, and stays in the composer (Web test).
  - done: impl-1173 · 2026-10-23T19:14:35.175Z
  - verified: rev-23 [reviewer] · run rev-20261023-1173-final · 2026-10-23T19:28:47.136Z · commit 29222014bf9840610f248152a327d9d852952044
- [x] C4. After the hub restarts the strip goes and an ask raised while the page was disconnected shows without a reload (Web test).
  - done: impl-1173 · 2026-10-23T19:14:35.346Z
  - verified: rev-23 [reviewer] · run rev-20261023-1173-final · 2026-10-23T19:28:47.136Z · commit 29222014bf9840610f248152a327d9d852952044
- [x] C5. `web/README.md` describes the disconnected state and why nothing is queued (docs).
  - done: impl-1173 · 2026-10-23T19:14:35.420Z
  - verified: rev-23 [reviewer] · run rev-20261023-1173-source · 2026-10-23T19:16:27.258Z · commit 29222014bf9840610f248152a327d9d852952044
  - verified: rev-23 [reviewer] · run rev-20261023-1173-final · 2026-10-23T19:28:47.136Z · commit 29222014bf9840610f248152a327d9d852952044

## Comments

### impl-1173 · 2026-10-23T19:12:25.293Z

Test-first slices: phone-disconnected timing test failed on missing strip (0 !== 1), then passed after connection timestamps/manual retry and strip. Controls test failed on missing Inbox as-of, then implementation added the stale time and reply unsent label. Tests use sealed webFixture/projectHub only, paused browser clock and real socket-close receipts; no live-hub mutation. Final targeted regression/check results pending.

### impl-1173 · 2026-10-23T19:14:53.790Z

Implementation committed/pushed as 29222014bf9840610f248152a327d9d852952044. origin/dev 1c82517c fetched/merged before review (already up to date). C1–C5 done. Local Darwin arm64 targeted Web run of phone*, connection, inbox, asks, composer and withdraw passed 98/98 (no skips; 61.968 s); build/typecheck pass; test lint zero refusals, existing report-only 132 findings. New identities 0.771/0.736/0.532 s, none reached 4 s; no allowance required. A-10189 implementation note and A-10190 raw targeted/check/red logs. Reviewer assigned rev-23 via role-based request in topic-916; exact-head mode-free verification pending source verdict. QA affected/after-stage under E-419, no per-item QA criteria.

### rev-23 · 2026-10-23T19:16:27.258Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1173-source
commit: 29222014bf9840610f248152a327d9d852952044
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1173 full source review
Head29222014bf9840610f248152a327d9d852952044; treeab510857c295885157eaf61dfefbffd99a743cad. Fixed base/parent1c82517c4cf7d9d7c3f82ccdf7cffee50eb1827b; branch t/T-1173-the-disconnected-strip-and-nothing. Run rev-20261023-1173-source. Clear; findings[]; C5 source/docs verified, C1–C4 runtime pending. Crew disables Reviewer subagents; both axes reviewed in this session.

## Standards
No findings. Connection metadata is additive, keeps existing state snapshot/cursor/command boundaries, no hub/protocol/dependency/authority/key change. connect clears pending retry, exposes Connecting state and retryNow; close retains first disconnectedAt and publishes the actual next scheduled delay before doubling backoff. Manual Retry detaches old handlers, closes unfinished socket, clears timers and restarts250ms policy without automatic mutation replay. Existing command guard refuses when !live or socket notOPEN; close rejects outstanding commands. Version mismatch remains stopped/restartRequired with no Retry. Disconnected component owns/cleans its250ms display interval; phone-only Shell strip uses tokenCSS/44px button. No duplicated reconnect scheduler or local key listener.

Three new tests use existing sealed touch/mobile webFixture, projectHub real socket edges and fake adapters/clock. No new startDaemon/spawnSpoke/cland/sleep calls; no elapsed wall wait. Real socket attempts/close events observed before advancing fake time, exact offline/live DOM receipts and data-phone resize commits bounded. Existing reconnectUntilLive reused for paused browser clock; scratch writers/owned browsers are fixture-managed with observed empty censuses in raw output. Cases prove distinct timing/controls/no-replay behaviors; Web registration sorted, dedicated test-seam heading and README match. Diff check clean.

## Spec
C1 source present:stable dropped time, next-attempt schedule and250ms countdown render under header only below640; immediate Retry replaces timer/unfinished handshake, resets backoff. Test drives actual scratch hub stop/socket close, doubles retry delays through8s, observes7s countdown, arms websocket observer before tap, observes failed attempt and250ms reset;44px/header/desktop-boundary/reconnect assertions retained.
C2 source present:connection.lastAppliedAt timestamps parsed applied frame path; stale state is retained onclose, phone Inbox header shows as-of, reply label unsent; existing AskCard/ApprovalCard/Composer disabled and guarded offline paths retained. Test has real ask/native approval/message rows, exact3 retained rows/stable14:09 as-of, five ask/four approval disabled controls and reply disabled/unsent/draft.
C3 source present:command() andsend guard still refuse offline with no replay queue; per-topic draft remains editable/storage-backed. Test forces offline formsubmit, captures zero topic.send, reconnects then asserts same text, no sends and no durable history message.
C4 source present:epoch/seq resume and replacement snapshot handling unchanged. Test pauses browser time, stops/restarts only scratch hub, raises exact ask while page remains disconnected, resumes with prior cursor, observes new epoch/live/no strip and exact fresh Inbox ask without a new document (performance.timeOrigin retained). First timing case's no-navigation counter covers its reconnect without area navigation; third case uses document identity through legitimate history navigation.
C5 verified:README Phone disconnected describes timing/reset/Connecting, phone-only presentation, as-of/unsent/offline-disabled behavior, drafts/no queue rationale and resume/replacement without reload. No additional findings.

A-10189 summary andA-10190 retained folder inspected:raw targeted98/98 pass, nofail/cancel/skip, clean browser censuses; build/typecheck/token/colour/hooks complete and report-mode test lint132findings59files/zero refusals. Original red logs retained in folder for missing strip/as-of; implementer attributes checks to source-as-committed tree, localDarwinarm64 Node24.21.0 isolated pinned Headless Shell. New passing targeted samples reported0.771/0.736/0.532s<4; no allowance trigger. Folder report has no separate per-command exit/head metadata; request reports check exits0. These are local targeted/check receipts, not configured/Linux/current-head suite evidence.

Proceed with mode-free verify at exact29222014; finalC1–C4 settlement and passing new-identity timing audit follow. Preserve originalstdout/exits/source/timings without transcription reruns. Reviewer read-only Git/files/log/hub, no tests/probes/live browser/GUI/edits/merge/delegation. After-stage affected QA separate, no per-item brief/qaCriteria.
Standards:0findings. Spec:0findings.

Criteria: C5 verified.

### impl-1173 · 2026-10-23T19:28:21.126Z

Mode-free run 004f37d7-2e27-4e52-ad7a-f9d84b8591be / A-10199 passed at head 29222014bf9840610f248152a327d9d852952044 (tree ab510857): 2767/2767, no skips/fails/cancellations/todos. T1, fallback all T2 hub+Neovim, and Web completed on Linux x64 droplet c-8 lon1 cland-v0-1290adbc, Node24.21/Neovim0.12.5; lifetime602s cost$0.0418. Host typecheck gate at 6c0693de recorded not repeated. Lint/duration/T3-ratchet gates report-only; existing connection identity5.612s and other budget warnings retained. Three new Web identities2.408/1.795/1.310s; all passing samples<4s, no allowance required. T3 deferred to periodic/integrated, absent from configured batch tiers; queue enabled. Post-run fetch: origin/dev still1c82517c; conflict check git merge-tree exits0 with reviewed tree ab510857, clean working tree; no merge or source change after review. Reviewer has sample audit for final settlement. After-stage QA remains E-419.

### rev-23 · 2026-10-23T19:28:47.136Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1173-final
commit: 29222014bf9840610f248152a327d9d852952044
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1173 final same-head evidence review
Head29222014bf9840610f248152a327d9d852952044; treeab510857c295885157eaf61dfefbffd99a743cad. Branch t/T-1173-the-disconnected-strip-and-nothing. Run rev-20261023-1173-final. Clear; C1–C5 verified, findings[]. Full source A-10191 carries forward.

## Standards
A-10199 raw configured mode-free run004f37d7-2e27-4e52-ad7a-f9d84b8591be independently audited: exactsource-clearhead, exit0; ordinary2767test/412file finishes allpass, nofail/cancel/skip. Actual allT1(132files), fallbackallhub+NeovimT2(239files), completeWeb(41files), noT3/T4. Configured T3 deferred periodic/integrated; no stageQA claim. No load-gate-scope records; generic five-repetition headers do not establish load repetitions.

Host npmruncheck output includes typecheck/build/static guards/report-only testlint; gate6c0693deb82647fecc4956919874a1dac47f78d4 reused remotely, not repeated. Linuxx64 c-8lon1 cland-v0-1290adbc, Node24.21.0/Nvim0.12.5, workers2/Web4, lifetime602s/$0.0418. Actual phasewalls51.62sT1/321.84sT2/136.10sWeb; summed testseconds/projections are notwall. Generic duration/lint/ratchet notices report-only:132lintfindings59files/1missing filebaseline; existing connection identity5.612s warning remains, no claim resolved.

Three new passing Web samples:countdown/manualRetry2.408143749s, retainedInbox/disabledcontrols1.795414531s, no-replay/resume1.309823975s. All<4s, priorlocal samplesalso<4; no allowance trigger. Fileelapsed6.474476220s is distinct from per-identity samples and Webphase wall.

## Spec
C1 verified:phone390×844 stable dropped time/counting8→7s backoff,44px immediateRetry/reset250ms, stripunderheader/640pxdesktopboundary and removal afterLive pass.
C2 verified:exact retainedInbox rows/stableas-of, disabledask/free/Decline/approval/replySend and unsentlabel/retainedreplytext pass.
C3 verified:forcedofflinesubmit sendsnoframe; reconnect retainsdraft, noauto-send and durablehistorycontainsnoofflinetext.
C4 verified:hello retainspriorcursor, newepochreplacement snapshot supplies exactask raisedwhilepageoffline, strip/as-of removed and performancetimeOrigin unchanged.
C5 verified:matchingREADME/noqueue-rationale already source-established, unchanged.

Branch tip/tree independently match reviewed values. Lead reports freshfetch dev1c82517c and read-onlymerge-treeexit0 returning sameab510857tree, cleanworktree/noheadchange. Source+currentconfiguredreceipt settle allcriteria; after-stageaffectedQA separate, noper-itembrief/qaCriteria. Any laterauthorizedheadchange needsfreshsource/currentevidence.
Reviewer read-onlyGit/files/log/hub, notests/probes/livebrowser/GUI/edits/merge/delegation.
Standards:0findings. Spec:0findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-23T19:33:44.709Z

Merged 3b4e3be58d6978cd83c14c9d9fc9b5a3121b9efe onto dev.

### coord · 2026-10-23T20:29:58.447Z

Coordinator, 2026-10-23 20:31Z: web/test/phone-disconnected.test.ts has a load race. The test calls page.clock.install({time: T}) and then page.clock.pauseAt(T) at three sites; under load the running fake clock passes T before pauseAt, which throws 'Cannot fast-forward to the past'. Seen in impl-1175's targeted run at 20:29Z; the file passes alone on dev 3/3. Fixed in T-1175 (install at T−1 s, pause at T), with a loaded 10-run check.
