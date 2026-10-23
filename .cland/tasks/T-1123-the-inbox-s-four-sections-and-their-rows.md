---
id: T-1123
kind: task
title: The inbox's four sections and their rows
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1122
topic: topic-889
branch: t/T-1123-the-inbox-s-four-sections-and-their-rows
created: 2026-10-22T15:16:13.645Z
updated: 2026-10-23T03:58:25.084Z
---

## Summary

The Inbox area shows the now layer in its four sections with their rows, ages and folds; the selected row unfolds in place with real buttons, `d` removes a request or a message, Enter opens, and the events line closes the list.

## Parent

E-417 (v0.1.2 §3.7 the inbox; P17, P18; tracer step 3).

## What to build

The sections are asks and approvals, plan approvals, requests and messages to the human, in that order; a topic waiting without an ask shows its latest message among the messages. Each section is newest first and shows five rows, folding the rest into one line that names how many and the oldest wait; each header is a name and a count, and an empty section stays as one muted line (P18). A row is a glyph, the subject, the text, the sender in the role colour and the waiting age at the right (P17), ages updating while the page is open. The selected row unfolds in place: an ask's card from the asks ticket, a request's or message's full text with its buttons, a plan's stage and lane counts. `d` declines a request (its sender is told) or marks a message read, and the row leaves; Enter opens the row's topic at its message, and on a waiting plan opens the Plan view of its epic. Below the sections the events line reads the number of events newer than the human's last look and their warnings in the watch colour, and opens the Events area. The keys live in the inbox context.

## Acceptance criteria

- [x] C1. The Inbox shows asks and approvals, plan approvals, requests and messages in that order, each newest first with each row's waiting age and a header of its name and count, and an empty section as one muted line (Web test).
  - done: impl-1123 · 2026-10-23T03:54:19.867Z
- [x] C2. A section with seven rows shows five and folds two into a line naming the count and the oldest wait (Web test).
  - done: impl-1123 · 2026-10-23T03:54:19.971Z
- [x] C3. The selected row unfolds in place with its buttons, and `d` declines a request, as its fake sender receives it, or marks a message read, and the row leaves (Web test).
  - done: impl-1123 · 2026-10-23T03:58:25.084Z
- [x] C4. Enter on a message row opens its topic at that message, and on a waiting plan opens the Plan view of its epic (Web test).
  - done: impl-1123 · 2026-10-23T03:54:20.133Z
- [x] C5. The events line counts the events newer than the human's last look and their warnings, and stays when every section is empty (Web test).
  - done: impl-1123 · 2026-10-23T03:54:20.314Z

## Comments

### impl-1123 · 2026-10-23T03:43:22.131Z

Implemented four ordered Now sections, section folding/oldest waits and local ages; selected details, request decline/read receipts, exact paged thread anchoring and Plan navigation; retained ask/approval outcomes and native approval keys; shared marks Events footer. TDD slices observed red before implementation at the sealed Web/public-frame seam. Initial root check and targeted regression set passed on macOS; final checks and commit preparation are in progress. Merged origin/dev through 930712ed (T-1161 README fix).

### impl-1123 · 2026-10-23T03:46:05.727Z

Exact pushed-head follow-up at d815665318007e862d93ed2f785d9664f79c2935: macOS/local targeted area-slots, key-contexts, palette, asks, folds and hub web-keymap passed 35/35 (7.473 s aggregate process duration; no suite gate). This supplies exact-head evidence for the required three regression files after the final approval-topic navigation adjustment. Root npm run check and Inbox Web 6/6 had passed on the identical source tree before commit; test lint was report mode with zero refusals. Holding this head for source review; mode-free suite remains pending.

