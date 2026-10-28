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
history catch-up, rendering/splitting or cards.

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

T-1404 retains production-frame coverage for twelve General sends, checking all
twelve durable sent mappings and native order with zero 429s under fake time.
Native client/outbox controls prove hold-after-store timeout recovery with one
post, equal enforced nonces and the durable message map; 401/403/404 drop without
replay; a paired-channel 403 stops with its cause while a missing edit leaves the
remote enabled. No browser, provider account or real platform is involved.

Aged recovery controls keep the original attempt at age 110 seconds and hold
recovery for another 20 seconds in either a route queue or a header wait. They
assert no second original-nonce POST, one original copy, unchanged attempt time
and an uncertain durable job. Client, outbox and fake share the same injected
clock, because the nonce deadline is absolute. The hold-after-store and aged
controls use the shared exchange owner and register outbox stop/store close
before launch; the store closes only after native work has drained.

Exchange Store roots are allocated by `exchange.project()`: shared `ownDirectory`
uses `beforeRemove: exchange.close`, and the owner registers `beforeDirectories`
for signal cleanup. A failed drain retains the root and open Store; the same
barrier retries after the actual writer settles. The held-writer control uses a
separate injected drain clock to expire the bound, checks that the root and Store
remain usable, releases the writer, observes its stored receipt, then checks
Store close and root removal. No removal proceeds on an incomplete receipt.

The held-writer control owns its entry observation separately through bounded
`exchange.run` plus `abortable`, with an independent observation-cancel signal.
Release/cancel/join disposal is registered before acquisition/launch and wraps
entry setup in finally. Its aborted-before-entry variant closes the exchange
before either action can enter, observes both rejections, then uses that same
disposer and retains the native close/root-removal assertions.

T-1406 adds mapped General reply and unmapped-reference assertions. A foreign
member replies to the same native target before the ordered accepted-input
barrier; assert exactly three human messages, no foreign receipt and no reaction.
Reaction cases use production frames and the loopback fake with a shared fake
clock. First observe 👌 and its durable sent settlement while no Coordinator is
present; restart, deliver to the Coordinator and observe 👀. A second variant
drops the delivery frame but retains the hub delivery, then restarts again to
prove receipt reconciliation. Replay the original input before a later durable
cursor and count exactly two PUTs for it, as well as bot-owned emoji state.
The fake's reactions are additive state keyed by channel, message, bot and emoji.
No browser or platform credentials are used.

An interrupted-reaction outbox control seeds a stored native reaction with an
unknown durable attempt and unavailable state, then resumes after the healthy
startup boundary. Assert sent settlement, one bot reaction, two PUT attempts and
no further PUT on the next resume. The frame cases also replay a legacy `1`
tombstone before the accepted cursor barrier.

Review regressions retain a known native mapping but supply Discord's explicit
`referenced_message: null` deleted-target marker: it must become plain General
text. Omitted referenced_message still uses its mapping. Held-reaction controls
record delivered while 👌 is in flight, then unpair or replace the user in the
same channel before release; after native settlement and hub stop, assert no 👀
job or native reaction for the retired identity. Reaction intents carry the
receipt's captured user rather than adopting the current pairing.
