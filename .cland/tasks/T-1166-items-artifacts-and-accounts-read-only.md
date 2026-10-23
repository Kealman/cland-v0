---
id: T-1166
kind: task
title: Items, Artifacts and Accounts read-only from More
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1165
topic: topic-907
branch: t/T-1166-items-artifacts-and-accounts-read-only
created: 2026-10-23T07:00:02.171Z
updated: 2026-10-23T15:03:12.225Z
closed: 2026-10-23T15:03:12.225Z
---

## Summary

At phone width the three areas More opens are read-only: the Items tree and a full-screen card without actions or planning views, artifacts to read without Keep, Archive or compose, and the accounts without edits.

## Parent

E-419 (§3.6 More, P26; "the planning views stay desktop first"; the second half of tracer step 1).

## What to build

- **Items.** At phone width the Items area shows the explorer tree only: the view switcher with Board, Graph and Plan is absent. A tap on a row opens the item's card full screen with a back control (the browser's back does the same). The card shows its blocks and none of its actions: no quick message, done, archive, criteria edit or plan approval, and the Items keys that change an item do nothing at this width. Other screens reuse this read-only card (the thread's card button, a later ticket).
- **Artifacts.** The list and the viewer, the viewer full screen with a back control; Keep, Archive and compose are absent.
- **Accounts.** The registry, windows and limits as facts; no control that changes an account. At phone width the notification switches belong to More (a later ticket), not to the profile block.
- While one of the three is open the bar marks More as current. The desktop at 640 px and wider keeps every action.

## Acceptance criteria

- [x] C1. At 390x844 More then Items shows the tree with no view switcher, and a tapped row opens its card full screen with a back control and no action control (Web test).
  - done: impl-1166 · 2026-10-23T14:31:17.772Z
  - verified: rev-23 [reviewer] · run rev-20261023-1166-final · 2026-10-23T14:58:30.718Z · commit eedf6a02b4b4be8b616d82f1d26d5291bf1b8b84
- [x] C2. At 390x844 the Items keys for done, archive, message and criteria edit change nothing, as `cland task view` reads, while at 1440 px the same keys still act (Web test).
  - done: impl-1166 · 2026-10-23T14:45:34.515Z
  - verified: rev-23 [reviewer] · run rev-20261023-1166-final · 2026-10-23T14:58:30.718Z · commit eedf6a02b4b4be8b616d82f1d26d5291bf1b8b84
- [x] C3. At 390x844 More then Artifacts opens an artifact full screen with a back control and offers no Keep, Archive or compose (Web test).
  - done: impl-1166 · 2026-10-23T14:26:38.736Z
  - verified: rev-23 [reviewer] · run rev-20261023-1166-final · 2026-10-23T14:58:30.718Z · commit eedf6a02b4b4be8b616d82f1d26d5291bf1b8b84
- [x] C4. At 390x844 More then Accounts shows each account's facts with no control that changes an account, and the bar marks More current in all three areas (Web test).
  - done: impl-1166 · 2026-10-23T14:26:38.896Z
  - verified: rev-23 [reviewer] · run rev-20261023-1166-final · 2026-10-23T14:58:30.718Z · commit eedf6a02b4b4be8b616d82f1d26d5291bf1b8b84
- [x] C5. `web/README.md` lists what More opens on the phone and what stays desktop only (docs).
  - done: impl-1166 · 2026-10-23T14:26:38.964Z
  - verified: rev-23 [reviewer] · run rev-20261023-1166-source-2 · 2026-10-23T14:32:21.296Z · commit 9bf6fbf9741c88e187212d7f967d427e266f7075
  - verified: rev-23 [reviewer] · run rev-20261023-1166-source-3 · 2026-10-23T14:46:12.585Z · commit eedf6a02b4b4be8b616d82f1d26d5291bf1b8b84
  - verified: rev-23 [reviewer] · run rev-20261023-1166-final · 2026-10-23T14:58:30.718Z · commit eedf6a02b4b4be8b616d82f1d26d5291bf1b8b84

## Comments

### impl-1166 · 2026-10-23T14:23:04.692Z

TDD slices implemented using T-1165's shared phone seam. Observed red Items switcher assertion (actual 1), red phone D/A filter changes, red missing artifact full-screen viewer, and red Accounts switches (actual 2). Four phone-more cases now pass locally on macOS arm64; Items 8/8 and Artifacts 11/11 neighbors pass. Migrating T-1165's selected-row observer to the exact full-screen card receipt. Remaining targeted neighbors, layout review and committed source review before mode-free verification.

### rev-23 · 2026-10-23T14:29:45.684Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1166-source
commit: b3d07949bd5b16ce11d9a17cdc4c06fcee2a138a
scope: full
findings: [{"severity":"medium","text":"M1: phone page open/popstate do not advance navigationSerial, so a held relation lookup can still match its old serial and push a page after Back or newer phone selection. Fence these transitions and cover held public resolution across both Back paths.","file":"web/src/Shell.tsx","line":70}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1166 full source review
Head b3d07949bd5b16ce11d9a17cdc4c06fcee2a138a / tree5e6e3dd613d62df38813d883440fd8411b81039a; fixed base/parent03a04581c8b57e0ca4222b989c7fe71f9338af5d (T-1165 landed). Diff16files311+/41-. Run rev-20261023-1166-source. Not clear; one medium finding M1; C1 failed. No configured verification receipt.

## Standards
No independent findings. Shared usePhone/isPhone seam drives render and central action dispatch/help/palette gates; no component-local raw keyboard listener. Existing desktop behavior defaults retained. ReadOnlyItemCard reuses factual card blocks and adds readOnly to ItemCriteria, both removing form controls and guarding mutate. ItemsTree is forced at phone width without deleting saved Graph/Board/Plan; tree wraps to phone width. More current marker remains supplied by shell. Artifacts preserves existing capability viewer/sandbox/download behavior and gates keep/archive/compose actions centrally. Accounts keeps registry/windows/limits/sign-in facts while hiding phone notification switches. README Phone and test guidance updated; sorted Web tier registration added. No command, protocol, setting, permission or dependency changes. Test levels/observable receipts in docs/agents/tests.md and Web documented key ownership applied. Diff check clean.

## Spec
M1 medium — web/src/Shell.tsx:70 (also78–81,306–315). New phone page open/history-pop boundaries do not advance navigationSerial. Phone card A can start a relation/item-link B lookup through asynchronous resolveItem (e.g. a closed target absent from snapshot); while its public task.list response is held, Back to Items/browser Back clears phonePage without fencing the lookup. At release, openItem's old serial still matches and pushes B, reopening detail after the human returned to the list. A newer direct phone card tap similarly fails to invalidate older resolution. This violates C1's meaningful Back/list navigation and can replace the current selected card. Invalidate pending navigation at phone-page and Back/popstate boundaries, preserving the completing openItem's own valid transition, and add a public held-resolution regression for both Back paths/newer selection. Impl confirms source issue and is fixing it; no regression was run by Reviewer.

Remaining spec checks: C1 tree/no switcher, read-only full-width reusable card and44px Back are present; both normal Back paths tested but race absent. C2 phone D/A,m/M,e and plan action gates apply to keyboard,palette/help; CLI task-view readback unchanged; desktop1440 filtering/composition/criterion mutation and640 editor remain tested. D/A are existing visibility filters, not tracker mutation commands. C3 direct artifact taps/full-screen page and Back paths present; no keep/archive/compose toolbar, frame capture/readback and existing sandbox retained. C4 Accounts facts/switch absence and640 restoration covered, More current marker checked across three areas. C5 README lists these phone/desktop distinctions accurately, but source criterion marking deferred while not clear. No other findings.

A-10065 existing screenshot inspected read-only, not browser QA:390x844 full-width item card, readable facts/expanded criteria,44px Back, More current, no drawer or obvious horizontal clipping. It cannot prove navigation races.

A-10066 is a source-as-committed working-tree local summary: macOS arm64 Node24.21.0 isolated Headless Shell/sealed fixtures, build/Web typecheck, phone-more4,phone7,items8,artifacts11,accounts6,key-contexts3,palette11 plus criteria4/actions7/shell9/slots4 reported passing; manifest lint pass, generic lint report132findings59files. Reported worst passing new sample1.202493208s<4s; no allowance trigger yet. Reds: switcher actual1, D/A filter changes, absent page viewer, phone notification switches actual2. Original output stays in implementer records; do not rerun for transcription or relabel working-tree evidence exact committed-head configured coverage. No Linux/full suite/load/T3 claim. Migrated T-1165 selection wait now observes exact full-screen card id and keeps split assertions. After correction re-audit passing new Linux samples for the launch allowance rule.

Complete finding set:M1 only. Fix/commit/push and request fresh source review before mode-free verification. Reviewer read-only Git/files/existing screenshot; no tests/browser/GUI/edits/merge. Affected after-stage QA separate, no per-item QA criteria/brief. Standards0; Spec1 medium.

Criteria: C1 failed (Phone Back/newer page selection does not fence a pending item-resolution read; late completion can reopen or replace the card after returning to the list.).

### rev-23 · 2026-10-23T14:32:21.296Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1166-source-2
commit: 9bf6fbf9741c88e187212d7f967d427e266f7075
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1166 corrected source review
Head9bf6fbf9741c88e187212d7f967d427e266f7075 / tree52b6cbd2c455e6a00e4d33f07f94de1b1d861a47. Parent/fixed pointb3d07949bd5b16ce11d9a17cdc4c06fcee2a138a; no dev merge. Run rev-20261023-1166-source-2. Clear; findings[]; C5 docs verified, C1–C4 runtime pending.

## Standards
Pass. Three-file focused correction moves shared navigationSerial ref before phone handlers and increments it for new phone-page opens and popstate. Existing serial checks remain. No new width seam, protocol, dependency, local keyboard listener or changed waits/assertions. Test retains sealed phone Web fixture, actual task.list request/reply, bounded holder setup, and observer armed before releasing held response. Exact target in rendered palette establishes arrival before the no-card assertion. Both button/browser Back subcases retained. Test guidance documents this boundary. Diff check clean; prior full source audit A-10067 carries forward.

## Spec
M1 resolved in source. A held relation resolution started before Back now sees a different serial after popstate and returns before openPhonePage/pushState. A newer direct phone card/page opening also increments the serial and fences the older lookup. Valid openItem completion still checks its serial before intentionally opening its own page; increment there has no subsequent invalidating check in that completion. Existing setArea/source resolution fences preserved.

Regression seeds T-1 linking an unloaded closed T-2; hideDone prevents premature closed-root loading. It captures the exact public T-2 summary response, navigates Back, observes original T-1 tree row, then arms exact T-2 palette-row arrival before releasing the response and asserts no reopened card plus original row remains. Repeats button and browser Back. A-10069 records original red on b3d source, `button Back must not reopen the late target; 1 !== 0`, retained trace A-10068. Newer direct selection fence additionally inspected in source; no separate runtime case claimed.

C5 verified: unchanged README Phone section accurately covers read-only Items/card/criteria, desktop-only planning views/mutation keys, artifact viewer/back/read controls, Accounts/sign-in facts without phone notification switches, More current marker and desktop>=640 behavior. Earlier screenshot A-10065 and local A-10066 retain original provenance.

A-10069 is working-tree source-as-committed targeted evidence: macOS arm64 Node24.21.0 isolated Headless Shell/sealed fixtures, build/Web typecheck/guards reported pass; phone-more5/5(new held-read case1.167914208s),phone7/7,items-actions7/7. Earlier required neighbors in A-10066 unchanged. No new passing local identity>=4s, so no allowance yet. No configured same-head/Linux/full-suite/T3/load evidence claimed. Preserve original output/exit/head/timings without transcription reruns.

Proceed with mode-free cland verify at exact9bf6fbf9, then final C1–C4 settlement and audit passing new Web durations. Reviewer read-only files/Git; no tests/browser/GUI/edits/merge. After-stage affected QA separate. Standards0; Spec0.

Criteria: C5 verified.

### rev-23 · 2026-10-23T14:43:55.430Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1166-evidence-red
commit: 9bf6fbf9741c88e187212d7f967d427e266f7075
scope: evidence
findings: [{"severity":"medium","text":"M2: Plan resize test still awaits an Epic plan heading at390px, but phone Items now intentionally renders the tree only. Migrate phone receipt/inert approval assertion while retaining1279/1280 desktop checks; configured run93bd397a is failed.","file":"web/test/plan.test.ts","line":137}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1166 failed configured evidence
Head9bf6fbf9741c88e187212d7f967d427e266f7075 / tree52b6cbd2c455e6a00e4d33f07f94de1b1d861a47. Run rev-20261023-1166-evidence-red. Not clear; C2 failed for affected integration-test gap; C1/C3/C4 runtime unverified, C5 source verification stands.

Actual raw failure A-10071:15235–15245: `locator.waitFor: Timeout 3000ms exceeded`, waiting for `getByRole('region', { name: 'Epic plan' }).getByRole('heading', { name: 'S1 · Changed stage', exact: true })`, at web/test/plan.test.ts:137. Leaf C3 and its parent fail.

## Standards
Configured mode-free93bd397a-b557-44eb-9052-e8527732a746 at same source-clear head exits1. Raw ordinary finish records:2730test passes/2test failures;404file passes/1file failure. T1(132files) and fallback all hub+Neovim T2(239files) exit0; complete Web(34files) exit1. Linux x64 c-8 sfo2 cland-v0-11742719, Node24.21.0/Neovim0.12.5, workers2/Web4; lifetime580s/$0.0403. Host gatea5284d85ccf6d7790f927e5e299cb70ba73237e0 reused, not repeated remotely. No T3/T4; task policy defers T3. No load-gate scope records; generic five-repetition headers are not repetition proof. Generic durations/lint/ratchet report-only,132lint findings59files,2missing baselines. Actual phase T1 49.09s/T2 310.19s/Web115.06s; projections and per-test sums are not observed phase wall.

## Spec
M2 medium — web/test/plan.test.ts:137. Old Plan C3 still expects the Plan heading mounted after resizing to390px, while this item's intentional ItemsView phone branch renders only ItemsTree below640. This affected integration expectation was not migrated. This is a branch integration gap, not classified as a shared runtime defect. Update phone slice to observe exact selected tree/no Plan or switcher, preserve inert physical approval plus durable task.plan state/frame assertions, and retain existing1279px absence and1280px restoration checks. Source/read-only design need not be reversed to satisfy obsolete assertion. Fresh source review before another verification.

All five new phone-more cases pass: Items/back2.736583968s, inert/desktop keys2.977130142s, artifacts1.447498781s, accounts1.135540486s, held Back race2.500315399s; none reaches4s so no new allowance trigger. Existing phone frame parent5.405397252s passes its reviewed E-880 allowance. Failed Plan parent8.617s and failed C3 4.346s do not justify passing-new-identity allowances.

Prior source review A-10070/M1 correction remains valid source evidence. Failed configured receipt cannot finalize C1–C4. Reviewer read-only source/log/hub inspection, no rerun/browser/edits/merge. After-stage QA separate. Standards0 new source findings; Spec1medium integration-test finding.

Criteria: C2 failed (Configured Web fails old Plan C3 expectation at390px after this item's deliberate phone-only tree change; migrate affected phone/desktop preservation test and rerun after source review.).

### rev-23 · 2026-10-23T14:46:12.585Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1166-source-3
commit: eedf6a02b4b4be8b616d82f1d26d5291bf1b8b84
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1166 Plan integration source review
Head eedf6a02b4b4be8b616d82f1d26d5291bf1b8b84 / tree fef4b84eb3518733099a8a1ab97e5e23021dcaa6. Parent/fixed point9bf6fbf9741c88e187212d7f967d427e266f7075; no dev merge. Run rev-20261023-1166-source-3. Clear; findings[]; C5 verified, C1–C4 runtime pending.

## Standards
Pass. Only web/test/plan.test.ts and docs/agents/tests.md change. Product/M1 fence unchanged from A-10070. Phone test now waits for durable exact E-900010 Items tree row after resize before asserting absent Plan and switcher. Physical a is dispatched from that row, captured no-approve frame assertion and durable task.plan pending readback remain. Existing1279 approval absence/help exclusion and1280 restored enabled approval checks untouched. No timeouts expanded or negative assertions substituted for completed render. Guidance adds Plan to required targeted neighbors. Diff check clean.

## Spec
M2 resolved: stale Plan-at390 expectation is replaced with this item's intentional tree-only phone behavior and preserves desktop planning view restoration. C2 is done-refreshed. A-10067 full audit/A-10070 M1 corrected source carries forward. C5 unchanged README still accurately documents phone More read-only surfaces, desktop-only planning/actions and640 seam. No additional source findings.

A-10073 retains actual failed configured93bd397a/A-10071 at9bf6fbf9: timeout waiting for Epic plan heading at137, T1/allfallbackT2 exit0, Web exit1 with2730pass/2fail. It remains failed historical evidence A-10072. Original local red at9bf source could see stale heading then click detached Plan at139; correction waits for the new tree boundary, addressing that render-order variant. Working-tree source-as-committed local macOS arm64 Plan4/4, phone-more5/5 and Web typecheck/guards reported pass; no new-head configured receipt. Earlier local summaries/trace retain provenance, no transcription rerun requested.

Prior Linux passing new phone-more max2.977130142s<4s; no new allowance triggered there. Re-audit next configured passing samples. Existing phone-frame parent allowance remains unchanged.

Proceed with mode-free verification at exact eedf6a02, then final runtime settlement. Reviewer read-only files/Git/hub state, no tests/browser/GUI/edits/merge. After-stage affected QA separate. Standards0; Spec0.

Criteria: C5 verified.

### rev-23 · 2026-10-23T14:58:30.718Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1166-final
commit: eedf6a02b4b4be8b616d82f1d26d5291bf1b8b84
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1166 final evidence review
Head eedf6a02b4b4be8b616d82f1d26d5291bf1b8b84 / tree fef4b84eb3518733099a8a1ab97e5e23021dcaa6, branch t/T-1166-items-artifacts-and-accounts-read-only. Run rev-20261023-1166-final. Clear; findings[]; C1–C5 verified.

## Standards
Exact-head source A-10074/rev-20261023-1166-source-3 carries forward full audit A-10067 and corrected navigation fence A-10070. Branch/tree readback and hub verify result match. Fresh mode-free run914feaa6-76bf-4712-988d-baf5d74cf587/A-10075 exits0; raw ordinary finish records2732test passes/405file passes, no failures/skips/cancellations. Actual T1(132files), fallback all hub+Neovim T2(239files), complete Web(34files) exit0. No T3/T4; T3 deferred by configured task policy. No load-gate scope finish records; generic five-repetition headings establish no repetitions. Fresh run, no old-head cache evidence claimed.

Linux x64 c-8 lon1 cland-v0-b0acbc29, Node24.21.0/Neovim0.12.5, workers2/Web runner4; lifetime618s/$0.0429. Host gate108a02212c1b71e9ea83138aedfeec2ccaaff49d reused, not remotely repeated. Actual phases T1 54.27s/T2 341.67s/Web127.03s; per-test sums and projected wall figures are not observed phase wall. Generic budget/lint/ratchet and existing out-of-scope tier-tripwire diagnostics remain report-only (132lint findings/59files;2missing file baselines). Reviewed phone-frame parent allowance unchanged. Five new phone-more identities max3.300633186s<4s across retained passing samples; no new allowance triggered.

## Spec
C1 verified: phone tree/no view switcher, full-screen reusable exact item card with factual blocks/read-only criteria, no mutation controls, both Back paths. Held public item-summary regression now passes after M1 serial fence, preserving list after late target arrival; newer page-open invalidation also source-reviewed.
C2 verified: phone mutation/action keys inert with sealed CLI readback; desktop1440 filtering/message/topic/criterion actions and640 restoration pass. Migrated Plan C3 passes exact phone tree/no planning view, physical a inert, no approve frame plus durable pending plan;1279 absence and1280 restored approval remain. M2 affected integration gap resolved.
C3 verified: artifact list/folder reading and full-screen existing capability viewer, both Back paths, no keep/archive/compose; public state/frame checks retained, sandbox unchanged.
C4 verified: registry paths/windows/limits/sign-in facts retained, phone account edits/notification switches absent;640 switches return; More current across all three areas.
C5 verified: source-reviewed README Phone accurately describes these behaviors and desktop distinctions, test guidance/registration match.

Raw passing phone-more samples: Items/card2.991456566s; phone/desktop keys3.300633186s; artifacts1.683328797s; accounts1.162081301s; held Back2.827687625s. Existing Plan C3 1.458281399s and parent6.263648537s pass; parent is existing identity, not a new phone-more sample. Historical93bd397a/A-10071 remains failed at9bf6fbf9, recorded A-10072; this new-head receipt supplies replacement evidence.

Earlier local summaries/trace/screenshot retain provenance; no new local reruns or browser QA by Reviewer. Read-only Git/log/hub inspection only; no edits/merge. Implementer reports clean post-run merge-tree against03a04581 without changing source; no independent mutation performed. Affected after-stage QA separate, no per-item QA criteria/brief. Standards0; Spec0.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-23T15:03:12.225Z

Merged 0e1b26d420c3ce03a6e3a0246208d1e02b709d7b onto dev.
