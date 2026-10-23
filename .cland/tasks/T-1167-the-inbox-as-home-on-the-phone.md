---
id: T-1167
kind: task
title: The inbox as home on the phone
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1165
topic: topic-908
branch: t/T-1167-the-inbox-as-home-on-the-phone
created: 2026-10-23T07:00:02.411Z
updated: 2026-10-23T15:37:33.503Z
closed: 2026-10-23T15:37:33.503Z
---

## Summary

At phone width the inbox is home: the four sections in order with 44 px fold buttons and their counts, empty sections kept at 0, "Nothing needs you" when every section is at 0, the events and archive lines closing the list, and a tapped message unfolding in place with a reply.

## Parent

E-419 (§3.6 the inbox as home, P40 and P42; the waiting plan as a row; the last part of tracer step 1).

## What to build

- **The title** reads Inbox with "N need you", or "Nothing needs you" in green with its check when every section is at 0.
- **Sections.** Asks and approvals, Plan approvals, Requests to you and Messages to you, in that order; each header is a full-width fold button at least 44 px tall with its name and count, its fold remembered per browser as on the desktop; an empty section keeps its header with 0. Rows are two lines at 390 px (glyph, subject, sender in the role colour and the age; then the first line of the text or the command), with no drawer at this width.
- **Message and request rows.** A tap unfolds the row in place with its text and a one-line reply to the sender in the row's topic (the composer's reply mode), with Open topic and Mark read or Decline; the reply's draft is the per-topic draft that already survives a reload.
- **A waiting plan** shows as a row with its stage, lane and item counts and no approve control and no Open Plan: plan approval needs the desktop's Plan view (said in the row's tooltip). The notification for it comes with the notifications ticket.
- **Ask and approval rows** keep the desktop's in-place unfolding until the sheet ticket replaces it.
- **The close of the list.** The events line and the archive line close the list as 44 px controls; the events line opens Events and the archive line opens the archive in place.

## Acceptance criteria

- [x] C1. At 390x844 the inbox shows its four sections in order, each header a fold button at least 44 px tall with its count, and an empty section keeps its header with 0 (Web test).
  - done: impl-1167 · 2026-10-23T15:11:18.224Z
  - verified: rev-23 [reviewer] · run rev-20261023-1167-final · 2026-10-23T15:32:39.373Z · commit 07281bf5c0ea850d1f3f60a83604f0fde6888328
- [x] C2. With every section at 0 the title reads "Nothing needs you" with its check, and a new ask from a fake session brings back the count (Web test).
  - done: impl-1167 · 2026-10-23T15:11:18.307Z
  - verified: rev-23 [reviewer] · run rev-20261023-1167-final · 2026-10-23T15:32:39.373Z · commit 07281bf5c0ea850d1f3f60a83604f0fde6888328
- [x] C3. A tapped message row unfolds in place with a reply to its sender in the row's topic, and a draft typed there survives a reload (Web test).
  - done: impl-1167 · 2026-10-23T15:11:18.372Z
  - verified: rev-23 [reviewer] · run rev-20261023-1167-final · 2026-10-23T15:32:39.373Z · commit 07281bf5c0ea850d1f3f60a83604f0fde6888328
- [x] C4. A waiting plan shows as a row with its counts and offers no approve or Open Plan control at 390x844 (Web test).
  - done: impl-1167 · 2026-10-23T15:11:18.534Z
  - verified: rev-23 [reviewer] · run rev-20261023-1167-final · 2026-10-23T15:32:39.373Z · commit 07281bf5c0ea850d1f3f60a83604f0fde6888328
- [x] C5. The events line and the archive line close the list as controls at least 44 px tall, and the events line opens Events (Web test).
  - done: impl-1167 · 2026-10-23T15:11:18.605Z
  - verified: rev-23 [reviewer] · run rev-20261023-1167-final · 2026-10-23T15:32:39.373Z · commit 07281bf5c0ea850d1f3f60a83604f0fde6888328
