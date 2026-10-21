---
id: T-983
kind: task
title: The snapshot at connection
state: open
status: ready
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-979
topic: topic-780
branch: t/T-983-the-snapshot-at-connection
created: 2026-10-20T16:50:00.282Z
updated: 2026-10-21T03:19:06.649Z
---

## Summary

A client that asks for it in its hello's feature list gets one snapshot after the welcome, stamped with an epoch and a sequence number. The snapshot carries the tracker levels, items, sessions, topics, inbox, the first page of events and the accounts, without the suite history, and replaces the eleven reads at connection.

## What to build

The hello carries a feature list (the snapshot, numbered deltas, slim frames), and the welcome answers with the accepted features. With the snapshot feature, the hub composes one snapshot in one turn of its loop and sends it as one frame per domain under one sequence number, closed by an end marker. Each frame stays within its kind's size limit. The domains:
- the tracker levels and the ladder;
- the items, each with the latest verdict of each kind and its round, while the verdict history stays behind `task.view`;
- the sessions with presence, the roles, the crew, the Coordinator and the verification queue;
- the open topics and those closed in the last seven days;
- the inbox with `needsYou`;
- the first page of events;
- the accounts.

A connection without the feature list, which means Neovim's and the CLI's, receives today's frames unchanged.

## Acceptance criteria

- [x] C1. A client hello with the snapshot feature receives, after the welcome, frames under one epoch and one sequence number closed by an end marker, and a hello without it receives today's frames only (test).
  - done: impl-983 · 2026-10-21T03:07:20.974Z
  - verified: rev-23 [reviewer] · run rev-20261021-983-final · 2026-10-21T03:19:06.537Z · commit ac463d7ffbf334115fed7b57f75e1baee24cd7e9
- [x] C2. The snapshot carries the levels and ladder, items with the latest verdict of each kind and its round, sessions with presence, roles, crew, Coordinator and verification queue, open topics plus those closed in the last seven days, the inbox with `needsYou`, the first page of events and the accounts (test, one assertion per domain).
  - done: impl-983 · 2026-10-21T03:07:41.556Z
  - verified: rev-23 [reviewer] · run rev-20261021-983-final · 2026-10-21T03:19:06.537Z · commit ac463d7ffbf334115fed7b57f75e1baee24cd7e9
- [x] C3. No snapshot frame carries suite history or an item's verdict history, and each frame stays under its kind's size limit (test).
  - done: impl-983 · 2026-10-21T03:07:41.687Z
  - verified: rev-23 [reviewer] · run rev-20261021-983-final · 2026-10-21T03:19:06.537Z · commit ac463d7ffbf334115fed7b57f75e1baee24cd7e9
- [x] C4. The snapshot is composed in one synchronous turn: no other frame reaches the connection between its first frame and its end marker (test with a change raced against the composition).
  - done: impl-983 · 2026-10-21T03:07:41.921Z
  - verified: rev-23 [reviewer] · run rev-20261021-983-final · 2026-10-21T03:19:06.537Z · commit ac463d7ffbf334115fed7b57f75e1baee24cd7e9
- [x] C5. On a local copy of the live tracker, a measurement script records the snapshot's bytes per domain and its compose time, and the figures are posted as a comment on E-412 beside the prototype's 1.15 MB (local evidence).
  - done: impl-983 · 2026-10-21T03:07:42.035Z
  - verified: rev-23 [reviewer] · run rev-20261021-983-source · 2026-10-21T03:10:44.337Z · commit ac463d7ffbf334115fed7b57f75e1baee24cd7e9
  - verified: rev-23 [reviewer] · run rev-20261021-983-final · 2026-10-21T03:19:06.537Z · commit ac463d7ffbf334115fed7b57f75e1baee24cd7e9
- [x] C6. `hub/README.md` documents the feature list, the snapshot's frames and the end marker.
  - done: impl-983 · 2026-10-21T03:07:42.163Z
  - verified: rev-23 [reviewer] · run rev-20261021-983-source · 2026-10-21T03:10:44.337Z · commit ac463d7ffbf334115fed7b57f75e1baee24cd7e9
  - verified: rev-23 [reviewer] · run rev-20261021-983-final · 2026-10-21T03:19:06.538Z · commit ac463d7ffbf334115fed7b57f75e1baee24cd7e9

## Comments

### impl-983 · 2026-10-21T03:07:42.316Z

Implementation at ac463d7ffbf334115fed7b57f75e1baee24cd7e9 (merged origin/dev before first review). C1–C4: local darwin/arm64 targeted connection-snapshot.test.ts 4/4 T2, snapshot-framing.test.ts 8/8 T1; check passed (typecheck all workspaces, web bundle, static/test lint; lint report mode). C5 copied tracker measurement A-8119, 1,032 items, 575,504 domain-frame bytes vs prototype 1.15 MB; largest items 54.5% cap, 5 compose samples 113–138 ms. Coordinator posted figures to E-412. C6 protocol and test/measurement docs updated. QA policy is after-stage, no per-item QA brief supplied.

### rev-23 · 2026-10-21T03:10:44.337Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-983-source
commit: ac463d7ffbf334115fed7b57f75e1baee24cd7e9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; full Standards/Spec audit A-8123 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8123-t-983-source-review-at-ac463d7f.md). All 12 files reviewed. Optional feature negotiation preserves legacy hellos; seven compact domains share epoch/sequence/end. Full-envelope UTF-8 limits validate the entire snapshot before any frame sends; journal revision-checked asynchronous preparation is followed by synchronous gather/validation/write, with atomic refusal fallback. Wire conformance and T1/T2 assertions cover domains, limits/history exclusion and raced-change ordering. No findings. C5 A-8119 copied-tracker measurement is explicitly scoped (other domains scratch defaults, no embedded SHA/exit) and figures are posted on E-412 by Coordinator; a7710226 accepts ~120 ms compose/54.5% items cap. C6 docs complete. Verify C5/C6; C1–C4 await exact-head configured mode-free receipt. Local targeted/check summary is not a full gate or exact-head timing proof. No Reviewer runtime; after-stage QA separate.

Criteria: C5 verified, C6 verified.

### rev-23 · 2026-10-21T03:19:06.538Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-983-final
commit: ac463d7ffbf334115fed7b57f75e1baee24cd7e9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; evidence audit A-8127 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8127-t-983-final-evidence-review-at-ac463d7f.md). Exact-head 7642ad7c/A-8126 completes Linux T1/all-T2 fallback: 2,206 ordinary passes/339 files plus 12 new identities each 5/5 load passes separately. Framing T1 8/8 and connection snapshot T2 4/4 prove negotiation/legacy behavior, all seven domains/compact history, byte limits/atomic fallback and no interleaved raced model frame before end. C5 copied local measurement/posting and C6 docs remain source-established. Web NOT RUN for missing Linux libraries; no browser/T3/T4/integrated/QA claim or new compose benchmark. Host check eb58e837 not repeated remotely; lint/duration/ratchet report-only, four missing baselines. No findings; verify C1–C6.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
