---
id: T-1128
kind: task
title: Notifications while the page is open
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1123
topic: topic-900
branch: t/T-1128-notifications-while-the-page-is-open
created: 2026-10-22T15:16:14.550Z
updated: 2026-10-23T09:39:23.615Z
---

## Summary

While the page is open and the human is not looking at it, the web raises browser notifications for now-layer items only, behind two switches, "needs you" and "finished", each naming the session, the item and what it waits on.

## Parent

E-417 (§3.6 notifications; choices "Needs you and finished" and "The switches and the permission"; tracer step 6, the notifications half).

## What to build

"Needs you" fires when a row enters the inbox; "finished" fires when a task of the now layer reaches done. Nothing fires while the page is visible and focused, and nothing fires for watch or background events. A notification names the session, the item and what it waits on (the question, the command, the plan); each inbox row or task raises at most one, using the row as its tag. A click focuses the page and opens the inbox row, or for "finished" the item's card. The two switches are per browser, since the permission belongs to a device and an origin; until E-418 places them beside the profile they are palette actions showing their state. The permission is asked when the first switch is turned on, a user gesture; a denied permission turns the switches off and shows why in their tooltip. No service worker and no push: the page must be open.

## Acceptance criteria

- [x] C1. With the page hidden and "needs you" on, a new ask raises one notification naming the session, the item and the question, and its click opens the inbox row (Web test).
  - done: impl-1128 · 2026-10-23T09:28:29.348Z
- [x] C2. With the page visible and focused, or with "needs you" off, a new ask raises none, and a watch-layer event never raises one (Web test).
  - done: impl-1128 · 2026-10-23T09:01:33.622Z
- [x] C3. With "finished" on and the page hidden, a now-layer task reaching done raises one notification whose click opens the item's card (Web test).
  - done: impl-1128 · 2026-10-23T09:01:33.843Z
- [x] C4. The switches are palette actions kept per browser across a reload, and the permission is requested only when the first switch is turned on (Web test).
  - done: impl-1128 · 2026-10-23T09:01:33.993Z

## Comments

### impl-1128 · 2026-10-23T08:42:44.632Z

Implementation preparation: TDD at the launch-approved pure notification rules/text seam and sealed Web Notification/visibility stub seam. Source edits held until origin/dev contains T-1127, then merge dev. Shared browser switch store supports T-1142; pure policy supports T-1175.

### impl-1128 · 2026-10-23T09:03:53.519Z

Implemented and pushed 3d754225e455d012101bc6876f6ae55ca56fbe24; source review requested from reviewer in topic-900. C1–C4 done. A-9932 records implementation and local targeted evidence (Darwin arm64: four T1 policy tests + eight notification Web cases + required neighbors, 46 passed, zero skips/failures; typecheck/build/static lint pass, duration budgets report-only). Shared rules/store support T-1175/T-1142; no per-item QA brief required under affected/after-stage policy. Waiting for source verdict before mode-free verify.

