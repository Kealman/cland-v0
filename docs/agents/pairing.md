# Pairing requests

The hub owns waiting codes, their expiry and per-stranger reply limits in
`hub.db`; [the pairing contract](../../hub/README.md#pairing-codes) describes
the trusted messenger callback and optional inbox rows. Use numeric ids as
strings. A platform adapter validates the pairing gesture and sends its callback
result privately; `null` is silence. A frame actor never supplies the messenger
source. Issuing a code grants no authority.

Approval callers resolve `InboxBoard.pairingCodes.get(id)` at the grant boundary,
then clear that messenger's other waiting codes with `clear(messenger)`. The local
approval handler and command are T-1333/T-1334. Remotes receive neither pairing
rows nor their needs-you count; the web cannot grant access. Existing one-argument
`Remote.start(send)` adapters and inbox replies without `pairings` remain valid.

Use the [T2 frame/fake-messenger seam](tests/hub-test-pairing-codes.test.ts.md)
for routing and the [T1 service seam](tests/hub-test-pairing-service.test.ts.md)
for local lookup, clearing and fake-clock expiry. Mutations invalidate synchronous
read replay at persistence; the 250 ms inbox publication is a separate boundary.
