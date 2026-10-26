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
