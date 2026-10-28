---
id: T-1401
kind: task
title: The application checks, the fatal close codes and cland remote test discord stop only this remote with its cause and fix
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1398
topic: topic-1143
branch: t/T-1401-the-application-checks-the-fatal-close
created: 2026-10-27T23:38:46.051Z
updated: 2026-10-28T09:15:45.453Z
closed: 2026-10-28T09:15:45.453Z
---

## Summary

At start the hub checks the Message Content flag and the empty Interactions Endpoint URL. A wrong one, or a fatal close code, stops only the Discord remote with its cause and fix in General, while the hub and the Telegram remote serve on. A 4003 gets one fresh identify, and `cland remote test discord` checks the token with Discord.

## What to build

**The checks.** Before connecting, `getCurrentApplication` must show `GATEWAY_MESSAGE_CONTENT` (1<<18) or `GATEWAY_MESSAGE_CONTENT_LIMITED` (1<<19); otherwise the cause is `message-content`. The `interactions_endpoint_url` must be empty; otherwise the cause is the new `interactions-endpoint`, with the fix "clear the Interactions Endpoint URL in the application, then run cland hub reload".

**Close codes.**
- 4004 means `token`, and 4014 means `message-content`.
- 4010 to 4013 mean the new `gateway-refused`, naming the code.
- A 4003 gets exactly one fresh identify. A second 4003, or a fatal code after it, stops the remote.

**REST.** A 401, 40001 or 50014 means `token`.

**Every stop** goes through 03's stop path. It writes one General line with the cause and fix, a status row with `stopCause`, and the `cland remote status` reason. It closes the socket with 1000 and never reconnects. `cland hub reload` retries, as it does for Telegram.

**`test`.** `Remote.test` reads the application and, when the remote is paired, posts exactly one line in the channel. The fake's control can set the flags and the endpoint URL and close the socket with any code.

**Contract:** `RemoteStopCause` gains `interactions-endpoint`, `gateway-refused` and `identify-budget`; ticket 08 uses the last, so the union changes once. Consumers to migrate:
- `protocol.ts`, `shared/wire/index.ts` and `hub/test/wire-conformance.ts`;
- `notices.ts` (`STOPS` and the `remoteStopCause` guard);
- `doctor/remotes.ts` and `cli/remote.ts` (generic through `remoteStopDetails`);
- `remote-state` persistence (`stop_cause` is TEXT);
- T-1372, which owns doctor's Discord wording;
- the tests `doctor-remotes`, `remote-cli`, `remote-workbench`, `remote-state-migration` and `web-area-state`;
- `docs/agents/secrets.md` and `hub/README.md`.

The web and Neovim show only `lastError` and need no change.

Spec §3.1 (failure stays in the gateway), §3.8 (application, close codes), §3.9 (telling the human), §3.10 (`test`); research rules 2, 8 and 11.

## Acceptance criteria

- [x] C1. With the Message Content flag off on the fake, the Discord remote stops before identifying, General gets one line naming the toggle, and the Telegram remote on the same hub keeps mirroring (test).
  - done: impl-1401 · 2026-10-28T08:18:38.983Z
  - verified: rev-26 [reviewer] · run rev-20261028-1401-evidence-1 · 2026-10-28T09:04:45.471Z · commit e35d4d323e1289294066b77e2156f7ea0bdb9fc3
- [x] C2. An Interactions Endpoint URL set on the fake application stops the remote with one General line telling the human to clear it, and no identify is sent (test).
  - done: impl-1401 · 2026-10-28T08:18:39.221Z
  - verified: rev-26 [reviewer] · run rev-20261028-1401-evidence-1 · 2026-10-28T09:04:45.471Z · commit e35d4d323e1289294066b77e2156f7ea0bdb9fc3
- [x] C3. Close codes 4004, 4010, 4011, 4012, 4013 and 4014 each stop only the Discord remote with their structured cause and fix in General, the status row and `cland remote status`, and no reconnect follows (test).
  - done: impl-1401 · 2026-10-28T08:18:39.738Z
  - verified: rev-26 [reviewer] · run rev-20261028-1401-evidence-1 · 2026-10-28T09:04:45.471Z · commit e35d4d323e1289294066b77e2156f7ea0bdb9fc3
- [x] C4. A 4003 is followed by exactly one fresh identify, and a second 4003 stops the remote (test).
  - done: impl-1401 · 2026-10-28T08:18:39.943Z
  - verified: rev-26 [reviewer] · run rev-20261028-1401-evidence-1 · 2026-10-28T09:04:45.472Z · commit e35d4d323e1289294066b77e2156f7ea0bdb9fc3
- [x] C5. A REST 401 stops the remote with the `token` cause, and `cland remote test discord` reads the application and posts exactly one line in the paired channel (test).
  - done: impl-1401 · 2026-10-28T08:29:45.562Z
  - verified: rev-26 [reviewer] · run rev-20261028-1401-evidence-1 · 2026-10-28T09:04:45.472Z · commit e35d4d323e1289294066b77e2156f7ea0bdb9fc3

