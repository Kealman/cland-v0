---
id: T-1141
kind: task
title: "The session's drawer: its recent thread, pending approval and a composer"
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1131
  - T-1136
  - T-1119
  - T-1124
  - T-1129
  - T-1110
topic: topic-904
branch: t/T-1141-the-session-s-drawer-its-recent-thread
created: 2026-10-22T15:16:16.460Z
updated: 2026-10-23T11:27:14.084Z
---

## Summary

Selecting a session opens the drawer with its recent thread, its pending approval as a card and a composer to the session, built on E-417's thread, approval card and composer.

## Parent

E-418 (§3.2 the drawer, P23; tracer step 4). Ordered after E-417's thread, composer and approval card and E-414's approval gate, which it reuses.

## What to build

- **The thread.** The drawer follows the selected session: its recent messages, sent and received across topics (the hub slice's request), drawn with E-417's message blocks and paged back by message number, updating live.
- **The pending approval**, when there is one, as E-417's approval card answered through E-414's gate (Approve once, Always for this command, Deny with a note); an approval the harness keeps in its TUI shows marked, as E-417 draws it.
- **The composer** is E-417's, addressed to the session in its item's topic when it has one, else in General, with the line "To <session> in <topic>".
- **Open thread.** Enter on a row at desktop width, or Open thread in the unfolded row, moves focus to the drawer's thread.

## Acceptance criteria

- [x] C1. Selecting a fake Codex session waiting for approval shows its command in the drawer's card, and Approve once folds the card with its outcome and the session leaves Waiting (Web test with the fake harness).
  - done: impl-1141 · 2026-10-23T11:18:43.810Z
- [x] C2. The drawer lists the session's recent messages in both directions across topics and pages back without a gap (Web test).
  - done: impl-1141 · 2026-10-23T11:18:43.915Z
- [x] C3. A message from the drawer's composer reaches the fake session in its item's topic, or in General without one, as the fake receives it (Web test with the fake harness).
  - done: impl-1141 · 2026-10-23T11:18:44.005Z
- [x] C4. Enter on a desktop row and Open thread move focus to the drawer's thread (Web test).
  - done: impl-1141 · 2026-10-23T11:25:33.996Z
- [x] C5. `web/README.md` describes the session's drawer (docs).
  - done: impl-1141 · 2026-10-23T11:18:44.307Z
  - verified: rev-23 [reviewer] · run rev-20261023-1141-source-2 · 2026-10-23T11:26:43.961Z · commit 8c0c29c4313ffaac83c318685272dfc38fe5ae62

## Comments

### impl-1141 · 2026-10-23T10:24:08.162Z

Implementation/test seams recorded as A-9974 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9974-t-1141-implementation-and-test-seams.md). Initial build passed on local macOS arm64 at 4624720e. Awaiting T-1129 landing before code; subscribed to its item event. Existing session.history has numeric before paging; no protocol expansion anticipated.

### impl-1141 · 2026-10-23T10:55:34.766Z

Current rebuilt browser bundle: new session-drawer Web file 6/6 passed on local darwin arm64 (largest passing new sample 0.656186708 s; no allowance trigger). Required/shared neighbors 114/116 passed: exact terminal Attach selector corrected; existing Topics Retry flake traced to rejected action:2 before:51 followed by automatic action:3 nine milliseconds later. Coordinator decision 4ab91733 includes the inherited guard bug here and requests 20 macOS repetitions at two workers for T-1157; deterministic regression is written, guard fix is deliberately held until its red run. Coordinator also requested T-1180 Web README model-test wording correction, now made. Neither follow-up item edited. All local runtime work held for stage retry 32d70fac, per 2a28d704; no tests running. Latest root npm run check exits 0 (static guards/report-only lint, 132 findings/59 files, zero refusals). No source review or configured verification yet.

### impl-1141 · 2026-10-23T11:18:58.250Z

Source review requested from reviewer (resolved to rev-23) at pushed 2b406f0772c342a1aef0f7ae460dfd1461837b5e, clean tree 5b057ad4171fbaaa763edbc0ea9e80bf51f3d885. C1-C5 done. A-9989 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9989-t-1141-source-review-evidence-at-2b406f07/report.md) retains raw exact-head local macOS arm64 evidence: 123/123 targeted Web, 20/20 Topics Retry at two workers for T-1157, 11/11 T1 keymap/state, root check exits 0 with report-only lint 132 findings/59 files and zero refusals. Seven new identities below 1 s locally; no passing sample >=4 s. Includes honest precommit red/green and original failed neighbor receipt. Coordinator-authorized T-1157, exact terminal Attach assertion and T-1180 included; follow-up tracker items untouched. Await clear source verdict before exact-head mode-free verify; affected QA is after-stage, no per-item brief/criteria.

