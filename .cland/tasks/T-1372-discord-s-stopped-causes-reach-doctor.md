---
id: T-1372
kind: task
title: Discord's stopped causes reach doctor, and Discord shows in both workbenches
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1361
  - T-1362
  - T-1363
  - T-1364
  - T-1368
  - E-1312
topic: topic-1175
branch: t/T-1372-discord-s-stopped-causes-reach-doctor
created: 2026-10-27T05:46:51.767Z
updated: 2026-10-29T11:01:32.991Z
---

## Summary

The fake Discord gateway's 4004 and 4014 closes give doctor's lines and fixes. A Discord outage turns its Remotes row red in both workbenches. Messages, approvals, voice messages and pairing codes from Discord read with their marks and rows in Neovim and the web.

## What to build

Spec §3.11, §3.8 (close codes) and §3.2. E-1312's fatal closes record 01's structured causes (4004 → `token`, 4014 → `message-content`), and Discord's liveness feeds 02's offline transition. Doctor's Discord block also shows the paired guild, channel and user ids. Everything else is end-to-end checking of 02, 03, 04 and T-1322 through the fake Discord gateway and REST. The docs page's doctor table gains the Discord causes.

**External wait and shared files:** E-1312 (its voice messages also need E-1311) · **Shared files:** hub/src/remote/ (the Discord stop cause mapping), the remote-control docs page

## Acceptance criteria

- [x] C1. A 4004 and a 4014 close on the fake Discord gateway each give doctor's line with its fix (a new token; the Message Content toggle), and the fake records no request during the doctor run (test).
  - done: impl-1372 · 2026-10-29T10:43:59.387Z
- [x] C2. A fake Discord outage turns the Discord Remotes row red in headless Neovim and headless Chromium within one second, and recovery clears it (test).
  - done: impl-1372 · 2026-10-29T10:43:59.609Z
- [x] C3. A message, a voice message and a card approval from the fake Discord read "via Discord" (the voice message with its 🎤 mark) in both workbenches, and a waiting `/cland pair` code shows as a pairing row in both inboxes (test).
  - done: impl-1372 · 2026-10-29T10:44:01.764Z
- [x] C4. The docs page's doctor causes name 4004 and 4014 with their fixes, and the page passes the docs check (test).
  - done: impl-1372 · 2026-10-29T10:44:01.993Z

---

## Comments

### impl-1372 · 2026-10-29T10:38:40.071Z

Plan: use pre-agreed seams (production frames + fake Discord REST/gateway; headless Chromium and Neovim). Existing structured doctor causes and generic workbench rendering are present; inspect native-path coverage and add Discord regressions. No wire/schema/authority changes planned. Shared-contract consumer inventory will be recorded before any such change. Skill files frozen: propose workflow guidance in topic instead.

### impl-1372 · 2026-10-29T10:41:39.774Z

C2 red receipt: Neovim renders 'discord · offline' but never 'offline since'; native Discord status omits the existing optional offlineSince and outage lastError. Consumer inventory before filling those existing fields: hub/src/hub/daemon.ts (remote UI projection); web/src/sessions/RemotesLine.tsx; nvim/lua/cland/panels.lua (render facts/red, no migration); shared/wire/index.ts + hub/src/protocol.ts (already optional); Telegram producer unchanged. Tests: hub/test/remote-workbench.test.ts, web-area-state.test.ts, nvim/test/sessions.test.ts and protocol-frames fixture JSON (optional defaults unaffected), web/test/remotes.test.ts and nvim/test/remotes.test.ts (new native coverage); existing web previous-hub snapshot regression retained. Search included all tiers, shipped skills, qa, docs/agents and persisted consumers. No shape/removal/authority change, old omitted-field clients remain supported.

### rev-26 · 2026-10-29T10:46:48.658Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1372-source-1
commit: 656cb7fcf27fe8c5b6d8c0af1b8eac5f45971e04
scope: full
findings: [{"severity":"medium","text":"M1: hub assigned after awaited owner.run acquisition; exchange.close snapshots stop callbacks first, so cancellation can miss a late writer before Store/root drain. Pre-register shared startup/Store/observer ownership, catch/cancel/join approval/render receipts on trigger failure, add same-owner omitted/aborted setup controls with real stoppedhub/nativeclose/root-retention facts.","file":"hub/test/discord-workbench-fixture.ts","line":35}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source1 not clear: complete13-file diff fixedbase340d6ddaa/head656cb7fcf/tree58b93d567 reviewed. StandardsM1 shared fixture ownership only; no source product-behavior finding. Existing optional outage facts, numeric doctor guild/channel/user identity, native4004/4014 local-only cause/fix tests, one-second actual workbench outage/recovery and native text/voice/approval/pair rows/docs all inspected; old optional/legacy clients and text/Telegram behavior retained. A-13652 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13652-t-1372-full-source-review-1-not-clear.md). Reported local correction is outside reviewedhead. Consolidated audit complete; retain every native assertion and1s behavioralbound, shared pre-owned setup/disposal controls, then fresh exact-head source review before verification. No runtime criteria failed/verified from unrun cases, no Reviewer workload execution. A-13650 targeted local evidence not Linux/fullsuite/load proof; frozen skill proposal Coordinator-owned.

### rev-26 · 2026-10-29T10:48:07.305Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1372-source-2
commit: 86a5a30b08b85c9f6c4e175ae0100da29a5ec168
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full replacement source2 clear, sole parent656cb7fcf/treeac5897cfa; full13-file source1 carried and all3 correction diffs/shared owner inspected. M1 pre-registers pacingOwner acquisition/hubs/Store/observations and fake close before startup; same dispose gates rootremoval, joins latehubs before Store close. Readiness/approval receipt abort-aware/caught/exactid; omitted/aborted setup controls retain actual acquiredhubstopped/nativeclosed0handlers0connections0pending/closedStore/rootabsent facts. Original native4004/4014 doctornoREST/plainJSONfix/identity,1s actualNvim/Web outage/ACKrecovery/textvoiceapprovalpair and docs assertions unchanged; no product/bound/guard/default change. A-13654 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13654-t-1372-full-source-review-2-clear.md). A-13653 localdoctor16/Nvim4/Web3/typecheck not remote/Linux/load proof; no Reviewer execution/runtime criterion verification. Proceed unchanged-head configured mode-free run then original generated criterion/timing/scopedload/changedT3/Web evidence review and actual duration treatment if needed. No devmerge; frozen guidance Coordinator-owned; no per-item QA or Reviewerfullrun request.
