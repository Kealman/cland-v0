---
id: T-1404
kind: task
title: "REST pacing: lanes per bucket and channel from the rate-limit headers, no repeat of 401, 403 or 404, and a timed-out send posts once"
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1400
topic: topic-1145
branch: t/T-1404-rest-pacing-lanes-per-bucket-and-channel
created: 2026-10-27T23:38:46.684Z
updated: 2026-10-28T10:19:55.439Z
closed: 2026-10-28T10:19:55.439Z
---

## Summary

REST requests go through one lane per rate-limit bucket and channel. Each lane follows the `X-RateLimit-*` headers and `retry_after`, with no hard-coded limit, so a burst sees no 429. Invalid requests are never repeated, interaction callbacks bypass the lanes, and a send retried after a timeout posts once.

## What to build

**Lanes.** Each lane is keyed by method, route template and top-level id until Discord names the bucket, then by bucket and top-level id. One request is in flight per lane. Before the next request, a lane reads `X-RateLimit-Remaining` and `X-RateLimit-Reset-After`.

**429s.** A 429 waits the body's `retry_after` (seconds with decimals), capped at 5 minutes; a global 429 pauses every lane. A 5xx or 130000 retries with bounded back-off.

**Errors.** Each follows the assumption's policy. A 401 stops the remote through 06. A 403 or 404 on the paired channel stops it as `blocked`. A 404 on an edit or a reaction drops only that job. None is sent twice.

**Callbacks.** Interaction callbacks and `@original` edits go straight to the client, outside the lanes and the outbox.

**Proof.** A send that timed out is proven through 05's nonce rule before anything is re-sent.

**The fake.** It emits the headers. Its channel bucket allows 5 sends per 5 seconds and its reaction route one call per 250 ms, and it answers a 429 with `retry_after` when a limit is ignored. Its control can force a global 429 or hold a request past the client's timeout after storing it, and it counts 429s.

Spec §3.8 (REST), §3.9 (outbox); research rules 16 to 18 and 21.

## Acceptance criteria

- [x] C1. A burst of twelve General messages on the fake's 5-per-5-seconds channel limit arrives in order with no 429, paced by the headers rather than a fixed rate (test).
  - done: impl-1404 · 2026-10-28T09:20:04.162Z
  - verified: rev-26 [reviewer] · run rev-20261028-1404-evidence-1 · 2026-10-28T10:12:33.999Z · commit ba383b91ddd0442a0e0b8ed4bbec6f646c4e0729
- [x] C2. A 429 waits the body's `retry_after`, a `retry_after` over 5 minutes waits 5 minutes, and a global 429 pauses every lane (test).
  - done: impl-1404 · 2026-10-28T09:20:04.652Z
  - verified: rev-26 [reviewer] · run rev-20261028-1404-evidence-1 · 2026-10-28T10:12:34.000Z · commit ba383b91ddd0442a0e0b8ed4bbec6f646c4e0729
- [x] C3. A send the fake stores and then holds past the client's timeout is proven by its nonce and posts exactly once (test).
  - done: impl-1404 · 2026-10-28T09:33:19.946Z
  - verified: rev-26 [reviewer] · run rev-20261028-1404-evidence-1 · 2026-10-28T10:12:34.000Z · commit ba383b91ddd0442a0e0b8ed4bbec6f646c4e0729
- [x] C4. A 401, 403 or 404 is never sent twice, a 403 on the paired channel stops the remote with its cause, and a 404 on an edit drops only that job (test).
  - done: impl-1404 · 2026-10-28T09:20:05.492Z
  - verified: rev-26 [reviewer] · run rev-20261028-1404-evidence-1 · 2026-10-28T10:12:34.000Z · commit ba383b91ddd0442a0e0b8ed4bbec6f646c4e0729
- [x] C5. An interaction callback goes out while the channel's lane waits on a rate limit (test).
  - done: impl-1404 · 2026-10-28T09:20:05.748Z
  - verified: rev-26 [reviewer] · run rev-20261028-1404-evidence-1 · 2026-10-28T10:12:34.000Z · commit ba383b91ddd0442a0e0b8ed4bbec6f646c4e0729

