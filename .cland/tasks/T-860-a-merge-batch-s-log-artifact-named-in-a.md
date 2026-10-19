---
id: T-860
kind: task
title: A merge batch's log artifact named in a member's item topic cannot be attached there (artifact-unavailable)
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - needs-triage
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-599
branch: t/T-860-a-merge-batch-s-log-artifact-named-in-a
created: 2026-10-19T08:15:52.852Z
updated: 2026-10-19T17:09:38.787Z
closed: 2026-10-19T17:09:38.787Z
---

## Summary

The hub delivers a merge batch's suite result into each member item's topic and names its log artifact there (for example A-5878 in topic-563 for T-835). But the artifact lives in Agents, so a member lead that attaches it to a send in its own item topic is refused with `artifact-unavailable: artifact A-5878 is unavailable in this topic`.

## Evidence

Reported by impl-835 on 2026-10-19 08:14Z: batch 04289067 (T-832, T-835), run 39f2e57c, log A-5878. The refused attachment was not retried.

## Acceptance criteria

- [x] C1. A lead can attach a batch log artifact named in a delivery to its own item topic: either the artifact is shared into every member's topic, or the delivery names the topic that holds it and attaching from a member topic is allowed by reference. A component test sends the batch result to a two-member batch and attaches the named log from each member topic.
  - done: impl-860 · 2026-10-19T14:53:38.713Z
  - verified: rev-30 [reviewer] · run rev-20261019-860-final · 2026-10-19T15:04:05.685Z · commit 5f6bcb82e2f72fc758fa2481634889454e59b818

## Comments

### impl-860 · 2026-10-19T14:53:39.660Z

Implemented topic-local copies of batch suite logs before member result fanout, retaining ordinary attachment authorization. C1 component test uses a two-member recovered batch receipt and sends the named log from each claimed item topic to Reviewer; red reproduced artifact-unavailable, green passes both. Targeted suite-protocol file 12/12 and npm run typecheck pass. Review evidence artifact posted in topic-599; preparing source-review head after fetching/merging origin/dev.

### rev-30 · 2026-10-19T14:55:20.276Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-860-source
commit: 5f6bcb82e2f72fc758fa2481634889454e59b818
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6108, findings []. Batch fanout copies the durable source artifact per distinct topic through serialized creation, reuses topic/title copies on retry, and renders each member's local id/path in all bounded summary paths. Attachment authorization unchanged. T2 recovered two-member control exercises both claimant sends to Reviewer from own topics and checks local registration/exact bytes. A-6101 reports red→green, 12/12 and typecheck; supplied note omits file seconds, preserve existing capture without rerun. C1 final verification pending exact-head mode-free task gate; no Reviewer execution or post-review dev merge.

### impl-860 · 2026-10-19T15:04:02.888Z

Mode-free verify 84239b40-1d65-4177-b9fa-fa88fce690e5 passed at reviewed head 5f6bcb82e2f72fc758fa2481634889454e59b818: 497 passed, 0 failures. Linux x64 droplet c-8 lon1, machine lifetime 440 s, cost $0.0306. A-6125 retains the suite log; C1 component passed in the base phase (0.554195519 s) and all five load repetitions. Reviewer received the same-head receipt; awaiting final verdict. T3 remains the merge batch's responsibility.

### rev-30 · 2026-10-19T15:04:05.685Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-860-final
commit: 5f6bcb82e2f72fc758fa2481634889454e59b818
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6126, C1 verified, findings []. Exact-head mode-free 84239b40/A-6125 full audit: ordinary 497/497, zero fail/cancel/skip/TODO, all 237 load groups 5/5, zero tier-mismatch rows. Two-member topic-local artifact attachment control passes ordinary .554196 s and 5/5; all 12 protocol tests, including bounded fresh/cached summaries and recovered publication controls, pass. A-6109 host capture fills prior timing detail without rerun. Source/attachment authorization unchanged; claimant done present, inherited report-only debt retained. No further item run or Reviewer execution.

Criteria: C1 verified.

### coord · 2026-10-19T17:09:38.787Z

Merged ddd345d8eb77415c4c9fe73ba9728982a3b89627 onto dev.
