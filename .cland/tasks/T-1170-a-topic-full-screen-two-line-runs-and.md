---
id: T-1170
kind: task
title: A topic full screen, two-line runs and artifact chips
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
topic: topic-911
branch: t/T-1170-a-topic-full-screen-two-line-runs-and
created: 2026-10-23T07:00:02.941Z
updated: 2026-10-23T17:12:07.804Z
---

## Summary

At phone width a topic opens full screen with a back control, its title, id and status and a button to the item's card; folded runs show two lines from the hub's facts and unfold in place; an inline HTML artifact is a chip that opens full screen.

## Parent

E-419 (§3.6 the thread screen, P31 and P32; the HTML artifact as a chip; the first half of tracer step 3).

## What to build

- **The screen.** A tap on a topic in the Topics list opens its thread full screen: a back control to Topics, the title, the topic's id and status, and a button to the item's card, which opens the read-only card of the More ticket full screen. The browser's back does what the back control does. The bar stays, with Topics current.
- **Fit.** Message blocks, verdicts with their criteria marks, chips and long ids fit 390 px; code blocks scroll inside themselves, never the page.
- **Folded runs** show two lines: the sessions and the message count; then the latest message's kind, its first words and its age. Both come from the run's facts the hub already sends (`participants`, `messageCount`, `latest`, `ageMs`), with no hub change. A tap unfolds the run in place and keeps the anchor line on top.
- **HTML artifacts** are chips at phone width instead of the 240 px iframe; a tap opens the artifact full screen in the same sandboxed iframe (`allow-scripts` alone) with a back control. File and folder artifacts stay chips as on the desktop.
- Every control on the screen is at least 44 px tall.

## Acceptance criteria

- [x] C1. At 390x844 a tapped topic opens full screen with a back control, the title, the topic id, the status and a card button, and both the back control and the browser's back return to Topics (Web test).
  - done: impl-1170 · 2026-10-23T17:05:15.482Z
- [x] C2. The card button opens the item's card read-only full screen, and back returns to the thread at the same message (Web test).
  - done: impl-1170 · 2026-10-23T17:10:31.947Z
- [x] C3. A folded run shows two lines, the sessions with the message count and then the latest kind, first words and age, and a tap unfolds it in place with the anchor on top (Web test).
  - done: impl-1170 · 2026-10-23T17:05:15.873Z
- [x] C4. At 390x844 an HTML artifact in a message is a chip that opens full screen in an iframe whose `sandbox` is `allow-scripts` alone, with a back control (Web test).
  - done: impl-1170 · 2026-10-23T17:05:16.071Z
- [x] C5. A thread holding a verdict, a fenced code block and long ids scrolls only vertically at 390 px (Web test).
  - done: impl-1170 · 2026-10-23T17:05:16.259Z

## Comments

### impl-1170 · 2026-10-23T16:53:55.506Z

Implementation plan: reuse the existing Topics page/Thread and add a phone-only full-screen view with history-backed Back paths. Keep Thread mounted while the read-only item card or artifact viewer is shown so its scroll and expanded runs survive. Tests use the supplied sealed Web/public-frame seam, one phone slice per red/green cycle; no hub or dependency changes.

