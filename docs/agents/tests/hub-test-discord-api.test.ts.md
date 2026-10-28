# hub/test/discord-api.test.ts

Tier T2, Node 24, in-process loopback HTTP only. Run
`node --test hub/test/discord-api.test.ts` after cover-quiet admission.
No hub, Git operation, child process, filesystem fixture, browser or real platform
is used. The fabricated token is held in memory and sent only as a Bot header.

The tests cover C1–C4 of T-1396: enforced nonce deduplication and expiry; empty
mention parsing on every client write; application and gateway facts; exact
string snowflakes and descending before pages; sanitized provider faults and
successful credential echoes; redirect/root refusal; Unicode content and legacy
component limits. A raw HTTP write proves that the fake detects default mentions
before the client suppression assertion is trusted. Held-request observation is
armed before the call; release/abort and fixture shutdown have bounded receipts.

`fakeDiscordFixture(t, { clock })` starts a loopback server and registers teardown
before binding. `discordFixtureOwner(t, options)` exposes `start`, `close`,
native `listening()` and `receipts()` so abandoned setup can be disposed by its
existing owner. `fakeDiscordFixture` is its start convenience wrapper. Listen
acquisition and new sockets are fenced by a lifetime signal. Close is idempotent
and independently bounds native close, socket/handler drainage and observer
drainage, aggregating incomplete outcomes.

Options `publishListening: false` and `publishHeld: false` omit public setup
receipts while retaining native observations; `setupClock` bounds those waits
deterministically, and `signal` aborts serving setup. Tests cover omitted and
aborted serving and held setup. Held calls abort and join their operation in
`finally` even when their observer fails. The fixture exposes `url`, `ids`, `waitForHold(signal?)`, native `held()`, `close`, `receipts()`, and
`control(operation, body?)`. Control operations:

- `state`: redacted requests and stored messages, ping records and redirect count.
- `configure`: partial `application` (flags, bot_public, interactions_endpoint_url)
  and `session_start_limit`.
- `say`: `user` human/member/bot/webhook, `channel_id` (defaults to pairing channel),
  `content`; messages share the same monotonically increasing string IDs.
- `fault`: next REST request receives `status`, JSON `code`, `retry_after`,
  `echoToken`; or `response` redirect/disconnect/hold.
- `release`: release all held responses.

The fake uses a five-minute nonce window under the injected clock, keyed by
author and nonce. This models Discord's documented recent-message deduplication;
it does not claim a measured production window. REST message and legacy
component constraints follow the [Message resource](https://docs.discord.com/developers/resources/message)
and [Component reference](https://docs.discord.com/developers/components/reference).
Requests expose only a boolean receipt for the fixed User-Agent because the
shared capture redactor removes URLs. Authorization is never captured.
The fake also hosts a loopback ws gateway on its REST port; its configurable
Hello, safe Identify receipt and heartbeat/dispatch controls are covered by
[discord-messenger](hub-test-discord-messenger.test.ts.md). Pacing tests use the injected clock: twelve ordered sends, changed 2-per-700ms
headers, decimal/global 429 holds and the five-minute cap, transient backoff,
invalid-request non-repetition, and callback plus original-edit bypass.
Live-bot behavior remains outside this file.

The websocket owner has independent listening/closed receipts. Options
`publishGatewayListening: false` and `publishGatewayClose: false` omit public
observations, while native `gatewayListening`/`gatewayReceipts` remain available.
`waitForGatewayClose(signal)` is bounded by setupClock; `closeGateway` closes the
owned websocket server. Tests omit or abort setup/close observers with an active
client and held REST request, then retain native ws closure and zero resources
after the same idempotent disposer. Websocket close and every other drainage
are independently bounded and all-settled: an incomplete ws receipt cannot skip
REST release or native server/socket/handler/observer drainage.

T-1404 fake controls: `configure` accepts `sendLimit`/`sendWindow` (milliseconds).
The default message bucket allows five POSTs per five seconds; reaction PUTs
allow one per 250ms, each keyed by channel. Every admitted response emits bucket,
remaining and relative reset headers. `state.rateLimits` counts injected and
natural 429s. `fault` accepts `global: true` with 429 or `response: holdStored`
to persist a create before holding its response until client abort/release.
Synthetic headers and windows model the contract, not measured live limits.
Validation-only tests increase the fake limit so they do not sleep for pacing.

Review controls retain the original FIFO/nonce assertions. `discordExchangeOwner`
in `hub/test/fakes/discord/exchange.ts` registers before acquisition and owns
native requests, held observers and controls before launching them. Its API proxy
adds a lifetime signal and independent two-second real-time operation bounds;
setup has its own fake/real deadline. Disposal aborts I/O, independently bounds
stop/native/observer drains, then closes registered stores. Omitted/aborted
setup, missing heldStored observer, abort before fault setup, and frozen pacing
controls require native close, zero pending operations/observers/timers.
`fault.response: holdHeaders` flushes bucket headers while holding the body;
`fault.bucket` selects the synthetic returned bucket. The discovering-route
regression holds an edit in the known create bucket, verifies another channel
progresses, then releases the response and checks the queued create’s content.
Long local/global 429 controls first persist a held create and time it out, then
advance beyond both the proof and fake dedupe windows: no third POST is allowed.
The ordinary 429 cap tests use reads so nonce expiry cannot mask rate pacing.

Store-bearing exchange fixtures use `exchange.project()` rather than a plain
tempProject root, so both ordinary and signal directory cleanup repeat the
successful-drain barrier. Rejected close attempts remain retryable after native
settlement; a failed drain never closes a still-owned Store or removes its root.
