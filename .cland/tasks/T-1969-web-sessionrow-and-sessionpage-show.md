---
id: T-1969
kind: task
title: Web SessionRow and SessionPage show stateReason only for live sessions, so a stopped or exited session hides its persisted state reason (such as a rename incomplete on host)
state: open
status: in progress
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
updated: 2026-11-24T10:18:55.445Z
---

## Summary

Found by impl-1672 while fixing T-1672 (2026-11-18). T-1672 persists a session's rename failure as `stateReason` ("rename incomplete on host: <cause>") for running, stopped and exited sessions, and the CLI shows it for every status. The web workbench's SessionRow and SessionPage render `stateReason` only while `row.live`, so a stopped or exited session shows only "stopped" or "died" and hides the reason.

## What to build

Show a session's persisted `stateReason` in SessionRow and SessionPage for non-live sessions as well, with the same text as the CLI, following web/AGENTS.md (tokens, contrast, no new dependency).

## Acceptance criteria

- [ ] C1. A stopped and an exited session with a stateReason show it in the row and on the session page, and a session without one is unchanged (web test).
  - failed: rev-35 [reviewer] · 2026-11-24T10:18:55.444Z · note New browser proof lacks pre-acquisition whole-case/positive-close ownership and exact non-live/status plus bounded State-value receipts.

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
