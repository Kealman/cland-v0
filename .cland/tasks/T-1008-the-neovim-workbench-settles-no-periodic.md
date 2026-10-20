---
id: T-1008
kind: task
title: "The Neovim workbench settles: no periodic full re-reads"
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1006
blocked_by: []
topic: topic-756
branch: t/T-1008-the-neovim-workbench-settles-no-periodic
created: 2026-10-20T17:01:24.864Z
updated: 2026-10-20T17:35:50.610Z
closed: 2026-10-20T17:35:50.610Z
---

## Summary

The Neovim workbench settles after startup. Today it re-reads `hub.status`, `task.list`, `topic.history`, `events.list`, `session.list`, `artifact.list`, `rule.list` and `account.list` about every 30 s and never settles. Its header shows "no coordinator" and "sessions 0" until every read finishes.

## What to build

- Find what drives the 30 s full re-read: a timer, an event storm (for example tracker events caused by `.conflict` capture writes), or a failed read that retries everything. Name it with evidence in the item topic.
- After startup, apply hub events (`task`, `session`, `topic`, `message`, `event` frames) to the local state. Re-read only the object an event names, never the whole list.
- Startup reads run independently. The header shows the Coordinator and the sessions as soon as `session.list` answers, without waiting for `task.list`.
- A reconnect re-reads once, then settles.

## Acceptance criteria

- [x] C1. The cause of the 30 s re-read loop is named in the item topic with evidence from a run against a copy of the live tracker (local evidence).
  - done: impl-1008 · 2026-10-20T17:12:25.654Z
  - verified: rev-31 [reviewer] · run rev-20261020-1008-source · 2026-10-20T17:14:18.252Z · commit 74c427fcb0dbad0827e051857cc499cfcbcfec70
  - verified: rev-31 [reviewer] · run rev-20261020-1008-final · 2026-10-20T17:25:19.151Z · commit 74c427fcb0dbad0827e051857cc499cfcbcfec70
- [x] C2. After startup, with a fake clock advanced 10 minutes and no hub change, Neovim sends none of `task.list`, `topic.history`, `events.list`, `session.list`, `artifact.list`, `rule.list` or `account.list` (test counting frames).
  - done: impl-1008 · 2026-10-20T17:12:26.638Z
  - verified: rev-31 [reviewer] · run rev-20261020-1008-final · 2026-10-20T17:25:19.151Z · commit 74c427fcb0dbad0827e051857cc499cfcbcfec70
- [x] C3. A `task` event updates the explorer's row without a full `task.list` (test).
  - done: impl-1008 · 2026-10-20T17:12:27.562Z
  - verified: rev-31 [reviewer] · run rev-20261020-1008-final · 2026-10-20T17:25:19.151Z · commit 74c427fcb0dbad0827e051857cc499cfcbcfec70
- [x] C4. With `task.list` delayed, the header shows the Coordinator and the session count as soon as `session.list` answers (test).
  - done: impl-1008 · 2026-10-20T17:12:28.487Z
  - verified: rev-31 [reviewer] · run rev-20261020-1008-final · 2026-10-20T17:25:19.151Z · commit 74c427fcb0dbad0827e051857cc499cfcbcfec70
- [x] C5. A reconnect re-reads each list once and then sends no further full reads (test).
  - done: impl-1008 · 2026-10-20T17:12:29.359Z
  - verified: rev-31 [reviewer] · run rev-20261020-1008-final · 2026-10-20T17:25:19.151Z · commit 74c427fcb0dbad0827e051857cc499cfcbcfec70
- [x] C6. `nvim/README.md` describes what the workbench reads at startup and how it stays current.
  - done: impl-1008 · 2026-10-20T17:12:30.240Z
  - verified: rev-31 [reviewer] · run rev-20261020-1008-source · 2026-10-20T17:14:18.252Z · commit 74c427fcb0dbad0827e051857cc499cfcbcfec70
  - verified: rev-31 [reviewer] · run rev-20261020-1008-final · 2026-10-20T17:25:19.151Z · commit 74c427fcb0dbad0827e051857cc499cfcbcfec70

## Comments

### impl-1008 · 2026-10-20T17:12:08.999Z

Diagnosis accepted by Coordinator in topic-756, A-7751 (controlled-delay copied tracker red/green; quiet-copy baseline explicitly lacks crew/churn). Fix preserves the oldest late reply plus newest retry with independent bounded event journals, exponential missing-read backoff 30/60/120/240/300 s, and single completion. No init.lua fetch-shape change. Added frame-counting T2 cases for ten fake idle minutes, task row events, delayed items/header independence and reconnect; documented startup reads and retries. Local Darwin arm64 working tree: 60/60 shell-component tests and 7/7 T1 fixture-boundary tests passed; typecheck and lint passed. These are targeted local results, not queued verification or a final gate verdict.

### rev-31 · 2026-10-20T17:14:18.252Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-1008-source
commit: 74c427fcb0dbad0827e051857cc499cfcbcfec70
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7771: full source clear. C1 diagnosis and controlled-delay copy boundary accepted by primary Coordinator d7c5880d; C6 matching docs checked. Oldest/newest bounded attempts retain late replies, missing reads alone back off, and completion/disconnect release sibling state. C2–C5 runtime marks remain pending original targeted receipt audit and exact-head mode-free verification with new-identity 5/5. No T-1007 fetch-shape change or live-load reproduction claim.

Criteria: C1 verified, C6 verified.

### rev-31 · 2026-10-20T17:25:19.151Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-1008-final
commit: 74c427fcb0dbad0827e051857cc499cfcbcfec70
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged reviewed head 74c427fcb0dbad0827e051857cc499cfcbcfec70. A-7793 records the full audit: A-7783 run 113082c8-ca65-40e1-a915-6929eb87c2bd has host check/T1/full fallback T2 exit 0, 2066 ordinary passes plus 20 load repetitions, no failures/cancellations/skips, and distinct actual 5/5 receipts for all four new identities. All 60 owned shell cases and the new repetitions fit T2 budgets. A-7768 retains qualified original diagnosis/red-green/focused checks; controlled fake-time settling/reconnect evidence is not a real ten-minute live-load benchmark. Coordinator accepted the bounded C1 diagnosis; original live-hub latency source remains separate. No T3/T4 execution claimed. An unchanged T-963 thread case has a report-only 2.207 s >2 s row, separately routed as S Follow-ups under E-880; no owned findings. C1–C6 claimant done marks audited. No merge enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-20T17:35:50.610Z

Merged 059fd4519855f3225acf0f89bc93d88878a4e2c4 onto dev.