### rev-23 · 2026-10-23T11:24:09.622Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1141-source
commit: 2b406f0772c342a1aef0f7ae460dfd1461837b5e
scope: full
findings: [{"severity":"medium","text":"M1: SessionRecentThread now renders Thread context but its existing Inbox caller omits controls={thread}; shared j/k dispatch reaches an unassigned ref and does nothing. Forward ref and prove exact message focus plus Escape in public Web regression.","file":"web/src/InboxArea.tsx","line":168}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1141 full source review
Head 2b406f0772c342a1aef0f7ae460dfd1461837b5e / tree5b057ad4171fbaaa763edbc0ea9e80bf51f3d885
Base0e3d36e18ac4fcc13188f1fc1c41bbf4d3721536; git diff0e3d36e1...2b406f07,25files539+/110-.
Run rev-20261023-1141-source. Not clear; M1 medium only. C4 failed for incomplete shared thread key integration. C1/C2/C3/C5 final verification pending.

Standards: no independent findings. Public numeric session.history seam, existing Thread/MessageBlock/ApprovalCard/Composer reused. One physical keymap/dispatcher retained; fixed-address composer removes @ chooser/context action while preserving native typing,~artifact picker and shared send/draft/offline guards. Session history read disables broad topic marks and topic-artifact opening. No protocol/dependency/role authority changes. New Web file classified Web; sealed fake harness lifecycle header retained.

Coordinator scope verified from topic904:4ab91733 explicitly includes T-1157 automatic paging error guard, deterministic red/green and20 repetitions at2workers, plus exact terminal Attach assertion; cfd732a8 includes T-1180 README model wording. Local quiet hold release ece92509 at11:11Z. Those additions are authorized, not unsolicited follow-up changes.

Spec:
M1 medium — web/src/InboxArea.tsx:168, due changed SessionRecentThread.tsx:17. SessionRecentThread now renders shared Thread with data-key-context=thread. Its existing Inbox approval caller does not pass controls={thread}, though InboxArea/InboxDetail dispatch thread-next/previous through that ref. Physical j/k inside the approval recent log are consumed but have no target; the reused component's integration is incomplete. Forward the existing control ref and add public Inbox approval-log j/k exact latest/previous-id focus plus Escape-to-selected-row regression. Preserve shared dispatcher and existing assertions. Implementer is reproducing before fix; replacement head not reviewed here.

Other source checks: SessionDrawer chooses current-session approval, prioritizes pending over retained closed outcome, reuses authoritative record/card guards. Session history cache reads20 rows with exclusive numeric before, merges identity/live/patch facts, revisions fence superseded selection replies, generation reset fences snapshots and retained older boundaries preserve pagination. New selection refresh and recent-vs-earlier Retry are separated. Automatic earlier paging now stops on error; explicit Retry retains its boundary/anchor. Composer addresses selected session in existing item topic or General and displays To/session/topic; no hub write bypass. Desktop Enter/Open thread reveals fold and focuses committed log, including split page; ThreadControls navigation/back routing is present for Sessions itself. Docs describe these behaviors; C5 will be source-checkable after corrected head review. No other source findings.

A-9989 evidence inspected: final-targeted123/123 Web pass, topics Retry20/20 pass, pure-keymap/state11/11 pass, check log reports zero refusals with132 report-only lint findings. Exact-head attribution is report.md; underlying logs are original runner stdout, not standalone command manifests. Report distinguishes dirty precommit red/green from exact-head passes, retains failed114/116 neighbor run, records two actual Node workers and redacted traces. New drawer local samples<1s; failed4.020s red is not allowance basis. No configured suite exists at this head and no native/Linux coverage inferred. Reviewer did not run tests/browser or examine trace contents.

Complete findings set:M1 only. Fresh corrected-head source review required before mode-free verification; preserve original command/exit/head/timing receipts without transcription reruns. After-stage affected QA separate, no per-item brief/outstanding QA criteria.

Criteria: C4 failed (Shared SessionRecentThread introduces thread context in Inbox approval drawer without forwarding its existing control ref, so j/k cannot focus messages.).

### impl-1141 · 2026-10-23T11:25:51.270Z

M1 source review correction pushed as 8c0c29c4313ffaac83c318685272dfc38fe5ae62 (tree c518de604608cab02362b8dc55c0468d1e8cdfe8), no dev merge. C4 done refreshed after rev-20261023-1141-source failed it. A-10002 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10002-t-1141-m1-control-ref-correction-evidence-at-8c0c29c4/report.md) retains original red/green and exact-corrected-head 37/37 affected Web plus root check pass on local macOS arm64; report-only lint 132 findings/59 files, zero refusals. Existing InboxThread controls now reach SessionRecentThread; exact physical j/k message focus and Escape-to-row regression passes. Fresh source review requested from reviewer; no verification submitted. Original A-9989 evidence remains attributed to 2b406f07.

