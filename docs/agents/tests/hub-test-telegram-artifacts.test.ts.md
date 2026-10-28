# hub/test/telegram-artifacts.test.ts

T2 uses sealed `tempProject`/`projectHub`, production upload/send frames and the
loopback fake Bot API. Run only this file with
`node --test hub/test/telegram-artifacts.test.ts`. No browser or real platform
is used. The web case uses the human client's `artifact.upload` frame, not a
browser; the Telegram-origin case uses gateway native bytes and feeds its actual
committed message frame to the production adapter.

The cases cover a 2 KB document caption, an agent's long text with PNG/PDF
and duplicate legacy `artifact`/`artifacts` fields, later sent-above replies,
a sparse 60 MiB fallback plus 12 MiB PNG document, queued files across hub
restart and held-upload timeout, workbench authors and source echo suppression,
and a queued file replaced by a symlink. The planner is messenger-neutral;
Telegram limits are 10 MiB photo, 50 MiB document and 1024 caption code points,
counting multipart CRLF expansion. Captions have no entities or parse mode.

Advance the injected clock only after the previous job's durable sent receipt.
A held upload is a General job: its timeout commits `missed` with an `unknown`
attempt, not the non-General `uncertain` state. After restart, observe the
startup poll following resume, stop its writer, and inspect exact request and
accepted-upload counts. Never infer non-delivery from a timeout. Queued payloads
hold artifact ids and captions, never bytes or absolute paths. Cleanup joins
all hub and fake writers before fixture roots and database readers disappear.

Fixture artifact creation is muted before the General send under test. It uses
real artifact creation and real General attachment policy; artifacts cannot be
attached across topics. The symlink case replaces the queued file only after
the text send commits, proving delivery-time confinement independently of
planning-time validation. Existing card, pacing, rich fallback and gap tests
retain their semantics and native payload compatibility.

Source-review regressions retain same-chat user replacement and changed-chat
pairing across restart: exactly one upload, with a native reply only in the
original chat. The reservation belongs to the messenger, independent of pairing;
admission still belongs to the captured current pairing. Existing persisted
file methods are recognized by artifact id, preserving earlier once keys.

The contiguous-publication case holds the first rich send, commits a card and a
later General message, advances the inbox coalescing clock, then releases that
exact request. Native order must be text/photo/document/card/later-text. A
persisted active-batch marker preserves this ordering after a publication starts;
ordinary cards still lead publications that have not started.

The no-follow reader is shared with WebArtifacts. Two API-boundary swaps replace
the leaf or parent after contents are descriptor-bound but before multipart
consumption; upload digests must match the authorized-file positive control,
never the fabricated outside bytes. Descriptor stat/type and bounded reads enforce
the cap, cancellation is checked while reading, and finally closes the descriptor.
The Telegram API receives a Blob for these jobs and never reopens their pathname;
its existing optional path-only API remains available to old native callers.

All acquisition uses the pre-registered pacingOwner, including Store creation,
hub start/restart and native observations. The omitted and aborted setup controls
hold getMe, retain a second intentionally unfulfilled observation, then release
and observe the exact held TCP close before closing the fake. After disposal they
assert the acquired hub stopped, the Store closed, zero observations and both
clock timer sets empty, plus the native fake server/connection/handler close receipt.
The startup closer closes the native fake in finally even if its receipt fails.

Every owned native observation also has its own deadline: `observeReceipt`
arms a five-second (test-scaled) bound as the observer is created, and on success,
failure or timeout cancels and joins its raw observation. Supplying the owner
signal therefore never removes the setup bound. Preparation is bounded before
fixture acquisition starts and rejects on earlier acquisition failure; late
acquisition and stopped-hub receipts have separate bounds too.

The omitted-exact-receipt case holds a real getMe request but makes the expected
request predicate deliberately impossible. Its separate receipt clock expires
before the hub setup clock advances. That error aborts acquisition, cancels and
joins the absent observer, and reaches the same exact TCP-close, native census,
closed Store, stopped hub and zero-observation/timer assertions. It proves the
missing receipt path independently of the existing startup timeout and explicit
abort controls.