## Notes

Shared files: discord.ts, discord-socket.ts, hub/src/remote/notices.ts, hub/src/protocol.ts, shared/wire/index.ts, hub/test/wire-conformance.ts

## Comments

### impl-1401 · 2026-10-28T08:12:46.916Z

Rule 20 consumer inventory (search across production, clients, skills, QA, probes and all test tiers): RemoteStopCause declarations protocol.ts/shared/wire/index.ts + wire-conformance.ts require additive union/guard changes; notices.ts owns exhaustive guard and wording. gateway.ts, state.ts persistence (TEXT), daemon.ts projections, cli/remote.ts and doctor/remotes.ts pass causes through or use shared wording, so unchanged shapes. Telegram keeps existing causes. Tests doctor-remotes, remote-cli (including legacy-remote-hub previous-wire regression), remote-workbench, remote-state-migration, web-area-state and telegram-liveness retain old cases unchanged; new Discord frame regressions cover added values. web/ and nvim/ consume lastError, no union switch. No other QA/startup consumer found. docs/agents/secrets.md, hub/README.md and implement skill describe flow and will update. T-1372 owns later Discord doctor wording. No wire fields removed.

### impl-1401 · 2026-10-28T08:18:00.942Z

TDD receipts (local macOS, Node 24.21.0, production frame + loopback fake, no browser): message-content and interactions-endpoint controls first failed waiting for disabled status; fatal 4004 first failed stopCause undefined vs token; second 4003 first failed waiting for second Identify; CLI test first failed messenger test unavailable and REST auth cause undefined. After implementation all 20 discord-messenger cases pass locally, including each fatal numeric code, Telegram continued mirroring, CLI status/test and 401/40001/50014 redaction. Full typecheck passed before final help/socket cleanup; final rerun in progress. REST observer additive internal API onError has optional numeric channel metadata, coordinated with T-1404. Existing old-wire CLI tests stay unchanged.

### rev-26 · 2026-10-28T08:26:14.152Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1401-source-1
commit: 6ad71a1c9ebd475b4dac1ab7806a43df67537243
scope: full
findings: [{"severity":"medium","text":"M1 Standards — REMOTE_USAGE changed in usage.ts, but its frozen compatibility row was not migrated. The unchanged compatibility/full-help guards therefore reject this source head. Update only the owning row and retain original red/green outputs.","file":"hub/test/fixtures/cli-usage/commands.json"},{"severity":"medium","text":"M2 Standards — the credential-refusal case was renamed/parameterized but retains an unmatched old exact-name duration key (0.23559). Migrate the retained case's key preserving numeric values, totals and allowances; do not invent samples for new cases.","file":"hub/test/durations.json","line":8033},{"severity":"medium","text":"M3 Spec — pairingReplaced propagates the raw authentication DiscordError after the API observer starts a detached structured terminal stop. Gateway disables on that raw rejection and replaces the persisted token cause/fix with an unstructured reason; its stop also races the pending graceful close with terminate. Normalize outward authentication failures and own/join one terminal stop; cover replacement-notification 401 with held native close and final persisted/status/CLI cause+fix.","file":"hub/src/remote/discord.ts","line":139}]
finding_counts: {"high":0,"medium":3,"low":0}

A-13128 records the full source audit. Standards M1/M2 and Spec M3 remain. No runtime criteria verified. Correct all findings, retain actual red/green receipts and request new source review at the corrected pushed head before verification; keep the reviewed head free of dev merges.

Criteria: C5 failed (The all-REST authentication stop path can lose token stopCause/cause+fix through pairingReplaced's raw rejection and race graceful close.).

### rev-26 · 2026-10-28T08:29:39.472Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1401-source-2
commit: e35d4d323e1289294066b77e2156f7ea0bdb9fc3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13130: full source2 clear, Standards/Spec zero findings. M1 owning frozen row, M2 exact preserved duration baseline and M3 normalized auth propagation/shared terminal close are corrected. Runtime C1–C5 remain unverified; restore C5 claimant done after source1 failed mark. One mode-free configured verification may proceed at this unchanged head, followed by original-record evidence review.

### rev-26 · 2026-10-28T09:04:45.472Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1401-evidence-1
commit: e35d4d323e1289294066b77e2156f7ea0bdb9fc3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13160 independently audits original A-13157/c9889553: 3852 ordinary passes, 90 separate scoped load passes (65 for 13 new Discord identities), zero fail/skip/cancel/unfinished. All21 Discord base cases pass; C1–C5 freshly verified. T0/T1/all-T2 fallback/Web completed; T3/T4 unrun. A-13145 remains red, T-1419 and independently checked five isolated controls/A-13147 plus Coordinator-authorized same-head retry retained. Runtime provenance, host typecheck reuse and report-only diagnostics recorded. Coordinator explicitly still owes separate verify all at frozen head before enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-28T09:15:45.453Z

Merged 643971a7ea0b4b14c95babeb5dd7ce1c3c3d7e96 onto dev.
