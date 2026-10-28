# hub/test/telegram-inbound.test.ts

T2 uses sealed `tempProject`/`projectHub`, the production messenger factory,
Unix-socket frames and the loopback fake Bot API. Pairing ids and a fabricated
token are seeded in the disposable store; no real platform, browser, process
or account is used. Run this file alone, subject to cover-quiet. `FakeClock`
owns platform deadlines; native observer bounds detect missing receipts.

`Telegram text decisions questions and formatting reach General as the human`
queues free text, decision/question commands and Telegram bold/link/code entities.
Arm the next-poll observer before startup, retain offset 5, then read exact
history fields: human attribution, Coordinator recipient, kind, text and source.
Read `remote.status` through local Neovim to prove reactions count as successful
outbound traffic. Formatting is discarded without parsing visible text as Markdown.

`Telegram replies use the mirrored topic and react stored before delivered`
posts an actual agent message through its spoke and seeds mirror-out's existing
native chat/message map. Arm the human message, native session delivery and
reaction observers before injecting the reply. Keep the source id, destination
topic, author, recipient, source mark and exact ordered 👌/👀 request parameters;
General must not contain the reply. Rendering and notices/cards are separate seams.

`Telegram replies to the native outbound mirror without an echo or a seeded
reply map` covers their integrated receive path after the mirror-out landing.
Retain an actual General agent frame, fake-accepted Rich Message and its durable
source mapping before replying. The reply must name that native source, reach
the Coordinator as the human, produce ordered 👌/👀 and leave only the original
message in the fake's outgoing census. Stop/join the hub, retain the exact poll
close and explicitly close/drain the fake before fixture removal.

`Telegram replays a stored input after interrupted feedback without a second
human message` holds 👌 after General commits, stops the first in-process hub,
observes the exact held TCP close and reopens the same database. The next poll
must confirm offset 2 and history must contain exactly one original message.
This is shutdown/reopen evidence, not a native SIGKILL assertion. The companion
gateway case captures a lost result before the adapter stores any receipt;
the [native crash guide](hub-test-telegram-polling-restart.test.ts.md) proves
the actual SIGKILL at that window with the shipped factory.

`Telegram stored feedback does not claim delivery until the queued addressee
receives it` retains only 👌 at the confirmed-offset boundary with no Coordinator.
Then connect the Coordinator and retain its exact human delivery, 👀 and the
matching reaction TCP close. This proves a send result alone cannot imply 👀.

`Telegram preserves workbench mention routing including named Aides and item
leads` compares native messages to previous-shape local `topic.send` results for
session, role, item-lead and named-Aide mentions. A bare `@aide` addresses nobody,
matching the existing workbench refusal to address the Aide role. Retain the
final offset and named Aide's actual Telegram-sourced delivery.

`Telegram delivery arriving as stored feedback settles acquires the next
reaction owner` completes the real fake 👌 HTTP exchange, then holds only its
native API result. Retain a real hub delivery frame while that result is held;
resolve 👌 and immediately forward delivery through `TelegramRemote.receive`.
This selects the microtask between the final drain check and a former deferred
ownership deletion. Keep exactly ordered 👌/👀, at most one active reaction,
and both native HTTP-close receipts. An absent 👀 is a failed boundary.

`Telegram restart reconciles a confirmed input whose durable session delivery
frame was lost` confirms offset 2 and 👌, then drops the real delivered frame
while retaining the session event and the hub history's `delivered` stage. The
platform's durable delivered bit remains false. Stop/reopen with the production
factory and retain one recovered 👀, unchanged offset, no repeated 👌 and native
close receipts. Startup uses a gateway-only native receipt lookup; ordinary
frame clients acquire no new read or mutation action.

Every case stops the hub and observes its exact long-poll close before teardown.
The fake's registered disposer joins its handlers and native connections before
fixture removal. Shutdown also aborts and joins reactions and pending frame requests.

The inbound handler follows explicit registry handlers and handles only new,
nonempty text or decision/question commands. Pairing starts, other commands,
media, edits and cards retain their dedicated handlers. The durable input id
comes from trusted native metadata, never a frame field; preserve the previous
wire regression in [gateway.test.ts](hub-test-gateway.test.ts.md).

T-1347 transport integration retains every history, offset, ordered-reaction,
TCP-close, held-settlement and lost-delivery recovery assertion. TelegramInbound
accepts the compatible setMessageReaction-only transport interface; TelegramRemote
supplies its per-chat queue while all stored/delivered/seen writes remain here.
`driveTelegram` uses persisted queue/deadline receipts to advance FakeClock between
reactions, including a persisted uncertain attempt before recovery. It never
advances during pending native HTTP. The pre-acquisition pacing owner owns each
Store, every hub start/restart and the custom held reaction's release/drain.
Reaction success carries no new message map; an unknown prior transport intent
stays fenced while the existing inbound recovery reconciles its feedback state.

`Telegram unsupported messages reply once confirm and do not replay after restart`
queues a photo, sticker, voice, caption-only message and document before ordinary
text. Retain five guidance replies, offset 7, exact General text and five logs
containing only event/update id/kind. Stop/join and reopen the same database;
retain offset 7, unchanged native messages and no additional fallback logs. This
is in-process reopen evidence, not SIGKILL coverage.

`Telegram silently confirms an edit and delivers the following text` retains
next offset 3, only the following text in General, no reply and exactly one
content-free `edited_message` diagnostic. Dedicated handlers run before the final
fallback; the command fence prevents duplicate guidance after interrupted handling.

The new fallback/edit/restart observers use `pacingOwner.observe` before setup.
The shared disposer cancels and joins observations before SQLite closes; native
close receipts use its `drain` option to survive producer cancellation. Its
`testWaitMs(5_000)` deadline starts when disposal begins, so acquisition cannot
consume the native-close budget.
`Telegram input fixture drains observers after omitted setup receipt` and its
`aborted` counterpart hold an actual sticker reply, omit/abort the hub setup
receipt, then retain native send close, stopped hub, cancelled unmatched poll
observer, zero pending observations/timers and closed SQLite. These controls run
through the same disposer as the fallback and held-card regressions.

T-1417 keeps a controlled 1100 ms acquisition delay after arming the observers
in both omitted/aborted setup controls. This deliberately exceeds the former
one-second deadline; it models scheduler delay and is not a completion wait.
The test then waits for `owner.serving` and the actual held-send receipt with
separate five-second setup bounds before triggering setup failure. Keep the
matching native close id, stopped hub, cancelled unmatched observer, closed
SQLite and zero observer/timer assertions. A deadline rejection is still a
failure, never a successful drain.