## Notes

Shared files: discord-api.ts, discord-outbox.ts; hub/test/fakes/discord/ (rate limits)

## Comments

### impl-1404 · 2026-10-28T08:12:59.915Z

Rule 20 consumer census before changing REST retry/refusal policy: production DiscordApi consumers are discord.ts (startup, run, pairing replacement), discord-commands.ts (registration, callbacks/@original), discord-outbox.ts (durable creates) and messenger.ts (factory). Tests: discord-api, discord-messenger, discord-pairing, discord-messages; fake-api imports types/User-Agent. Shipped guidance: implement skill; docs/agents/tests/hub-test-discord-{api,messenger,pairing,messages}.test.ts.md; hub/README Discord section. Repo-wide search found no T3/T4/client wire consumers of DiscordError/DiscordApi, no persisted native error readers or startup probes. No wire shape change planned. Preserve constructor defaults and callback bypass; additive clock/deadline options. Durable outbox must classify definite 401/403/404 as dropped rather than uncertain/reprove; paired-channel terminal errors stop only Discord.

### rev-26 · 2026-10-28T09:24:35.937Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1404-source-1
commit: 89d57915d2a2781ecd62f125d8d0fa7c3e921b8b
scope: full
findings: [{"severity":"high","text":"M1 Spec: nonce retry eligibility is checked before waits, using lane-entry time, and not immediately before each native POST. A stored-response timeout followed by a five-minute 429/global wait can resend after the original nonce proof window and create a duplicate; pacing can also outlive Outbox's earlier original-attempt check. Carry immutable original eligibility through queue/backoff/header waits and recheck at I/O, with long-wait and aged-recovery negative controls.","file":"hub/src/remote/discord-api.ts","line":134},{"severity":"medium","text":"M2 Standards: new native fake-clock tests await request groups/individual operations without independent live bounds and pre-owned cancel/join cleanup; t.after(abort) alone does not drain them. heldStored also arms a rejecting observer before fault setup without ownership. Use a shared registered exchange disposer with tracked/caught requests/observers, separate setup/behavior/drain bounds, omitted/aborted setup and frozen-wait controls. Wait for client header/pacing receipt before advancing the behavior clock.","file":"hub/test/discord-api.test.ts","line":303},{"severity":"medium","text":"M3 Spec: learning a bucket publishes route mapping but not the current in-flight owner into the bucket tail. Another route already mapped to that bucket can start while the discovering response body is held, violating one-in-flight-per-bucket/channel. Adopt current completion ownership on bucket discovery/change; prove shared-bucket cross-route serialization and different-channel independence.","file":"hub/src/remote/discord-api.ts","line":163}]
finding_counts: {"high":1,"medium":2,"low":0}

A-13171 consolidated full source audit. Standards M2 native fake-clock operation ownership/bounds; Spec M1 high original nonce deadline across waits and M3 shared-bucket owner adoption. C3 failed; remaining runtime criteria unverified. Fix all findings with retained red/green controls and semantic assertions, then request fresh exact-head source review before configured verification. No dev merge absent Coordinator direction.

Criteria: C3 failed (A paced retry can POST after original nonce eligibility expires because waits are not followed by a final pre-I/O deadline check.).

### impl-1404 · 2026-10-28T09:30:51.656Z

Review remediation contract addendum: DiscordRequestOptions gains optional native-only nonceDeadline (absolute original-attempt time + 120s), propagated by DiscordOutbox and snapshotted by the API before queues. Rechecked every POST after all waits. Consumer census remains discord.ts/discord-commands.ts/outbox/messenger plus four Discord T2 test files, shipped guides/implement/README; other callers omit it and retain call-time fallback; no protocol, persisted shape or remote frame change. Landed onError compatibility retained. M1 red: held-store/timeout then long local/global 429 returned success ('Missing expected rejection') before fix. M3 red: known-route message count was 2 instead of 1 while discovering response body held. Added original-age queue/header controls and bounded exchange-owner omitted/aborted/frozen controls.

