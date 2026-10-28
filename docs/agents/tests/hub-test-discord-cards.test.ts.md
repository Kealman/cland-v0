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
while General is muted; foreign/unissued/out-of-range button refusal; private
modal placeholders; and stop before and after deferral with no late edit or timer.

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
this file does not assert restart/catch-up or cross-client outcome propagation.

`Discord lost defer response still settles the committed outcome without a second callback`
uses `interact` with `lose_callback_response: true`: the fake accepts the initial
callback, then destroys its native response. The production hub result must still
produce a settled outbox edit, remove buttons and retain exactly one type-6
callback. Enqueue the owed edit independently of defer success and join both
owners on stop.
