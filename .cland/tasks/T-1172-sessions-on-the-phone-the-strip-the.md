---
id: T-1172
kind: task
title: "Sessions on the phone: the strip, the queue sheet and the page"
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
  - T-1166
topic: topic-915
branch: t/T-1172-sessions-on-the-phone-the-strip-the
created: 2026-10-23T07:00:04.138Z
updated: 2026-10-23T19:54:10.562Z
closed: 2026-10-23T19:54:10.562Z
---

## Summary

At phone width the Sessions screen shows its counts, the accounts strip of cells, the verify line opening the queue view as a full-height sheet, and the two-line rows of T-1137 whose tap opens the session's page full screen.

## Parent

E-419 (§3.6 the sessions, P27 to P30; tracer step 4). Reuses T-1136's page and confirmations and T-1137's rows.

## What to build

- **The header** names Sessions with the waiting, busy, idle and yours counts.
- **The accounts strip** is one row of cells in the registry's order (name, the worst window with its share, a thin meter; red with the reset when limited; a dash without data); a tap on a cell opens Accounts read-only.
- **The verify line** keeps its one-line summary with a chevron; a tap opens the queue view as a full-height sheet with a close control, instead of in place.
- **Rows** are T-1137's two-line rows with no row or swipe actions; groups fold as on the desktop.
- **The session's page** opens full screen on a tap with a back control (the browser's back too, returning to the same row): the model, the account, the usage, the command a waiting session waits on, and Stop, Resume, Archive and Capabilities at least 44 px tall, Stop and Archive confirmed in place as T-1136 does.

## Acceptance criteria

- [x] C1. At 390x844 the Sessions screen shows the header counts, one accounts cell per account and the two-line rows, and no row offers an action (Web test).
  - done: impl-1172 · 2026-10-23T19:19:22.356Z
  - verified: rev-23 [reviewer] · run rev-20261023-1172-final · 2026-10-23T19:49:23.370Z · commit 6fe30b154db5ce21cd4bd52b23901e93b00dfc78
- [x] C2. A tap on the verify line opens the queue view as a full-height sheet whose close returns to the list (Web test).
  - done: impl-1172 · 2026-10-23T19:19:22.456Z
  - verified: rev-23 [reviewer] · run rev-20261023-1172-final · 2026-10-23T19:49:23.370Z · commit 6fe30b154db5ce21cd4bd52b23901e93b00dfc78
- [x] C3. A tap on a waiting fake session opens its page full screen with the command it waits on, and the browser's back returns to the same row (Web test).
  - done: impl-1172 · 2026-10-23T19:24:32.942Z
  - verified: rev-23 [reviewer] · run rev-20261023-1172-final · 2026-10-23T19:49:23.370Z · commit 6fe30b154db5ce21cd4bd52b23901e93b00dfc78
- [x] C4. On the page, Stop on a busy fake session asks for a confirmation and stops it after Confirm, as `cland session list` reads, with each action at least 44 px tall (Web test).
  - done: impl-1172 · 2026-10-23T19:19:22.743Z
  - verified: rev-23 [reviewer] · run rev-20261023-1172-final · 2026-10-23T19:49:23.370Z · commit 6fe30b154db5ce21cd4bd52b23901e93b00dfc78
- [x] C5. A tap on an account cell opens Accounts read-only (Web test).
  - done: impl-1172 · 2026-10-23T19:19:22.815Z
  - verified: rev-23 [reviewer] · run rev-20261023-1172-final · 2026-10-23T19:49:23.370Z · commit 6fe30b154db5ce21cd4bd52b23901e93b00dfc78

## Comments

### impl-1172 · 2026-10-23T19:14:32.376Z

Test-first phone slices are implemented in the working tree: counts and single-row account meters, shared full-height BottomSheet queue, waiting command/page with browser Back, and in-place Stop/Archive confirmation. Four new Web cases pass locally (Darwin arm64, sealed Headless Shell and fake Codex only); Stop is checked through scratch-hub CLI session list. No passing sample reaches 4 s so far. Desktop regression files and required phone files run next.

