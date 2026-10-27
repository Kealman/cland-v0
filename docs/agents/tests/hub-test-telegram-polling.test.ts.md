# hub/test/telegram-polling.test.ts

T2 uses sealed `tempProject`/`projectHub`, the existing gateway frame port and the
loopback fake Bot API. A `FakeClock` owns all poll deadlines and retries; native
one-second bounds detect missing receipts, never supply behavior timing. Run this
file alone, subject to cover-quiet. No real platform, credential or browser is used.

`Telegram confirms only durable handling and deduplicates update and message ids`
queues an exact duplicate and a new update carrying the same message id. The
fixture handler resolves only on the real `topic.send` durable result. Retain
one General message, one handler completion, next offset 3, explicit allowed
kinds and the 40-second poll. The fixture is a handler seam, not the shipped
mirror implementation.

`Telegram filters foreign identities unlisted kinds and bots before the handler`
injects another chat, another sender, an unlisted kind, a bot claiming the paired
id, the bot's own message, a group and foreign callbacks/membership. The only
handler effect and General text must be the approved human's sentinel. Rejected
input carries a document id, so reaching the handler would expose it to download
work. The fake deliberately ignores allowed_updates for injected payloads.

`Telegram waits for durable handler completion and joins its writer on stop`
holds the exact handler, retains missing offset/dedupe, observes cancellation
before releasing its writer, and keeps the final completed-stop and absent-offset
assertions. Stop cannot substitute a detached promise for writer drainage.

`Telegram retries offline with zero timeout and restarts a stalled poll using
injected time` waits for the failure's scheduled-retry log, observes the actual
zero-timeout request and a recovered 40-second poll, then stalls the next one.
Advance 55 seconds only after the held receipt; retain its native response-close,
the next retry and actual zero-timeout poll. No wall-clock outage is simulated.

`Telegram registry isolates private pairing starts and distinct callbacks on the
same card` proves unpaired free text is dropped, private /start uses only the
pairing handler, paired text uses its handler, duplicated callback ids are ignored,
and distinct presses of one bot-authored card both reach their handler. Retain
an edited-message handler receipt, the bot's membership receipt and next offset 9.

`Telegram retains unmatched input with paced retries and one content-free
diagnostic` injects an edit without a matching handler; the native text mirror
does not consume edits. Observe the first blocked-update log,
advance one second, retain the actual repeat request and TCP close, then stop.
The final offset remains absent, exactly two requests occurred, the sole log has
only event/update id, and no timers remain. Input is preserved for its eventual
handler; native text behavior has its own [guide](hub-test-telegram-inbound.test.ts.md).
only event/update id, and no timers remain. Input is preserved for an installed
handler; this does not exercise the native pairing/mirror features.

Shared contract: `TelegramPollingOptions.handlers` selects the first applicable
handler after authority filtering. The optional native `foreignCard` refusal
handler is separate from this registry: only a foreign non-bot callback on this
bot's durably mapped card qualifies, and it sends no human frame. The card file
proves the private alert, callback-id dedupe and silent non-card/forged-author
controls; this registry fixture without that option preserves previous behavior.
Successful handler completion means durable
and replay-safe handling. Messages/edits dedupe by chat/message, callbacks by
callback id, all updates by update id; offsets and dedupe commit together through
`RemoteStore.confirmTelegramUpdate`. Keep the storage rollback proof in
`hub/test/remote-state.test.ts` and the actual SIGKILL proof in the restart guide.

Native startup includes `getMe` and scoped menu reconciliation (`getMyCommands`,
with `setMyCommands` on a changed menu). The rejected-input case retains that
exact startup prefix, then permits only polling: downloads and replies remain
forbidden for the rejected payloads.
