---
id: T-1168
kind: task
title: "The ask sheet: keyboard, Decline with a reason, no answer by accident"
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1167
topic: topic-910
branch: t/T-1168-the-ask-sheet-keyboard-decline-with-a
created: 2026-10-23T07:00:02.549Z
updated: 2026-10-23T17:22:12.072Z
closed: 2026-10-23T17:22:12.072Z
---

## Summary

At phone width an ask opens as a bottom sheet with full-width numbered options and a free answer; the sheet rides on the keyboard with 44 px options, Decline sits on the field's label row and needs a reason, and nothing answers on a swipe, the scrim or Escape.

## Parent

E-419 (§3.6 the ask sheet, P25 and P36 to P38; tracer step 2).

## What to build

- **Opening.** A tap on an ask row opens the sheet over a scrim, the row staying selected behind it. At phone width an ask card in a thread shows its question and an Answer button that opens the same sheet, so the sheet is the one place an ask is answered on the phone.
- **The sheet.** A header with the ask's item, sender and age, a link to its thread and a close button; the question; each option as a full-width button at least 48 px tall with its number; the free answer with its label row and Send answer.
- **The keyboard.** When the free answer takes focus the sheet follows the visual viewport and sits on its bottom edge; the question clamps to three lines and the options shrink to 44 px. The page has no virtual keyboard in the suite, so the test shrinks the viewport.
- **Decline** sits on the field's label row. It turns the label into the reason and Send answer into a red Decline that stays disabled until a reason is typed; Answer instead turns it back. The answer goes through `topic.answer` as on the desktop.
- **Closing.** Escape (through the key map), the close button and a tap on the scrim close the sheet without answering; there is no swipe gesture, so a swipe neither answers nor declines.
- **The answered row.** An answer from any client closes the sheet and folds the row in place to one line with the option, who answered and when; the row stays until the human leaves the inbox and then moves to the archive, by the existing leave rule.

## Acceptance criteria

- [x] C1. At 390x844 a tapped ask row opens a bottom sheet with the question, each option as a full-width numbered button at least 48 px tall, and the free answer (Web test).
  - done: impl-1168 · 2026-10-23T17:05:33.369Z
  - verified: rev-26 [reviewer] · run rev-20261023-1168-final-1 · 2026-10-23T17:17:12.358Z · commit a59bc01da7eacb7bcce4925331f0e863e00c716c
- [x] C2. Focusing the free answer and shrinking the viewport keeps the sheet on the visual viewport's bottom with the question clamped to three lines and 44 px options (Web test).
  - done: impl-1168 · 2026-10-23T17:01:20.351Z
  - verified: rev-26 [reviewer] · run rev-20261023-1168-final-1 · 2026-10-23T17:17:12.358Z · commit a59bc01da7eacb7bcce4925331f0e863e00c716c
- [x] C3. Decline on the label row turns Send into a red Decline that stays disabled until a reason is typed, and the fake asker receives `declined` with the reason (Web test).
  - done: impl-1168 · 2026-10-23T17:01:20.524Z
  - verified: rev-26 [reviewer] · run rev-20261023-1168-final-1 · 2026-10-23T17:17:12.358Z · commit a59bc01da7eacb7bcce4925331f0e863e00c716c
- [x] C4. Escape, the close button, a tap on the scrim and a touch swipe across the sheet leave the ask open, as a frame client reads it (Web test).
  - done: impl-1168 · 2026-10-23T17:01:20.800Z
  - verified: rev-26 [reviewer] · run rev-20261023-1168-final-1 · 2026-10-23T17:17:12.358Z · commit a59bc01da7eacb7bcce4925331f0e863e00c716c
- [x] C5. An ask answered in a second context closes the first context's sheet and folds its row to the outcome, and the row stays until the human leaves the inbox (Web test).
  - done: impl-1168 · 2026-10-23T17:01:20.971Z
  - verified: rev-26 [reviewer] · run rev-20261023-1168-final-1 · 2026-10-23T17:17:12.358Z · commit a59bc01da7eacb7bcce4925331f0e863e00c716c
