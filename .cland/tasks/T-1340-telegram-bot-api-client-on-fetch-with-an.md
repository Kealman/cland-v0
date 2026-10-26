---
id: T-1340
kind: task
title: Telegram Bot API client on fetch with an API-root override, and a fake Bot API with a control API
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by: []
topic: topic-1091
branch: t/T-1340-telegram-bot-api-client-on-fetch-with-an
created: 2026-10-26T19:09:06.045Z
updated: 2026-10-26T21:17:24.065Z
closed: 2026-10-26T21:17:24.065Z
---

## Summary

A Telegram Bot API client and a fake Bot API with a control API that plays the human. Every later Telegram ticket builds on these two.

## What to build

A client in the hub on plain `fetch` (Node 24) with hand-written types and no Telegram library. The token is validated (T-1330) and put into a URL only inside the client. HTTP timeouts are 30 s or more, and an API-root override points it at the fake, as `CLAND_DIGITALOCEAN_API` does for DigitalOcean. A fake Bot API in hub/test/fakes/ has a control API that plays the human and a stranger. It models what the prototype met: Rich Message rejections, 429 with `retry_after`, 409, a stalled long poll, membership updates and duplicate updates. Plug it into T-1331's messenger factory for `telegram`. Spec §3.7. The prototype (33bf2b2e: telegram-api.ts, discord/fake-discord.ts) may be read, never merged.

## Acceptance criteria

- [x] C1. Against the fake Bot API, `getMe` and a send succeed through the API-root override, and a forced error, log line or artifact carries no token, shown with a made-up token (test).
  - done: impl-1340 · 2026-10-26T20:20:01.554Z
  - verified: rev-26 [reviewer] · run rev-20261026-1340-evidence-1 · 2026-10-26T20:35:54.226Z · commit f104b0372ae84719af02324f7d2999a0c4bc5c97
- [x] C2. The fake's control API delivers human and stranger messages, duplicate updates, a Rich Message rejection, a 429 with retry_after, a 409, a stalled poll and a membership update, each exercised by a test (test).
  - done: impl-1340 · 2026-10-26T20:20:02.030Z
  - verified: rev-26 [reviewer] · run rev-20261026-1340-evidence-1 · 2026-10-26T20:35:54.226Z · commit f104b0372ae84719af02324f7d2999a0c4bc5c97

## Comments

### impl-1340 · 2026-10-26T19:17:52.990Z

Pre-change shared-contract consumer inventory (rule 20): searched hub/src, hub/test (all tier entries including T3/T4), nvim, web, shared, qa, docs and .agents for MessengerFactory/ConfiguredGateway/gatewayMessenger/gatewayRemotes, remote.enabled, remote.test/status and Telegram API overrides. Production: hub/src/remote/configuration.ts owns factory/reload; hub/src/hub/daemon.ts constructs gateways; gateway.ts owns optional status/test/pairingReplaced/run/stop; dispatch.ts reads those receipts; secrets.ts validates tokens; redact.ts owns project output sanitization; cli/remote.ts and cli/usage.ts consume the unchanged remote frames. Frame projections and persisted remote records stay unchanged. New Telegram API/error/types and fake control API have no previous consumers. Test/fixture consumers: hub/test/harness.ts, web/test/harness.ts; gateway.test.ts, gateway-state.test.ts, gateway-secrets.test.ts, config-set.test.ts, remote-cli.test.ts, pairing-codes.test.ts, pairing-approval.test.ts, outbox-gateway.test.ts, web-authority.test.ts, web/test/remote-via.test.ts; T1 init-config/secrets/redact coverage; T3 cli-imports/daemon/config-reload coverage. Existing explicit gatewayMessenger/gatewayRemotes injection remains authoritative; platform behavior is exercised only against a loopback fake with made-up credentials. Preserve legacy optional Remote callbacks and the previous-hub remote CLI regression. No remote API wire additions/removals, list membership, schema or credential/admission policy changes are planned. Shipped guidance consumers: hub/README.md Gateway authority/Reloading project configuration/Remote commands, docs/agents/secrets.md and test guides for config-set, gateway, gateway-secrets, remote-cli, .agents/skills/implement/SKILL.md plus CHANGES. qa/briefs and startup probes have no Telegram API client/fake consumers (search found only unrelated DigitalOcean override guidance); no new role-clause lines/permissions. The new default platform activation requires docs/help replacement of the current factory-injected-only description. Seams agreed by launch: T1 plain client ↔ loopback fake Bot API for C1/C2; T2 projectHub public remote.test/status frames for production factory activation and sanitization. Cover-quiet currently prevents executing the first red test, typecheck and builds; no runtime evidence claimed.

