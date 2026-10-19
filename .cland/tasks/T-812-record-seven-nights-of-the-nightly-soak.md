---
id: T-812
kind: task
title: "Record seven nights of the nightly soak after T-715 merges: at least five runs, each under $0.25"
state: open
status: in progress
size: XS
criterion_seq: 1
labels:
  - ready-for-human
assignee: null
parent: E-678
blocked_by:
  - T-715
topic: topic-604
branch: t/T-812-record-seven-nights-of-the-nightly-soak
created: 2026-10-18T16:21:54.721Z
updated: 2026-10-19T15:24:23.648Z
---

## Summary

T-715's former C5 is an observation that can only be made after merge, so it can't gate the merge. Seven nights after T-715 lands, the Coordinator reads the soak lease records and records them here.

## Acceptance criteria

- [ ] C1. From T-715's merge to the release build, every night's soak is listed from the lease records with run id, tree, duration and cost against the $0.25 target, and any skipped night names its cause (D65: measured and recorded on this epic with the target; the miss is carried to v0.2's E-880, not a release gate).

## Comments

### impl-812 · 2026-10-19T14:52:33.839Z

Evidence collection found one nightly soak since T-715 merge: run866cf201-a3a7-47fd-bf3e-89376fba41fe, tree3bda3956b2a80ac7300355889642468eab12d53f, queued2026-10-19T03:00:02.899Z, finished04:16:35Z, exit124 (run timeout75m). Existing hub result/log A-5766 reports lifetime4583s, cost$0.3182, above C1's$0.25 ceiling; no published coverage map. T-827 already fixed timeout planning. Reported criterion contradiction and requested Coordinator lease receipts after executor.status permission refusal. C1 remains unmarked pending decision; measurement artifact follows.

### impl-812 · 2026-10-19T14:54:22.623Z

Published measurement A-6105: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6105-t-812-nightly-soak-ledger-through-2026-10-19.md. Exactly one due night since T-715's 2026-10-18 21:58:04Z merge; none skipped. Run 866cf201-a3a7-47fd-bf3e-89376fba41fe at tree 3bda3956b2a80ac7300355889642468eab12d53f timed out (exit 124, 75m), lifetime 4,583 s, ledger cost $0.3182436, no published coverage map. Coordinator supplied read-only ledger confirmation and daily cap $14 (respected). Per Coordinator f7010011/a204d4cb, C1 stays unchecked because the historical cost exceeds $0.25; Coordinator owns unmet-target decision and release-time append. T-827 merged 05:17Z after this soak. No source changes or new test run.