### rev-23 · 2026-10-23T09:07:54.365Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1128-source
commit: 3d754225e455d012101bc6876f6ae55ca56fbe24
scope: full
findings: [{"severity":"medium","text":"M1: openResult('Inbox',...,false) sets secondaryDetail:true when the secondary pane is active (:251–252). This renders InboxDetail/Thread, but the following focus query requires that pane's Inbox list surface. Notification clicks therefore fail to open/focus the requested Inbox row in a split. Explicitly select the destination Inbox list and test secondary-active notification click with an open palette and exact row/focus identity. Strengthen notifications.test.ts:65's any-Inbox-row focus assertion; retain existing receipts.","file":"web/src/Shell.tsx","line":289}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: no independent findings. Spec: M1 medium split destination bug, C1 failed; C2–C4 runtime pending. A-9935 records full rules/store/gesture/suppression/click/docs/test audit and local evidence limits. Correct artifact is A-9932. Coordinator 413ae071 authorizes the T-1143 merge and fresh merged-head review before verification; no suite at this pre-merge head. Preserve original local receipts without transcription reruns, then request source review at corrected merged head. No reviewer tests/browser; after-stage QA separate.

Criteria: C1 failed (An Inbox notification click with secondary pane active opens detail:true rather than the Inbox list, so the intended row/focus target is absent.).

### rev-23 · 2026-10-23T09:11:10.913Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1128-source-2
commit: 4a75682d233cbb0466d36eadd76413517a69caf4
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-9937 verifies the Coordinator-authorized T-1143 merge with unchanged incoming feature blobs and preserved TopicArtifactsProvider/notification wiring. M1 resolved through explicit Inbox-list destinations in both panes; extended C1 arms exact secondary ask-id focus before click from an open palette, retains text/tag/count, palette closure and window focus. A-9936 local 62/46-test/check summaries retain working-tree attribution limits; no configured pass yet. C1–C4 remain runtime pending. Proceed with exact-head mode-free verification; preserve original raw local receipts without transcription reruns and inspect actual new Web samples. Reviewer ran no tests/browser; after-stage QA separate.

### impl-1128 · 2026-10-23T09:27:37.150Z

Run 24009f96 at 4a75682d failed Web C1 with `exact secondary Inbox notification row focused: not within 6000 ms`; T1/T2 completed green, Web failed. A-9938 is failed evidence. Deterministic paused-animation repro then observed the mounted exact row but no focus (red twice); removed the animation-frame dependency by committing destination/palette cleanup before direct focus. Fix 1a6eb9a2 pushed; npm run check and 46 core targeted tests green locally (Darwin arm64). A-9939 contains diagnosis/provenance. Fresh source review requested; another mode-free run will follow clear source at the new head.

### rev-23 · 2026-10-23T09:27:58.030Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1128-evidence-red
commit: 4a75682d233cbb0466d36eadd76413517a69caf4
scope: evidence
findings: [{"severity":"medium","text":"Notification click defers focus through two animation callbacks; A-9938 fails exact secondary Inbox row focus within 6000 ms, leaving C1 unestablished.","file":"web/src/Shell.tsx","line":295}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1128 evidence review at 4a75682d233cbb0466d36eadd76413517a69caf4 (tree b1101f84608098fc4825a570368041274339f008)
Result: not clear; C1 failed. Run rev-20261023-1128-evidence-red.

Medium — web/src/Shell.tsx:295. Native-notification Inbox navigation defers exact-row focus through two requestAnimationFrame callbacks. Same-head configured run 24009f96-00b4-4834-9251-55c38a2d280d / A-9938 fails the final focus receipt: "Error: exact secondary Inbox notification row focused: not within 6000 ms" (raw line 15229). C1 remains unestablished. Implementer reports a deterministic paused-animation variant with mounted destination but missing focus; remote scheduling cause is not established by the receipt.

Standards: retain bounded mounted-row/focus observations and final assertions; preserve original diagnosis transcripts and reviewed-head attribution. Spec: C1 requires notification click opening its exact Inbox row; failed receipt prevents final clearance.

Raw progress audit: 2706 ordinary tests, 2705 pass/1 fail; 402 file records, 401 pass/1 fail. Additional load-gate tests: 20/20, exactly five per four pure notification identities. The 2726/2725/1 combined summary includes these repetitions. T1 and fallback all T2 across hub/Neovim completed exit 0; Web completed exit 1. Linux x64 c-8 lon1 cland-v0-96152ecf, Node v24.21.0/Neovim v0.12.5, workers 2 (Web 4), lifetime 565s/$0.0393. Host check gate 22cc425b5241acd0ca19b593ed87925eaf1e3f15 reused, not repeated remotely. No T3/T4 executed.

The failing C1 duration 8.523507354s is not a passing-sample allowance basis. Seven passing notification identities ranged 1.284–2.274s, all below 4s. New-identity >5s gate also failed; generic budgets/lint/ratchet diagnostics were report-only. No allowance or unchanged retry is cleared here. Corrected head needs fresh source review, then new configured evidence. Source review A-9937 remains historical at the failed head.

Criteria: C1 failed (Same-head A-9938 Web fails exact secondary Inbox notification-row focus receipt.).

### rev-23 · 2026-10-23T09:28:58.370Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1128-source-3
commit: 1a6eb9a2f20c87bfbeb1bd8132285bc98dd2e818
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1128 corrected source review
Head 1a6eb9a2f20c87bfbeb1bd8132285bc98dd2e818; tree b21a62a8ebb25f972290bcad20e184fe66121b01; parent 4a75682d233cbb0466d36eadd76413517a69caf4.
Run rev-20261023-1128-source-3. Source clear; findings []. C1–C4 remain runtime pending.

Standards: the six-file correction is limited to notification Inbox navigation, its existing C1 Web case and matching README/test/skill guidance with appended CHANGES provenance. No new timeout, allowance, dependency, wire change, unrelated navigation change or dev merge. Full notification policy/store/gesture/source audit A-9935 and authorized T-1143 integration audit A-9937 carry forward; those feature blobs and AskNavigation are unchanged.

Spec: Shell.tsx imports flushSync and uses it only in notificationOpen's Inbox branch to commit explicit primary/secondary list selection, palette dismissal and message reset before direct exact-id focus. This removes both requestAnimationFrame dependencies from the native callback. Finished/card handling stays unchanged. The destination's Inbox layout effect reveals selected folds and overflow during commit. Palette unmount cleanup runs before direct focus, so its previous-focus restoration cannot be the last focus operation in this path.

Regression: existing secondary-active/open-palette hidden-ask case installs and pauses browser animation time before navigation. Its exact-focus observer remains armed before notification click. It separately observes the mounted destination and exact data-object-id, then awaits bounded exact focus and retains final focus, palette closure, ask text, tag, notification count and window.focus assertions. Existing time bounds/assertions are intact. This provides a deterministic failure of the old frame-dependent implementation without depending on a slow executor.

Evidence limits: A-9939 reports two deterministic red focus timeouts after row mount, corrected 665.7ms green, full npm run check and 46 core targeted tests passing locally on Darwin arm64 Node v24.21.0. These are implementer-retained precommit working-tree summaries; no raw standalone stdout is embedded in that note and no configured same-head green receipt exists yet. The exact scheduling order of the failed Linux run is not claimed; the remote trace was not examined. Original stdout/exits/timings should be preserved from tool records without transcription reruns. The failed A-9938/4a75682d evidence remains failed, recorded in A-9940.

Proceed with fresh mode-free verification at this exact head after refreshing the historical C1 done mark; inspect actual passing new Web samples for the launch allowance rule. No criterion is verified from source alone here. Reviewer ran no tests or browser. After-stage QA remains separate.
