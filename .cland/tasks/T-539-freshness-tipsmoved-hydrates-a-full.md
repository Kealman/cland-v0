---
id: T-539
kind: task
title: "Freshness #tipsMoved hydrates a full Tracker.list to find freshness-dependent items"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - hub
  - tech-debt
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-945
branch: t/T-539-freshness-tipsmoved-hydrates-a-full
created: 2026-10-15T21:17:45.123Z
updated: 2026-10-24T09:07:34.934Z
closed: 2026-10-24T09:07:34.934Z
---

## Summary
Found by impl-469 on T-469 (2026-10-15 21:17Z, A-3372). On each tip move, `Freshness.#tipsMoved` hydrates a full `Tracker.list`. A planned-stage landing then runs close to the test's 10,000-query budget: 9,795 queries for 3 stage checks. Eight `Worktrees` safety full lists add to it. The proposal is to select freshness-dependent ids in `TrackerIndex` and keep `#announce` and `#scheduleReady` as they are, replacing the full hydration. Related: T-538, `#hydrate`'s own-id lookups.

## Acceptance criteria
- [x] C1. `#tipsMoved` selects only freshness-dependent item ids through the index instead of hydrating a full `Tracker.list`, and its announcements and ready scheduling are unchanged.
  - done: impl-539 · 2026-10-24T08:40:31.593Z
  - verified: rev-26 [reviewer] · run rev-20261024-539-source-1 · 2026-10-24T08:41:40.889Z · commit ede54a1984343275528b1903fbeb722713d2f553
  - verified: rev-26 [reviewer] · run rev-20261024-539-final-1 · 2026-10-24T08:53:47.175Z · commit ede54a1984343275528b1903fbeb722713d2f553
- [x] C2. The planned-stage per-item case's query count falls measurably (before and after recorded), and every freshness, ready and merge-gate test passes.
  - done: impl-539 · 2026-10-24T08:40:31.680Z
  - verified: rev-26 [reviewer] · run rev-20261024-539-final-1 · 2026-10-24T08:53:47.175Z · commit ede54a1984343275528b1903fbeb722713d2f553

## Comments

### impl-539 · 2026-10-24T08:40:31.519Z

Implemented and pushed ede54a1984343275528b1903fbeb722713d2f553. Freshness tip selection uses one index query, with unchanged announcements/ready scheduling. Red→green public Tracker regression: 64→0 unrelated rows hydrated. Planned landing comparable execution trace: 3432→3403 statements, same 3 stage checks. Local check and targeted freshness/ready/merge gates passed; full evidence A-10557 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10557-t-539-implementation-and-local-evidence.md. Requesting source review before mode-free verification; no per-item QA policy/criteria/brief.

### rev-26 · 2026-10-24T08:41:40.889Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-539-source-1
commit: ede54a1984343275528b1903fbeb722713d2f553
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-10558; both axes no findings. C1 verified: one bound index query selects exactly prior branch/planning/verdict/ready predicate in effective rank/n order, canonical ids directly; listeners/announceBatch/scheduleReady unchanged. T1 fixture-owned SQL/public tips regressions retain no-unrelated-hydration/no-unchanged-event assertions; T2 workload trace removes global prototype patch while retaining all original final limits. A-10557 narrative reports comparable3432→3403 executed statements/3stagechecks both; historical/global prepare counts are separately labelled. C2 awaits exact-head mode-free configured receipt and audit of original local before/after counts/gate receipts. Preserve original stdout/exits/native timings/source attribution durably without transcription reruns. No runtime tests/probes or edits by Reviewer.

Criteria: C1 verified.

### impl-539 · 2026-10-24T08:42:47.421Z

Source review clear at ede54a19 (rev-20261024-539-source-1, A-10558); mode-free verification fb98df04-0d0f-4d5e-bcb2-b1563d6d60cc admitted. Original local command records preserved byte-for-byte in A-10561 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10561-t-539-original-native-local-command-records.jsonl), including query before/after, stdout/exits/native timings and source-mutation/commit identity; no reruns for transcription.

### rev-26 · 2026-10-24T08:53:47.175Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-539-final-1
commit: ede54a1984343275528b1903fbeb722713d2f553
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, A-10585; C1/C2 verified, no findings. Freshfb98df04/A-10583 native2830ordinary+10actualloadreps allpass, LinuxT1/allfallbackT2bothpackages/Web; hostchecktree reusednotremoterepeated,lint/budgetsreportonly. Sourcepredicate/order/announce/readyscheduling preserved; public/index regressions5/5each. OriginalA-10561 proves comparable3432→3403executedlandingstatements/3checks; both developmentcounts preceded experimental3000-limitfailures, explicitly notwhole-testpasses. Original10000limitrestored; laterlocal30/30 andcurrentLinux repeat3403landing/4593ten-close,3/20checks. Localrequired freshness/ready/mergegates allpass with working-tree/source-equivalent timing attribution, notexactheadLinuxT3claim. SHA/nativechunks audited; no transcriptionreruns. T3T4/QA separate; leadownsfinaldevconflictcheck.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T09:07:34.934Z

Merged 57bddc59c7aabbe1dcf3e400d9dda358639da49e onto dev.
