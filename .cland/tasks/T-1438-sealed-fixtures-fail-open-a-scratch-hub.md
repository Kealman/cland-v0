---
id: T-1438
kind: task
title: "Sealed fixtures fail open: a scratch hub with a remote enabled and no loopback API root reaches the real Discord/Telegram endpoint"
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1178
branch: t/T-1438-sealed-fixtures-fail-open-a-scratch-hub
created: 2026-10-29T10:42:10.083Z
updated: 2026-10-29T12:20:59.683Z
---

## Summary

Found by T-1371 (impl-1371, topic-1176, 2026-10-29 10:41Z). `fixtureEnvironment(root, base, extra)` strips every `CLAND_*` key from `base` and keeps only what `extra` gives. A test that passes `CLAND_DISCORD_API_ROOT` in `base`, not `extra`, loses the override. The remote then falls back to its production default (`https://discord.com/api/v10` in `hub/src/remote/discord-api.ts:57`), and made-up-token REST reads may reach Discord's real endpoint. No real token was used. Rule 15 (sealed fixtures) assumes the fixture fails closed; here it fails open.

## What to build

Make sealed fixtures fail closed for every remote and provider endpoint (Discord, Telegram, ElevenLabs): when a fixture hub has no explicit loopback root, the remote targets an unroutable loopback sentinel, or refuses at start with a plain error. It must never reach the production default. Production defaults stay unchanged outside fixtures.

## Acceptance criteria

- [x] C1. A fixture hub with Discord enabled and no `CLAND_DISCORD_API_ROOT` in `extra` makes no request to a non-loopback host and reports a plain fixture error.
  - done: impl-1438 · 2026-10-29T11:58:15.023Z
  - verified: rev-31 [reviewer] · run rev-20261029-1438-final1 · 2026-10-29T12:20:59.477Z · commit ad13b4a22c451d4866f0440665009452c818c772
- [x] C2. The same holds for Telegram and the ElevenLabs speech provider.
  - done: impl-1438 · 2026-10-29T11:58:15.242Z
  - verified: rev-31 [reviewer] · run rev-20261029-1438-final1 · 2026-10-29T12:20:59.477Z · commit ad13b4a22c451d4866f0440665009452c818c772
- [x] C3. Passing the override in `base` instead of `extra` is caught by the same guard.
  - done: impl-1438 · 2026-10-29T11:58:15.446Z
  - verified: rev-31 [reviewer] · run rev-20261029-1438-final1 · 2026-10-29T12:20:59.477Z · commit ad13b4a22c451d4866f0440665009452c818c772

## Comments

### coord · 2026-10-29T10:42:29.591Z

Exposure record (impl-1371, 2026-10-29 10:42Z): before the override fix, T-1371's runs made only REST application reads with a made-up token. Setup failed before enabling Discord, so no gateway websocket and no Identify was opened. No real token or account was involved.

### impl-1438 · 2026-10-29T11:53:37.873Z

Pre-change contract inventory (rule 20): fixtureEnvironment, runnerFixtureEnvironment and hub/test/fixture-environment.ts re-export are the shared test-only environment contract (154 TypeScript consumers across hub, nvim, web and test-support). Production endpoint readers: hub/src/remote/messenger.ts -> DiscordApi/TelegramApi; hub/src/speech/provider.ts -> ElevenLabsProvider; direct DiscordApi process.env fallback. Existing explicit-extra loopback callers remain unchanged. Non-remote fixtures receive inert missing-root sentinels but never instantiate those clients. Runner children reseal environments, so roots must still be supplied in extra at each launch. No public wire/schema, persisted reader, startup probe or previous-client shape changes. Full path inventory will accompany the implementation artifact. Proposed implementation: invalid, credential-free missing-root sentinels in fixtureEnvironment only; existing client URL validation refuses before I/O. Validate explicit extras as numeric loopback HTTP roots. Base-only roots stay stripped and hit the same refusal. Production defaults stay untouched.

### impl-1438 · 2026-10-29T11:58:08.294Z

Implementation evidence: new hub/test/fixture-endpoints.test.ts (T2) covers generated cases `sealed discord refuses missing and base-only API roots before external I/O`, same for telegram/elevenlabs, `sealed endpoint extras allow only explicit numeric loopback HTTP roots`, and `sealed hub refuses enabled discord/telegram without an extra root and keeps frames available`. Constructor controls failed before the guard; frame positive controls with missing-root default removed failed while fetch interception prevented external requests. Restored guard: all six pass locally, macOS arm64, no browser. Existing setup-remotes (17), setup-remote-component (1), setup-pairing-component (3), remote-cli (23), telegram-messenger (4), discord-messenger (38), telegram-api, discord-api (26), speech (13) passed one file at a time; typecheck passed. No Linux/full-suite receipt yet. Consumer inventory: A-13666, durable .cland/artifacts/A-13666-t-1438-fixture-endpoint-consumer-paths.txt. No hub/src changes. Fixture builder alone installs missing-root sentinels and validates explicit extras. Speech reserves loopback port zero because keyless default provider construction must remain usable. Matching README/test guidance updated; no CLI/help, public wire, role clause or SKILL.md changes needed.

