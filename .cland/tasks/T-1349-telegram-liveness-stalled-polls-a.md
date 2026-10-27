---
id: T-1349
kind: task
title: "Telegram liveness: stalled polls, a lasting 409, and a 401 or 403 that stops only this remote"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1341
topic: topic-1097
branch: t/T-1349-telegram-liveness-stalled-polls-a
created: 2026-10-26T19:09:07.935Z
updated: 2026-10-27T02:12:35.368Z
---

## Summary

Liveness and failure on Telegram: a poll that hasn't returned within its timeout plus 15 s restarts the loop, a lasting 409 shows as "another consumer of the token", and a 401 or 403 stops only this remote with the cause and the fix in General.

## What to build

Stall detection on the poll, 409 handling within T-1323's poller lease (ride out up to 60 s at start; a lasting 409 is reported and never settled by stopping another process), and 401 and 403 handling through T-1326's isolation. Spec §3.9.

## Acceptance criteria

- [x] C1. A stalled poll restarts after its timeout plus 15 s under an injected clock, and a lasting 409 shows as "another consumer of the token" in General and `cland remote status` (test).
  - done: impl-1349 · 2026-10-27T02:10:22.727Z
- [x] C2. A 401 stops only the Telegram remote with its cause and fix in General while the hub and the web edge serve on (test).
  - done: impl-1349 · 2026-10-27T02:10:22.815Z

## Comments

### impl-1349 · 2026-10-26T23:19:09.092Z

Consumer inventory before liveness/failure policy changes (rule 20): production TelegramApi.getUpdates and TelegramRemote.run/start/test/pairingReplaced; messengerFactory and daemon startup/reload; Gateway runtime/start disable path; PollerLease (inspection/CAS only, unchanged); remote.status/doctor read RemoteStore.status.reason via existing schema. Tests: telegram-api, telegram-messenger, telegram-polling, telegram-polling-restart (T3), poller-lease, gateway-state, gateway, remote-cli, config-set, gateway-secrets, project-hub-lifecycle, cli-imports. Shipped implement skill and README polling guidance, per-file test guides and future E-1309 QA fake controls consume this behavior. No wire, persisted shape or rows change; old injected clients remain compatible via optional notice callback. Existing API already aborts a 40-second stalled poll at 55 seconds; retain that regression, add explicit wording/short offline deadline coverage and 409/401/403 frame evidence. Lease never signals a token consumer.

### impl-1349 · 2026-10-26T23:24:52.155Z

Coordinator adds unchanged-config reload recovery: Gateway.needsRestart() exposes only whether its existing disabled set is nonempty; ConfiguredGateway.update drains/recreates that gateway only when enabled clients failed. Configuration-disabled messengers still have no client. Searched production, client, skill, QA, startup, persisted and all-tier test surfaces before edit: hub/src/{cli/remote.ts,hub/{daemon,dispatch,web-authority}.ts,protocol.ts,remote/{configuration,gateway,messenger,poller-lease,state,telegram-polling,telegram}.ts}; hub/test/{gateway-secrets,gateway-state,gateway,pairing-approval,poller-lease,remote-cli,remote-state,telegram-messenger,telegram-polling,web-authority}.test.ts and telegram-polling-fixture.ts; telegram-polling-restart T3 uses the existing native production path. All wire/status/store fields remain unchanged. Existing injected factories and Remote clients need no callback/shape migration. Docs: README, docs/agents/{secrets,session-permissions}.md, test guides and implement skill; no QA brief/startup probe/Neovim/Web consumer of these private class methods exists. Existing old injected-client/old-hub remote-cli regressions remain valid.

### impl-1349 · 2026-10-26T23:30:40.973Z

Source audit fixes pending consolidated verdict: preserve the frozen CLI command row (REMOTE_USAGE only), and move fixed cause/fix before bounded provider detail. For the long-description regression, extend only fake Telegram /control/fault with an optional description string. Consumer search covers telegram-api, telegram-messenger, telegram-polling, telegram-liveness, telegram-polling-restart (T3) and telegram-polling-fixture; existing fault callers omit description and retain existing fallback/echoToken semantics. Bot API documentation and future E-1309 fake QA remain compatible; no production wire/persistence change.