- [x] C6. `web/README.md` describes the inbox as home on the phone (docs).
  - done: impl-1167 · 2026-10-23T15:11:18.669Z
  - verified: rev-23 [reviewer] · run rev-20261023-1167-source · 2026-10-23T15:13:24.175Z · commit 5c9cdc0efbd9b092aebc9eac88654703c7d737a2
  - verified: rev-23 [reviewer] · run rev-20261023-1167-source-2 · 2026-10-23T15:19:53.402Z · commit 07281bf5c0ea850d1f3f60a83604f0fde6888328
  - verified: rev-23 [reviewer] · run rev-20261023-1167-final · 2026-10-23T15:32:39.373Z · commit 07281bf5c0ea850d1f3f60a83604f0fde6888328

## Comments

### impl-1167 · 2026-10-23T14:59:38.150Z

Implementation started with implement + tdd guidance. Confirmed seam from E-419 brief: sealed public-frame/Web fixture at 390×844 touch/mobile. Waiting for T-1166 to land before source edits; will reuse existing folds, reply composer/drafts and event summary.

### rev-23 · 2026-10-23T15:13:24.175Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1167-source
commit: 5c9cdc0efbd9b092aebc9eac88654703c7d737a2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1167 full source review
Head5c9cdc0efbd9b092aebc9eac88654703c7d737a2 / tree814250bde89e2c17382279dee54e6cd0fad3c2aa; fixed base/parent26a24ca72c79d5c637e615761fa635c427f0b98e (T-1166 landed). git diff26a24ca7...5c9cdc0e;8files219+/10-. Run rev-20261023-1167-source. Clear; findings[]; C6 docs verified; C1–C5 runtime pending.

## Standards
Pass. Existing shared usePhone seam scopes new rendering and CSS; desktop labels/surfaces retained. Shared Fold owns remembered section state and native controls. Existing Composer reply mode/draft store reused without duplicating sender/topic routing or send/retry logic. No new key listener, provider, dependency, command, permission or setting. Central Inbox controls retain r/Enter behavior. New phone CSS explicitly restores hidden row display:none after its grid rule, so settled outcomes do not expose original message rows. Token colours/shared role styles remain. Web tier registration sorted, README/test guidance updated, diff check clean. Applied docs/agents/tests.md Web/observable-receipt rules and documented shared keyboard ownership; role prohibits sub-agent delegation, so both review axes performed read-only in this session.

## Spec
C1 source: phone four sections remain ordered Asks and approvals, Plan approvals, Requests to you, Messages to you. Header count remains live Now pending facts, empty headers preserved. Full-width44px fold buttons use existing browser preferences; phone grid places glyph/subject/role sender/age above first-line preview, hidden rows stay hidden. Header height/count/ordering/reload fold and row bounds have public Web assertions.
C2 source: Shell phone Inbox title uses hub needsYou, whose projection sums the same Now asks/approvals/plans/requests/messages; zero becomes green token check/Nothing needs you. Unavailable remains dash. Test waits zero title then exact live fake ask before checking1need you and first section count.
C3 source: selected phone messages/requests add existing one-row Composer with exact row.topic.id and reply{id,sender}; field ref gives physical r the inline target. Shared send emits replyTo, hub resolves sender in that topic; persisted per-topic drafts and offline/no-replay behavior unchanged. Existing Open topic and Mark read/Decline retained, phone drawer still guarded. Test uses two topics/message+request, saves distinct drafts, reloads, asserts text/recipient, arms exact fake-sender delivery observers before Send, and verifies topic/reply-id plus durable folded outcomes. It also checks two-line phone geometry, physical Cyrillic-key r and no drawer.
C4 source: waiting-plan row previews stages/lanes/items and tooltip desktop Plan requirement; phone hides its Open Plan detail and openEntry refuses plan Enter. Existing desktop detail/navigation remain. Test asserts counts/tooltip and tap/Enter stay Inbox with no approval/Plan controls.
C5 source: existing shared complete event summary/Archive retained, phone controls44px at list close; Archive stays inline and Events navigation retained. Test checks order/height, in-place archive list and exact Events list.
C6 verified: README Inbox describes phone title/folds/rows/replies/drafts/disconnect/plan/footers accurately. Test guidance names sealed public seam, required neighbors and phone-vs-desktop expectations.

