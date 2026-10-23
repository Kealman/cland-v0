---
id: T-1171
kind: task
title: "The touch composer: two rows, the kind sheet and Withdraw"
state: open
status: review
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
updated: 2026-10-23T18:03:18.855Z
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
- [x] C2. Return in the field breaks the line and sends nothing, and Send sends both lines as one message, as a frame client reads it (Web test).
  - done: impl-1171 · 2026-10-23T17:58:21.896Z
- [x] C3. The kind chip opens a sheet of Message, Decision and Question with the current one checked and no scrim, and choosing Question sends a question (Web test).
  - done: impl-1171 · 2026-10-23T17:58:21.968Z
- [x] C4. A message to a busy fake session shows queued with a Withdraw at least 44 px tall, and Withdraw returns its text to the composer (Web test).
  - done: impl-1171 · 2026-10-23T17:58:22.040Z
- [x] C5. A draft typed at 390x844 survives a reload with its kind (Web test).
  - done: impl-1171 · 2026-10-23T17:58:22.265Z
- [x] C6. `web/README.md` describes the composer on the phone (docs).
  - done: impl-1171 · 2026-10-23T17:58:22.339Z
  - verified: rev-23 [reviewer] · run rev-20261023-1171-source-2 · 2026-10-23T18:03:18.855Z · commit 54e3817848c345ff6477e4e801d6af3c03dabe02

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