### rev-26 · 2026-10-28T09:36:30.598Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1404-source-2
commit: c31611d5487ffb9122f4928a867c091cf8d3f60e
scope: full
findings: [{"severity":"medium","text":"M4 Standards: when stop/native drainage fails, afterDrain Store closure is skipped, but the consuming recovery tests use plain tempProject roots without an exchange drain beforeRemove barrier. Shared cleanup continues directory removal after resource errors, so an incomplete writer can retain its Store while losing its root. Tie normal/signal directory removal to successful drainage, retain root on incomplete outcomes, and prove held-writer failure then actual settlement/close/removal.","file":"hub/test/fakes/discord/exchange.ts","line":15}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13178: source2 corrects prior M1 nonce deadline, M3 learned bucket ownership and the operation-bound/ownership portion of M2. Remaining M4 medium: incomplete exchange drainage can still be followed by plain tempProject directory removal while Store/writer remain owned, including signal cleanup. Bind root removal to successful drainage and prove incomplete held-writer retention before actual settlement/close/removal. No runtime criteria verified; corrected pushed head needs new source review before verify.

### rev-26 · 2026-10-28T09:40:10.670Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1404-source-3
commit: 140591f2e3d083b103f7b87087240615f0961d40
scope: full
findings: [{"severity":"medium","text":"M5 Standards: the new incomplete-drain control awaits entered.promise without a separate setup bound or cancellation, before entering the release finally. exchange.run can reject before invoking the writer when its lifetime is aborted, leaving entered unresolved and release cleanup unreachable. Bound/cancel/join the entry observer, register release before awaiting it, and cover abort-before-entry while retaining all writer/root/Store assertions.","file":"hub/test/discord-messages.test.ts","line":379}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13180: M4 root/Store retention fixed through shared beforeRemove/beforeDirectories barriers and retryable close. Remaining test-only M5: new incomplete-drain writer entry awaits an unbounded uncancelled observer before release finally; pre-action abort can strand it. Independently bound/cancel/join entry and pre-register release; cover abort-before-entry preserving all semantic assertions. Production unchanged and no Spec findings. Runtime criteria remain unverified; new exact-head source review before verify.

### rev-26 · 2026-10-28T09:44:56.007Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1404-source-4
commit: ba383b91ddd0442a0e0b8ed4bbec6f646c4e0729
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13183 full source4 clear, both axes zero findings. M1–M5 corrected: original nonce deadlines at I/O; learned bucket ownership; bounded native exchange; root/Store retention on incomplete drainage; independent owned writer entry with pre-registered release and abort-before-entry control. Production unchanged since c31611d54. Local historical receipts attributed separately; C1–C5 runtime unverified. One mode-free configured verify at unchanged head, then original-record evidence review. Coordinator integrated cover/landing separate.

### rev-26 · 2026-10-28T10:12:34.000Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1404-evidence-1
commit: ba383b91ddd0442a0e0b8ed4bbec6f646c4e0729
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13197 final original-record evidence audit clear, both axes zero findings. A-13193 / run 16904808 at unchanged source4 head: 3,874 ordinary passes, zero failure/cancel/skip/unfinished; 135 separate scoped load passes, including all 22 new task identities base + 5/5 (110 task repeats). C1–C5 verified against named native execution records and retained assertions. Max new base 0.329303270 s/load 0.690894285 s, no >=3 s allowance. T0/all T1/fallback all T2/Web completed on Linux x64 c-8 nyc1; HS156/revision1248. Host typecheck reused, not repeated remotely. Budgets/lint report-only; T3/T4 unrun; no integrated/stage-cover claim. Coordinator cover/enqueue/landing separate; no new edit or rerun requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-28T10:19:55.439Z

Merged ecfb60a2e37cc82876c4b9e31365c1cb96eb92f7 onto dev.
