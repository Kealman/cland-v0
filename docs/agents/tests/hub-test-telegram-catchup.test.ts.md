# hub/test/telegram-catchup.test.ts

T2 uses the sealed `telegramLivenessFixture`, production messenger factory,
real Unix-socket frames, loopback fake Bot API and one injected `FakeClock`.
Run this file alone. It uses no real platform, token, child hub, browser or GUI.
The fixture owns startup and teardown before native work starts; each case
observes its exact final poll close before root removal. Native one-second
observation bounds detect missing receipts; they never simulate outage time.

`Telegram four-minute outage reports offline only after three minutes and
recovery exactly once` makes an HTTP 503 outage while the scratch hub serves.
The provider's 240-second retry interval allows the offline timer to be observed
independently. Retain no offline line at 179999 ms, the exact General line at
180000 ms, a disconnected traffic-derived status, no early recovery and exactly
one recovery on the successful exchange at 240000 ms. Another completed poll
must leave that recovery count at one. The paired native queue reports the
missed offline hub notice as one silent gap, then mirrors the recovery General
line only after its own per-chat pacing boundary. Keep the positive provider-token echo
and the assertion that frames/logs do not contain the fabricated token.

`Telegram ten-second outage marks retained input then sends one gap for three
missed General posts` queues three human workbench posts and one retained native
input during an actual poll outage. Its fake clock crosses a minute boundary,
so the annotation proves both the provider-written time and the recovered time.
Retain the saved human message, its confirmed offset, one successful native gap
send, and exactly one gap replacing all three outbound posts without an echo or
replay. A later completed exchange must not repeat the gap. A short outage must
leave General without an offline/recovery notice. Gap sends use the native
per-chat queue and retain its exact durable delivery receipt.

`Telegram retries interrupted inbound feedback without duplicating its stored
human message` fails the native stored reaction with HTTP 503 after the hub
commits input. Retain the scheduled retry, disconnected status, subsequent
confirmed offset and exactly one original human message in General. The native
failure cannot disable the remote or cause another frame-side mutation.

`Telegram General arriving during a held gap stays missed until its own
successful gap` holds the real native gap response, posts another General
message through frames, and inspects both durable source rows. Only the first
source becomes reported on that receipt; the second stays missed until its
own paced gap succeeds. Keep both accepted native messages and final poll close.

`Telegram uncertain native gap stays fenced across successful recovery polls`
commits the fake platform effect then disconnects its response. Subsequent
successful zero-timeout polls must retain the same captured gap, one uncertain
keyed outbox job and one native send. General remains missed, the hub serves,
and no new job or attempt bypasses uncertainty.

The 401 and 403 gap controls retain missed sources and the captured gap, one
fatal cause/fix in General, disabled status, no retry, no offline timer firing,
and continued hub service. The provider echoes the fabricated token as a
positive redaction control. `Telegram membership kick during catch-up retains
fatal reload recovery` keeps the consumed update offset and a real resumed poll
after unchanged reload; retry handling must not swallow that fatal boundary.

Keep first-success traffic distinct from catching up: a full Telegram batch
needs another zero-timeout probe, and an unhandled input cannot complete
catch-up. New native callbacks stay optional for older injected clients; no
public frame shape or remote authority changes. Existing fatal 401/403/409
and stalled-poll controls stay in
[telegram-liveness.test.ts](hub-test-telegram-liveness.test.ts.md).
