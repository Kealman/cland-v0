# hub/test/telegram-cards.test.ts

T-1359 adds four sealed T2 frame/native controls:

- `Telegram one inbox publication sends three newest-first asks oldest first ahead of queued General`
  holds one native General send, queues another before releasing a real
  newest-first inbox frame, and checks all durable maps and the final accepted
  order. The in-flight message finishes first; the cards precede queued General.
- `Telegram inbox resends only open asks oldest first and an answer from a new copy folds every copy`
  closes one of three asks in Neovim, observes two new mapped copies in age
  order, presses a new copy, and checks both native outcomes. Pressing the other
  ask's original copy proves its retained buttons also work after resend.
- `Telegram inbox resend lost HTTP receipt stays fenced across restart and a new command makes a fresh copy`
  holds the fake's accepted resend response, joins its native close before
  component restart, and checks confirmed input, an uncertain unmapped copy,
  no retransmission and a fresh mapped copy from a new command.
- `Telegram empty inbox replies with only Nothing needs you` retains the exact
  single native message and confirmed command offset.

All publication and command effects use the existing per-chat queue. Resends
reuse opaque ask/approval keys with command-scoped job keys; earlier automatic
keys, wire frames and persisted maps remain readable. There is no OS-crash,
real-platform, browser or latency claim. Linux durations and gate mode come
from queued verification.

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

`Telegram refuses unissued and cross-ask button data` proves C3 with real presses. Edit a real fake message to carry an
unissued key, then the issued key of another ask; preserve both open asks and
each toast/offset. The extra direct API client uses real HTTP deadline time and
a one-second abort signal, with an independent five-second native case bound;
the server clock remains injected. Other answer and Decline prompt flows are covered below.

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
`telegram-commands.test.ts` separately retains command replay and the shared
long-card renderer for live `/inbox` sends.

Before source review, run the touched test files serially plus `npm run typecheck`;
the queued verifier owns broader selection. The polling
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


Cross-client closure (T-1354) adds these T2 frame/fake receipts:

- `Telegram ask answered via Neovim edits its mapped card from the hub outcome
  without buttons` and the `via web` case use a real Unix client and a signed-in
  web WebSocket respectively. No browser runs. They keep exact rendered outcome
  text, source, actor, time and empty keyboard assertions.
- `Telegram withdrawn ask edits its card without buttons` and the cancelled case
  resolve or close a dedicated topic over the public protocol, then observe the
  durable edit and native card. No new wire fields are needed.
- `Telegram drops a closed ask card queued behind a 429 hold without sending it`
  observes the durable never-left attempt, answers through Neovim, then observes
  the dropped job. It retains exactly one non-delivery attempt, no accepted
  message and an enabled adapter after shutdown.
- The two `Telegram tap racing a Neovim answer keeps the … winner on every copy`
  cases hold the actual inbox read result or committed answer result at the
  adapter boundary. A second native accepted card plus durable map represents
  a prior resend; resend admission itself belongs to `/inbox`. Both orders
  assert one stored answer and identical winner text with no buttons on both
  copies, plus the losing press toast or losing Neovim result.
- `Telegram inbox departure with a web decline edits the card when its ask frame
  is unavailable` drops ask frames and retains the native decline edit after
  the inbox coalescing publication. The departure's existing `declined` reason
  carries an answered ask state and the durable decline outcome.
- `Telegram in-flight card mapped after an answer still turns into its outcome`
  holds the fake's request before it sends, observes the committed ask frame,
  then releases that exact request. The stored closure folds the late map.
  `hold-after-send` deliberately has no releasable response; it is suitable for
  missing-receipt tests, not this receipt-delay test.

All behavioural waits are bounded separately from setup. These are component
receipts on the fake, not real-platform or browser evidence. Before source review
run touched files serially plus typechecking as directed by the item lead;
retain the file/phase results and platform.

The uncertain accepted-card restart control now closes that ask through Neovim
before restarting. Its unknown send still remains uncertain and is never replayed
or relabelled as a safe source-closed drop.


The authenticated web client uses `telegram-card-web-fixture.ts`. Its owner is
registered before `pacingOwner`, and explicit fixture stop drains it before the
hub. HTTP request and response close events, WebSocket close, native acquisition
and the independent readiness observer are owned before their operations can
complete. Disposal aborts acquisition, destroys outstanding HTTP work, terminates
the socket and waits at most two seconds for native close and setup observers.

Three same-disposer controls preserve the actual web decline/card assertions:
a deliberately omitted readiness receipt after a real authenticated handshake,
and aborts immediately after HTTP request or WebSocket acquisition. The missing
receipt case holds completion of its socket-close observer after the actual
native close event, verifies disposal has not joined, then releases it. Removing
the drain await fails that exact assertion (`true !== false`); restoring it
passes. A terminate-only negative control without this held observer was green
because native close happened before inspection, so it is not claimed as a red
receipt. Final controls require matching native started/closed counts, joined
setup, no active readiness observer and zero pending owned work. No browser or
real platform is involved.


T-1355 adds the same T2 frame/fake seam for prompt input:

- `Telegram Other answer sends a separate ForceReply and the next text answers only its ask`
  retains the separate reply target/placeholder, no ForceReply on the card,
  one editable ask map, exact free-answer outcome via Telegram, stored/delivered
  reactions and one answer rather than a General message.
- `Telegram Decline reply to its ForceReply records the reason and folds only the card`
  checks `declined` with the typed reason, outcome text, empty card keyboard and
  the unchanged immutable prompt.
- `Telegram cancel clears the decline wait but keeps the ask buttons and sends next text to General`
  observes the accepted cancel reply and confirmed input before checking the
  open ask, retained buttons and subsequent ordinary message.
