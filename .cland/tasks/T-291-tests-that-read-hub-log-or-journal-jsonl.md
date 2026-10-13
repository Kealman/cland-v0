---
id: T-291
kind: task
title: "Tests that read hub.log or journal.jsonl right after an event race the hub's asynchronous writes: audit them and wait on the flushLogs barrier"
state: closed
status: done
criterion_seq: 3
labels:
  - hub
  - ready-for-agent
  - v0.1.2
assignee: null
parent: T-216
blocked_by: []
topic: topic-177
branch: t/T-291-tests-that-read-hub-log-or-journal-jsonl
created: 2026-10-12T13:45:45.431Z
updated: 2026-10-13T00:59:02.779Z
---

## Summary

Under a full run's load, tests that read `.cland/log/hub.log` or `journal.jsonl` as soon as an event or reply arrives can see the file before the hub's queued write lands. Three such cases failed in one hour on 2026-10-12, each passing alone; this item audits the rest and makes them wait on the existing `hub.status` `flushLogs` barrier (or an `eventually` on the expected record), keeping every assertion exact.

## Parent

T-216 Tech debt. Found during the v0.1.2 build (T-277's census, T-283's verify): codex-adapter.test.ts:396 (harness-exited log line, fixed on T-277 as 7cb55c6), codex-adapter.test.ts's recovery journal read (fixed on T-283 as aed0622 with the flushLogs barrier), and handover.test.ts's audit line (part of T-281). `Journal.write` queues without a durability acknowledgement by design.

## What to build

Find every hub test that reads hub.log or journal.jsonl directly after an action (grep for the two file names and for `readFile`/`readJournal` near them), classify each as already synchronized or racing, and add the barrier where it races: the `hub.status` `flushLogs` barrier where the hub is live, an `eventually` on the expected record otherwise. Exact counts stay exact (assert after the barrier, recheck "exactly once" where the test means once). No production change; no skip, retry or loosened assertion. List the audited files with their classification in the item.