### rev-32 · 2026-10-26T23:31:53.915Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261026-1349-source
commit: 5f2c3cc9de7815eb33e8bf9710fb5d7de476922c
scope: full
findings: [{"severity":"medium","text":"M1: REMOTE_USAGE adds two lines without migrating its owning frozen commands.json block. cli-usage-compatibility's deepEqual and cli-help's exact-byte remote/top-level checks necessarily disagree. Update only REMOTE_USAGE's intended fixture bytes; retain both guards.","file":"hub/src/cli/usage.ts","line":67},{"severity":"medium","text":"M2: The fatal error puts provider detail before the fixed cause/fix. TelegramApi permits a 500-character sanitized description and Gateway bounds the complete reason to 500 characters again, so long 401/403 errors remove the cause and recovery command from remote.status/doctor/CLI. Put fixed guidance first and bound optional provider detail; cover long descriptions through the real factory and status/General sinks.","file":"hub/src/remote/telegram.ts","line":47},{"severity":"medium","text":"M3: f.start awaits projectHub/getMe under a frozen FakeClock before any independent setup deadline or pre-start owner for joining startup. Holding/missing getMe stalls its 35-second fake transport deadline; later within(polled) never starts and projectHub has not installed its normal teardown yet. Own setup before launch, bound readiness independently, and prove missing/aborted setup drains startup and native/hub writers before root cleanup.","file":"hub/test/telegram-liveness.test.ts","line":32}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source review: A-12517. Standards: medium M1 (usage.ts:67, owning REMOTE_USAGE frozen-byte migration omitted) and M3 (telegram-liveness.test.ts:32, fake-clock startup awaits before independent setup bound/pre-start drainage ownership). Spec: medium M2 (telegram.ts:47, long provider detail consumes Gateway's 500-character reason before fixed recovery guidance). Findings include concrete correction/control requirements. C1/C2 remain unverified; no configured runtime, tests, build, browser or provider was run by this reviewer. A-12512 remains local macOS summary evidence only. Correct and commit the replacement head, restore claimant done marks as appropriate, and request fresh source review before verification.

Criteria: C1 failed (Source review requires the frozen help migration and independently bounded owned fixture startup before configured verification.), C2 failed (Long provider descriptions truncate the fixed status cause/fix; fixture startup ownership and help bytes also need correction.).

### impl-1349 · 2026-10-27T01:08:09.321Z

After merging landed T-1343, audited the new receive/render path as a401/403 consumer. Its generic rich-rejection catch swallows auth/block errors and attempts plain fallback. This belongs to T-1349's fatal policy: rethrow401/403 into the existing #track boundary, while other rendering rejections retain fallback. New production-factory/fake rich401/403 controls will prove exactly one failed rich send, no fallback, fixed General/status cause/fix, closed poll and continued hub service. Consumers searched: TelegramRemote.receive, telegram-rendering tests and guide, README Telegram mirror section, implement renderer guidance, fake rich errors and messenger tests; no protocol/store migration.

### rev-32 · 2026-10-27T02:12:35.368Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261027-1349-source2
commit: 882073164ec48fd6af182a137478783a504da19d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full replacement source review clear: A-12553. Reviewed all 18 task-diff files against landed dev c1bbef405 plus final integration. Standards: no findings; M1 owning frozen REMOTE_USAGE bytes now match unchanged guards, M3 pre-start ownership/independent readiness and missing/aborted setup drainage controls are present. Spec: no findings; M2 fixed cause/fix comes first with long-description status/CLI/General controls; liveness, 60-second conflicts, isolated failure/reload recovery and Coordinator-authorized fatal rich-send exception remain intact. Landed pairing, renderer, native ingress/receipt and inbound recovery seams are retained. A-12552 is 66/66 serial local darwin arm64 targeted evidence, not configured Linux/full-suite evidence. C1/C2 remain unverified pending the same-head runtime receipt. Follow Coordinator decision 78e4c76c: report this clear head for its single rule 6 verify all; do not submit a duplicate mode-free run. No per-item QA brief; policy none/after-stage.