- [x] C6. At 390x844 an ask card in a thread offers Answer, which opens the same sheet (Web test).
  - done: impl-1168 · 2026-10-23T17:01:21.246Z
  - verified: rev-26 [reviewer] · run rev-20261023-1168-final-1 · 2026-10-23T17:17:12.358Z · commit a59bc01da7eacb7bcce4925331f0e863e00c716c

## Comments

### impl-1168 · 2026-10-23T16:52:38.730Z

Implementing phone ask sheet test-first at the existing approved sealed Web/public-frame seam (E-419): touch/mobile browser layout and interaction plus fake asker and topic.history receipts. Reusing AskCard/topic.answer and Inbox visit outcomes; no new hub seam. QA is after-stage on E-419.

### rev-26 · 2026-10-23T17:03:45.614Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261023-1168-source-1
commit: 455722fd62d4ad2ae364f08665153274d2a34678
scope: full
findings: [{"severity":"medium","text":"M1: Register phone-asks.test.ts as Web in hub/test/tiers.json. All six new acceptance tests are absent from the phase manifest; the T0 inventory guard requires every test file to appear and configured Web planning uses those entries.","file":"web/test/phone-asks.test.ts","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at 455722fd/tree 17c941fc. Standards M1 medium, web/test/phone-asks.test.ts:1: new file absent from hub/test/tiers.json; docs require Web classification and T0 lint-repository-tier-plan compares all test paths with manifest keys. Register it as Web, retain all cases, re-mark C1 done and request fresh review before verification. No other source findings across the 12-file sheet/AskCard/Inbox/dispatcher/docs/test change; runtime C1–C6 unverified. A-10115 remains narrative local macOS supporting evidence, not exact-head configured proof; preserve original command/stdout/exits/native timings with source limits without transcription reruns. Full audit complete. No Reviewer runtime or GUI; after-stage QA separate. A-10117: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10117-t-1168-source-review-at-455722fd.md.

Criteria: C1 failed (The new six-case phone-asks acceptance file is missing its Web tier manifest entry, preventing the configured inventory check.).

### rev-26 · 2026-10-23T17:06:02.949Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1168-source-2
commit: a59bc01da7eacb7bcce4925331f0e863e00c716c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at a59bc01d/tree dcea0f0c. Standards and Spec: no findings. M1 resolved by sorted Web tier entry for phone-asks.test.ts. Removes only the stale duration observation for the absent old phone selection identity; no transferred timing, budget/allowance increase, product/docs/test/assertion changes. Full product review A-10117 carries forward; all six cases retained. A-10120 original local command/exit/native timing excerpts inspected with explicit uncommitted-implementation-tree provenance; supporting evidence, not corrected-head configured proof or root check claim. C1–C6 await same-head mode-free verification and actual new passing duration audit. After-stage QA remains separate; no Reviewer runtime. A-10123: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10123-t-1168-corrected-source-review-at-a59bc01d.md.

### rev-26 · 2026-10-23T17:17:12.358Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1168-final-1
commit: a59bc01da7eacb7bcce4925331f0e863e00c716c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged a59bc01d/tree dcea0f0c; C1–C6 verified, no findings. A-10132/run 4124751d exits 0: independently counted 2741 ordinary test passes and 407 file passes, zero fail/cancel/skip. T1, fallback all T2 hub/Neovim and actual Web pass on Linux x64 c-8 lon1, Node24.21/Neovim0.12.5, machine workers2/Web4. Host root check/inventory guard passes; gate ebc9a331 not repeated remotely. Six phone-sheet criterion cases pass at 2.278/1.418/1.691/1.957/1.778/1.337 seconds; renamed phone selection 1.385 seconds, all below 4-second allowance trigger. Source A-10117/A-10123 carries forward, M1 resolved. Generic lint/duration/tier/ratchet report-only, zero lint refusals, one missing baseline; Web wall119.01s exceeds its report-only40s budget. No T3/T4, repetition, enforcing phase-budget or after-stage QA claim. A-10120 original local provenance retained; no Reviewer runtime. A-10133: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10133-t-1168-final-evidence-review-at-a59bc01d.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-23T17:22:12.072Z

Merged a2a90824cd2e13e126b8ad4801c1bbe8a3a5d926 onto dev.
