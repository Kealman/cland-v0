# hub/test/telegram-users.test.ts

T2 uses the sealed fake Telegram server, a scratch project with two activated
users, production TelegramRemote and projectHub. All clocks use FakeClock;
native timers continue running. The fixture owns and stops every writer before
closing its store or removing directories.

Observers are armed before General sends, native input and callback presses.
Final checks use durable message mappings, committed answer userId, native folded
cards and missed-job acknowledgements. A failed native send keeps its original
attempt fence; the healthy chat continues, and only the failed chat receives its
gap line. Run `node --test hub/test/telegram-users.test.ts` on supported Node.

Blocked-destination controls inject `sendMessage` 403 faults scoped by the fake
server's optional `chat_id` filter. They exercise gap recovery and four-minute
polling-outage replacement cards, then observe healthy General/card delivery and
committed native input. The long-outage case waits for the healthy destination's
catch-up completion checkpoint before measuring subsequent General behavior.

Held-destination tests hold an actual native General send or gap notice, then
require healthy user input to commit while the first job remains `sending`.
They release that exact request, observe its durable sent settlement, and check
shutdown leaves no sending jobs or timers. A separate stop case aborts an
independently owned held gap, observes its exact native connection close and
asserts the durable unknown attempt after hub.stop returns.

T-1650 extends the existing ask and paired-approval cases with Alice pressing a
conflicting choice after Bob's named folds. Preserve Alice's chat-specific token
before folding, then press with the current folded message. Require the native
`answerCallbackQuery` text `Already answered`, one forwarded answer frame,
unchanged durable outcome and card texts, and exactly one `editMessageText` per
copy. The ask also asserts exactly one durable `answerTo` message. The unpaired
approval control remains unchanged in scope. The fixture records forwarded
frames without changing admission or transport behavior; its pacing owner joins
all writers and observers before cleanup.

The exact callback update's `telegram.update:<update_id>` marker is the completion
receipt, after polling joins the handler. A per-instance API wrapper holds after
a successful native acknowledgement; require marker absence and an unfinished
observer while held, then release and await the marker before final assertions.
`/control/callback` is an additive fake-only injection that registers the callback
id's native age; `/control/update` retains raw/replay/expired-id semantics. Both
first and second users use the fresh callback control. Existing fake API/card/
approval tests remain unchanged as preservation controls.
