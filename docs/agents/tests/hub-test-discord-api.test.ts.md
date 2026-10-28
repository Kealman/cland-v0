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
Pacing, gateway events, interactions and live-bot behavior are outside this file.
