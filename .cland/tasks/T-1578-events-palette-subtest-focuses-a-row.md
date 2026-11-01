---
id: T-1578
kind: task
title: Events palette subtest focuses a row that a late event re-renders (detached on macOS stage cover)
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
  - flaky
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1127
topic: topic-1293
branch: t/T-1578-events-palette-subtest-focuses-a-row
created: 2026-11-01T06:25:26.372Z
updated: 2026-11-01T07:46:24.353Z
closed: 2026-11-01T07:46:24.353Z
---

## Summary

`web/test/events.test.ts` › "physical s selects an Events subject in the palette and Enter opens topic, session and artifact subjects" failed on the macOS stage cover 6d153f45 at dev 6700d6a7 (A-15202, local darwin arm64, 2 workers, peak load 5.43) with `locator.focus: Timeout 3000ms exceeded`. The call log shows the `[data-event-id]` row filtered by `data-event-subject="events-worker"` resolved and was then detached from the DOM while being retried (events.test.ts:230). The Linux stage cover bdab5e3a at the same head passed. The file passed 5/5 alone on the same Mac (`node --test web/test/events.test.ts`). The test focuses a row that a later event re-renders. Same family as T-1577: a Web read races an asynchronous re-render under macOS full-run load.

## Acceptance criteria

- [x] C1. The step waits for the Events list to settle (a receipt for the last expected event, or a stable row identity) before it focuses the row, with the test's assertions unchanged.
  - done: impl-1578 · 2026-11-01T07:13:23.843Z
  - verified: rev-35 [reviewer] · run rev-35-1578-source-1 · 2026-11-01T07:14:19.510Z · commit 930a3b400bedbd2886d4852209dcfd8738765893
  - verified: rev-35 [reviewer] · run rev-35-1578-final-1 · 2026-11-01T07:36:55.446Z · commit 930a3b400bedbd2886d4852209dcfd8738765893
- [x] C2. A regression holds or replays the late event that re-renders the row, and shows the focus step still succeeds.
  - done: impl-1578 · 2026-11-01T07:13:24.647Z
  - verified: rev-35 [reviewer] · run rev-35-1578-source-1 · 2026-11-01T07:14:19.510Z · commit 930a3b400bedbd2886d4852209dcfd8738765893
  - verified: rev-35 [reviewer] · run rev-35-1578-final-1 · 2026-11-01T07:36:55.446Z · commit 930a3b400bedbd2886d4852209dcfd8738765893
- [x] C3. The file passes five sequential targeted runs on macOS with normal admission (`node --test web/test/events.test.ts` after `npm run build`, or the mode-free verify's file selection), each receipt kept; the deterministic control in C2 carries the race proof, not machine load.
  - done: impl-1578 · 2026-11-01T07:13:25.475Z
  - verified: rev-35 [reviewer] · run rev-35-1578-final-1 · 2026-11-01T07:36:55.446Z · commit 930a3b400bedbd2886d4852209dcfd8738765893

## Comments

### impl-1578 · 2026-11-01T06:27:02.216Z

Pre-change failure quoted in topic-1293 from A-15202: locator.focus Timeout 3000ms exceeded; events-worker launched row resolved then detached, events.test.ts:230. Deterministic events.list response-holding control prepared. First targeted run was refused at admission by cover-quiet f7d23abd before setup; awaiting test-slot-available, no runtime pass/fail claimed. Source points to reactivation's fresh first page replacing retained older-page rows before focus. No production contract changes.

### impl-1578 · 2026-11-01T07:13:25.722Z

Diagnosis A-15206 and five sequential macOS receipts A-15207. Retained older page was read before re-entry refresh; deterministic held action response reproduces session focus Timeout 3000ms before fix, passes after exact rendered response wait. All original assertions retained; no production changes. Final source 930a3b400bedbd2886d4852209dcfd8738765893 (tree 415658227406537a65fef944506cbfbeff2c4c2a). Five full events.test.ts runs each 12 pass/0 fail/skip/cancel/todo on darwin arm64 Node 24.21.0 isolated Headless Shell 1248 / 156.0.8078.4, normal admission, no load occasion. Build/typecheck/test:lint exit 0 (existing advisory findings remain). No full Web or T0-T4 from targeted runs. Pre-review fetch/merge origin/dev cbe02fc648 was tracker-only; merge-tree clean. QA policy none.

### rev-35 · 2026-11-01T07:14:19.510Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1578-source-1
commit: 930a3b400bedbd2886d4852209dcfd8738765893
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. Standards/Spec: no findings. Before-navigation transport observer correlates real first-page action replies, deterministically holds session re-entry refresh, proves cached row removal, then exact rendered response IDs precede presence/paging/focus. Already-open Events uses current response. Original keyboard/destination/filter/out-of-inventory assertions and bounds retained; test-only scope. C1/C2 source verified. C3 five macOS receipts in A-15207 and same-head verify need final evidence check. A-15206 controlled red/green is correctly scoped separately from full-stage load. No Reviewer tests/browser execution; QA none.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-01T07:36:55.446Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1578-final-1
commit: 930a3b400bedbd2886d4852209dcfd8738765893
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Standards/Spec: no findings. A-15234 records evidence inspection: same-head e9facacb / A-15233 exit0,4555 passes,zero fail/cancel/skip/todo; T0/T1/all fallback T2/Web complete, T3/T4 unexecuted. All12 named Events outcomes pass, including physical-s/Enter regression. Droplet Linux x64 Node24.21.0 isolated Headless Shell1248/Chrome Testing156.0.8078.4; runner tree b70cd479 separately recorded. A-15207 macos-1 through5 each have12 named passes and zero failures/cancel/skip/todo, bound to unchanged source tree41565822: sequential normal-admission Darwin arm64 targeted runs, not macOS full-stage cover. C1/C2 source/control evidence retained; C3 now verified. Budget/lint/ratchet report-only, no cache/skips. QA none; no Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-01T07:46:24.353Z

Merged 24ace2c3613c3534006f0eb3a8804f658c042aad onto dev.
