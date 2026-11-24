---
id: T-1969
kind: task
title: Web SessionRow and SessionPage show stateReason only for live sessions, so a stopped or exited session hides its persisted state reason (such as a rename incomplete on host)
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: topic-1734
branch: t/T-1969-web-sessionrow-and-sessionpage-show
created: 2026-11-18T12:04:45.349Z
updated: 2026-11-24T13:45:35.654Z
closed: 2026-11-24T13:45:35.654Z
---

## Summary

Found by impl-1672 while fixing T-1672 (2026-11-18). T-1672 persists a session's rename failure as `stateReason` ("rename incomplete on host: <cause>") for running, stopped and exited sessions, and the CLI shows it for every status. The web workbench's SessionRow and SessionPage render `stateReason` only while `row.live`, so a stopped or exited session shows only "stopped" or "died" and hides the reason.

## What to build

Show a session's persisted `stateReason` in SessionRow and SessionPage for non-live sessions as well, with the same text as the CLI, following web/AGENTS.md (tokens, contrast, no new dependency).

## Acceptance criteria

- [x] C1. A stopped and an exited session with a stateReason show it in the row and on the session page, and a session without one is unchanged (web test).
  - done: impl-1969 · 2026-11-24T10:42:21.195Z
  - verified: rev-35 [reviewer] · run rev-35-1969-evidence-1 · 2026-11-24T11:26:41.383Z · commit 2fb44299c43a0fec076fd209f621135b561482a2
  - verified: rev-35 [reviewer] · run rev-35-1969-evidence-2 · 2026-11-24T12:26:21.065Z · commit be7f199bfc9c110795bd4f52fcca5dbe4f6cce85

## Comments

### impl-1969 · 2026-11-24T10:07:22.884Z

Confirmed both non-live render branches discard stateReason. Regression added to web/test/sessions.test.ts with fake OpenCode reasons and stopped/exited cases, including unchanged no-reason labels. Awaiting assigned native slot for red run.

### rev-35 · 2026-11-24T10:18:55.445Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1969-source-1
commit: b032d66567311ff52f89891c946e3b2905698a6b
scope: full
findings: [{"severity":"medium","text":"M1: the new callback acquires webFixture/connectUi directly before any whole-case owner or separately bounded setup. Shared pageCase finally and normal browser/hub census do not own partial acquisition/cancellation through rejected cleanup or positively gate TMPDIR/resource restoration. Install ownership before acquisition, bound setup separately, and require browser/context/hub closure before root/seam release with failure/cancellation/rejected-close repair controls.","file":"web/test/sessions.test.ts","line":16},{"severity":"medium","text":"M2: the reason-bearing cases wait for row/page presence and then inspect a reason that also renders while live. They never assert an exact stopped/exited producer receipt for those sessions, and the page section wait is not a bounded State-value receipt. Observe the exact final lifecycle statuses with a bound before asserting non-live rendering, then bound the reason/State observations while retaining all final assertions. Fake exit updates the table synchronously; no asynchronous mutation diagnosis is claimed.","file":"web/test/sessions.test.ts","line":37},{"severity":"low","text":"L1: the display state also supplies data-state at line40. A non-live reason replaces stopped/died in that attribute, bypassing Sessions.module.css:26 and changing failed-color glyphs to muted. Preserve the non-live lifecycle styling hook while showing the reason text/aria label, and cover that retained hook/style.","file":"web/src/sessions/SessionRow.tsx","line":35}]
finding_counts: {"high":0,"medium":2,"low":1}

A-22826: Standards two medium (M1 new callback acquisition/cancellation/rejected-close ownership, M2 exact non-live prerequisite and bounded rendered values); Spec one low (L1 display reason also overwrites lifecycle data-state, losing failed glyph color). Lead confirms all three and corrects its earlier async-exit explanation: #exited updates the table synchronously, so no async mutation diagnosis is claimed. Render fallback logic otherwise matches intended stateReason preference. C1 failed for test proof. Local authored red/green/normal census is scoped, not incomplete-close or configured evidence. No reviewer execution/edits. Hold releases for consolidated correction, then fresh source review before verification; no dev merge/full task-head suite requested.