### rev-23 · 2026-10-23T11:26:43.961Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1141-source-2
commit: 8c0c29c4313ffaac83c318685272dfc38fe5ae62
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1141 corrected source review
Head 8c0c29c4313ffaac83c318685272dfc38fe5ae62 / tree c518de604608cab02362b8dc55c0468d1e8cdfe8
Parent 2b406f0772c342a1aef0f7ae460dfd1461837b5e; no dev merge.
Run rev-20261023-1141-source-2. Clear; findings []; C5 documentation verified. C1–C4 runtime pending.

Standards: pass. Focused three-file correction forwards the already-declared InboxThread controls ref into SessionRecentThread, adds one public Web regression and matching test guidance. No additional key listener, new command/wire/authority, unrelated navigation, timeout expansion or product change beyond the missing integration. Original full audit A-10000 carries forward; authorized T-1157 error guard/T-1180 wording and exact terminal Attach selector unchanged.

Spec: M1 resolved. Both Inbox pane drawer and split InboxDetail now receive the shared ThreadControls through their existing thread ref. Shared physical j/k reaches the mounted recent-thread log rather than an unassigned ref; existing Inbox thread-back routing returns to its selected approval row. Regression creates two public session messages, selects approval, observes exact latest row, focuses log and arms each focus observer before physical KeyJ/KeyK using Cyrillic key values and Escape. Every exact focus assertion and selected-row assertion retained.

C5 verified: Web README at this head describes selected Sessions drawer,20-row numeric cross-topic history with live merge/anchor/selection/reconnect, authoritative approval outcomes/TUI fallback, fixed session composer in item topic or General, desktop Enter/Open thread/split focus and shared message keys. T-1180 model coverage wording matches existing model tests. Test guidance describes shared-control integration; no role-clause/CLI behavior change requires a matching update.

Evidence: A-10002 inspected. Original red on2b406f07+newtest exits1 with exact j-focus timeout3000ms (test4.027684583s, not a passing allowance sample). Original green after one-line fix before commit exits0 at0.9091735s. Corrected exact-head local Darwin arm64 Node24.21 check exits0,37/37 Web targeted at2workers across Inbox/session-drawer/key-contexts/area-slots, newcase0.422420667s, report-only lint132 findings/59files,0refusals. A-9989's original123Web,20Retry repetitions at2workers and11T1 remain correctly attributed to2b406f07; unchanged source makes them supplemental, not new-head reruns. No configured verification yet, no Linux/T3/full-suite claim.

Proceed with exact-head mode-free verification; inspect original passing new Web durations for4s allowance trigger. Preserve raw command/exit/head/timing receipts, no transcription reruns. Reviewer performed read-only inspection, no tests/browser/edits. After-stage affected QA remains separate, no per-item brief/outstanding QA criteria.

Criteria: C5 verified.

### impl-1141 · 2026-10-23T11:27:14.084Z

Fresh source review clear at exact 8c0c29c4313ffaac83c318685272dfc38fe5ae62: rev-20261023-1141-source-2, A-10004, M1 resolved and no findings; C5 source verified, C1-C4 runtime pending. Mode-free verify admitted as 01d1cc62-68ad-4f3e-9414-4c5305d298ba, queue position 1, no executor override, reporting to topic-904/rev-23/impl-1141. Head clean and unchanged. Waiting for hub result; no dev merge or further test run.
