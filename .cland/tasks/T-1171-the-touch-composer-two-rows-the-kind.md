---
id: T-1171
kind: task
title: "The touch composer: two rows, the kind sheet and Withdraw"
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1170
topic: topic-914
branch: t/T-1171-the-touch-composer-two-rows-the-kind
created: 2026-10-23T07:00:03.184Z
updated: 2026-10-23T18:20:27.161Z
closed: 2026-10-23T18:20:27.161Z
---

## Summary

At phone width the composer docks above the bottom bar in two rows, its kind chip opens a sheet of Message, Decision and Question, return breaks the line and only Send sends, and a queued message shows a 44 px Withdraw.

## Parent

E-419 (§3.6 the touch composer, P33 to P35; the second half of tracer step 3).

## What to build

- **Two rows** docked above the bar: the kind chip and the addressee chip (the Coordinator by default in an item's topic, as on the desktop); then the text field and Send. Attaching an artifact stays on the desktop in 0.2.0.
- **Return** in the field breaks the line at phone width; only Send sends. The key goes through the key map's composer context, never a component-local listener.
- **The kind sheet.** The kind chip opens a small sheet rising from the composer with Message, Decision and Question as three large buttons, the current one checked; no scrim, and the thread moves up by the sheet's height.
- **Queued messages.** A message to a busy session shows its queued mark under the text with a Withdraw at least 44 px tall until the turn starts; Withdraw puts the text back into the composer as on the desktop.
- **Drafts** are the existing per-topic drafts and survive a reload with their kind.

## Acceptance criteria

- [x] C1. At 390x844 the composer sits above the bottom bar in two rows, the kind and addressee chips over the field and Send, each control at least 44 px tall (Web test).
  - done: impl-1171 · 2026-10-23T18:02:33.950Z
  - verified: rev-23 [reviewer] · run rev-20261023-1171-final · 2026-10-23T18:15:14.752Z · commit 54e3817848c345ff6477e4e801d6af3c03dabe02
- [x] C2. Return in the field breaks the line and sends nothing, and Send sends both lines as one message, as a frame client reads it (Web test).
  - done: impl-1171 · 2026-10-23T17:58:21.896Z
  - verified: rev-23 [reviewer] · run rev-20261023-1171-final · 2026-10-23T18:15:14.752Z · commit 54e3817848c345ff6477e4e801d6af3c03dabe02
- [x] C3. The kind chip opens a sheet of Message, Decision and Question with the current one checked and no scrim, and choosing Question sends a question (Web test).
  - done: impl-1171 · 2026-10-23T17:58:21.968Z
  - verified: rev-23 [reviewer] · run rev-20261023-1171-final · 2026-10-23T18:15:14.752Z · commit 54e3817848c345ff6477e4e801d6af3c03dabe02
- [x] C4. A message to a busy fake session shows queued with a Withdraw at least 44 px tall, and Withdraw returns its text to the composer (Web test).
  - done: impl-1171 · 2026-10-23T17:58:22.040Z
  - verified: rev-23 [reviewer] · run rev-20261023-1171-final · 2026-10-23T18:15:14.752Z · commit 54e3817848c345ff6477e4e801d6af3c03dabe02
- [x] C5. A draft typed at 390x844 survives a reload with its kind (Web test).
  - done: impl-1171 · 2026-10-23T17:58:22.265Z
  - verified: rev-23 [reviewer] · run rev-20261023-1171-final · 2026-10-23T18:15:14.752Z · commit 54e3817848c345ff6477e4e801d6af3c03dabe02
- [x] C6. `web/README.md` describes the composer on the phone (docs).
  - done: impl-1171 · 2026-10-23T17:58:22.339Z
  - verified: rev-23 [reviewer] · run rev-20261023-1171-source-2 · 2026-10-23T18:03:18.855Z · commit 54e3817848c345ff6477e4e801d6af3c03dabe02
  - verified: rev-23 [reviewer] · run rev-20261023-1171-final · 2026-10-23T18:15:14.753Z · commit 54e3817848c345ff6477e4e801d6af3c03dabe02

## Comments

### impl-1171 · 2026-10-23T17:44:03.670Z

Implementation preparation: read E-419, A-9888 cut decisions, Composer/drafts/picker/withdrawal and phone harness guidance. Confirmed test seam is sealed Web at 390×844 touch/mobile with public frames and fake sessions. Waiting for T-1170 merge as instructed; no code changes yet.

### impl-1171 · 2026-10-23T17:57:23.219Z

Implemented phone two-row 44px composer, inline checked kind sheet, phone-only Return chord mapping and matching palette/help hints, desktop-only attach, and below-text phone delivery/Withdraw. Reuses shared per-topic draft and withdrawal state. Test-first slices observed red before implementation for layout, Command+Return send, inline sheet, below-text queue, and phone palette hint; existing persistence then passed unchanged. Local Darwin arm64 Headless Shell targeted phone*/composer/withdraw/topics/key-contexts run at the working tree based on 39a0a1bb passed 60/60, no skips (A-10156); five new phone identities all <1s, no >=4s allowance required from these samples. Screenshot A-10155. Web typecheck/guards and tier lint passed. Finishing root check and required shared-key routing neighbors before source review.

### rev-23 · 2026-10-23T18:01:58.262Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1171-source
commit: 376140623868722a7326874330ec14bbb0a08d2d
scope: full
findings: [{"severity":"medium","text":"M1: Phone recipient chip only sets a session; desktop Remove→to:null has no phone equivalent. Restore a 44px clear/default route and test worker→clear→reload→implicit recipient delivery.","file":"web/src/Composer.tsx","line":49}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1171 full source review
Head 376140623868722a7326874330ec14bbb0a08d2d; tree 36b3df6059fbf1b911e4d7b8dcc88dd43b3324b6. Fixed base/parent 39a0a1bb99daeccd664e2e595f1ec82a07d89200; branch t/T-1171-the-touch-composer-two-rows-the-kind. Run rev-20261023-1171-source. Not clear: M1 medium, C1 failed; runtime C2–C5 pending. Full audit complete, no other findings. Crew disables Reviewer subagents; both review axes performed read-only in this session.

## Standards
No independent findings. Shared Composer/draft/picker/withdrawal modules reused; phone width centralized through usePhone/isPhone. Physical Return/Shift/Meta chords map to composer-newline in composer/session-composer/reply contexts, via existing single Shell listener; composing/native unowned fields remain native. Phone send/send-always/artifact actions excluded centrally, palette/help keys derive width-aware context map. No component-local key listener or hub/protocol/dependency change. Existing desktop branches remain and required shared-key neighbors are reported passing.

Five new Web cases use sealed touch/mobile webFixture, FakeClock/in-process recipients and fake adapter; no new startDaemon/spawnSpoke/cland/sleep calls or wall-time latency assertion. Public message/history/recipient receipts prove routing/kind; observer armed before Send/Withdraw/idle. Held successful withdrawal reply proves no restoration before receipt and restoration ahead of newer typing after release, then exact injected frame and rendered stage remove Withdraw. Per-topic reload checks retain kind/text and assert no human sends. Existing fixture owns browser/writer cleanup; raw receipts show clean owned browser censuses. Web registration sorted; test-seam guidance has its own ### phone-composer.test.ts at end of Web section as Coordinator a5fd5a99 directed. Diff check clean. No duration allowance introduced.

## Spec
M1 medium — web/src/Composer.tsx:49. Phone replacement drops desktop's addressee clear transition. Touch chip only opens Sessions palette, whose selection only sets to=row.id; it has no empty/default option. Desktop branch retains Remove→update({to:null}) at line55, but no reachable phone action does so. After choosing worker or reloading its persisted per-topic recipient, the phone cannot return to hub/default addressing, even when the user wants typed routing rather than an explicit worker recipient. This regresses the shared addressing flow while replacing its UI. Preserve a 44px clear path in row one and add public phone worker→clear→reload→implicit/default recipient receipts, retaining two rows. Implementer confirmed M1 and is adding this regression/fix; no Reviewer runtime reproduction claimed.

Other checks: C1 grid first row kind/addressee, second field/Send, 44px controls above bar and no attach present, but M1 blocks recipient completion. C2 phone Return chords insert selected newline via shared map; test observes zero frames/history writes then exact multiline one-send receipt. C3 inline normal-flow three-button sheet has pressed/current check,44px buttons, no modal/scrim; log shrinks by occupied height and remains reachable, Question history kind asserted. C4 phone delivery/Withdraw moves below text,44px minimum; authoritative eligibility and existing receipt-gated restore logic unchanged, held success/new draft/submission tests retained. C5 existing per-topic storage unchanged, navigation/reload exact text+kind and no-send assertions present. C6 README accurately documents width, keys, kind sheet, chips, draft persistence and withdrawal; desktop key table clarified. Fix docs as needed for added clear affordance.

Existing screenshot A-10155 inspected read-only:390px thread, footer delivery, inline checked three-choice sheet, kind/Coordinator row, textarea/Send row and Topics-current bottom bar visible without page overflow. No interactive/browser QA claim.

A-10156 raw requested targeted60/60; A-10157 raw shared keyboard/Sessions neighbors82/82; both zero fail/cancel/skip and clean browser censuses. A-10158 raw root check typecheck/build/static guards complete,132 report-only lint findings59files/zero refusals. Request additionally reports pure hub web-keymap2/2 and command exits0; no separate raw log inspected for that identity. Local Darwinarm64 isolated Headless Shell, source-as-committed working tree based39a0a1bb attributed by request, not fresh committed-head/Linux/configured-suite evidence. All reported new passing samples<4s; no allowance trigger yet. Preserve original command/exit/source/timing receipts without transcription reruns.

Complete finding set M1 only. Commit/push correction and request fresh source review before mode-free verify. No post-review dev merge without Coordinator request. Reviewer read-only Git/files/log/existing image/hub, no tests/probes/browser/GUI/edits/merge. After-stage affected QA separate, no per-item qaCriteria/brief.
Standards:0 findings. Spec:1 medium (M1).

Criteria: C1 failed (Phone addressee chip removes the existing clear-to-default transition, trapping persisted drafts in explicit recipient routing.).

### rev-23 · 2026-10-23T18:03:18.855Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1171-source-2
commit: 54e3817848c345ff6477e4e801d6af3c03dabe02
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1171 corrected full source review
Head 54e3817848c345ff6477e4e801d6af3c03dabe02; tree 5aa090a79ff4792eeb124dc2f2c9b6478dc02a1b. Parent/fixed point 376140623868722a7326874330ec14bbb0a08d2d, branch t/T-1171-the-touch-composer-two-rows-the-kind. Run rev-20261023-1171-source-2. Clear; findings []; C6 verified from source/docs, C1–C5 runtime pending. Builds on full audit A-10160.

## Standards
No findings. Four-file focused correction, no dev merge. New row-one button uses existing draft update({to:null}), inherits phone44px height/width, disables while send pending and is absent for fixed session composer. No duplicate draft/routing logic or new key listener. README and separate test-seam heading describe clearing/persistence consistently. Existing assertions, waits and bounds retained; diff check clean.

## Spec
M1 resolved in source. Phone recipient clearing is now reachable without replacing its shared session picker. Public Web regression selects worker, types explicit @coord text, reloads to prove chosen recipient retention, observes44px clear on addressing row above field, clears and reloads to prove null does not reintroduce item Coordinator default. Observer captures outgoing topic.send before navigation/actions; exact Coordinator receipt is armed before Send. After completion it asserts no explicit to in sole send frame, durable history to=['coord'], no worker delivery, unchanged text and zero sends on reload. Existing two-row, multiline, Question, receipt-gated withdrawal and per-topic draft cases remain. C6 README accurately includes touch layout/keys/sheet/withdraw/drafts and new clear/default addressing path.

A-10161 raw six phone-composer cases pass, zero fail/cancel/skip and all owned browser censuses after0. New clear case0.691311209s, max0.948474583s. Request reports local Darwinarm64 isolated Headless Shell source-tree-identical precommit build/typecheck/contrast/hooks exit0; raw A-10161 is targeted stdout, not separate command-exit/head metadata or configured proof. Earlier A-10156/57/58 stay attributed to37614062; no relabeling. All reported passing new identities<4s, no allowance trigger yet. Preserve original receipts without rerunning for transcription.

Proceed with mode-free verify at exact54e38178; final C1–C5 settlement and Linux passing new-identity timing audit follow. C6 alone is source-established. Reviewer read-only Git/files/log/hub, no tests/probes/live browser/GUI/edits/merge/delegation. After-stage affected QA separate, no per-item brief/qaCriteria.
Standards:0 findings. Spec:0 findings.

Criteria: C6 verified.

### rev-23 · 2026-10-23T18:15:14.753Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1171-final
commit: 54e3817848c345ff6477e4e801d6af3c03dabe02
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1171 final same-head evidence review
Head54e3817848c345ff6477e4e801d6af3c03dabe02; tree5aa090a79ff4792eeb124dc2f2c9b6478dc02a1b. Branch t/T-1171-the-touch-composer-two-rows-the-kind. Run rev-20261023-1171-final. Clear; C1–C6 verified, findings[]. Source reviews A-10160/A-10162 carry forward; M1 recipient clearing corrected.

## Standards
A-10168 raw configured run1a6fce37-012f-457b-9146-46b477ea2ab1 independently audited: exact source-clear head, exit0. Ordinary2753 test finishes and409 file finishes all pass, no fail/skip/cancel. Actual allT1(132files), fallback all hub+NeovimT2(239files), completeWeb(38files). NoT3/T4; T3 deferred by configured task policy to periodic/integrated occasions. No load-gate-scope progress records; generic five-repetition headers are not load repetition evidence.

Host npmruncheck output includes typecheck/build/static guards and report-only test lint; gate7961b512c6022766431b70c7db5c7083134ffcba reused remotely, not repeated. Linuxx64 c-8lon1 cland-v0-b305aeed, Node24.21.0/Nvim0.12.5, workers2/Web4, lifetime598s/$0.0416. Actual phase wall51.50sT1/325.25sT2/129.92sWeb; test-second sums/projections are not wall. Generic duration/lint/ratchet notices remain report-only:132lint findings59files,3missing file baselines, existing wall/per-test warnings retained.

Six new phone-composer passing samples:layout2.317580486s,clear/reload2.016326315s,Return/multiline1.487469714s,kind/Question1.900283441s,held withdrawal1.928998697s,draft reload2.018386428s. Max2.318s<4s; local passing samples also<4s, no allowance trigger. File elapsed12.669478381s is distinct from summed test seconds11.669s and Web wall129.92s.

## Spec
C1 verified:two rows above phone bar,44px targets/defaultCoordinator, session selection and corrected44px clear→to:null with selection/cleared-choice reload and exact implicit Coordinator routing pass.
C2 verified:physical Return/Shift/Meta chords insert newline without topic.send/history write; explicitSend delivers exact two lines once.
C3 verified:checked Message/Decision/Question inline no-scrim sheet takes height from history, remains reachable and sends Question kind.
C4 verified:queued status/44pxWithdraw below text; held successful receipt prevents early restore, then restores before newer typing; actual injection removesWithdraw.
C5 verified:per-topic text/kind navigation and reload preserved without sending.
C6 source-established README/touch key/help/test guidance remains unchanged sinceA-10162.

Branch tip/tree independently resolve to reviewed values. Source/current configured evidence settles all criteria; lead performs required fresh dev-conflict check/ready routing without changing this reviewed head. Any Coordinator-authorized later merge needs fresh source/current-head evidence. After-stage affected QA separate, no per-item qaCriteria/brief. Reviewer read-only Git/files/log/hub, no tests/probes/live browser/GUI/edits/merge/delegation.
Standards:0findings. Spec:0findings.
Post-audit lead report5a32ce3d confirms fetch origin/dev a84547b8 and read-only merge-tree exit0/tree3fa19b9a, clean worktree/no head change. This is a conflict check, not a merged-head verification claim.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1171 · 2026-10-23T18:15:18.338Z

Exact-head mode-free verification 1a6fce37 at 54e3817848c345ff6477e4e801d6af3c03dabe02 is green: 2753/2753, no skips/failures; T1, fallback all T2 across hub/Neovim and Web. T3 is deferred to periodic/integrated occasions and excluded from configured batches. A-10168 retains the raw receipt and host check gate (not repeated on droplet). Executor Linux x64 c-8 lon1 cland-v0-b305aeed; lifetime 598s, cost $0.0416. Lint/duration/ratchet gates report-only. New phone-composer identity passing maximum 2.317580486s on Linux (all six <4s); no allowance trigger. Fetched origin/dev a84547b8 and checked prospective merge via git merge-tree: exit 0, no conflicts, tree 3fa19b9ac105a0ed39d89db74ad170d30362485e. Head and clean worktree unchanged; final reviewer evidence settlement pending.

### coord · 2026-10-23T18:20:27.161Z

Merged 6ca5a58db163b068f60c45c255266e5212f4b2c3 onto dev.