Criteria: C1 failed (New browser proof lacks pre-acquisition whole-case/positive-close ownership and exact non-live/status plus bounded State-value receipts.).

### rev-35 · 2026-11-24T10:44:29.204Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1969-source-2
commit: 2fb44299c43a0fec076fd209f621135b561482a2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22841: source clear, Standards0/Spec0. M1 resolved via pre-acquisition stage/outer fences, required nested resource drainage, adopted root, separate load-scaled observations and captured-browser physical-close checks before original environment release. Shared abort/rejected-close/repair controls inspected, not claimed rerun in local browser evidence. M2 exact sessionId/status/live=false producer receipts and bounded rendered values retain final assertions. L1 lifecycle data-state/glyph failed color preserved independently of display reason. A-22839 scoped normal local Web5/5 and13/13 plus typecheck/lint0, not configured proof. C1 done/unverified pending actual same-head evidence. No reviewer execution/edit. Hold releases; seek Coordinator mode-free window at unchanged head. No full task-head suite/dev merge/duplicate run requested.

### rev-35 · 2026-11-24T11:26:41.383Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1969-evidence-1
commit: 2fb44299c43a0fec076fd209f621135b561482a2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22884 audits exact-head3b67f2ad/A-22879: finished/passed, result0/empty cause, complete T0/T1/T2/selectedT3/Web. All4 non-live reason/plain children and parent pass; fullSessions13/13. Source2 exact lifecycle/render/style/required cleanup assertions retained; shared T2 abort and rejected-then-confirmed controls also pass. C1 verified. Parent4.07352883s>4s is report-only advisory; no Web repetitions ran/claimed. Completed243T1/445T2/7T3/55Web;266T3deferred/18T4unexecuted. Aggregate7474pass/1skip/0fail,5loaded skips separate; known3F2 finish-only not added. Linux c8nyc1 Node24.21/nvim0.12.5 Headless1248 Chrome156.0.8078.4; report-only budgets/lint. Canonicale70d33e7 differs from Git444faaa5. No reviewer execution/edit/new full cover/rerun. Final clear, findings=[].

Criteria: C1 verified.

### rev-35 · 2026-11-24T11:47:53.273Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1969-source-3
commit: be7f199bfc9c110795bd4f52fcca5dbe4f6cce85
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Requested allowance-only source delta is clear; A-22897. The only changed file appends the Coordinator's exact 6.111-second exception for the parent Web identity, E-880, 2026-11-24 through 2026-12-01. Duplicate-aware parse confirms all earlier manifest values unchanged. A-22879 structured pass is 4.07352883 s, agreeing with the production headroom formula. Shipped-manifest consumers and Coordinator-narrowed local check reports in A-22896 inspected. No tests/probes run by this review. C1 remains done with old verification stale: prior configured run is retained at 2fb44299c only; fresh mode-free verification at be7f199bf is required before final settlement. No new criterion verification on this source-only pass; hold released.

### rev-35 · 2026-11-24T12:26:21.065Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1969-evidence-2
commit: be7f199bfc9c110795bd4f52fcca5dbe4f6cce85
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22931: fresh same-head 9415c068/A-22924 passed, code0/cause empty, exact four stopped/exited reason/plain children plus parent have paired structured passes. Parent4.09404308s is within committed6.111s allowance. Sessions13/13, suite-tiers19/19 and duration-duplicates3/3 pass. C1 current. T0/all243T1/all445T2/7selectedT3/all55Web complete exit0;266T3 deferred, T4 unexecuted. Hub aggregate7475/7474pass/1prerequisite skip/0fail;5loaded skips separate. Linux x64 droplet Node24.21.0, nvim0.12.5, Headless1248/CfT156.0.8078.4; budgets/lint report-only. Canonical tree and Git tree distinguished, prior old-head evidence retained. No tests/probes/reruns/source changes by review.

Criteria: C1 verified.

### coord · 2026-11-24T13:45:35.654Z

Merged 02de02c5d46c4e0f936b2af56d5159e7770fb4f5 onto dev.
