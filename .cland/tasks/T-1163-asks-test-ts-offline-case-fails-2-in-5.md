---
id: T-1163
kind: task
title: "asks.test.ts offline case fails 2 in 5 alone: reconnect waits on more fake time than runFor(250)"
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1122
topic: topic-891
branch: t/T-1163-asks-test-ts-offline-case-fails-2-in-5
created: 2026-10-23T03:59:05.507Z
updated: 2026-10-23T04:20:42.739Z
closed: 2026-10-23T04:20:42.739Z
---

## Summary

web/test/asks.test.ts › "offline asks disable writes and a fresh snapshot recovers an answer without replaying a draft" (T-1122, landed 269ea26f) failed T-1094's verify all 07b1f675 (A-9808, Linux) with `pageUntil "fresh epoch live"` timing out at 3 s, and fails 2 of 5 targeted runs alone on dev (macOS, 2026-10-23 ~04:00Z). The test advances the page's fake clock once by 250 ms and then waits up to 3 s of real time for the connection to read Live; when the reconnect backoff needs more fake time than that, it never arrives.

## What to build

The case advances the fake clock until the hub connection reads Live (bounded by a fake-time ceiling), or drives the reconnect deterministically, so the reconnect no longer depends on one fixed 250 ms step; every existing assertion stays.

## Acceptance criteria

- [x] C1. The offline ask case passes 20 of 20 targeted runs alone and 10 of 10 under two CPU-load loops on macOS, with its assertions unchanged (test).
  - done: impl-1163 · 2026-10-23T04:08:00.124Z
  - verified: rev-23 [reviewer] · run rev-20261023-1163-final · 2026-10-23T04:16:05.397Z · commit d03507dadfc632f4c12660881d3e35fecd1b92bd
- [x] C2. The reconnect wait in the case is driven by fake-clock advancement bounded in fake time, not one fixed step followed by a real-time wait (test).
  - done: impl-1163 · 2026-10-23T04:08:00.341Z
  - verified: rev-23 [reviewer] · run rev-20261023-1163-source · 2026-10-23T04:09:57.946Z · commit d03507dadfc632f4c12660881d3e35fecd1b92bd
  - verified: rev-23 [reviewer] · run rev-20261023-1163-final · 2026-10-23T04:16:05.397Z · commit d03507dadfc632f4c12660881d3e35fecd1b92bd
- [x] C3. The "In Inbox from a secondary thread opens and focuses that pane list while the primary thread keeps its ask" case waits for a rendered focus receipt before asserting focus, and passes 20/20 alone and 10/10 under two CPU-load loops (test).
  - done: impl-1163 · 2026-10-23T04:08:00.474Z
  - verified: rev-23 [reviewer] · run rev-20261023-1163-final · 2026-10-23T04:16:05.397Z · commit d03507dadfc632f4c12660881d3e35fecd1b92bd

## Comments

### impl-1163 · 2026-10-23T04:01:12.734Z

Baseline e327baef: linked root node_modules and rebuilt bundle. Read asks.test.ts, pageUntil/clock fixture and connection.ts: product backoff is documented 250ms doubling to 10s, no jitter. 20/20 unchanged isolated macOS targeted runs passed; continuing unchanged reproduction under two owned CPU loops after local queue holder:null.

### impl-1163 · 2026-10-23T04:07:24.397Z

C3 full-file red at a20af3e1: unchanged secondary-thread focus assertion false !== true (A-9811). Focus-event probe observed immediateFocus:false followed by exactly one move link→secondary ask; Shell.tsx schedules it with requestAnimationFrame. d03507da adds only a bounded exact destination===activeElement wait armed before click, retaining the final assertion. C3 now 20/20 alone and 10/10 under exactly two owned yes loops on macOS local; both loops exited. Repeating C1 at final head and whole file before review. Reconnect red/green and earlier C1 evidence: A-9812.

### impl-1163 · 2026-10-23T04:08:15.232Z

Final d03507da source validation complete: C1 and C3 each 20/20 alone + 10/10 under two yes loops, macOS local Headless Shell; loops killed and exit observed. Whole asks.test.ts 9/9. Web workspace typecheck passed. Criteria C1–C3 done. Review requested from Reviewer at pushed head. Evidence A-9813: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9813-t-1163-final-c1-c3-source-validation.md. Mode-free verification pending source clear.

### rev-23 · 2026-10-23T04:09:57.946Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1163-source
commit: d03507dadfc632f4c12660881d3e35fecd1b92bd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings; C2 verified. A-9817: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9817-t-1163-bounded-reconnect-and-focus-source-clear-at-d03507da.md. Only asks.test.ts changes: actual rendered Live drives250ms fake steps under15000ms ceiling, final assertion retained; exact secondary destination focus wait arms before click, retains finalfocus/duplicate/option-delivery assertions. No product changes. Parsed A-9813 required60 local targeted passes plus whole9/9 and typecheck are valid supporting evidence; natural reconnect flake was not reproduced, removed failed-retry probe red/green is qualified separately. Proceed with mode-free exact-head verification; C1/C3 final evidence settlement awaits receipt. No QA required.

Criteria: C2 verified.

### rev-23 · 2026-10-23T04:16:05.397Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1163-final
commit: d03507dadfc632f4c12660881d3e35fecd1b92bd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear C1–C3, no findings. A-9820 records evidence audit of A-9818/dee76f15 and A-9813. Exact-head Linux x64 c-8 lon1: 915 ordinary test passes, T1 + Web; empty web-only T2 compatibility phase is not hub/Neovim T2 coverage. Host check reused, no T3/T4, generic budget/lint/ratchet report-only. Each affected identity separately has 20/20 alone + 10/10 under two CPU loops on macOS at this head; accepted bounded fake-clock and pre-trigger focus observer retain original assertions. No inferred natural flake frequency or remote load proof. Source A-9817 stands; after-stage QA separate.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-23T04:20:42.739Z

Merged ed49f6fd78b1d0014759bc299af45a7248c1fc02 onto dev.
