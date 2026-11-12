---
id: T-1821
kind: task
title: Neovim's Hosts row, and session rows that name their host
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1819
topic: topic-1492
branch: t/T-1821-neovim-s-hosts-row-and-session-rows-that
created: 2026-11-12T10:07:19.751Z
updated: 2026-11-12T14:04:28.712Z
---

## Summary

Neovim's sessions panel shows a Hosts row beside Remotes, one line per pool, with the same facts as the web's, red at once when its pool is alerted. `za` on the row's header expands it to the host list. A session on a host names its host on its panel row.

## What to build

The panel reads T-1819's frame into state and draws the Hosts row after the Remotes row, in that row's pattern: a dim header, one wrapped line per pool, the error highlight while the pool is alerted with the host or the failure named. The row folds as the Accounts header does: `za` on its header goes through the existing fold handler, with no new key binding. The expanded list shows each host's id, size, region, uptime, sessions, price per hour and spend today. The row is hidden when no pool is configured and no host is live. A session whose process row has a host shows the host id on its panel row and in its selected meta line; a local session shows none. The recorded protocol-frame fixtures gain the frame.

## Acceptance criteria

- [x] C1. Headless Neovim's sessions panel shows the Hosts row after Remotes with one line per pool from the hub's frame, with hosts, slots and logins per harness (test).
  - done: impl-1821 · 2026-11-12T13:52:39.453Z
- [x] C2. `za` on the Hosts header expands and folds the host list with id, size, region, uptime, sessions, price per hour and spend today (test).
  - done: impl-1821 · 2026-11-12T13:52:39.648Z
- [x] C3. A fake host made unreachable turns its pool's line red within one second and names the host, and the line is plain again on recovery (test).
  - done: impl-1821 · 2026-11-12T13:52:39.963Z
- [ ] C4. A session on a fake host names its host id on its panel row and in its selected meta line, and a local session names none (test).
  - failed: rev-36 [reviewer] · 2026-11-12T13:56:51.128Z · note At normal panel widths a provisioned host id can be fully clipped from both session row and selected meta; the wide short-id test misses it.
- [x] C5. The panel shows no Hosts row when no pool is configured, and the recorded protocol-frame fixtures include `hosts.state` (test).
  - done: impl-1821 · 2026-11-12T13:52:40.468Z

## Blocked by

- T-1819

## Notes

- Hot files: `nvim/lua/cland/panels.lua` (the sessions panel and its fold handler), `nvim/lua/cland/state.lua`, `nvim/lua/cland/hub.lua`, `nvim/lua/cland/init.lua`, `nvim/test/fixtures/protocol-frames.json`, `nvim/test/fixtures/protocol-frames/sessions.json`.
- Tests: new `nvim/test/hosts.test.ts` (headless Neovim against `projectHub` with the fake host provider and the fake transport), after `nvim/test/remotes.test.ts`.
- Serves epic C1 and C3.

## Comments

### impl-1821 · 2026-11-12T13:46:16.149Z

Consumer scope: client-only handling of existing hosts.state and process.host; no shared wire/schema/admission change. Neovim consumers: hub.lua event dispatch, init.lua reconnect/event handlers, state.lua sessions/folds, panels.lua session rows/meta/fold handler; sessions.test.ts and new hosts.test.ts use frame-fixtures via shell-fixture/stub-hub. Existing protocol/shared wire producers, web consumers and T1/T2/T3/T4 host lifecycle consumers retain unchanged shapes. Catalog consumers discovered through hub/test/nvim-frame-consumers.ts transitive graph will run after regeneration.

### impl-1821 · 2026-11-12T13:51:27.931Z

Test split: hosts.test.ts is T2 recorded-frame UI (lowest adequate tier for folds/facts/compatibility), hosts-native.test.ts is T3 projectHub + native fake provider/SSH/agent transport-loss proof; sessions.test.ts adds recorded process.host row/meta proof. No hub/agent/provider production contract changed. New native file drives changed behavior locally; Linux mode-free verify supplies T1/T2/Web and changed T3; full T3 belongs to merge batch and T4 to stage/epic.

### rev-36 · 2026-11-12T13:56:51.128Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1821-source-1
commit: c8c5f931b2ead6784ae8dd63279a13dc0b9cade0
scope: full
findings: [{"severity":"medium","text":"Keep the host identity visible at normal panel widths. The row appends it after session name/role and the selected meta appends it after harness/model/account, but both paths pass those chunks to Canvas:add, which truncates the tail. A real host-<UUID> can disappear entirely from both row and meta; the 100-column fake-host regression hides this failure. Add normal-width rendered controls with realistic provisioned ids and preserve the required host visibility through the existing row/detail layout.","file":"nvim/lua/cland/panels.lua","line":271}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review not clear: Standards 0 findings, Spec 1 medium C4 visibility finding. A-19053 records Canvas/bar fitting cause, author confirmation, remaining source scope and fixture preservation inspection. Other criteria remain runtime-unverified. Fix with realistic provisioned ids at normal widths and fresh source review before configured verification. Local/catalog/native evidence in A-19050 remains qualified supporting evidence, no reviewer execution. Full remaining T3/T4 and affected after-stage QA separate.

Criteria: C4 failed (At normal panel widths a provisioned host id can be fully clipped from both session row and selected meta; the wide short-id test misses it.).

### rev-36 · 2026-11-12T14:04:28.712Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1821-source-2
commit: 27b1c58d154aad19d946391ebaf48f7b6e9be3f3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Repaired source clear, Standards/Spec zero findings. A-19058 records C4 full-id wrapping, preserved session/detail metadata and cursor semantics, 30/40/100-column controls, and static preservation of all previous fixture records. No reviewer execution. C1–C5 final current-head verification awaits configured mode-free Linux evidence including changed hosts-native T3. Local all-catalog/native evidence retains its source/capture limits; full remaining T3/T4 and affected after-stage QA separate.
