---
id: T-528
kind: task
title: "session-usage test: a coalesced Codex usage burst journals a duplicate rate-limit row (Linux)"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-495
topic: topic-393
branch: t/T-528-session-usage-test-a-coalesced-codex
created: 2026-10-15T20:01:03.365Z
updated: 2026-10-16T16:40:00.148Z
closed: 2026-10-16T16:40:00.148Z
---

## Problem

`hub/test/session-usage.test.ts:88`, 'Codex coalesces a usage burst and journals a rate-limit-only change', expected three journal rows and got four on Linux: `[[12,6],[24,6],[24,9],[24,9]]`, a duplicate `[24,9]`. This was in T-474's droplet verify fb5a0840 (A-3313). It's either the test reading two publications of one coalesced change, or the coalescer itself journalling the same change twice under load. T-495 fixed different assertions in this file.

## Acceptance criteria

- [x] C1. Determine whether the duplicate row is a test boundary or a real double journal write. If it's a product bug, the coalescer journals each distinct change once, with a regression test. Otherwise the test reads the coalesced boundary it means to observe. Record which in the commit.
  - done: impl-528 · 2026-10-16T16:15:55.676Z
  - verified: rev-31 [reviewer] · run rev-20261016-528-source · 2026-10-16T16:19:13.060Z · commit 1835e287cf9f85befc4788702648985bcaaca6a2
- [x] C2. session-usage.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-528 · 2026-10-16T16:37:54.453Z
  - verified: rev-31 [reviewer] · run rev-20261016-528-final · 2026-10-16T16:39:04.862Z · commit 1835e287cf9f85befc4788702648985bcaaca6a2

## Comments

### impl-528 · 2026-10-16T16:11:32.065Z

Cause is a test boundary/data artefact, not an identical production double write. A-3976 records a deterministic Mac replay of the exact [[12,6],[24,6],[24,9],[24,9]] failure: hold the existing fake rate-limit-read barrier across the push publication, release it and observe the next publication. The pushed [24,9] has rateLimitsByLimitId.codex, while the authoritative compatibility-only read removes that map. #recordUsage correctly treats those as different snapshots. The original test projected away the field and assumed the push/read completed within 100 ms. Correcting only this test's scripted read/push data to agree, while preserving exact row assertions and explicitly crossing the delayed-read boundary.

### impl-528 · 2026-10-16T16:16:32.755Z

Source review requested at 1835e287cf9f85befc4788702648985bcaaca6a2 (origin/dev merged, head pushed). npm run typecheck at this head from task worktree exited 0; git diff --check exit 0. Review brief A-3988 (not A-3980; that request reference was a typo). One collected whole-file Mac pass 8/8 so far, with nine remaining gated on uptime <15 per Coordinator load notice. C2 remains incomplete until all ten collected runs and droplet evidence. No per-item QA (none/after-stage).

### rev-31 · 2026-10-16T16:19:13.060Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-528-source
commit: 1835e287cf9f85befc4788702648985bcaaca6a2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards0/Spec0 findings. A-3995 records review. A-3976 exact historical projection reproduction plus source establish distinct snapshots, not identical duplicate writes: push synthesizes by-id bucket; compatibility-only authoritative read removes it; recordUsage deep-compares that map while ignoring freshness timestamp. Existing test now scripts equal compatibility/by-id data, observes push before releasing held read, then observes later freshness/map equality before retaining exact three-row journal and final usage assertions. No production edit, filtering/dedup relaxation, changed deadline, sleep or new identity. Cause in commit. Correct brief A-3988 reports typecheck/targetedgreen and initial whole-file8/8; independent ref/diffcheck confirmed. C1 verified; C2 pending completed serial Mac10file proof and post-review same-head droplet gate.

Criteria: C1 verified.

### impl-528 · 2026-10-16T16:37:59.330Z

C2 complete at unchanged source-reviewed/pushed head 1835e287cf9f85befc4788702648985bcaaca6a2. Mac proof A-4023 contains six serial whole-file node --test hub/test/session-usage.test.ts passes, all 8/8, no skips/cancellations/failures; walls 45.972s, 37.791s, 47.214s, 44.342s, 38.692s, 51.380s. One extra in-flight file's uncollected receipt is explicitly excluded. After Coordinator load notice each counted subsequent run started only with uptime <15. Coordinator decision cb4111fe-2453-403d-ae5e-56f23cb57ac8 corrects launch brief to ticket C2's 5/5; stopped waiting wrapper before run 7 with no active file interrupted. Same-head droplet verify 163867e1/A-4003 exited 0: Linux hub 30/30 (all eight session-usage cases, changed case 2.064s), Neovim smoke 12/12, total 42/42; c-8 lon1, lifetime 134s, cost $0.0093. npm run typecheck at reviewed head exited 0. No head changes after source review. Final Reviewer evidence verdict requested.

### impl-528 · 2026-10-16T16:38:49.549Z

Mac proof audit clarification: A-4025 indexes A-4023. Raw log additionally retains an initial-wrapper successful 58.699s receipt (duplicate ordinal 2), excluded from the six reported passes. The uncollected in-flight file was a subsequent file, not the second; earlier raw annotation's ordinal was mistaken. The five replacement-wrapper passes (37.791,47.214,44.342,38.692,51.380s) each have uptime <15 admission lines and alone satisfy C2's 5/5. All captured receipts are green. No head/source changes.

### rev-31 · 2026-10-16T16:39:04.862Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-528-final
commit: 1835e287cf9f85befc4788702648985bcaaca6a2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards0/Spec0 findings. A-4024 evidence analysis with receipt-index correction A-4025: raw A-4023 has an extra58.699s green block and duplicateordinal2; its early annotation was mistaken. The five replacement-wrapper runs37.791/47.214/44.342/38.692/51.380s independently each pass8of8, have preceding uptime<15, and alone meet C2; first45.972s is a sixth conservatively counted pass. No uncollected run needed or counted. Independently read Coordinatorcb4111fe correcting launch10 to ticket5. Same-head Linux163867e1/A-4003 exit0 hub30of30 plus Neovimsmoke12of12, nofail/skip. C2 verified; C1 source mark current. Origin tip unchanged. No additional run or failed-gate exception needed.

Criteria: C2 verified.

### coord · 2026-10-16T16:40:00.148Z

Merged c4527af1d15a06c5f173b61835e72db80b28c973 onto dev.
