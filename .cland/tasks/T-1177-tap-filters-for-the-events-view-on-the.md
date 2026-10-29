---
id: T-1177
kind: task
title: Tap filters for the Events view on the phone
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1184
branch: t/T-1177-tap-filters-for-the-events-view-on-the
created: 2026-10-23T07:00:15.868Z
updated: 2026-10-29T16:31:32.702Z
closed: 2026-10-29T16:31:32.702Z
---

## Summary

E-419 decided that in 0.2.0 the phone's Events view is read-only and unfiltered, newest first, because T-1127's filters are keyboard-only (`1`–`8`, `w`, `s`, `F`). This follow-up gives the phone tap filters for the same categories.

## What to build

At phone width the Events view offers its filters as tappable chips or a sheet with the same categories and counts as the desktop's keys, 44 px targets, remembered like the desktop filter.

## Acceptance criteria

- [x] C1. At 390x844 with touch, tapping a filter shows only that category's events and the choice survives a reload (Web test).
  - done: impl-1177 · 2026-10-29T15:58:53.733Z
  - verified: rev-31 [reviewer] · run rev-20261029-1177-final1 · 2026-10-29T16:20:42.711Z · commit 81c7245d94d12fb78dca2c338b29151c352bed3a

## Comments

### impl-1177 · 2026-10-29T15:57:20.666Z

Seam: existing authenticated Web fixture at 390×844 with touch, native taps and rendered event IDs compared with events.list. Existing eventsFilter/setEventsFilter, guarded cland.ui.events.v1 storage and Subjects picker are reused; no wire/schema/admission contract changes. Counts remain the existing loaded-events footer, rather than inventing global per-category totals not supplied by desktop or hub.

### rev-31 · 2026-10-29T16:01:20.572Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1177-source1
commit: b6e9af86e44ec8e7f1f2328d380b2c7b52f38630
scope: full
findings: [{"severity":"medium","text":"M1: new phone transitions wait on filter status text/absence of loading, and reload only row presence, rather than exact rendered result. Bound each on rendered IDs equal to public events.list oracle with positive nonempty controls; retain final equality/pressed/44px assertions (rule9).","file":"web/test/events.test.ts","line":104}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13740 consolidated source1 not clear, M1 only: Standards1medium/Spec0. Phone controls reuse categories/filter/storage/subject picker/footer counts; keymap/wire unchanged, actual390×844 touch test supplied. Result-receipt finding is source-identified, no Reviewer execution/flake claim. Reported local12/12/typecheck remain local; C1 runtime-unverified. Preserve base and assertions, fresh source review after focused wait correction before verification; no full task run/per-item QA.

### rev-31 · 2026-10-29T16:03:53.704Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1177-source2
commit: 81c7245d94d12fb78dca2c338b29151c352bed3a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13744 source2 delta clear; M1 resolved, Standards0/Spec0. Exact rendered-ID oracles pre-armed before taps and used after reload, all nonempty/semantic controls and final equality/pressed/44px assertions retained. Existing finite until bound; UI/CSS/key/storage/wire unchanged from source1. Independently verified Coordinator Agents5cbfcf63 all-lane shared-merge direction; merge0ba34423 brings tracker+README d36aec5a only, no other implementation. Local reported12/12/843ms/typecheck remain macOS, configured evidence absent. C1 runtime-unverified; mode-free verify may proceed unchanged then original-record final review. No full task run/per-item QA.

### rev-31 · 2026-10-29T16:20:42.711Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1177-final1
commit: 81c7245d94d12fb78dca2c338b29151c352bed3a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1 verified. Original A-13782/2454d875 names exact source2 head, terminal0, 4151 ordinary pass+50 separate load passes; T0/T1/fallback allT2/Web complete, T3/T4 absent. Exact phone case pass2.396549880s at21585, all12 Events cases/file pass. Source retains390x844 touch/taps/exact-ID nonempty oracles/reload/pressed/44px assertions. Web0 new files/0 required repetitions; no phone load-pass claim. Linux c8nyc1 Node24.21/nvim0.12.5 CHS156.0.8078.4/v1248; configured2/Web4. Host gate92aa099a reused; report-only warnings retained. Full audit A-13784; no Reviewer execution.

Criteria: C1 verified.

### coord · 2026-10-29T16:31:32.702Z

Merged c7279f62e60b55abe8c20329c0816537325b08a0 onto dev.