### rev-23 · 2026-10-23T19:21:56.847Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1172-source
commit: d94d69d45ba120964400dc9f3ca3218b32b689aa
scope: full
findings: [{"severity":"medium","text":"M1: layout effect clicks a collapsed Fold then focuses its still-hidden row. Restore exact selected-row focus after the visible commit and cover busy→Stop→folded Stopped→Back.","file":"web/src/sessions/SessionGroups.tsx","line":13}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1172 full source review
Headd94d69d45ba120964400dc9f3ca3218b32b689aa; tree3e1fbb54552b151adad91e0a19c7f238a9319f6f. Fixed base/parent1c82517c4cf7d9d7c3f82ccdf7cffee50eb1827b; branch t/T-1172-sessions-on-the-phone-the-strip-the. Run rev-20261023-1172-source. Not clear: M1medium/C3failed, other runtime criteria pending. Full audit complete, no other findings. Crew disables Reviewer subagents; separate axes reviewed in this session.

## Standards
No independent findings. Existing Sessions modules/confirmation/capability/queue model reused. BottomSheet adds optional fullHeight defaultfalse, preserving ask/approval geometry; queue shares modal focus/inertness/viewport lifecycle and Shell's single sheet dispatcher. No new key listener/hub authority/dependency. Shell adds Sessions to phonePage/history while preserving navigationSerial and inboxLaunch initialization; Sessions dismissal deliberately reaches SessionActions so Escape cancels pending confirmation before Back.

FakeHarness.waitingForApproval adds optional approvalCommand through existing AdapterHost.signal; one-argument behavior matches prior #signal/#publish path, production StateSignal already declares field and Codex emits it. No real harness/process introduced for it. New Web header explicitly justifies scratch CLI session-list subprocesses as acceptance readback. No new startDaemon/spawnSpoke/sleep; one cland call-site in readback helper, only scratch fixture. Public adapter facts/socket frames, fake sessions, exact DOM/CLI receipts and boundedpageUntil used; browser/writer cleanup delegated to existing sealed fixture with empty censuses. Stop Confirm waits Resume before CLI persisted status, Archive waits disappearance before archivedCLI; no native reaping claim. Full-height queue test measures visible section surface, not just viewport-sized overlay. Tier/docs/help coherent, diffcheckclean.

## Spec
M1medium — web/src/sessions/SessionGroups.tsx:13. New Back focus effect clicks a folded destination group's toggle and immediately calls row.focus/scrollIntoView in the same layout effect. The Fold hidden ancestor has not yet committed open, so the focus attempt is ignored; subsequent open render does not rerun this selected-only effect. Public path: keep Stopped folded, tap busy session, Stop on page, Back; selected session is now in the folded Stopped group. C3 requires Back to exact originating row, and added phone focus behavior must survive its live group move. Existing Back case keeps waiting row in already-open group. Restore focus only after destination's visible commit, and add public folded-Stopped→busy page→Stop→both Back paths regression with exact focus receipt. Implementer is reproducing/fixing; no Reviewer runtime reproduction claimed.

C1 otherwise source present:four phone header counts, registry-order worst/missing/critical meter cells one row,44px height, shared52px two-line rows/no visible row actions, group folds retained.
C2 source present:phone verify summary with chevron opens shared full-height modal queue; Close/physicalEscape restore summary focus, desktopFoldpreference unaffected. Test asserts section0,0,390,844 and retained queue row.
C3 source page facts/model/account/usage/full waiting command wrapping and historyBack present, but M1 blocks same-row focus under group transition.
C4 source shares existing44px Stop/Resume/Archive/Capabilities and in-place confirmations; EscapeCancel remains beforepageBack. Public fake busy Stop and Archive cancellation/confirmed persisted scratchCLI outcomes tested.
C5 cell anchor navigates Accounts; existing central phone readonly gate removes mutations, test sees exact account and no inputs/select/switch/edit controls.

Existing retained A-10193/94/95 screenshots inspected read-only:phone list fits counts/3orderedcells/two-linegroups/currentSessionsbar; page complete longcommand wraps/facts/44pxStop+Capabilities; queue visible surface fills390×844 withclose. No interactive/real-browserQA claim.

A-10192 contains local original targeted output83/83 in15 serial files, nofail/cancel/skip and empty browsercensuses. Per-command wall table is not phasegate timing. Summary attributes source-as-committed working tree; later final phone4/4 includes screenshots/title change and max1.172s. Rootcheck/tierlint reportedpass;132report-onlylintfindings59files/zerorefusals. Darwinarm64 Node24.21.0 isolated HeadlessShell, fakeCodex only. No configured/Linux/full-suite receipt; raw standalone command-exit metadata not supplied in note, no stronger claim. All new passing localsamples<4s, noallowanceyet. Preserve originalstdout/exits/source/timings; no transcription reruns.

Complete finding set M1only. Correct/commit/push and fresh source review before mode-freeverify, re-markC3 after fix. No unsolicited post-reviewdevmerge. Reviewer read-only Git/files/log/existing images/hub; no tests/probes/livebrowser/GUI/edits/merge/delegation. After-stage affectedQA separate, no per-itembrief/qaCriteria.
Standards:0findings. Spec:1medium(M1).

Criteria: C3 failed (Back into a folded destination group attempts focus before its open commit, losing exact selected-row focus after a session changes group on its page.).

### rev-23 · 2026-10-23T19:25:19.982Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1172-source-2
commit: 89c0aed1200a5da52300b727c6c396242a0b7796
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1172 corrected full source review
Head89c0aed1200a5da52300b727c6c396242a0b7796; treeabbce50d51cb27557feda268fb44a0bd036027d9. Parent/fixed pointd94d69d45ba120964400dc9f3ca3218b32b689aa; branch t/T-1172-sessions-on-the-phone-the-strip-the. Run rev-20261023-1172-source-2. Clear; findings[]; allC1–C5 runtime pending. Prior full audit A-10196 carries forward.

## Standards
No findings. Four-file correction, no dev merge. Both ordinary and archived Fold render children with committed groupOpen; SessionRow uses ref/layout effect gated selected&&groupOpen&&isPhone, dependencies selected/groupOpen. Parent effect still reveals selected group; focus is no longer attempted while hidden. No timer/frame workaround/product polling or extra keyboard listener. Desktop focus behavior unchanged. New public regression keeps exact destination expanded/visible/focused assertions with existing bounded pageUntil; docs describe state/group transition. Bounds and prior assertions retained, diffcheckclean.

## Spec
M1 resolved in source. When Back remounts selected stopped row inside saved-closed group, first row effect skips falsegroupOpen; parent opens Fold; subsequent committed truegroupOpen triggers row focus/scroll. Handles regular and archive groups. Regression covers both button/browserBack:fold Stopped, open busyfake, Stop with Resume receipt beforeBack, observe exact Stopped row/group expanded and exact activeElement. Existing quiet waiting-command Back case remains. Implementer reproduced prior source twice with actual error 'stopped row has focus after its destination fold commits open: not within3000ms', selectedtrue/visibletrue/activeBODY; retained in A-10197, no Reviewer runtime reproduction.

A-10197 retains affected37/37 across6serialfiles, nofail/skip/cancel and clean owned browsercensuses. Finalphone5/5, newM1identity1.021723333s, fileTAP4.338616083s distinct from command wall table; other new localsamples<4s, no allowance. Request reports localDarwinarm64 Node24.21.0 isolatedHeadlessShell, current build/webtypecheck/token/contrast/hooks pass. Note contains retained output/summary rather than separate command-exit metadata; no configured/Linux/same-head suite or artificial combined84/84 claim. Original83/83 stays attributable tod94d69d4. Preserve originalstdout/exits/source/timing receipts without transcription reruns.

Proceed with mode-freeverify at exact89c0aed1, then finalC1–C5 settlement and actual new passing identity audit. Source review does not establish runtime marks. Reviewer read-only Git/files/log/hub; no tests/probes/livebrowser/GUI/edits/merge/delegation. After-stage affectedQA separate, no per-itembrief/qaCriteria.
Standards:0findings. Spec:0findings.

### rev-23 · 2026-10-23T19:36:36.508Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1172-source-3
commit: 6fe30b154db5ce21cd4bd52b23901e93b00dfc78
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1172 merged-head delta source review

Head 6fe30b154db5ce21cd4bd52b23901e93b00dfc78; tree 4c40c911bdea1301fc8116e3d086c99a6ba85506. Parents: source-clear 89c0aed1200a5da52300b727c6c396242a0b7796 and incoming dev d4d24ec88ffd8254f245cfe2828177f9a67415d7. Branch t/T-1172-sessions-on-the-phone-the-strip-the. Run rev-20261023-1172-source-3. Clear; findings []; all C1–C5 runtime pending. Full source audits A-10196/A-10198 carry forward.

Coordinator authorization independently read: 21f175b0 directs cancellation/merge after T-1173, retains both Shell behaviors and docs headings; 34aa52e6 corrects required test name to phone-disconnected; 6b2da046 confirms landing and authorizes merge d4d24ec8. Cancelled A-10201 is partial old-head evidence, not a pass.

## Standards

No findings. Both complete test-seam headings and contents survive exactly against their parent sources. Shell resolution combines as-of time and Sessions Back control in the shared actions header; disconnected import/component remains immediately under app header. Sessions phone-page type, navigation serial/history and confirmation-first Escape routing are intact.

SessionGroups/SessionRow, phone-sessions test, BottomSheet and FakeHarness blobs match source-clear 89c0aed1. In particular, M1's selected-row focus still waits for Fold's committed open state. Incoming connection/Disconnected/Composer/phone-disconnected test blobs match reviewed dev exactly; T-1173 source/final audits A-10191/A-10200 carry forward. No new branch-local product/test behavior beyond reviewed lanes. Tier registrations and README retain both lanes; diff check clean.

## Spec

No merge findings. Phone Sessions remains a history-backed page with Back control and shared lifecycle confirmation handling, including cancellation before navigation. Offline strip and Inbox as-of have their original width/live guards; unsent reply and command refusal/no replay remain incoming behavior. No new interaction overwrites either lane's state.

A-10204 retained local output and per-file table inspected: 87/87 across 16 serial files, no fail/skip/cancel and clean owned browser censuses. Includes phone-sessions and phone-disconnected once each, required phone files and Sessions/actions/launch/accounts/key-contexts/verification neighbors. Build, full root typecheck, tier lint and whitespace check reported passing at resolved merge tree, local Darwin arm64 Node24.21.0 isolated Headless Shell. Note contains original output/summary rather than separate command-exit metadata; this is targeted local evidence, not a configured Linux/current-head suite pass. No new passing phone identity reaches 4 s; no allowance trigger yet.

Proceed with fresh mode-free verification at exact 6fe30b15, followed by final criterion settlement and actual passing-sample audit. Preserve original command/exit/head/timing attribution without transcription reruns. Reviewer read-only Git/files/log/hub; no tests, probes, live browser, GUI, edits, merge or delegation. Affected after-stage QA remains separate; no per-item brief or qaCriteria.

Standards: 0 findings. Spec: 0 findings.

### impl-1172 · 2026-10-23T19:49:15.161Z

At exact reviewed merge head6fe30b154db5ce21cd4bd52b23901e93b00dfc78, mode-free verify0f4fb161-febb-4927-9fde-fee53d192d1f passed2772/2772 with zero failures/skips on Linux x64 droplet c-8lon1, Node24.21.0/Neovim0.12.5. Check plus T1/T2/Web completed; mixed-diff fallback ran all T2 in both packages; T3 deferred to periodic dev/integrated (absent configured batch tiers). Lint/budgets/T3ratchet report-only. A-10206 is the durable full receipt. Droplet lifetime670s/cost$0.0465. New phone passing identities max3.124381s, so no allowance warranted. Post-run fetch/merge-tree against origin/devd4d24ec8 is conflict-free and produces existing HEAD tree4c40c911; tree clean. Awaiting Reviewer final runtime settlement; after-stage QA remains separate.

### rev-23 · 2026-10-23T19:49:23.370Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1172-final
commit: 6fe30b154db5ce21cd4bd52b23901e93b00dfc78
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1172 final same-head evidence review

Head 6fe30b154db5ce21cd4bd52b23901e93b00dfc78; tree 4c40c911bdea1301fc8116e3d086c99a6ba85506. Branch t/T-1172-sessions-on-the-phone-the-strip-the. Run rev-20261023-1172-final. Clear; C1–C5 verified; findings []. Source audits A-10196/A-10198 and merge delta A-10205 carry forward. M1 focus failure is resolved.

## Standards

A-10206 raw configured run 0f4fb161-febb-4927-9fde-fee53d192d1f independently audited: exact reviewed head, exit 0; ordinary 2772 test finishes and 413 file finishes all pass, with no failure, skip or cancellation. Actual all T1 (132 files), fallback all hub and Neovim T2 (239 files), complete Web (42 files). No T3/T4; configured T3 deferred to periodic/integrated occasions, no stage QA claim. No load-gate-scope records; generic repetition headers are not proof of repetitions.

Host check output includes typecheck, build and static/report-only test lint; gate 548435d6a176e3cce5539719ac0c2670682f0197 reused remotely, not repeated. Linux x64 c-8 lon1 cland-v0-ff441149, Node24.21.0/Neovim0.12.5, workers2/Web4, lifetime670s/$0.0465. Actual phase walls: T1 57.64s, T2 355.04s, Web158.94s. Test-second sums/projections are not wall time. Generic budgets/lint/ratchet remain report-only:132 findings in59 files,2missing file baselines and existing duration warnings retained.

Five new Web samples: counts/accounts/rows3.124380977s; waiting page/both Back1.914350833s; folded destination focus2.870319606s; confirmed lifecycle/CLI2.736234617s; queue sheet1.709656402s. All below4s and prior local passing samples below4s, so no allowance trigger. File elapsed13.439922145s is distinct from these identities and the Web phase wall.

## Spec

C1 verified: four header counts, registry-ordered one-row account cells with worst/missing readings,52px two-line rows, no visible/swipe row actions and group folds pass.
C2 verified: verify summary opens the shared full-height visible queue surface; Close and physical Escape restore summary focus/list.
C3 verified: waiting command/model/account/usage full-screen page, both Back paths and exact row focus pass; corrected busy→Stop→saved folded Stopped return passes for both Back paths.
C4 verified: shared44px lifecycle/capability controls, confirmation cancellation and confirmed Stop/Archive persisted scratch CLI receipts pass. No real harness or OS reap claim.
C5 verified: account-cell navigation opens phone Accounts read-only without mutation controls.

Branch tip/tree independently match the reviewed values. Lead is completing its fresh dev-conflict/ready check; a later authorized head change requires fresh source/current-head evidence. Cancelled A-10201 remains partial old-head evidence, not a pass. Source and this configured receipt settle all criteria at this exact head. Affected after-stage QA remains separate; no per-item brief/qaCriteria.

Reviewer read-only Git/files/log/hub; no tests, probes, live browser, GUI, edits, merge or delegation.
Standards: 0 findings. Spec: 0 findings.
Lead follow-up dfac2fde confirms fresh dev d4d24ec8, successful read-only merge-tree returning exact HEAD tree4c40c911, clean worktree and no head change.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-23T19:54:10.562Z

Merged db598a494d7b94a9ddb0bfdbda5bc631bf7752fc onto dev.