### rev-23 · 2026-10-23T17:08:52.925Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1170-source
commit: d8485c4cf6f203219efe71728c341172f3f0d993
scope: full
findings: [{"severity":"medium","text":"M1: readable=false only suppresses read receipts; message-update layout effect still auto-scrolls atEnd while covered. Retain/restore exact reading anchor across card coverage and test live traffic from the current end before Back.","file":"web/src/Thread.tsx","line":68}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1170 full source review
Head d8485c4cf6f203219efe71728c341172f3f0d993 / tree8c71693f7c6f2cde23187b3d6aa6fc8de6e69fed; fixed base/parent7c04ffe53c0261d45d9b87d9fdb3f3d2126fb78d. Branch t/T-1170-a-topic-full-screen-two-line-runs-and. Run rev-20261023-1170-source. Not clear; M1 medium/C2 failed; other runtime criteria pending.

## Standards
No independent findings. Shared Thread/ReadOnlyItemCard/ArtifactViewer and usePhone seam reused; central physical key routing retained, no new key listener/dependency/hub/protocol/authority. Phone history tracks full-screen Topics and nested detail; inert/aria-hidden/visibility coverage removes hidden thread from interaction, readable=false disconnects read observer/timer while covered. Artifact metadata stays viewer fallback, capability-backed iframe still sandbox allow-scripts alone, no srcdoc/allow-same-origin. CSS preserves desktop>=640 fold/240px preview, token colours and internal code scrolling. Docs README/test seam and sorted Web registration match intended behavior. Diff check clean.

## Spec
M1 medium — web/src/Thread.tsx:68, reached via PhoneTopicThread.tsx:62. Keeping Thread mounted/readable=false does not freeze its reading position. Its message-update useLayoutEffect still scrolls to scrollHeight whenever atEnd.current is true. Open the item card while at the current end, deliver a new live message while covered, then Back: hidden Thread follows that message, so the exact prior message/pixel is lost. C2 requires return to the same message. Current C2 case scrolls into message7 and delivers no covered live traffic; it misses this. Preserve/restore exact message anchor across the cover (including at-end state), retain live data and read suppression, and add public live-message-while-covered regression for Back paths. Implementer accepts and is adding it. No Reviewer runtime reproduction claimed.

Remaining source checks: C1 full-screen phone TopicPage/header Back/title/id/status/linkedCard plus browser history/list return and Topics bar current present. C2 reusable readonlycard/forms absent, current quiet middle-of-thread return/focus and read suppression tested, but M1 blocks completion. C3 two-line summaries use hub participants/otherParticipants/messageCount/latest kind/preview/ageMs, with age separate from truncating preview; shared expansion anchors and sticky summary unchanged. Test compares public hub run facts/messages and anchor pixel after tap/fold, plus desktop foldLine. C4 HTML-only phone buttons route to nested full-height capability viewer, file/folder remain chips; both Back paths/sandbox/src/origin/width/height tested, desktop240px restored. C5 phone message/compact verdict/long-id wrapping and pre overflow preserve390px vertical page; real Reviewer criterion frames, longids, exact code/internal scroll and message bounds tested. Existing global phone pane button rule and new header/chip/link rules supply44px targets. No additional findings.

Existing screenshot A-10119 inspected read-only:390px full-width header/Back/Card, role/verdict/long criterion wrapping, composer and Topics-current bar fit; no browser QA claim. Off-screen code is proved by test source, not screenshot visibility.

A-10118 raw local targeted53/53 pass, zero fail/skip/cancel, owned browser censuses clean; A-10121 is implementation/source-as-committed summary. Local Darwinarm64 Node24.21.0 pinned isolated Headless Shell, required phone*/topics/threadruns/artifacts/keycontext/palette neighbors and build; request reports root npmruncheck exit0 (brief predates completion). These are targeted/local, not configured exact-head/Linux/T3/load evidence. All reported new passing local identities<4s, no allowance yet. Preserve original stdout/exits/head/timings without rerunning for transcription.

Complete finding set M1 only. Correct/commit/push then fresh source review before mode-free verification. Reviewer read-only Git/files/existing image/hub traffic, no tests/live browser/GUI/edits/merge. No per-item QA brief/criteria; affected after-stage QA separate. Standards0; Spec1medium.

Criteria: C2 failed (Covered thread still follows new live messages when atEnd was true, so Back from the item card can lose the exact prior message/pixel.).

### impl-1170 · 2026-10-23T17:10:31.457Z

Addressed source review M1/C2 in the second commit: hidden live arrivals no longer trigger Thread auto-follow, and Back retains the previous end message at the same pixel. Added a public-frame regression covering button and browser Back, each starting at the current end and awaiting the exact hidden live article. It failed at the original implementation and passes with the fix. Required targeted Web neighbors rerun on Darwin arm64: 54/54, no skips, all new passing identities below 4 s. Fresh source review follows before mode-free verification.

### rev-23 · 2026-10-23T17:12:07.804Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1170-source-2
commit: 2b9cf3ee794d49e98ec4e1f87f7db0c4a59e9d1d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1170 corrected source review
Head2b9cf3ee794d49e98ec4e1f87f7db0c4a59e9d1d / tree61b5a8a407a3b79e962796d529978ce1bae70092; parent/fixed pointd8485c4cf6f203219efe71728c341172f3f0d993. Run rev-20261023-1170-source-2. Clear; findings[]; C1–C5 runtime pending.

## Standards
Pass. Two-file focused correction, no dev merge. Shared Thread layout effect now depends on readable and skips hidden follow/paging adjustment; when hidden arrivals leave a gap below the old viewport it clears atEnd. Uncovering therefore retains position, and subsequent live changes do not restart following until an actual scroll reaches the new end. Default readable=true leaves desktop/other threads unchanged. Read observer cancellation/inert covered UI retained. No bounds expanded or assertions removed; diff check clean. Prior full audit A-10124 carries forward.

## Spec
M1 resolved in source. New public regression begins at the current end for each button/browser Back, captures exact last message id/pixel, opens read-only card, arms hidden rendered article observer before real topic.send, waits for exact live text in mounted hidden thread, returns and asserts same last message/pixel plus new traffic below. Both Back paths tested; source effect sets atEnd=false on hidden gap and preserves that state on reveal. Existing quiet middle-of-thread return/read suppression and sandbox/run/layout cases retained.

A-10125 raw targeted54/54 pass, no fail/skip/cancel, owned browser censuses clean. Local Darwinarm64 Node24.21.0 isolated pinned Headless Shell, build/required neighbors and root npmruncheck exit0 reported at source-as-committed tree. Implementer reports original old-source assertion `same last message at the same pixel after covered live traffic` failed before guard and green after; no Reviewer reproduction. Local samples reported<4s, no allowance yet. No configured exact-head/Linux/T3/load proof claimed; preserve original stdout/exits/head/timings without transcription reruns.

Proceed with mode-free verify at exact2b9cf3ee, then final criterion settlement and passing new Web timing audit. Reviewer read-only Git/files/log/hub; no tests/browser/GUI/edits/merge. After-stage affected QA separate, no per-item brief/qaCriteria. Standards0; Spec0.