### impl-1340 · 2026-10-26T19:27:56.801Z

Correction to preparation note: the real loopback HTTP/fetch boundary is T2, not T1, because T1 forbids sockets. Both new files will be registered T2. The initial artifact's T1 wording is superseded by this comment and the corrected file header. Per Coordinator decision 4a4868a8-3680-475f-90f7-d0f3ad50a9ad, implementation continues during cover-quiet in alternating test-first/source commits; actual red runs will be replayed from those test commits in sealed disposable detached worktrees after release. Still no local test/typecheck/build has run.

### impl-1340 · 2026-10-26T19:37:43.218Z

Source candidate 61da27637 pushed to local origin. API/fake/native factory, test-first commit chain and help/docs/skill updates are complete as a candidate. Deferred red replay and validation plan: A-12475, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12475-t-1340-implementation-candidate-and-deferred-tdd-replay-map.md. Runtime work remains held by the Coordinator's cover-quiet decision; no local tests/typecheck/build/review/verify ran and no criteria are marked done. Fresh fetch/merge origin/dev was already up to date before publishing the candidate. Awaiting the promised release notice in topic-1091.

### impl-1340 · 2026-10-26T20:07:47.597Z

Source review requested from Reviewer role at pushed head 914ae913755f9fbacdbccbda2dc49417abb5319f (full scope, assigned rev-26). Fresh origin/dev merge included only tracker/duration metadata; no further dev merge after this source review unless directed. C1/C2 marked done. A-12484 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12484-t-1340-local-pre-review-evidence-at-914ae9137) retains exact-head local macOS arm64/Node24.21.0 evidence: 12/12 client T2 cases 0.175s, 3/3 messenger T2 cases 0.620s, typecheck 3.181s, closed-wording guard 0.480s, tier-manifest validation 1.409s (times include producer startup/fixture cleanup, exclude worktree setup/queue). No browser or full suite/T3/T4/Linux/load-gate receipt claimed. Twelve historical red replays are A-12482; module-absent/method-absent/timeout receipts are explicitly labelled. Diagnosed and fixed global fetch keep-alive retaining TCPWRAP/Timeout; negative control removes only Connection: close and fails a bound started after request completion, before fake cleanup. Test assumptions corrected for native Journal output and isolated verification lock. Both disposable validation worktrees were removed only after producer native close receipts. Next: wait for source verdict; if clear, one mode-free verify at exact reviewed head, then evidence review.

### rev-26 · 2026-10-26T20:10:42.812Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1340-source-1
commit: 914ae913755f9fbacdbccbda2dc49417abb5319f
scope: full
findings: [{"severity":"medium","text":"M1: fake HTTP listener acquisition precedes registered cleanup; listen and close callback waits have no independent deadline/cancellation. Register ownership before bind and retain bounded native listener/connection closure with omitted/aborted setup controls. Route direct unbounded control fetch/body waits in both new files through the bounded control boundary.","file":"hub/test/fakes/telegram/fake-api.ts","line":183},{"severity":"medium","text":"M2: native start awaits getMe but cancellation occurs only in remote.stop; Gateway.stop joins #starting before invoking remote.stop, so shutdown during a held enable/reload getMe waits for the 35-second HTTP deadline. Cancel before joining and prove held startup native close/settlement without advancing to the HTTP deadline, preserving acquisition fences and drainage.","file":"hub/src/remote/telegram.ts","line":40}]
finding_counts: {"high":0,"medium":2,"low":0}

Full Standards/Spec audit at fixed base be37472b4a59d1f680c6b6011166fb01d638fdcd; exactly M1/M2, no other findings. Detailed audit, official API references and evidence limits in A-12485: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12485-t-1340-full-source-review-at-914ae9137-m1-and-m2.md. C1/C2 remain unverified pending corrections/source clearance and configured runtime evidence; their ordinary successful paths are present, no false missing-feature claim. A-12484 is targeted macOS evidence only. No Reviewer execution or delegation. Request fresh pushed-head source review before verification; Coordinator owns integration and landing.

### impl-1340 · 2026-10-26T20:11:21.473Z

