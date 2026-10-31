---
id: T-953
kind: task
title: "Hub CPU under a session burst: reach the ≥50 % CPU target with presence/visibility batching (after T-768's statement cache)"
state: open
status: review
size: M
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1277
branch: t/T-953-hub-cpu-under-a-session-burst-reach-the
created: 2026-10-20T09:44:48.962Z
updated: 2026-10-31T15:59:49.891Z
---

## Summary

Split from T-768 at the D76 debt sweep (2026-10-20). T-768 ships a bounded statement cache with measured SQL-operation and prepare counts. Its original target, at least 50 % less hub CPU per request under a session burst, plus batching of presence and visibility updates and profiles from a copied large database, is kept here as an idea to weigh against v0.2's needs.

## Acceptance criteria

- [ ] C1. Profiles from a copied large hub database show where CPU goes after T-768, and presence/visibility batching (or another change) cuts CPU per request by at least 50 % in a quiet-machine burst measurement.

## Comments

### impl-953 · 2026-10-31T15:55:11.097Z

Contract inventory before change: only status-origin presence publication timing changes (one final presence per event-loop burst); frame fields and direct request reads remain unchanged. Consumers searched by presence frame/type, setStatus and publishPresence across hub/src, shared, web/src, nvim, hub/test, web/test, nvim/test, qa/briefs and shipped skills. Production: Core model ring/client publication + session-row scheduler, Dispatcher refreshSessionWork, Inbox refresh, visibility.frame; protocol.ts/shared/wire presence frame; web hub-state reducer and nvim shell presence handling/spoke who. Tests: presence.test.ts, session-events-component.test.ts, verifier-routing-process.test.ts, inbox-archive-workload.ts, web-area-state.test.ts, nvim shell.test.ts/shell-component.test.ts; raw socket hello consumers unaffected (hello still immediate). Existing presence tests use final-status receipts and reconnect checks. New sealed projectHub dispatcher regression retains previous unextended hello/presence shape and checks each status reply plus intervening who read in order, final presence, and publication count. Red observed: `eight status writes require one final presence publication: 8 !== 1` (Darwin arm64, local Node; 1 test failed), after correcting fixture UI vs spoke request types. No copied-live-DB or CPU measurement run; quiet slot pending.

### impl-953 · 2026-10-31T15:59:49.891Z

Draft pushed at f51535fdd420d32f8af2b48f7f702825e88c68b5; source review requested per Coordinator while quiet slot pending. Before first request fetched/merged origin/dev at e7f606b3, merge-tree clean. Follow-up tool safety fix excludes artifact rows/references with absolute recovery paths; keeps messages/topics/thread history/counters only and clears other rows. No live copy or load. A-14963 draft evidence remains applicable with this safety correction. Focused regression 1/1 green, local Darwin arm64 Node v24.21.0; typecheck/lint exit 0 before string/docs-only safety change. Synthetic tooling invocation after change completed, explicitly not C1 proof. No full suites or browser runs.
