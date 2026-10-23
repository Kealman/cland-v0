---
id: T-1172
kind: task
title: "Sessions on the phone: the strip, the queue sheet and the page"
state: open
status: review
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
updated: 2026-10-23T19:25:19.982Z
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
- [x] C2. A tap on the verify line opens the queue view as a full-height sheet whose close returns to the list (Web test).
  - done: impl-1172 · 2026-10-23T19:19:22.456Z
- [x] C3. A tap on a waiting fake session opens its page full screen with the command it waits on, and the browser's back returns to the same row (Web test).
  - done: impl-1172 · 2026-10-23T19:24:32.942Z
- [x] C4. On the page, Stop on a busy fake session asks for a confirmation and stops it after Confirm, as `cland session list` reads, with each action at least 44 px tall (Web test).
  - done: impl-1172 · 2026-10-23T19:19:22.743Z
- [x] C5. A tap on an account cell opens Accounts read-only (Web test).
  - done: impl-1172 · 2026-10-23T19:19:22.815Z

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
