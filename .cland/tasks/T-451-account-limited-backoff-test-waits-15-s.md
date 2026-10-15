---
id: T-451
kind: task
title: account-limited backoff test waits 15 s for a reset its own assertion requires at 16 s or later
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-271
branch: t/T-451-account-limited-backoff-test-waits-15-s
created: 2026-10-15T04:36:56.217Z
updated: 2026-10-15T05:49:54.332Z
closed: 2026-10-15T05:49:54.332Z
---

## Summary

`hub/test/account-limited.test.ts:236` ('after-hit read waits for a recent failed poll backoff and duplicate hits share it') waits with `eventually()`'s default of 15,000 ms for the deferred poll's reset (line 261). Its final assertion requires the failed-poll delay to be at least 16,000 ms (minimum 6,000, floor 8,000). The wait is shorter than the behaviour it asserts, so the case races itself: it failed in T-254's gate 938db829 (A-2679), and once in four runs alone at 871876cc (A-2684; A-2681 to A-2683 green, at 17.3–17.6 s). This is a shared fix, which blocks T-254 and the release.

## What to fix

Give that wait a bound derived from the asserted delay, the backoff plus a margin, rather than the 15 s default. Better still, drive the backoff from a test timing knob (T-389's pattern) so the case no longer waits on real clocks. Keep the assertion's meaning: the read waits for the backoff, and duplicate hits share it.

## Acceptance criteria

- [x] C1. The case's wait is bounded by the backoff it asserts, or the backoff runs on a test timing knob, and the assertion is unchanged in meaning.
  - done: impl-451 · 2026-10-15T04:56:12.147Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-451-1 · 2026-10-15T04:57:02.366Z · commit a9d9d6dd0616944bc6997f6a8ce9e034e29778d1
  - verified: rev-23 [reviewer] · run rev-2026-10-15-451-2 · 2026-10-15T05:49:38.165Z · commit a9d9d6dd0616944bc6997f6a8ce9e034e29778d1
- [x] C2. The file passes 10/10 whole-file runs serially.
  - done: impl-451 · 2026-10-15T04:56:13.299Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-451-2 · 2026-10-15T05:49:38.165Z · commit a9d9d6dd0616944bc6997f6a8ce9e034e29778d1

## Comments

### impl-451 · 2026-10-15T04:37:47.428Z

Confirmed A-2679 and A-2684 both fail at deferred poll supplies reset: not within 15000 ms. AccountPoller uses floor × 2 after the first failure (8000 × 2 = 16000 ms); the test asserts that same lower bound. Existing failure artifacts cover reproduction, so no extra flaky baseline run is needed. Plan: share the asserted delay with an explicit eventually bound plus 5000 ms margin, retaining all no-early-read and duplicate-hit assertions. T-440 timing cleanup stays out of scope.

### impl-451 · 2026-10-15T04:56:26.052Z

Implemented and pushed a9d9d6dd0616944bc6997f6a8ce9e034e29778d1 on t/T-451-account-limited-backoff-test-waits-15-s after merging origin/dev 1e4afd9a. Test-only diff: shared 16000/12000 ms asserted delay, eventually bound = that delay + 5000 ms; no assertion semantics changed. Validation: 10/10 serial whole-file runs passed before dev refresh, plus one complete run on refreshed source (10 tests each, 110 passes total). Evidence A-2687 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2687-t-451-ten-serial-whole-file-passes-plus-post-dev-merge-check.md. Queue checked before each run, no coord holder. QA policy none; requesting source review before hub verification.

### rev-23 · 2026-10-15T04:57:02.366Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-451-1
commit: a9d9d6dd0616944bc6997f6a8ce9e034e29778d1
scope: full

Source clear. Standards and Spec: no high or medium findings. One test-only +4/-2 change shares unchanged 16000/12000 ms minimum assertion with explicit wait bound +5000 ms. The failed-poll 8000 ms floor doubles to 16000 ms, exceeding the former 15000 ms default; C1 is established without weakening no-early-read, duplicate single-poll, reset, notice, bounded-refresh or restart assertions. A-2687 independently checked: ten serial whole-file logs each 10/10, no failures/cancellations/skips, plus post-dev-merge 10/10. First ten are labelled on pre-refresh d6b17be4 with the same candidate patch; extra validates incoming dev 1e4afd9a, whose underlying test blob is unchanged. C2 supporting evidence retained for final review after exact-head local no-mode gate; no claim of ten exact-final-head runs. A-2688 details review. Original red A-2679/A-2684 retained; no flaky retry substitutes for correction. Submit no-mode --executor local at a9d9d6dd.

Criteria: C1 verified.

### rev-23 · 2026-10-15T05:49:38.165Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-451-2
commit: a9d9d6dd0616944bc6997f6a8ce9e034e29778d1
scope: evidence

Final clear at unchanged source-reviewed a9d9d6dd. Standards and Spec: no high or medium findings. C1 unchanged 16 s/12 s no-early-read floor and duplicate-hit assertions remain; completion bound includes 5 s margin. C2 audited A-2687 ten serial whole-file runs each 10/10, zero failures/skips/cancellations, plus post-dev-merge 10/10. Ten use the same candidate patch before incoming dev refresh; final-source supplementary run and unchanged underlying test blob establish integration provenance, not ten exact-final-head runs. Exact-head local no-mode 9ffc648c/A-2695 selects hub-only: root typecheck and 1712/1712 pass (37 free hub, 1663 machine hub, 12 Neovim smoke), zero failures/skips/cancellations/todos, exit 0. Both affected cases pass. Full Neovim not selected or claimed. Both done marks and branch/log/tracker head checked. A-2696 details evidence; original T-254 reds A-2679/A-2684 retained as corrected shared defect. C1/C2 verified.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-15T05:49:54.332Z

Merged fe4efed83f13f5a9b4fb47e420fe39153624ceff onto dev.