A-10080 evidence is explicitly working-tree final source-as-committed/local macOS arm64: npm run check reported pass, test lint report-only132findings59files/0refusals; final phone-inbox+phone10/10 and affectedInbox/shell/folds/slots42/42. Requested71/71 neighbors preceded final hidden specificity correction; affected set rerun afterward, no claim all71atfinalsource. Original reds include empty title, preview line, missing plan counts and visible settled row; raw tool receipts retain their stated provenance. Reported new local passing worst .959/.796/.570s, all<4s. No configured exact-head/Linux/T3/load receipt claimed. Preserve original stdout/exits/head/timings without transcription reruns.

Proceed with mode-free verification at exact5c9cdc0e and audit passing new Web samples for4s allowance rule before final runtime clearance. Reviewer read-only Git/source/logs/hub; no tests/live browser/GUI/edits/merge. No per-item QA criteria/brief; affected after-stage QA separate. Standards0; Spec0.

Criteria: C6 verified.

### rev-23 · 2026-10-23T15:19:53.402Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1167-source-2
commit: 07281bf5c0ea850d1f3f60a83604f0fde6888328
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1167 README source review
Head07281bf5c0ea850d1f3f60a83604f0fde6888328 / tree71fc4730315fb9b22f1255337d75f3550bfe73ae; parent/fixed point5c9cdc0efbd9b092aebc9eac88654703c7d737a2. Run rev-20261023-1167-source-2. Clear; findings[]; C6 verified, C1–C5 runtime pending.

Coordinator instruction b0c0cb64-b96b-4367-920a-f3959b975b7c in topic-908 explicitly requested these C6 clarifications after source review; no dev merge required. Read-only diff confirms web/README.md only, no source/test changes; diff check clean. All original implementation/tests and full Standards/Spec audit A-10081 carry forward.

## Standards
Pass. Matching docs now state shipped width-dependent behavior directly, distinguish later work and avoid implying More notification switches already exist. No new command/setting/permission or implementation change. A-10082 preserves docs-only provenance. Parent configured run e4081b2f still targets5c9cdc0e, not this head; current new tree requires its own reviewed-head verification receipt.

## Spec
Pass; C6 verified. More currently lists Items/Artifacts/Accounts, notifications explicitly later E-419 ticket. Phone Requests to you vs desktop Requests, desktop-only Enter-to-Plan, phone inline reply vs desktop drawer, one-pane/no split or drawer below640, read-only full-screen item card and desktop restoration correctly match unchanged source. Six Coordinator build checks remain implemented from full review: full-width44px folds, two-line390rows, request reply, desktop Plan tooltip, green empty/check title, Requests to you. No findings.

No new runtime samples/reruns by Reviewer. A-10080 local working-tree evidence keeps original attribution; no pass at new head yet. After source clearance, submit mode-free verify at exact07281bf5 when session queue is available; parent run may finish first and remains historical. Audit new passing Web samples for4s allowance requirement before final C1–C5 settlement. No merge/queue bypass. Affected stage QA separate; Coordinator has posted E-419 stage-1 brief on dev5f3c01d6, no per-item QA criteria.

Reviewer read-only Git/files/hub traffic, no tests/browser/GUI/edits. Standards0; Spec0.

Criteria: C6 verified.

### rev-23 · 2026-10-23T15:32:39.373Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1167-final
commit: 07281bf5c0ea850d1f3f60a83604f0fde6888328
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1167 final evidence review
Head07281bf5c0ea850d1f3f60a83604f0fde6888328 / tree71fc4730315fb9b22f1255337d75f3550bfe73ae, branch t/T-1167-the-inbox-as-home-on-the-phone. Run rev-20261023-1167-final. Clear; findings[]; C1–C6 verified.

