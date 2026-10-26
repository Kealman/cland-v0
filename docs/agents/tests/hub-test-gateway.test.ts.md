# hub/test/gateway.test.ts

`hub/test/gateway.test.ts` is T2. Use `projectHub` with `gatewayRemotes` and
`testMessenger` from `hub/test/fakes/messenger.ts`. Each messenger exposes the
existing `frameClient` interface; its platform port carries no hub credential.
The fixture retains the ordinary Unix, spoke and web edges and sealed account
and Git environment. No real messenger, browser or native harness is involved.

Observe the exact message id in the remote's `message` frame before replying,
and the Coordinator's channel receipt before asserting human attribution.
Observe `delivery`, ask and inbox/approval frames at the same seam. Approval
completion must retain the fake adapter's native choice/note receipt as well
as the closed record. Hub shutdown must stop the remotes before store disposal.

Keep the six allowed request types explicit in the regression. Enumerate the
other human request types using the exhaustive web table, and retain pairing,
unknown/prototype frame names and actor overrides. A forbidden result naming
the request proves refusal before malformed payload validation; retained topic
history proves forged replies and artifact sends wrote nothing. A valid local
client can still create topics and launch the fake harness using its old hello
shape. Two remotes start their frame-client request ids at the same value:
their successful, distinct results prove gateway correlation isolation over
one dispatcher conversation.

For startup/shutdown races, hold a messenger's `start`, request gateway stop,
then release setup and observe both promises settle. Retain the final stopped
receipt, absence of later remote acquisition and refused post-stop admission.
Register release and drainage cleanup before triggering startup; only the
already-started remotes need stopping. The dispatcher hello deadline begins
after remote setup, so a held platform start owns no waiting conversation.

The optional third start argument is a lifetime signal, aborted before joining
partially started work. Native Telegram's held getMe cancellation proof is in
the [messenger guide](hub-test-telegram-messenger.test.ts.md).

Remote provenance uses `testMessenger(id, via)` (`telegram` by default), or
`testMessenger(id, { via, startError })` to combine source and startup faults. The
platform source travels as trusted `Conversation.receive` metadata on the one
shared conversation; a frame's own `via` cannot override it. The Telegram and
Discord cases use a fake clock and observe the exact `approval` delta, then
read ask outcomes, denial-note messages and archive entries through a local
client with the previous hello/request shape (no features). Preserve declines,
native choice/note receipts and simultaneous sends from both sources.

Workbench proof is in `web/test/remote-via.test.ts` and
`nvim/test/remote-via.test.ts`; the latter replays committed frames and accepts
legacy ask outcomes with no source. These tests involve no real platform,
token, native harness or GUI browser.

Failure isolation uses the fake messenger's startup error, controlled run-loop
rejection and synchronous/asynchronous receive faults. Check both broadcast
fanout and correlated results. Inject `testRemoteStates()` through
`projectHub`'s `gatewayState`; observe its exact disabled/reason row and the
matching `remote-disabled` log before asserting the failed remote's stop
receipt. Keep the healthy remote's real request/result and message-id receipt,
and an authenticated web `/ws` client's successful requests after each fault.
The web fixture uses only HTTP and WebSocket clients, with no browser binary.

For held cleanup, prove healthy startup completes while the failed stop is
pending, then release and drain in `finally` so a red startup deadline cannot
strand fixture writers. For shutdown, hold run and receive separately past the
remote stop receipt and release each before observing final completion. A stop
failure stays owned, is attempted once and reaches final shutdown only as a
redacted error. A synthetic registered credential must be absent from both the
state sink and hub log; retain a readable reason and matching log/state values.
T-1326's sink is intentionally independent of the hub.db table wiring owned by
T-1323; its evidence proves the injected storage boundary.
