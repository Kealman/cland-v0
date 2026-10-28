# hub/test/discord-messages.test.ts

T2, Node v24.21.0. Run alone: `node --test hub/test/discord-messages.test.ts`.
Uses sealed tempProject/projectHub, production gateway frames, loopback Discord
REST/ws and the native Telegram fake. No browser, real platform or account.

General sends retain the neutral mirror filter and author header. Assert enforced
nonce, SUPPRESS_EMBEDS, empty allowed_mentions, the durable attempt and native id
mapping. Paired text and replies become human messages to the Coordinator; other
members, bots, webhooks, channels and system types never enter the hub. A later
accepted cursor is the ordered completion barrier for ignored and duplicate input.
Telegram receives the cross-remote author; Discord receives no echo.

The controlled production frame port holds ingress before the hub stores it:
lastMessageId must remain absent, then advance only after the saved result. A
restart replays the same id before a second valid input, preserving deduplication.
Native outbox crash receipts prove a send by the bot's observed nonce, otherwise
retry the same nonce strictly within two minutes of the attempt. At or beyond
that bound, unknown delivery remains fenced. Discord documents only "the past
few minutes"; the two-minute bound is conservative, not a guaranteed platform TTL.
General failures retain the neutral outbox's missed/gap classification; other
unknown jobs remain uncertain. These tests do not claim REST bucket pacing,
history catch-up, rendering/splitting, reactions or cards.

The held-send owner registers before fake setup, immediately catches and retains
observations, setup operations and sends, and cancels/joins them before closing
the Store. Omitted held publication and abort before fault setup use that same
disposer. Preserve the durable attempt and independent SQLite reader assertions.
Startup replay cancellation runs the native remote under Gateway: abort must
close the held REST request, drain handlers and prevent late conversation
acquisition or a sent mapping. Its cleanup has an independent I/O abort so a
regression cannot wait for the production REST deadline.

Recovery POSTs must take the neutral queue's new-attempt path. Hold that POST and
read its second distinct attempt before release; then retain one native message
and its sent mapping. A refreshed latest attempt at the original window's expiry
must not permit another POST. Eligibility uses the first attempt and is checked
again immediately before I/O, including a restart after a proof or queue delay.