## Standards
Full source audit A-10081 and Coordinator-authorized README clarification A-10083 carry forward. Branch/tree readback and hub verify head agree. Fresh exact-head configured mode-free c0d88fcf-92a6-4430-aaa3-bf51890ca2bd/A-10085 exits0; raw ordinary finish records2735tests/406files all pass, no fail/skip/cancel. Actual T1(132files), fallback all hub+Neovim T2(239files), complete Web(35files) exit0. No T3/T4; task policy defers T3 to periodic/integrated occasions. No load-gate scope finish records; generic five-repetition headings establish no repetitions. No integrated or old-head-cache claim.

Linux x64 c-8 lon1 cland-v0-7e2c9113, Node24.21.0/Neovim0.12.5, workers2/Web4; lifetime588s/$0.0408. Host gate89318e5d4159bc3cc1559c61f202174d8fb70e1d reused, not remotely repeated. Actual T1 phase51.26s/T2 327.52s/Web123.34s; per-test sums and projected wall figures are not measured phase wall. Generic duration/lint/ratchet and existing out-of-scope tier-tripwire diagnostics remain report-only (132lint findings/59files;3missing phone-file baselines); retained overages are not claimed fixed. New passing phone Inbox samples2.703996427/2.093516814/1.570929975s, all<4s including prior local samples, so no new allowance justified.

## Spec
C1 verified: ordered four phone sections, full-width44px fold buttons/counts including zeros, remembered fold after reload; two-line glyph/subject/sender/age plus preview geometry and role source reviewed.
C2 verified: initial zero title check/Nothing needs you and live exact fake ask restores1need you/section count; token green source checked.
C3 verified: selected message/request unfolds full text with existing inline reply Composer, exact sender/topic/replyTo delivery; separate topic drafts survive reload, physical Cyrillic-key r focuses field, no drawer; settled rows retain folded outcomes with hidden source rows. Shared offline/pending/recovery behavior unchanged.
C4 verified: waiting plan shows stages/lanes/items, desktop Plan tooltip, tap/Enter stay Inbox and no Approve/Open Plan control. Desktop branch preserved and neighboring Web tests pass.
C5 verified: Events/Archive closing control order/44px targets; Archive opens inline, Events opens exact Events list.
C6 verified: current README accurately distinguishes phone home/replies/Requests to you/desktop Plan and split/drawer, later More notification controls; test guidance and registration match.

Superseded parent run e4081b2f/A-10084 at5c9cdc0e was cancelled143 with T1 plus partial T2/no Web; it is not passing or current-head evidence. Current fresh run supplies runtime clearance. Earlier local summaries retain source-as-committed/provisional attribution and limits; no transcription reruns requested.

Implementer reports post-run fetch/merge-tree againstdev5f3c01d6 exit0 with clean unchanged source; reviewer did not merge or edit. Reviewer only read existing source/logs/hub state; no tests/live browser/GUI. Affected after-stage QA separate under E-419 stage-1 brief, no per-item QA criteria. Standards0; Spec0.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1167 · 2026-10-23T15:32:58.568Z

Ready report sent to Coordinator. Final clear review rev-20261023-1167-final/A-10087 at 07281bf5 verifies C1–C6. Mode-free run c0d88fcf/A-10085: 2735/2735 on Linux c-8 lon1, T1 + all fallback hub/Neovim T2 + Web, diagnostics report-only, no T3/T4/integrated claim. New Web samples max 2.704 s; no allowance. Post-run dev 5f3c01d6 merge-tree conflict check clean (A-10086); no dev merge, no test migration needed in this item. Stage QA remains separate.

### coord · 2026-10-23T15:37:33.503Z

Merged 04d03949cf87bb882acd1a4fb1c8875db3ceafac onto dev.
