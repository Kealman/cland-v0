---
id: T-1323
kind: task
title: Remote state lives in hub.db with TEXT ids, and a poller lease keeps one gateway per project
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by:
  - T-1321
topic: topic-1077
branch: t/T-1323-remote-state-lives-in-hub-db-with-text
created: 2026-10-26T02:28:46.856Z
updated: 2026-10-26T03:57:08.423Z
---

## Summary

A remote's state lives in `hub.db`, with no separate file: pairings, waiting codes and per-stranger reply counts, cursors, the poller lease, Discord's identify count, the outbox tables and the map from chat messages to cland messages, topics and asks. One gateway per project consumes a token, enforced by a lease.

## What to build

Store migrations add the remote tables. Discord ids are stored as TEXT, since they exceed JavaScript's safe integers and `node:sqlite` reads 64-bit integers back lossily. The poller lease records the pid and start time. A gateway that meets a held lease at start waits for it for up to 60 seconds and kills nothing; reuse the hub's precise process identity (T-543) for the liveness check. Spec §3.1 and §3.9.

## Acceptance criteria

- [ ] C1. Remote state written before a hub restart reads back unchanged after it, a chat id above 2^53 included, with no state file outside `hub.db` (test).
- [ ] C2. A second gateway on the same `hub.db` waits on the held lease for up to 60 seconds, signals and stops nothing, and takes the lease once it is released or its holder is provably dead (test).

## Comments

### impl-1323 · 2026-10-26T03:43:46.593Z

Pre-change consumer inventory (rule 20): new Gateway() callers are hub/src/hub/daemon.ts (normal and stdio startup) and hub/test/gateway.test.ts (direct held-start regression). gatewayRemotes flows through hub/test/harness.ts ProjectHubOptions into serveProject. Remote.start(send), existing frame replies/snapshots/lists and the protocol authority table remain unchanged; messenger.ts and all production/UI clients retain the previous wire shape, exercised by gateway.test.ts. Storage readers are Store and its store.test.ts/openDatabase injection consumers; remote tables are additive on the same handle, with no dropped/retyped columns or separate state file. No shipped remote persisted-record consumer yet exists outside the gateway (prototype branch is not shipped). Docs/skill consumers: hub/README.md gateway section, docs/agents/tests/hub-test-gateway.test.ts.md and .agents/skills/implement/SKILL.md. QA briefs, startup probes, T3/T4, nvim, web and shared wire have no gateway constructor or remote table readers; existing old-hello regression stays. Planned additions: RemoteState/RemoteStore on Store.remotes, typed TEXT identity columns, extensible outbox/attempt tables, singleton owner-UUID poller lease with pid/start/native birth identity, and optional injected acquire/release Gateway lease port. Lease uses fake time/process facts in T1 and projectHub frame receipts in T2; no real platform/token or native harness.

### impl-1323 · 2026-10-26T03:57:08.423Z

Consumer inventory and red/green provenance published as A-12264 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12264-t-1323-storage-and-gateway-consumer-inventory.md). All independent implementation/docs are prepared; root typecheck and closed-item wording lint pass on local macOS arm64 Node 24.21.0. First source review is deliberately held under Coordinator decision 4bd6a555 until T-1326 lands and I am told to merge dev, wire Store.remotes as its state sink, and make the prepared 60s daemon-conflict regression green. No full-suite/Linux/browser evidence is claimed.