### rev-23 · 2026-10-23T03:49:59.251Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1123-source
commit: d815665318007e862d93ed2f785d9664f79c2935
scope: full
findings: [{"severity":"medium","text":"The five-row slice and saved section folds do not reveal props.selected. In Inbox from an older ask's thread can select an unrendered/hidden target, so destination focus and controls fail. Reveal exact selected targets through both limits; cover an older-than-five ask in a saved folded section with duplicate-pane focus.","file":"web/src/InboxArea.tsx","line":105},{"severity":"medium","text":"Previously pending approvalCards/retainedApprovals survive a fresh snapshot that omits a peer-answered approval, with no exact outcome recovery. Old live answer controls return and refusal only shows an error. Recover the exact archived winner for omitted/refused approvals while preserving newer rows/counts; cover offline peer answer and real refused receipt.","file":"web/src/connection.ts","line":268},{"severity":"medium","text":"Footer counts only the latest 200 events; warnings beyond that unread page are silently omitted. C5 requires events/warnings since last look. Count through the shared mark across pages, and cover >200 unread rows with an older warning, unless Coordinator explicitly changes the contract.","file":"web/src/InboxArea.tsx","line":98},{"severity":"medium","text":"Successful inbox.read/inbox.decline resolves by applying its whole returned Inbox regardless of newer pushed state. A held old reply can erase a newer unrelated row and roll counts back. Reconcile the exact action or protect freshness; test a held real success reply released after a newer Inbox row.","file":"web/src/connection.ts","line":106}]
finding_counts: {"high":0,"medium":4,"low":0}

Full source not clear; complete M1–M4 findings in A-9803: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9803-t-1123-source-review-selection-reconnect-counts-and-action-freshness.md. Reveal selected targets through row cap/saved folds; recover exact approval outcomes on fresh-snapshot omission/refusal; count events and warnings through the last-look mark beyond page one; prevent old read/decline result snapshots from overwriting newer live Inbox state. Other section/key/action/paged-thread/plan/docs/standards audit complete. C3/C5 failed, other runtime criteria unverified. Local targeted summaries are supporting evidence, not configured pass. Preserve original raw receipts; fixes need fresh source review before verify. After-stage QA and reply/archive/drawer follow-ons separate.

Criteria: C3 failed (Selected targets can stay hidden; offline approval winners are not recovered; delayed action snapshots can erase newer rows/counts.), C5 failed (Unread event/warning counts stop at the latest 200 rows and omit older unread warnings.).

### rev-23 · 2026-10-23T03:56:45.787Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1123-source-2
commit: 1435e0c5d59c6f8b9db1419bde8823be9a8633f2
scope: full
findings: [{"severity":"medium","text":"Recovery protects a newer closed record but installs an old returned pending record over a newer same-id pending delta. Held recovery can restore stale subject/choices/hub eligibility after current TUI-only/revalidated fields arrived. Fence against the exact record captured at recovery start and cover a held real recovery reply followed by a newer same-id authorization delta.","file":"web/src/connection.ts","line":142}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrected source not clear; M1 selected reveal, M3 complete event-page counts and M4 old action snapshot fencing are resolved. M2 closed-winner/unrelated-row recovery works, but old archive pending rows still overwrite newer same-id pending deltas. Fence exact-record freshness and extend held-recovery regression with current TUI-only/revalidated fields. Complete remaining finding set; other audit stands. A-9805: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9805-t-1123-corrected-audit-same-approval-recovery-freshness-remains.md. Local corrected44/44/check are supporting pre-final-indentation receipts, not configured pass. C3 failed; fresh corrected-head review before verify, after-stage QA separate.

Criteria: C3 failed (Held approval recovery can overwrite newer same-id pending authorization with stale subject/choices/routing.).

### rev-23 · 2026-10-23T03:58:15.901Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1123-source-3
commit: 5cd0852b3ee58452f01829b63bbe5970aafe865b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings; C1–C5 runtime verification pending. A-9807: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9807-t-1123-source-clear-at-5cd0852b.md. M1 selected reveal, M3 complete unread-page counts and M4 action snapshot freshness remain resolved. M2 now captures exact record identity before archive read and preserves any later same-id pending/closed update; regression retains current TUI subject/zero controls after recovery finally completes. Original full audit and accepted corrections stand; no dev merge. Local44/44 plus latest3/3 and static tail A-9806 support source only, not configured pass. Claimant should restore C3 done after the fix (currently unchecked), then exact-head mode-free verification. Final criteria and after-stage QA remain separate.
