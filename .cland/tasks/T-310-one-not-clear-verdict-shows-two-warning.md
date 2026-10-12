---
id: T-310
kind: task
title: One not-clear verdict shows two warning rows in the events view
state: open
status: in progress
labels:
  - v0.1.2
  - hub
  - nvim
  - qa-found
  - ready-for-agent
assignee: null
parent: T-274
blocked_by: []
topic: topic-184
branch: t/T-310-one-not-clear-verdict-shows-two-warning
created: 2026-10-12T22:12:06.310Z
updated: 2026-10-12T22:12:39.770Z
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

- [ ] One not-clear verdict gives exactly one warning row in `events.list` and in the events view, live and after a workbench restart, on a journal that already holds both records.
- [ ] A clear verdict likewise gives one row; the other event kinds and classes are unchanged.
- [ ] The inbox's events line and the warning count count one verdict once.
- [ ] Targeted hub and headless tests pass; `cland verify` is green.