- `Telegram typed reply to a free-answer card answers it` and
  `Telegram typed reply to an options-only card requires an option number`
  retain the exact answer, non-number note/open ask, valid numbered choice and
  absence of a stray General message.
- `Telegram prompt wait survives component restart and consumes the next text once`
  rebuilds the hub/adapter over the same SQLite state and retains one prompt,
  the original immutable prompt and exactly one answer after restart.
- `Telegram prompt answer lost result replays its durable answer instead of posting to General`
  interrupts the actual committed answer result before feedback/offset, rebuilds
  the component, and checks the same stored answer id and exactly one history row.
- `Telegram reply to an older prompt targets its own ask after a different next-text answer`
  proves explicit prompt mapping wins after another prompt consumed the chat wait.
- `Telegram prompt answer losing the inbox-read race notes the closed ask and consumes no General message`
  holds the actual inbox result, answers in the workbench, then releases it.
  The losing input receives a closed-ask note, confirms its offset, and changes
  neither the winning outcome nor General.

- `Telegram prompt feedback interrupted after commit restarts without a stale note or duplicate answer`
  holds the actual reaction request after the answer committed, observes its
  native close before rebuilding, and retains the original answer, confirmed
  input and no closed-ask note. Admission and feedback are separate boundaries.

No new wire field, database column, authority grant, real browser or platform is
required. `remote_state` gains additive intent/selection/receipt keys. The native
input path reuses the existing gateway answer receipt and inbound feedback owner.
These restarts are component restarts, not OS crash claims. File-level duration
and enforce/report gate facts come from verification receipts.


Source-review corrections (M1/M2) retain every original criterion assertion:

- `Telegram uncertain ForceReply send confirms the callback and safely consumes an unmapped reply after restart`
  injects native `accept-disconnect` on the prompt send, observes its uncertain
  job, then requires the exact next callback offset. It restarts with the actual
  accepted but unmapped prompt, replies to it, retains the incomplete/note outcome
  with no answer or General post, cancels and confirms later ordinary input.
  Final native request/message counts and the uncertain job prove no prompt
  retransmission. Quoted prompt text never supplies routing authority. Before
  the fix the cursor step hit its deadline with the unknown send fenced.
- `Telegram confirmed prompt answer recovers owed delivery feedback after component restart`
  drops the actual delivery frame after an answer result, requires the confirmed
  input offset and the hub's current delivered stage, and verifies the adapter
  still owes its delivery reaction. Rebuild only after stopping every writer.
  Arm native reaction and TCP-close observers before restart; retain the exact
  message id, close id, unchanged confirmed offset, exactly one answer/history
  row and one stored/one delivered reaction. Before the fix it failed with
  `confirmed ask answer is missing recovered delivery feedback`. This control
  does not replay the input: it proves the native recovery reader follows the
  answer receipt to the current stored message/stage.

The internal Conversation recovery callback takes an optional trusted messenger
argument; existing one-argument consumers keep direct-id lookup. The exported
RemoteReceipt and all wire frames stay unchanged. `gateway.test.ts` retains the
same-identity other-messenger refusal and previous-wire action controls for
native answer receipts, alongside ordinary input recovery.


T-1356 retains the same sealed T2 frame/fake seam:

- `Telegram stale press on a closed mapped card makes no hub request and preserves its outcome across restart`
  closes through Neovim, restarts the component, restores a stale native keyboard
  with its original opaque keys, then presses it. Keep `Already answered`, zero
  outbound hub frames, the unchanged stored outcome and the removed keyboard.
  A second restart replays the callback id and retains exactly one native toast.
- `Telegram foreign card press gets one private alert without hub frames or card changes and duplicate ids stay inert`
  requires the exact private owner refusal with `show_alert`, the confirmed
  offset, zero hub requests and unchanged card/ask before and after callback-id
  replay. `Telegram foreign input outside a bot-authored mapped card remains silent`
  covers unmapped copies, forged card authors, groups, bot pressers and ordinary
  foreign text. These are explicit negative controls for the admission exception.
- `Telegram late text goes to General marked late while its prompt wait and ask stay open`
  uses an actual fake 503 poll outage, a retained native timestamp and recovery;
  keep the exact General text, Telegram source, absent answer target and original
  wait. Both `Telegram late reply to … card answers only its mapped open ask`
  cases preserve another ask's wait: the closed target gets a note and no General
  post, while the open target alone gets the answer.
- `Telegram late General routing survives feedback interruption and restart without consuming its prompt wait`
  holds the native reaction after General commits, observes its exact TCP close,
  restarts over the same store, and retains one marked General message, no ask
  answer, the original wait and the confirmed update offset.

Red receipts before implementation: the closed press emitted `inbox.list`;
the foreign press had zero callback responses; late unthreaded input changed
its waiting ask to `answered`. The existing transient callback test also guards
saved `Answered` replay; a new stale press must not overwrite that receipt.
No real platform, browser or OS crash is exercised. New cases have no latency
claim; Linux duration and gate mode come from the task verifier's receipt.


T-1356 source-review M1 adds
`Telegram uncertain stale-card outcome fallback releases its callback and later input across restart without retransmission`.
It closes the ask through Neovim, restores its stale keyboard, refuses the repair
edit with a definite 400 and accepts/disconnects the fallback reply. Keep the
uncertain job, saved Already answered toast, confirmed callback offset, unchanged
hub outcome, restarted component and subsequent General input receipt. Exactly
one native outcome reply and one callback answer remain after shutdown. The
unknown fallback is marked incomplete and stays fenced; it cannot hold the
already-closed callback cursor. The pre-fix run failed at the exact boundary with
`stale callback confirmation blocked by unknown fallback`.
