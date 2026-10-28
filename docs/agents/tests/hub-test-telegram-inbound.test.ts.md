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
queues a location, sticker, voice, caption-only message and contact before ordinary
text. Retain five guidance replies, offset 7, exact General text and five logs
containing only event/update id/kind. Stop/join and reopen the same database;
retain offset 7, unchanged native messages and no additional fallback logs. This
is in-process reopen evidence, not SIGKILL coverage.

`Telegram replies to an edit and delivers the following text` retains
next offset 3, only the following text in General, one fallback reply and exactly one
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

T-1385 adds native photo/document uploads through the production factory. Keep
largest-size bytes, JPEG suffix, one captioned human message, empty captions,
named document replies in a mapped topic, and the declared-25-MB refusal with no
getFile call. The restart case holds getFile, observes durable offset 3 with an
empty General, stops/joins the hub, and reopens to retain exactly media then text.
This is in-process restart evidence, not SIGKILL coverage. The transient failure
case preserves command bypass and waits for a durable media completion receipt
before asserting the queue drained. Sink scans have token/URL positive controls
and inspect actual frames, log, journal and every uploaded artifact's raw bytes.

Review corrections retain a deterministic public MediaQueue handoff test: resolve
one native-worker callback, enqueue the successor in the retiring owner's turn,
and wait for its durable completed identity before asserting exact order. Held
getFile and download controls revoke pairing through remote.unpair, optionally
replace it, observe the exact native close id, and assert no artifact/message.
File-preparation controls hold a real FileHandle.writeFile after exact bytes are
written, revoke pairing before releasing it, and retain the rollback/no-message
assertions. The filesystem mock is restored through syncBuiltinESMExports and
its release is registered with the pacing owner before hub acquisition.

The six generated `Telegram media <getFile|download> <401|403|409> saves fatal
state and recovers queued work on reload` cases retain saved disabled status,
stopCause, one native hub notice, the exact poll-close receipt and one uploaded
artifact after unchanged reload. Fatal media completion joins polling before
reaching Gateway's lifetime observer. The omitted/aborted held-media setup
controls retain exact getFile close identity, stopped hub, drained observers,
closed SQLite and zero clock timers. Media fake observations use pacingOwner
signals, with independent post-acquisition setup bounds and drainage ownership;
UI message observation checks captured frames under the same owner.

T-1386 album cases retain three ordered photo bytes on one message and every
native reply map, with ordinary text closing the group. The restart case waits
for offset 3 plus the exact native getUpdates(offset=3) receipt with empty
General, joins the stopped hub, advances downtime, and
adds a third file using the fake control's optional opaque `group`. Wait for
offset 4, advance 1999 then 1 injected milliseconds, and assert one message with
the first non-empty caption, exact bytes and one stored reaction per item. The
fake poll offsets [3, 3, 4] show the second and third cursor confirmations;
re-polling offset 3 on startup does not confirm an item twice. This is stopped
in-process restart evidence, not an OS SIGKILL test. The four-item case omits the
25 MB document, retains the three other files in order, maps all four items,
and asserts one named native refusal plus exactly three getFile requests.

The committed-album/lost-result case drops the actual successful upload result
at the Remote receive seam, verifies the committed General message through
public history, and stops with the group still stored. The fake `expire-files`
control removes all native downloads before restart. Retain exact original
message id and bytes, maps for both members, one stored reaction for each,
queue completion, and only two total getFile calls (both before restart).
Recovery consults Gateway's messenger-scoped durable ingress receipt first.

Receipt consumer controls also run telegram-cards (exact legacy single-message
shape and confirmed prompt recovery), telegram-polling-restart and telegram-notices
(absent receipt controls). Only album receipts gain targets and per-target progress.
