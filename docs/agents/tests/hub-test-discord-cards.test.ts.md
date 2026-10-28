# hub/test/discord-cards.test.ts

T2, production hub frames and native Discord REST/ws through the sealed exchange
owner. Run this file alone: `node --test hub/test/discord-cards.test.ts`.
No browser, real platform or real credential is used. The exchange owns hub stop,
native drainage, Store close and fixture removal, in that order.

The generated cases cover nine short options in rows of five/four plus the two
secondary actions; numbering and an intact option list for long labels; native
content budgeting for a large question; a stored Discord answer observed at the
native type-7 callback boundary; a held topic.answer deferred at exactly 2000 ms
and completed through a settled outbox edit; coalesced publication oldest first
while General is muted; foreign/unissued/out-of-range button refusal; modal answers and declines; and stop before and after deferral with no late edit or timer.

Advance the shared fake clock 250 ms after committed asks to publish the inbox.
Wait for the durable remote message mapping before pressing. `interact` accepts
`message_id` and `custom_id` to emit a component interaction, and defaults to the
paired human; `user: "member"` selects the foreign member. Its state contains
callback arrival timestamps and enforces a strictly-under-three-second initial
callback. Type 7 updates the original fake message. The optional onCallback
observer sees only interaction id/type and proves the durable hub-result receipt
exists before native callback acceptance. Interaction tokens stay in adapter/fake
memory and never enter frames, outbox payloads or exported receipts.

Existing command interaction shapes and historical Discord outbox payloads remain
valid. Restart tests must respect the persisted five-second Identify reservation;
this file does not assert restart/catch-up.

`Discord lost defer response still settles the committed outcome without a second callback`
uses `interact` with `lose_callback_response: true`: the fake accepts the initial
callback, then destroys its native response. The production hub result must still
produce a settled outbox edit, remove buttons and retain exactly one type-6
callback. Enqueue the owed edit independently of defer success and join both
owners on stop.

Modal and shared-gate coverage uses both production messenger factories and both
loopback fakes in one sealed project. `interact` with `modal_text` emits a type-5
Label/Text Input submission; component clicks still use the previous shape.
Assert type 9 with question Text Display before Label/paragraph input, then the
stored outcome, native update and Telegram edit. Use `driveTelegram` only from
durable pacing waits. Web and Neovim frames, Telegram presses and racing native
presses check the same outcome; closure cases assert REST settlement and removed
buttons. The held-channel case arms `waitForHold` before publishing, observes a
queued card, closes its ask, releases the native request and checks `dropped`
plus absence of any native card mapping. No browser is used by these frame tests.

Accepted-but-unmapped cards survive closure and adapter restart: hold the native
POST after storage, answer through a workbench, stop the adapter to lose its
response, then restart after advancing the persisted five-second Identify budget.
Assert the original native id is mapped, exactly one native copy exists, the
same enforced nonce is used on recovery, and its durable edit removes buttons.
Unattempted closed cards still drop. Recovery outside the original two-minute
nonce window remains fenced; no new send window is granted by closure.

`holdRequest` registers the rejecting hold observer with the exchange before
producer setup can yield. Setup failure aborts and joins the observer and releases
holds. Omitted and pre-aborted setup controls check intended bounded failure,
zero exchange work/observers/holds, then native close, handlers, sockets and fake
clock timers. Node's test runner treats any unhandled rejection as a failure.

The post-map/pre-fold interruption control uses the public native outbox seam
and an injected throw immediately after the real `writeOutbox` completion/map
transaction returns. It keeps the actual accepted fake message, durable closure
and pending General job, stops the first owner, then closes and reopens SQLite.
The new owner must reconstruct the owed edit before draining General. Assertions
retain the original native id, one card copy, removed buttons, outcome, durable
edit settlement, native PATCH-before-General-POST order and a no-I/O second resume.
This models the persistence checkpoint; it does not claim OS process-crash timing.
