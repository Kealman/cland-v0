# hub/test/telegram-pacing.test.ts

T2 uses the sealed tempProject/projectHub frame seam and the loopback fake Bot
API with FakeClock. Run this file alone with
`node --test hub/test/telegram-pacing.test.ts`, subject to cover-quiet. No child
hub, real messenger, browser, credential or wall-clock wait is used. Queue-only
controls use the same native API, disposable Store and registered close owner.

`twenty General sends survive a 429 complete and ordered with durable attempts
and one-second pacing` posts twenty Coordinator reports through frames. The first
attempt's never-left receipt must be durable before advancing to one millisecond
before an eight-second hold. After the deadline, each exact committed sent row
admits the next one-second advance. Keep the independent literal message order,
21 attempt timestamps, zero timers and early lastOutbound assertion. Runtime
budgets measure the local component work, not the twenty-seven simulated seconds.

The cross-chat control injects retry_after 900 seconds and proves no accepted
send before 299,999 ms, then both chats at 300,000 ms and the next same-chat send
at 301,000 ms. The held-request control pre-arms native entry, keeps chat 101 in
flight while chat 202 completes, advances past pacing, and retains the exact held
id before releasing it. The fake's maximum active responses must stay one per
chat. A queued card then overtakes ordinary work; a new arrival still leaves in
the original drain, ordinary FIFO stays intact and the card's map names its ask.

The fallback control injects a rich 400, waits for the durable replaced/dropped
intent and sends two replacement parts ahead of a later General message. Retain
all exact accepted texts and source maps; a rejected rich intent is not missed
General. Rich 429 must retry rich only after its hold. Rich and plain-fallback 401 and 403 must stop
the native adapter, produce one sanitized cause/fix and send no plain fallback.
Network disconnect, 5xx and accepted-without-receipt controls must leave one
unknown attempt and no plain resend or replay after availability resumes. The
accepted-without-receipt fake supplies the positive accepted-message control.

Shutdown cases cover pacing, 429 and active HTTP separately. Arm native close
before triggering a held request. Join stop and the send outcome, retain exact
TCP close for active I/O, prove zero timers and no later send after a further
fake advance, and refuse post-stop admission. Cleanup owns queue/hub stop before
closing SQLite and removing roots; observers have finite native test bounds.

The native remote-test and captured old-chat notice control starts a General
429, queues both non-General paths through TelegramRemote, and retains three
durable intents before advancing. No chat sends before the hold; both chats
resume at its deadline and the same-chat test follows after its pacing interval.

Review boundary controls preserve every original C1 assertion. Eight cases
cross unpair/replacement with ordinary pacing/429 and live/recreated adapters:
revoked queued project content must be dropped, while the explicit old-chat
notice and either the new paired chat or stranger pairing reply still deliver.
Reopen controls separately retain the remaining absolute bot hold across both
chats and the remaining 600 ms of per-chat spacing. Keep exact fake request times.

The planted failure-between-parts control interrupts the second Store.putOutbox
within the replacement transaction. No partial replacement row may survive;
a recreated adapter must recover the definite 400, deliver both exact parts then
the later General message, retain all source maps, issue only one rich request
and count no missed General. The fault is at the persistence seam, so no native
crash process is needed.

`telegram-pacing-fixture.ts` registers one unconditional owner before root,
Store or producer acquisition. Every queue/remote close belongs to that owner,
including recreated adapters. Hub setup ownership is recorded before awaiting
its serving receipt. Missed/aborted receipt and rejected-startup controls use the
same disposer with a held native send: stop/drain hub and all queue writers,
observe the exact socket close and incomplete send, then prove SQLite closed,
both clocks empty and no accepted message. Setup deadlines use a separate
clock; each test keeps an independent five-second native bound. The added
rendering Store observer also registers nullable ownership before acquisition.

After T-1344, the reaction/429 control queues 👌 and 👀 behind a limited ordinary
send. No reaction may arrive before the bot deadline; exact requests must be
send/retry/👌/👀 at per-chat spacing with maximum one in flight. Await 👌's own
completion before advancing for 👀: completion must observe its durable result,
not the end of the whole chat drain. The Outbox T1 observer independently reads
the committed job/map from a second Store inside the optional settled callback.

`driveTelegram` advances from persisted queued/uncertain pacing deadlines only
when no job is in native I/O (`sending`). It waits for exact requested operation
receipts and retains their existing native bounds. It never runs the clock ahead
while a real HTTP response is pending. Inbound fixtures use the same owner for
every hub start/restart and custom held-API resource.

The rejected-startup owner control uses malformed scratch TOML before native
hub resources open, retaining the already-held queue writer and SQLite cleanup
assertions. It does not inject a late database-open failure into unrelated
daemon journal acquisition.

The final T-1346 integration keeps one entities-aware #send redirect for
ordinary replies and the explicit pairing/old-chat purposes. See the command
file's public-frame /help+429 control for ordinary priority, own completion,
entity retention and durable accepted ids; menu compare/write remains the
landed command handler's startup contract.

Source-2 pre-serving controls hold the real fake getMe before projectHub returns.
The owner arms cancellation/deadline observation before invoking acquisition,
tracks raw acquisition separately from the observed setup, and releases registered
startup-only I/O/custom owners before joining it. A late hub is retained and
stopped before SQLite closes. Both explicit abort and missing setup-deadline
cases keep the behavior clock frozen and require the primary setup rejection,
completed late-hub stop, actual fake server closure with zero connections and
handlers, closed Store and zero timers. An independent native guard fails if
setup does not settle; emergency fake release runs only afterwards to keep the
red control finite, so it cannot supply the asserted primary cleanup receipt.
The existing post-serving missing/aborted receipt and rejected-config assertions
remain unchanged. Fixture users register their native fake's startup-only close
before triggering any hub acquisition; normal completed setups leave final fake
census reads available until the fake's own disposer runs.


`queued Telegram edits merge their latest text and ride ahead of older General
work` accepts one initial card, then queues an older General send and two keyed
edits behind its ordinary pacing wait. It drives only durable queue deadlines,
awaits every completion waiter, and asserts the actual native request order:
one latest edit before General. Attempted payloads remain immutable; this case
covers only edits with no attempt. No additional test process or browser runs.

`dropping a keyed Telegram card for lost pairing remains incomplete` distinguishes
source closure from admission loss. A keyed card queued behind pacing is dropped
after unpairing, but its completion retains the missing-delivery rejection.
Only an explicit closed-source receipt permits a keyed card to complete without
an accepted send.

T-1360 M3 retains all five original 429/reopen assertions. A resume call captures
its current lane drains and publication waiters together. A later send can own
a new chat lane outside that snapshot and must complete from its own receipt,
including after the bot-wide hold. Reconciliation must not judge that new work
terminal when only the older lanes have drained. The four generated
`queued project content is fenced after … during 429 …` cases and
`reopen retains the remaining bot-wide 429 deadline for every chat` reproduced
`Telegram send has no delivery receipt` through resume's continuation before
capturing the original waiter orders. Keep the card guide's live held-publication
drop control as well: limiting reconciliation must still settle that old waiter
without waiting for stop.