### rev-31 · 2026-10-29T12:02:31.808Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1438-source1
commit: d5595caaa49e30977990b156d1cb70ee78bd7dc2
scope: full
findings: [{"severity":"medium","text":"M1: per-test H1 is not exact test path; preserve test-docs guard, capture red, fix heading and retain green.","file":"docs/agents/tests/hub-test-fixture-endpoints.test.ts.md","line":1},{"severity":"medium","text":"M2: ElevenLabs negative control transcribes without pre-armed outbound-target containment/observation or owner signal/bound; sentinel regression can send externally and still satisfy transport-error regex. Guard target before native I/O, assert actual origin separately, safe mutation control and bounded joined operation.","file":"hub/test/fixture-endpoints.test.ts","line":26},{"severity":"medium","text":"M3: new hub frame cases acquire projectHub without pre-owned setup/late-hub stop/join barrier; general fallback registers after serving. Use established owner with omitted/aborted setup controls retaining root until stopped/writer receipts.","file":"hub/test/fixture-endpoints.test.ts","line":59}]
finding_counts: {"high":0,"medium":3,"low":0}

A-13672 consolidated source1 not clear, Standards3medium/Spec0; M1–M3 only. Test-only builder's missing-root sentinels/explicit-extra validation match intended approach; production defaults unchanged. Findings concern guard and contained/owned proof, not an observed live-provider call by Reviewer. Reported local macOS evidence and working corrections remain outside pinned head; C1–C3 runtime-unverified. Preserve current base and assertions; fresh pushed source review before verification. No Reviewer workload/full task run/per-item QA.

### rev-31 · 2026-10-29T12:04:29.489Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1438-source2
commit: ad13b4a22c451d4866f0440665009452c818c772
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13675 source2 clear; M1–M3 resolved, Standards0/Spec0. Exact guide H1; speech fetch guard blocks forbidden actual origins before native I/O, independent target assertion plus fixed error and bounded awaited signal; pre-owned pacingOwner acquisition/late-hub stop/frame observations and root removal barrier, four omitted/aborted controls with stopped/zero-observer/timer/no-fetch/ENOENT facts. Builder unchanged from source1, production defaults untouched, same base/no merge. Reported local10endpoint/3docs/typecheck and safe mutation remain macOS claims, not configured/Linux evidence. C1–C3 runtime-unverified. Mode-free verification may proceed at unchanged head; no full task run/per-item QA.

### impl-1438 · 2026-10-29T12:20:23.975Z

Configured verification receipt: run 1bebebc4-7046-4074-8359-3f9134627515, A-13681, exact unchanged reviewed head ad13b4a22c451d4866f0440665009452c818c772. Linux x64 droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5, Chrome Headless Shell 156.0.8078.4/Playwright 1248; lifetime 813 s, cost $0.0564. Completed T0/T1/all fallback T2/Web: 4128 pass, 0 fail/cancel/skip/todo. T3 deferred by configured batch policy; no changed T3/T4, no per-item QA. Lint and duration gates report-only; host typecheck cache at d6e748e6 not repeated on droplet, local explicit typecheck passed at reviewed tree. Original log parsed by generated test name: each ten endpoint cases has exactly one phase pass and five load-gate passes; maximum measured test duration across 60 receipts is 0.206766098 s, below the 3-second allowance threshold. Final evidence review requested from reviewer.

### rev-31 · 2026-10-29T12:20:59.477Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1438-final1
commit: ad13b4a22c451d4866f0440665009452c818c772
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13683 final original-record evidence clear; C1–C3 verified. Original A-13681/1bebebc4 independently parsed4128ordinary+90separate load passes, no nonpass/duplicates;10new endpoint identities each base+5/5 (50task samples), worst0.206766098s. Missing/base-only Discord/Telegram refusals, fixed disabled/frame/no-fetch assertions, actual loopback ElevenLabs target/error, explicit-extra/resealing and four disposal controls pass. Existing environment/docs/setup/remote/speech consumers pass at this branch base. T0/allT1/fallbackallT2/Web complete; T3/T4 absent. Linuxc-8lon1 Node24.21/Nvim0.12.5 HeadlessShell156/v1248, task2/Web4; reused host typecheck and report-onlylint/durations/one missing baseline retained. No live-platform/changed-T1371/full-all claim. Ready may follow conflict provenance; Coordinator gates/enqueue separate.

Criteria: C1 verified, C2 verified, C3 verified.
