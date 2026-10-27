# hub/test/telegram-api.test.ts

T2 exercises `TelegramApi` with actual Node fetch and the real loopback HTTP
server in `hub/test/fakes/telegram/fake-api.ts`. T1 forbids these sockets. No hub,
child process, filesystem fixture, inherited credential or real platform is used.
Run this file alone with `node --test hub/test/telegram-api.test.ts`, subject to
cover-quiet admission.

`Telegram API override sends to the fake bot` retains `getMe`, the sent message
and `/control/state` receipts. Provider-refusal controls check every retained
error field and stack, including the absence of a raw fetch cause. The token
validation control uses a malformed synthetic value before parsing a root that
could echo it. Redirect, malformed JSON/envelope and disconnect cases exercise
real transport paths; the redirect target deliberately succeeds if followed,
so `assert.rejects` detects removal of redirect refusal.

Human/stranger delivery retains exact ids and messages, repeated reads before
acknowledgement and an offset-confirmation result. Separate cases check exact
duplicate updates, the bot's `my_chat_member` update, Rich Message rejection
with a successful plain send, numeric `retry_after`, and an injected 409.
These are platform receipts; dedupe, rich-to-entities conversion, global pacing,
conflict recovery and pairing policy belong to their gateway callers.
The fake also rejects overlapping entities unless one contains the other and
one is emphasis, excluding all code/pre nesting. It implements this narrow
Bot API formatting restriction independently of the converter, not a full
formatting parser. The positive refusal and continued-delivery controls live in
[telegram-rendering](hub-test-telegram-rendering.test.ts.md).

Arm `fake.waitForPoll()` before starting a poll. The held receipt names its id,
parameters and stall state. Arm `waitForPollClose(id)` before cancelling or
completing it, then retain the actual response-close receipt and empty pending
state. The caller-abort control puts a synthetic token in its abort reason to
prove that reason never becomes a public error. The deadline control shares one
`FakeClock` with the fake/client, observes the held request before advancing to
65 seconds and checks the refusal, close and cleared timer. Its five-second
native test bound catches a missing simulated deadline; it is not a wait.

## Fake Bot API control contract

`await fakeTelegram(t, { clock? })` registers its cleanup owner before binding
an ephemeral `127.0.0.1` HTTP listener and
returns `{ url, waitForPoll, waitForPollClose, waitForConnectionClose, waitForRequest, close }`. Supply the exported
`TELEGRAM_TEST_TOKEN` only to the client or a private disposable secret store.
The fake never reads the environment, HOME or a credentials file. Its shared
`onCleanup` owner is already installed when setup begins. Close aborts setup,
destroys owned peers and independently bounds native server closure and all
connection/handler drainage at one real second. Observers have bounded,
abortable lifetimes; all control requests use `telegramControl`, with one
five-second signal across headers and the full body. Its status/body/text
result preserves the tests' final status and content assertions.
`waitForConnectionClose(method)` observes an actual bot-request TCP connection
close, with a token-free request id and method. Arm it before the request;
unrelated control HTTP connections cannot satisfy it.

`fakeTelegramFixture(t, { setupClock?, signal?, publishListening?, port? })`
exposes the same owner before `start`, with bounded native `listening()` and
durable `receipts()`. The missed-readiness and aborted-setup cases arm native
listening before triggering start, then drive only the separate setup clock or
signal; both retain actual server-close, zero connection/handler and cleared
setup-timer receipts. The occupied-port case retains native `EADDRINUSE` and
the same disposer. A missing setup deadline must hit the test's independent
1.5-second native bound, rather than hanging its cleanup. Normal callers use
the async convenience wrapper; every caller supplies its TestContext.

GET `/control/state` returns sanitized `messages`, method/parameter `requests`,
`pendingPolls`, `heldRequests`, `redirectsFollowed`, and chat-request `sends`
(request id, chat and injected-clock start time for sendMessage, sendRichMessage
and setMessageReaction), plus `maxInFlight` per chat. Requests never retain URLs
or headers. POST controls take JSON:

| Path | Parameters | Receipt |
| --- | --- | --- |
| `/control/say` | `user: "human"` (default) or `"stranger"`, `text` | Queued message update. Human id/chat 101, stranger id/chat 202. |
| `/control/update` | Arbitrary update body without `update_id` | Assigns the next id and queues the redacted body, deliberately bypassing kind/identity filtering for negative controls. |
| `/control/duplicate` | `update_id` | Adds the exact queued update again, retaining both ids. |
| `/control/membership` | `user`, `status: "member"` or `"kicked"` | Queued `my_chat_member` update for the bot. |
| `/control/commands` | `commands` array | Replaces and returns the fake private-chat menu to exercise platform drift. |
| `/control/fault` | `method`, HTTP `code`, optional `echoToken`, `description` (at most 4000 characters), `retry_after`, `response` | Arms one fault for that method; response modes below distinguish refusal from committed effects. |
| `/control/release-requests` | `ids: number[]` | Releases exactly the named `hold` requests to normal method handling. |
| `/control/stall` | `enabled: boolean` | Subsequent polls hold even when the requested timeout expires. |
| `/control/release-polls` | `{}` | Ends held polls, returning their exact ids. |

Without a response mode, a fault returns the Bot API error envelope and optional
Retry-After header before accepting an effect. The supported response modes are:

| Mode | Effect and receipt |
| --- | --- |
| `redirect` | Returns the configured code with a redirect to a deliberately successful target; production must refuse to follow it. |
| `invalid-json` | Returns malformed JSON, deliberately echoing only the fabricated token. |
| `malformed-error` | Returns deliberately invalid error-field shapes containing the fabricated token. |
| `disconnect` | Closes the connection before accepting an effect. |
| `accept-disconnect` | A send commits its fake message, then closes without a success response. |
| `hold` | Publishes a bounded token-free held request id/method and waits before normal method handling; explicit id release or cancellation ends it. |
| `hold-after-send` | For sendMessage, commits the message and publishes its held id before withholding the response until cancellation. |

`waitForHeldRequest(method)` and `heldRequests` expose the held boundary.
`echoToken` appends only the fabricated token to the optional provider description;
all captured receipts are redacted. A 429 fault is one response, not a scheduler;
repeat controls to model further refusals.

The fake implements getMe; getUpdates; sendMessage; sendRichMessage with nested
rich_message.markdown; setMessageReaction; and getMyCommands/setMyCommands.
Menu methods require all_private_chats scope, and the setter requires a commands
array. Reactions retain their exact parameters in requests and share the
fault/hold/native-close controls with sends; they create no new message row.
Updates remain queued until an offset confirms them. Empty positive-timeout
polls use the injected clock and wake when a control queues input. Faults supply
conflicts explicitly. This narrow boundary does not claim real-client rendering,
server retention or rate-limit enforcement.

`waitForRequest(method, accepts?)` observes a token-free request id, method and
redacted parameters before the fake handles it. Arm it before the action, including
immediate zero-timeout polls. `Telegram fake injects unlisted update kinds with
redacted request observations` retains the fabricated-secret positive control,
the injected channel-post body, exact request parameters and matching TCP-close
id. Production callers must still filter, even when allowed_updates is explicit.

The pacing controls in [telegram-pacing](hub-test-telegram-pacing.test.ts.md)
retain independent request times and per-chat maximum active responses. A held
send is released by its exact id; a lost-receipt send is present in messages but
has no success response. Neither observes a token-bearing URL. Fixture disposal
destroys peers, releases held handlers and joins all handlers before root cleanup.