Addressing consolidated source-1 findings M1/M2 from A-12485. Pre-change consumer search: fakeTelegram has 14 callers, all in hub/test/telegram-api.test.ts and hub/test/telegram-messenger.test.ts, plus its per-file guide; no production/shipped QA/startup consumer. M1 will migrate every caller to a TestContext-owned factory, register before bind, bound setup/native close/handler drainage and share bounded control requests. For M2 the Remote.start lifetime contract is consumed by Gateway, testMessenger, TelegramRemote, ConfiguredGateway/daemon, injected gateway/config/secrets/pairing/authority/outbox tests, web/test/remote-via and harnesses/guides already inventoried. An optional third AbortSignal argument will be additive: existing two-argument or zero-argument clients ignore it, preserving all previous shapes. Gateway aborts it on stop before joining startup; TelegramRemote forwards it to getMe. No frame/list/schema change and no dev merge after first source review. Both changes get fresh source review before any verification.

### rev-26 · 2026-10-26T20:21:27.384Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1340-source-2
commit: f104b0372ae84719af02324f7d2999a0c4bc5c97
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full Standards/Spec source clear, retaining A-12485 audit and inspecting every correction line; M1/M2 resolved. Pre-bind fake owner and independently bounded setup/native close/handler/control receipts retain all old assertions and add missed/aborted/EADDRINUSE controls. Optional third Remote.start lifetime signal is aborted before the startup join; native getMe composes it, with held production reload shutdown regression preserving exact close, settlement and zero-timer facts without deadline advancement. Legacy signatures, acquisition fences and failure isolation remain. Detailed A-12487: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12487-t-1340-full-source-clearance-at-f104b0372.md. No dev merge, Reviewer execution or delegation. A-12486 is targeted macOS only; C1/C2 runtime marks pending one same-head mode-free configured run.

### impl-1340 · 2026-10-26T20:22:03.454Z

Full source-2 clear at f104b0372ae84719af02324f7d2999a0c4bc5c97 (rev-20261026-1340-source-2, A-12487). Confirmed clean unchanged head and submitted one mode-free configured verify: 02c96ea6-7377-468d-985b-3ae4cec4f7eb, admitted to topic-1091, Reviewer/claimant recipients. No mode/executor/occasion override and no full-suite claim. Waiting for the hub's original execution/timing/load receipt before final evidence review; C1/C2 runtime verification still pending.

### rev-26 · 2026-10-26T20:35:54.226Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1340-evidence-1
commit: f104b0372ae84719af02324f7d2999a0c4bc5c97
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1/C2 verified from original exact-head configured run 02c96ea6-7377-468d-985b-3ae4cec4f7eb / A-12488, exit 0. Independently deduplicated 3,497 ordinary passes plus 90 distinct scoped load passes: all 14 API and four production messenger identities pass base + 5/5. Named fake controls, actual public/log/Journal/artifact sanitization, native TCP close, M1 setup-failure and M2 startup cancellation facts checked apart from exit. New-case max base 0.213088588 s/load 0.360865464 s; none >=3 s. Existing gateway/config/secret/CLI/provenance consumers pass. T0/all T1/fallback all T2/Web completed on Linux c-8 lon1, Node 24.21.0, Neovim 0.12.5, isolated Headless Shell 156.0.8078.4/v1248. No T3/T4; budgets/lint report-only; host typecheck not repeated remotely. A-12489: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12489-t-1340-final-linux-evidence-review-at-f104b0372.md. No Reviewer execution/delegation or real Telegram call. Coordinator owns integration/full-cover policy and landing.

Criteria: C1 verified, C2 verified.

### impl-1340 · 2026-10-26T20:37:19.150Z

Ready reported to Coordinator at unchanged pushed f104b0372ae84719af02324f7d2999a0c4bc5c97. Source-2 and final evidence-1 clear; C1/C2 current verified. Mode-free original run 02c96ea6-7377-468d-985b-3ae4cec4f7eb/A-12488 passed T0,T1,fallback all T2,Web (3,497 ordinary passes +90 scoped load executions; no T3/T4); evidence review A-12489 retains exact case timings, Linux/browser provenance and report-only limits. No new passing Linux case/repetition reaches3s, so no duration allowance needed. Fresh origin/dev fetch be37472b4a59d1f680c6b6011166fb01d638fdcd and merge-tree exit0/projected tree b4aad91e0428f16f57d05b75080ff0c4301f9346 prove no conflict; no source/head merge/change. Coordinator's separate rule-6 all run 450e103d is launching at this same head and is not claimed green. Keep claim/head until Coordinator enqueue/landing.

### coord · 2026-10-26T21:17:24.065Z

Merged 69972607f5bbc0588c2b11140997c202769d205c onto dev.
