---
id: T-1340
kind: task
title: Telegram Bot API client on fetch with an API-root override, and a fake Bot API with a control API
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by: []
topic: topic-1091
branch: t/T-1340-telegram-bot-api-client-on-fetch-with-an
created: 2026-10-26T19:09:06.045Z
updated: 2026-10-26T19:37:43.218Z
---

## Summary

A Telegram Bot API client and a fake Bot API with a control API that plays the human. Every later Telegram ticket builds on these two.

## What to build

A client in the hub on plain `fetch` (Node 24) with hand-written types and no Telegram library. The token is validated (T-1330) and put into a URL only inside the client. HTTP timeouts are 30 s or more, and an API-root override points it at the fake, as `CLAND_DIGITALOCEAN_API` does for DigitalOcean. A fake Bot API in hub/test/fakes/ has a control API that plays the human and a stranger. It models what the prototype met: Rich Message rejections, 429 with `retry_after`, 409, a stalled long poll, membership updates and duplicate updates. Plug it into T-1331's messenger factory for `telegram`. Spec §3.7. The prototype (33bf2b2e: telegram-api.ts, discord/fake-discord.ts) may be read, never merged.

## Acceptance criteria

- [ ] C1. Against the fake Bot API, `getMe` and a send succeed through the API-root override, and a forced error, log line or artifact carries no token, shown with a made-up token (test).
- [ ] C2. The fake's control API delivers human and stranger messages, duplicate updates, a Rich Message rejection, a 429 with retry_after, a 409, a stalled poll and a membership update, each exercised by a test (test).

## Comments

### impl-1340 · 2026-10-26T19:17:52.990Z

Pre-change shared-contract consumer inventory (rule 20): searched hub/src, hub/test (all tier entries including T3/T4), nvim, web, shared, qa, docs and .agents for MessengerFactory/ConfiguredGateway/gatewayMessenger/gatewayRemotes, remote.enabled, remote.test/status and Telegram API overrides. Production: hub/src/remote/configuration.ts owns factory/reload; hub/src/hub/daemon.ts constructs gateways; gateway.ts owns optional status/test/pairingReplaced/run/stop; dispatch.ts reads those receipts; secrets.ts validates tokens; redact.ts owns project output sanitization; cli/remote.ts and cli/usage.ts consume the unchanged remote frames. Frame projections and persisted remote records stay unchanged. New Telegram API/error/types and fake control API have no previous consumers. Test/fixture consumers: hub/test/harness.ts, web/test/harness.ts; gateway.test.ts, gateway-state.test.ts, gateway-secrets.test.ts, config-set.test.ts, remote-cli.test.ts, pairing-codes.test.ts, pairing-approval.test.ts, outbox-gateway.test.ts, web-authority.test.ts, web/test/remote-via.test.ts; T1 init-config/secrets/redact coverage; T3 cli-imports/daemon/config-reload coverage. Existing explicit gatewayMessenger/gatewayRemotes injection remains authoritative; platform behavior is exercised only against a loopback fake with made-up credentials. Preserve legacy optional Remote callbacks and the previous-hub remote CLI regression. No remote API wire additions/removals, list membership, schema or credential/admission policy changes are planned. Shipped guidance consumers: hub/README.md Gateway authority/Reloading project configuration/Remote commands, docs/agents/secrets.md and test guides for config-set, gateway, gateway-secrets, remote-cli, .agents/skills/implement/SKILL.md plus CHANGES. qa/briefs and startup probes have no Telegram API client/fake consumers (search found only unrelated DigitalOcean override guidance); no new role-clause lines/permissions. The new default platform activation requires docs/help replacement of the current factory-injected-only description. Seams agreed by launch: T1 plain client ↔ loopback fake Bot API for C1/C2; T2 projectHub public remote.test/status frames for production factory activation and sanitization. Cover-quiet currently prevents executing the first red test, typecheck and builds; no runtime evidence claimed.

### impl-1340 · 2026-10-26T19:27:56.801Z

Correction to preparation note: the real loopback HTTP/fetch boundary is T2, not T1, because T1 forbids sockets. Both new files will be registered T2. The initial artifact's T1 wording is superseded by this comment and the corrected file header. Per Coordinator decision 4a4868a8-3680-475f-90f7-d0f3ad50a9ad, implementation continues during cover-quiet in alternating test-first/source commits; actual red runs will be replayed from those test commits in sealed disposable detached worktrees after release. Still no local test/typecheck/build has run.

### impl-1340 · 2026-10-26T19:37:43.218Z

Source candidate 61da27637 pushed to local origin. API/fake/native factory, test-first commit chain and help/docs/skill updates are complete as a candidate. Deferred red replay and validation plan: A-12475, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12475-t-1340-implementation-candidate-and-deferred-tdd-replay-map.md. Runtime work remains held by the Coordinator's cover-quiet decision; no local tests/typecheck/build/review/verify ran and no criteria are marked done. Fresh fetch/merge origin/dev was already up to date before publishing the candidate. Awaiting the promised release notice in topic-1091.
