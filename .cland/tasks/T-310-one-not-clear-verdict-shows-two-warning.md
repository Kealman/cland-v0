---
id: T-310
kind: task
title: One not-clear verdict shows two warning rows in the events view
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1.2
  - hub
  - nvim
  - qa-found
  - ready-for-agent
assignee: null
parent: E-274
blocked_by: []
topic: topic-184
branch: t/T-310-one-not-clear-verdict-shows-two-warning
created: 2026-10-12T22:12:06.310Z
updated: 2026-10-12T22:44:06.618Z
---

## Summary

In T-274's QA demo (run qa-2026-10-12-27 at fdf5d26, A-1664), one not-clear review verdict produced two warning rows in the events view, `T-5 review not clear · rev [reviewer] · run qa274-nc` and `T-5 verdict posted review not clear · qa274-nc`, also after a workbench restart. The events view must show one row per verdict, so the warning count and the inbox's events line count it once.

## Parent

T-274: Inbox and the events view (its C5 failed on this). Spec: docs/spec/v0.1.2.md §3.7. Found by qa-27, filed by the Coordinator.

## What to build

Find why one verdict reaches `events.list` as two rows. The likely cause is that both the verdict's notification record and the announced `task` event ("verdict posted") map onto the verdict kind. Make one verdict one row: one record maps, or the two are recognised as the same event, by the verdict's item, run and result. Merging by text within 60 seconds does not catch them, since their texts differ. Keep every other event and every warning class as T-287 built them. Old journal periods that already hold both records show one row too. The inbox's events line counts the verdict once.

Out of scope: any other events-view change.

Constraints: tests through the hub's frame protocol first (a real hub, a real spoke writing a not-clear verdict), the Neovim UI headless on the stub hub second; no synchronous full recompute per event (T-293), keeping T-284's C7 workload test green; tests that read hub.log or journal.jsonl wait on the flushLogs barrier.

## Acceptance criteria

- [x] C1. One not-clear verdict gives exactly one warning row in `events.list` and in the events view, live and after a workbench restart, on a journal that already holds both records.
  - done: impl-310 · 2026-10-12T22:15:57.979Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-310-1 · 2026-10-12T22:17:21.219Z · commit c00414eb6cc0aa20284be6e416603fcef4068344
  - verified: rev-23 [reviewer] · run rev-2026-10-12-310-2 · 2026-10-12T22:43:37.429Z · commit c00414eb6cc0aa20284be6e416603fcef4068344
- [x] C2. A clear verdict likewise gives one row; the other event kinds and classes are unchanged.
  - done: impl-310 · 2026-10-12T22:15:58.648Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-310-1 · 2026-10-12T22:17:21.219Z · commit c00414eb6cc0aa20284be6e416603fcef4068344
  - verified: rev-23 [reviewer] · run rev-2026-10-12-310-2 · 2026-10-12T22:43:37.429Z · commit c00414eb6cc0aa20284be6e416603fcef4068344
- [x] C3. The inbox's events line and the warning count count one verdict once.
  - done: impl-310 · 2026-10-12T22:15:59.189Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-310-1 · 2026-10-12T22:17:21.219Z · commit c00414eb6cc0aa20284be6e416603fcef4068344
  - verified: rev-23 [reviewer] · run rev-2026-10-12-310-2 · 2026-10-12T22:43:37.429Z · commit c00414eb6cc0aa20284be6e416603fcef4068344
- [x] C4. Targeted hub and headless tests pass; `cland verify` is green.
  - done: impl-310 · 2026-10-12T22:43:22.433Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-310-2 · 2026-10-12T22:43:37.429Z · commit c00414eb6cc0aa20284be6e416603fcef4068344

## Comments

### impl-310 · 2026-10-12T22:13:21.769Z

Reproduced before product changes with node --test --test-name-pattern='a real spoke verdict' hub/test/events.test.ts (0.82 s): real Reviewer spoke task.comment produced two warn-level verdict pushes, `T-1 verdict posted review not clear · one-row-not-clear` and `T-1 review not clear · rev [reviewer] · run one-row-not-clear`; assertion 2 !== 1. Investigating shared journal mapping; preserving T-293's coalesced projection and T-284 workload bounds.

### rev-23 · 2026-10-12T22:17:21.219Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-310-1
commit: c00414eb6cc0aa20284be6e416603fcef4068344

No high/medium findings. Shared mapping chooses the richer hub verdict notification before grouping/filtering, preserving file-authored verdicts and raw journal/subscriber announcements. Real hub/spoke tests cover live/history/restart and old paired-record pagination; headless tests cover once-only inbox/warning counts and cold saved filters. Workload/core/UI production paths unchanged; A-1665 reports targeted 18/18. C1–C3 verified; C4 awaits full exact-head result. Evidence A-1666: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1666-t-310-source-review-one-verdict-row-across-live-and-history.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-310 · 2026-10-12T22:43:22.725Z

Exact-head full cland verify e618c84f-bfd0-4f45-9c34-cd9b6f20af21 is green at c00414eb6cc0aa20284be6e416603fcef4068344: typecheck and all phases; 1686/1686 passed, zero failures/cancelled/skipped. Durable log A-1671 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1671-suite-e618c84f-bfd0-4f45-9c34-cd9b6f20af21-all-at-c00414e.log. Targeted 18/18 and source review C1–C3 already clear (A-1665/A-1666). C4 marked done; requesting the reviewer's remaining C4 verification.

### rev-23 · 2026-10-12T22:43:37.429Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-310-2
commit: c00414eb6cc0aa20284be6e416603fcef4068344

No high/medium findings. C1–C3 assessment retained; C4 verified by full exact-head cland verify e618c84f, A-1671: typecheck and all phases, 1686/1686, zero skips/cancellations, exit 0. Once-only verdict live/history/restart, paired pagination/file-authored preservation, UI counts/cold filters and unchanged workload regression pass. Evidence A-1672: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1672-t-310-final-review-once-only-verdict-full-verification.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-12T22:44:06.618Z

Merged 0fcb242df2bc44716d6a85c45aceb57efb26816e onto dev.
