# hub/test/telegram-cards.test.ts

T2 uses sealed `tempProject`, `projectHub`, real frame clients, `TelegramRemote`
and the loopback fake Bot API. No provider account, real token, browser or child
process is used. Run this file alone with `node --test hub/test/telegram-cards.test.ts`.
`pacingOwner` owns every Store and adapter before acquisition, joins all writers
before SQLite closes, and releases held startup I/O before joining acquisition.
The fake has its own pre-registered bounded close owner. Drive fake time from
durable queue receipts; the explicit 250 ms inbox coalescing step follows the
committed ask, and never stands in for an accepted-message/mapping assertion.

`Telegram nine-option free ask arrives as one entities card with eleven opaque
button rows` proves C1 at the actual accepted card and durable native map:
asker/topic/question, entities, one row per option, ordered auxiliary buttons,
unique keys at most 64 bytes and one platform message.

`Telegram option three commits via Telegram before callback answer and offset,
then edits the outcome` proves C2. Hold the direct callback HTTP response,
inspect the durable ask outcome and unconfirmed update, release that exact
request, retain the next offset, and drive the queued outcome edit. Its exact
text includes the full option, human, via Telegram and hub-local HH:MM, and
its keyboard is empty. Callback acknowledgement requires no outbox pacing step.

`Telegram callback replay after committed answer and lost result returns its
durable receipt once` interrupts after dispatch commits, before the native
adapter can receive the result or confirm the offset. A wrapper drops only that
actual result; stop drains the pending request. Recreate the hub/adapter over
the same SQLite file and fake queue, then assert the Answered toast, confirmed
offset, same durable answer id and exactly one human answer in frame history.
This is a component restart control, not an OS-crash claim. The existing
`gateway.test.ts` old-client cases retain the previous request/result shapes.

`Telegram refuses unissued and cross-ask button data and keeps auxiliary actions
unavailable` proves C3 with real presses. Edit a real fake message to carry an
unissued key, then the issued key of another ask; preserve both open asks and
each toast/offset. The extra direct API client uses real HTTP deadline time and
a one-second abort signal, with an independent five-second native case bound;
the server clock remains injected. Other answer and Decline remain unavailable
toasts.

The `Telegram not-modified outcome edit settles with no reply` and `Telegram
failed outcome edit settles with one reply` cases prove C4. Inject the exact
400 description, assert durable edit/fallback settlement, one edit attempt,
reply target, outcome text and empty keyboard. Stop before the final absence
checks so later work cannot change their result.

Additional native controls retain 400 plain fallback and mapping; fatal
401/403 with the hub still serving and no fallback; 429 immutable attempts;
and accepted-without-response sends fenced across adapter restart. The long-ask
case checks one mapped card, all eleven buttons and full labels, a word-boundary
preview plus `full question in the workbench`, and a bounded outcome edit.
`telegram-commands.test.ts` separately retains contiguous numbered command
parts; it identifies command replies apart from automatic card sends.

Before source review, run every `hub/test/telegram-*.test.ts` file serially,
then outbox, outbox-gateway and gateway, plus `npm run typecheck`. The polling
restart file is existing T3; this new file creates no hub process and stays T2.
No real Telegram rendering, network outage or client press expiry is claimed
by these receipts. The fake/API file independently models the 150-second expiry.


Source-review corrections retain the original criterion assertions. `Telegram
answer receipt failure rolls back without publishing or delivering a phantom
answer, then retries once` installs a SQLite trigger in the scratch database
that refuses only the native replay receipt. It observes the actual failed
frame result, then drains earlier UI/spoke frames with ordered request replies
before checking the open ask, absent answer delivery/frame/edit and unconfirmed
update. Removing the trigger permits exactly one answer on retry.

`Telegram expired callback acknowledgement confirms the durable answer and lets
later input progress` holds the actual committed frame result before native
callback HTTP starts, advances the fake's press lifetime to 151 seconds, then
releases the result. It retains confirmed press/next-command offsets, one durable
answer and the later help response. Holding an HTTP exchange for 151 seconds
would instead trigger its independent 35-second client deadline and would not
prove expiry. The source-1 renderer was restored temporarily from Git and its
unchanged diff checked before this corrected test failed; the corrected renderer
was then restored. `Telegram transient callback refusal retries its saved answer
without duplicating the human effect` separately proves that a 500 still retries
and does not confirm early. Both cases have five-second native test bounds.
