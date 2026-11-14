---
id: T-1845
kind: task
title: The Hosts view test waits 1000 ms of real time for uptime to advance
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1506
branch: t/T-1845-the-hosts-view-test-waits-1000-ms-of
created: 2026-11-13T17:28:32.927Z
updated: 2026-11-14T08:36:42.779Z
closed: 2026-11-14T08:36:42.779Z
---

## Summary

`web/test/hosts.test.ts` "Sessions Hosts renders pushed facts and alert recovery" (desktop) waits for the Hosts row's uptime text to change, with a real-time bound of 1000 ms (`until(…, { what: 'uptime advances without a push', timeoutMs: 1000 })`). In T-1844's local mode-free verify f6402387 (log A-19208, darwin arm64, Chrome Headless Shell 1248, head 9aae88c06, no web/ change in the diff), the desktop case failed with "uptime advances without a push: not within 1000 ms" while its phone counterpart passed.

## What to build

The uptime-advance check drives the page clock (or the test's fake clock) past the next uptime tick, then asserts that the text changed, instead of waiting on wall-clock time for the page's own timer. The case then passes regardless of host load, and a stalled uptime timer still fails it.

## Acceptance criteria

- [x] C1. The uptime-advance assertion in hosts.test.ts advances a controlled clock and no longer depends on a real-time 1000 ms wait; a page whose uptime timer is stopped still fails it (test).
  - done: impl-1845 · 2026-11-14T06:25:22.518Z
  - verified: rev-36 [reviewer] · run rev-36-1845-final-1 · 2026-11-14T07:07:10.505Z · commit f8b2f8c7275ab353ad10527465e3c418b230a035
- [x] C2. The file passes five lone repetitions on macOS, desktop and phone, and the task's mode-free verify (test).
  - done: impl-1845 · 2026-11-14T06:25:24.316Z
  - verified: rev-36 [reviewer] · run rev-36-1845-final-1 · 2026-11-14T07:07:10.505Z · commit f8b2f8c7275ab353ad10527465e3c418b230a035

## Comments

### coord · 2026-11-14T06:21:46.534Z

Shared defect (hub, 2026-11-14 06:21Z): the same desktop case failed in T-1844's verify f6402387 (A-19208) and T-1852's verify 33cf40be (A-19301, only red; T0-T3 green), both 'uptime advances without a push: not within 1000 ms'. Moved into R-1530 under the human's standing yes for test-defect items (2026-10-28) as the one shared fix.

### impl-1845 · 2026-11-14T06:25:46.808Z

Implemented and pushed f8b2f8c72; source review requested. A-19304 holds slowed-timer red desktop/phone, five lone file greens, web typecheck and inventories. C2 mode-free verify remains pending source verdict. Export secret scan passed after positive control; concurrent T-1852 verify qualifies global inventory +10 in runs4–5 per Coordinator.

### rev-36 · 2026-11-14T06:29:00.300Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1845-source-1
commit: f8b2f8c7275ab353ad10527465e3c418b230a035
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, zero Standards/Spec findings. Hub/page clocks align before navigation; explicit2000ms advance precedes exact durable1h0m2s DOM receipt/final changed-text assertion,spend and other UI assertions retained. No production/shared-contract change. A-19304 desktop+phone slowed-timer reds and5 full-file greens read; A-19305 retains honest launcher/parent-vs-child completion/source-copy/hash/build/inventory limits. Post-run recorded source hashes independently match reviewed commit. Whole green parent exits1 on qualified+10 inventory despite5 child greens; no per-run/global-cleanup claim. C1/C2 final verification pending exact-head mode-free receipt. No reviewer execution or extra provenance/fullT3 run requested; QA-none,Linux unexecuted.

### rev-36 · 2026-11-14T07:07:10.505Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1845-final-1
commit: f8b2f8c7275ab353ad10527465e3c418b230a035
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards 0 / Spec 0. A-19314 independently reconciles A-19313 same-head run a38f820f: T0/T1/fallback-all-T2/Web exit 0; 6254 base test passes, 691 file passes, separate 125 load test/file passes. All four Hosts named cases and file completion pass; desktop 0.963832209s, phone 0.872669708s. C1 controlled-clock/slowed-timer red and C2 five macOS file repetitions established with A-19304/A-19305/A-19306 qualifications retained. Exact local darwin arm64 Node24.21/Neovim0.12.5 and Headless Shell1248/CfT156 provenance read. Report-only advisories retained; whole-interval +10 root growth/campaign-parent exit1 and uncaptured per-run fields remain explicit. No Linux/T3/T4/QA execution claimed; full T3 landing separate, QA none.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-14T08:36:42.779Z

Merged 4339df5716df163a2cf6edc9596be1d9d27cb961 onto dev.