Out of scope: the three cases already fixed (7cb55c6, aed0622, T-281's handover fix); changing `Journal.write`'s durability.

## Acceptance criteria

- [x] C1. Every hub test reading hub.log or journal.jsonl after an action is listed in the item as synchronized or fixed.
  - done: impl-291 · 2026-10-12T17:32:06.553Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-291-1 · 2026-10-12T21:57:27.834Z · commit 43b9f191f1adb6cf049825f46a31b2ec8ef55d51
  - verified: rev-23 [reviewer] · run rev-2026-10-13-291-2 · 2026-10-12T23:22:11.867Z · commit 83e48a4eb0b16875d36957595bd996433fd68275
  - verified: rev-23 [reviewer] · run rev-2026-10-13-291-4 · 2026-10-13T00:58:09.968Z · commit e215e5342594627acce9ae74f845a9c082a4f8fb
- [x] C2. Each fixed test waits on the flushLogs barrier or an `eventually` on the expected record, with its assertions unchanged in strength.
  - done: impl-291 · 2026-10-12T17:32:08.380Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-291-1 · 2026-10-12T21:57:27.834Z · commit 43b9f191f1adb6cf049825f46a31b2ec8ef55d51
  - verified: rev-23 [reviewer] · run rev-2026-10-13-291-2 · 2026-10-12T23:22:11.867Z · commit 83e48a4eb0b16875d36957595bd996433fd68275
  - verified: rev-23 [reviewer] · run rev-2026-10-13-291-4 · 2026-10-13T00:58:09.968Z · commit e215e5342594627acce9ae74f845a9c082a4f8fb
- [x] C3. Each fixed file passes 20 runs under four concurrent workers; `npm run typecheck` passes and `cland verify` is green.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-291-4 · 2026-10-13T00:58:09.968Z · commit e215e5342594627acce9ae74f845a9c082a4f8fb
  - done: impl-291 · 2026-10-13T00:58:43.051Z

## Comments

### coord · 2026-10-12T15:31:33.271Z

Raised and launched now (Coordinator, 2026-10-12 15:32Z): the integrated dev run 3262aa67 at add6a19 (A-1551) failed only hub/test/claude-code-adapter.test.ts:207 ("one log event for the crash", 0 != 1), which passes 3/3 alone: the same race as codex-adapter :396. These flakes now cost a full run each, so this item is fixed forward before the next integrated run. Known starting points: claude-code-adapter.test.ts:207 (must be fixed here); 7cb55c6 on t/T-277 (codex-adapter :396, not yet on dev: cherry-pick it so both land together and do not conflict); aed0622 (codex-adapter recovery journal read, on dev via T-283); d44a2c8 (nvim sessions test, on dev via T-283); T-281's handover case stays T-281's.

### impl-291 · 2026-10-12T17:32:06.152Z

# T-291 log and journal read audit

Every match from `rg -l 'hub\.log|journal\.jsonl|readJournal' hub/test nvim/test` was audited, following file-reader helpers to their callers. No production changes, skips, retries or weakened assertions. Hub frames/replies do not acknowledge durability; successful `hub.status` with `flushLogs: true` drains both daemon sinks. Process-log startup records use the existing synchronous sink.

| File | Classification | Evidence / change |
| --- | --- | --- |
| `hub/test/agents-journal.test.ts` | fixed | flush live journal/startup-tail/replay snapshots; settled exact launch-grant count; stopped-hub read retains shutdown drain |
| `hub/test/claude-code-adapter.test.ts` | fixed | flush before launch/clause/crash/injection log reads; exact crash count rechecked after 100 ms and second drain |
| `hub/test/claude-code-sessions.test.ts` | fixed | flush before signal/launch/resume/stop log and journal assertions |
| `hub/test/cli-identity.test.ts` | fixed | audit reader drains via authenticated short-lived UI |
| `hub/test/codex-adapter.test.ts` | fixed | flush before clause/resume/steering/recovery snapshots; exact counts rechecked after settling; inherited T-277/T-283 fixes retained |
| `hub/test/codex-delivery.test.ts` | synchronized | eventually on every expected injection/reconnect record |
| `hub/test/crew-launch.test.ts` | fixed | flush before session-reused journal assertion |
| `hub/test/daemon.test.ts` | synchronized | serving process log uses synchronous startup sink; shutdown read follows graceful process exit |
| `hub/test/default-subscriptions.test.ts` | fixed | flush and settled recheck of exact ready-event delivery count |
| `hub/test/epic-close.test.ts` | fixed | flush before override journal assertion |
| `hub/test/events-quiet.test.ts` | synchronized | awaited fixture writes; explicit flushLogs before live-journal fixture append |
| `hub/test/events.test.ts` | synchronized | awaited fixture writes, no emitted-record read |
| `hub/test/handover.test.ts` | out of scope | T-281 owns this audit read; left untouched |
| `hub/test/init.test.ts` | synchronized | config-loaded process log uses synchronous startup sink |
| `hub/test/journal-async.test.ts` | synchronized | awaited Journal.flush/close or daemon.stop; deliberate SIGKILL case waits for completed append before blocking next |
| `hub/test/merge.test.ts` | fixed | flush before completion/refusal/recovery snapshots; deferred cleanup records already eventual |
| `hub/test/opencode-adapter.test.ts` | fixed | flush before clause/crash/resume; exact crash count rechecked after settling |
| `hub/test/orphan-servers.test.ts` | fixed | flush before sweep/stop completion snapshots; ambiguity expected record already eventual |
| `hub/test/permission-integrity.test.ts` | fixed | audit reader drains via authenticated short-lived UI |
| `hub/test/permissions.test.ts` | synchronized | audit check helper drains before/after actions; later reads assert subsets of drained records |
| `hub/test/pid-identity.test.ts` | synchronized | eventually plus flushLogs on signal-refused; final assertion reads the same persisted record |
| `hub/test/plan-gate.test.ts` | synchronized | eventually on expected migration journal records |
| `hub/test/progress.test.ts` | fixed | flush before final send-kind journal snapshot; resume/uncertain records already eventual |
| `hub/test/push.test.ts` | fixed | flush before outcome-unknown/no-refusal log assertions |
| `hub/test/request-guard.test.ts` | synchronized | explicit flushLogs; other assertions read synchronous in-memory arrays |
| `hub/test/role-integrity.test.ts` | fixed | flush before superseded/hello/clause assertions; settled recheck of exact clause count |
| `hub/test/roles.test.ts` | fixed | flush before exact clause snapshots including reconnect; config edits/acks already eventual |
| `hub/test/session-async-processes.test.ts` | synchronized | eventually on production task.close audit before assertions |
| `hub/test/session-launch.test.ts` | fixed | eventually on complete expected send/ack pair, retaining both assertions |
| `hub/test/session-stop-races.test.ts` | synchronized | assertStopped drains log/journal; subsequent signal-skipped read uses that drained snapshot |
| `hub/test/spoke-identity.test.ts` | fixed | eventually on spoke-owned skipped record, settled exact count; hub-owned negative reads drain |
| `hub/test/stage-qa.test.ts` | synchronized | eventually on expected freshness-failed record |
| `hub/test/subscription-hygiene.test.ts` | synchronized | explicit flushLogs before journal read |
| `hub/test/subscriptions.test.ts` | synchronized | explicit flushLogs before journal read |
| `hub/test/suite-selection.test.ts` | synchronized | fixture appendFileSync writes; reads follow awaited runner exit |
| `hub/test/suite.test.ts` | synchronized | journal timing drains hub.status; budget-capped process log is synchronous startup |
| `hub/test/task-plan.test.ts` | fixed | flush before accepted baseline and after refused publication; other expected records already eventual |
| `hub/test/task-worktrees.test.ts` | synchronized | eventually on expected worktree-refused record |
| `hub/test/termination-ownership.test.ts` | fixed | flush before exact completion count and recheck after settling |
| `hub/test/tracker-async.test.ts` | synchronized | eventually on stalled record; abandoned record follows drained shutdown/process exit |
| `hub/test/tracker.test.ts` | fixed | log reader drains before conflict/reindex/fallback snapshots; watcher eventually checks retained |
| `hub/test/verdict-criteria.test.ts` | synchronized | eventually on expected roles-loaded count |
| `nvim/test/crew.test.ts` | synchronized | bounded polling waits for expected crew-refused record |
| `nvim/test/sessions.test.ts` | synchronized | launch/death/stop file reads already flushLogs (T-283) |

Shared test helper: `hub/test/harness.ts` adds `flushProjectLogs(t, root)` for tests without a retained UI client. It opens an authenticated UI connection, drains, asserts success and closes in finally.

Validation: fixed Claude adapter passed 20/20 whole-file runs with four concurrent workers, five invocations per worker. Remaining changed files run the same proof. Typecheck passed after the barriers were added.

### impl-291 · 2026-10-12T18:51:51.255Z

Implementation commits: b0fc308 (test-only barriers and settle checks), de2e10b (use retryUi after the merge fixture replaces its daemon). The initial merge whole-file proof correctly failed on an introduced stale-connection barrier; four failures and four interrupted obsolete runs are retained. The corrected case passes alone, and the remaining proofs run on de2e10b with a fresh 20-run merge proof scheduled last. Twelve files now have complete 20/20 proofs, four workers each; C3 remains pending.

### impl-291 · 2026-10-12T19:10:11.716Z

At the Coordinator's 19:05Z direction, four-worker stress proofs are paused while T-278's full verification holds the machine. Seventeen files have complete 20/20 proofs and stand. Remaining: task-plan, termination-ownership, tracker and corrected merge; four in-flight task-plan invocations were stopped through registered process cleanup and are retained as interrupted evidence. The remaining proofs will check the verification queue and acquire the existing joint hub/Neovim legacy leases for each four-worker round, releasing between rounds to admit queued suites. No stress processes remain active; C3 is still pending.

### impl-291 · 2026-10-12T20:19:18.370Z

Machine-protected task-plan proof completed 20/20 at 2ba75fe (A-1618), bringing the completed file count to eighteen. Termination-ownership completed three protected rounds (12/20), all passing. At the Coordinator's reservation for T-280's Ubuntu full run and host verification, the supervisor was stopped outside any proof round and both leases are released. A persistent reservation marker now blocks admission even when the host queue shows no holder. Resume requires impl-280's explicit Ubuntu-complete/host-start note; completed rounds are retained and will not repeat. Tracker and corrected merge still await their fresh 20-run proofs.

### impl-291 · 2026-10-12T20:38:04.229Z

T-280's reserved Docker run has stopped and its host verification e146e6d7 was confirmed as the active holder at 20:37:37Z. The special reservation marker is released. The continuation now waits through ordinary queue/legacy-lock admission, reusing twelve successful termination-ownership invocations before the final eight; tracker and corrected merge follow. No T-291 proof overlaps host verification.

### impl-291 · 2026-10-12T21:50:38.240Z

Twenty changed files now have complete20/20 four-worker proofs (termination A-1645, tracker A-1649); corrected merge round1 passed4/4, all49 cases each, before T-281's reserved admission. During the next handoff, verify queue showed no holder despite T-281's matching live owner records, then runSuite took over PID60689 as stale and the peer reported wrapper137. Restored hold and SIGTERM stopped the supervisor through registered owned cleanup. Four interrupted merge round2 invocations are preserved and excluded; no proof supervisor remains. At the Coordinator's explicit21:49Z decision, no proof round runs until its machine handoff after T-281's investigation/batch. C3 remains pending.

### rev-23 · 2026-10-12T21:57:27.834Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-291-1
commit: 43b9f191f1adb6cf049825f46a31b2ec8ef55d51

No high/medium findings. The pinned 44-file reader inventory matches the item's audit. Successful frame drains/eventual persistence preserve assertions, exact-count settle rechecks and dev's draining helpers/prepared fixtures; production delta is empty. C1/C2 verified. C3 remains incomplete: A-1654 has twenty 20/20 files and corrected merge 4/20 (404 indexed passing logs); 16 merge invocations plus integrated typecheck/full verify remain. Evidence A-1659: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1659-t-291-source-and-audit-review-at-43b9f19.md.

Criteria: C1 verified, C2 verified.

### impl-291 · 2026-10-12T22:19:57.658Z

Full queued verification8c40210d completed exit0 at pushed head43b9f191f1adb6cf049825f46a31b2ec8ef55d51 (A-1667). npm run typecheck passed for hub and Neovim; full package suite passed1683/1683, zero failures/cancellations/skips. Reviewer rev-23 cleared C1/C2 at this head (A-1659). C3 remains pending only the16 corrected merge whole-file invocations held for T-309's fix and the Coordinator's explicit machine handoff; no stress supervisor runs.

### impl-291 · 2026-10-12T23:17:01.074Z

Fresh merge proof atbebb72f completed20/20 whole-file invocations under four concurrent workers (A-1677); earlier4/4 and interrupted prior-head runs are excluded. All21 fixed files now have complete20-run proofs (420 passing invocations). Both proof leases released; T-303's ordinary queued full run acquired them afterward. Fetched/merged currentdevbf09ed0 into pushed head83e48a4eb0b16875d36957595bd996433fd68275 before final review/verification; merge.test.ts, harness.ts, run-suite.ts and suite-lock.ts blobs are unchanged from the fresh proof build. Re-audit still finds44 reader files. Updated synchronized classification: hub/test/events.test.ts now also has T-310's emitted verdict-journal read, after successful flushLogs at the end of each verdict iteration; awaited fixture writes remain synchronized. No additional fix required. C3 awaits fresh-head integrated typecheck/full verification.

### impl-291 · 2026-10-12T23:18:09.111Z

Final proof bundle A-1678 is durable at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1678-t-291-final-proof-bundle-420-passing-invocations-across-21-files/README.md. It validates21 complete summaries and420 successful whole-file invocations; excludes the older partial merge proof and interrupted runs while retaining their logs. Review refresh delivered to rev-23 at pushed83e48a4 after currentdev merge; relevant merge/fixture/runner blobs match freshproofbebb72f. Per Coordinator04eb8c33, final ordinary suite submission waits for T-281's Linux batch/container end, behind T-304. No further hand run; C3 remains pending final integrated typecheck/full result.

### rev-23 · 2026-10-12T23:22:11.868Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-291-2
commit: 83e48a4eb0b16875d36957595bd996433fd68275

No high or medium findings. C1/C2 remain clear after the shared merge; all 44 reader classifications match, including T-310's flushed verdict reader. The selected 21 proof indices contain 420 successful whole-file invocations and every log has zero fail/cancelled/skipped/todo. Fresh merge proof blobs match this head. C3 remains pending the new exact-head integrated typecheck/full verification. Evidence A-1684: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1684-t-291-refreshed-source-review-and-420-log-proof-audit.md.

Criteria: C1 verified, C2 verified.

### impl-291 · 2026-10-13T00:11:49.297Z

Final full verify25623acb-a3f1-401e-b6fc-98d196054a69 queued atpushede836e3a1ba173f16790cfca571f620261427cb62 immediately behindT-304's admittedd5977459, following Coordinatorc1043ca6. Fetched/merged currentdev first; review request delivered torev-23 before queue admission. Audit inventory still44 files; relevant merge/fixture/runner blobs match fresh20/20 buildbebb72f. All420 stress invocations complete; C3 awaits the exact-head integrated result. No additional hand-run testing.

### rev-23 · 2026-10-13T00:35:08.034Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-291-3
commit: e836e3a1ba173f16790cfca571f620261427cb62

Medium — nvim/test/layers.test.ts:327: the Now-filter screen retains an excluded Watch/background item, failing the full suite required by C3. The test and UI are unchanged by this branch; cause remains unproven.
C1/C2 source review and all 420 stress proof logs remain applicable. Exact-head full 25623acb: 1697/1698 pass, one failure, no skips/cancellations. Evidence A-1707: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1707-t-291-c3-blocked-by-layer-filter-full-suite-failure.md; full log A-1706.

Criteria: C3 failed (Exact-head full 25623acb exited 1: layers.test.ts:327 Now-filter exclusion fails; resolve the failure and obtain green integrated verification.).

### impl-291 · 2026-10-13T00:38:54.170Z

Coordinator-authorized shared fixe215e5342594627acce9ae74f845a9c082a4f8fb is pushed as a separate one-file commit, subject 'shared fix: layers.test.ts gn wait (T-291)'. The gn wait includes both exclusions; all original assertions remain. Exactdev5b4797b baseline passed5 sequential standalone file invocations,14/14 each; modified file passed14/14 once (A-1709). No multiworker proof or failure retry. Currentdev fetched/merged before candidate; temporary detached baseline worktree removed after evidence copied. Fresh review request delivered torev-23 before full verifydbd3c941-1913-4633-be3c-5e57cc1fd5a4, queued at exactheade215e53. C1/C2 and original420 stress proofs stand; C3 awaits the new integrated result.

### impl-291 · 2026-10-13T00:40:23.314Z

Audit addendum after T-304 merge at e215e53: current reader inventory is45 files, adding hub/test/session-resume.test.ts. Classification: synchronized. Its resumed-Claude role-clause hub.log read is inside an eventually callback after successful hub.status flushLogs (line37); its lost-work session-resumed journal read follows successful flushLogs (line132). No source change needed. The prior44 classifications remain, including the updated events.test.ts synchronized verdict read. Totals:21 fixed,23 synchronized,1 out-of-scope handover owned byT-281. The separate shared layers wait fix reads neither hub.log nor journal.jsonl. A fresh complete45-file audit artifact is posted alongside the retained420-run proof bundle.

### rev-23 · 2026-10-13T00:58:09.968Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-291-4
commit: e215e5342594627acce9ae74f845a9c082a4f8fb

No high or medium findings remain. C1–C3 verified: 45-file audit complete, synchronization assertions preserved, 420 selected stress invocations pass, and exact-head full dbd3c941 passes typecheck and 1712/1712 tests with zero failures/cancellations/skips. The shared layer wait preserves exclusions and now passes the full suite. Evidence A-1718: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1718-t-291-final-review-at-e215e53.md; audit A-1712, proof A-1678 and full log A-1717. C3's Implementer done mark was still pending at the pre-verdict read.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-291 · 2026-10-13T00:58:42.763Z

Final exact-head full verifydbd3c941 completed exit0 ate215e5342594627acce9ae74f845a9c082a4f8fb: npm run typecheck passed for hub andNeovim; all1712 tests passed, no failures/cancellations/skips (A-1717). Reviewer rev-23 verifiedC1–C3 and posted clearrev-2026-10-13-291-4 (A-1718). Updated45-file auditA-1712 and420-invocation proof bundleA-1678 are complete. Renewing C3 done after the priorfailed suite; claim retained until merge.

### coord · 2026-10-13T00:59:02.779Z

Merged 37234f43200646cb13bc07bc41e81ed23251a6a4 onto dev.
