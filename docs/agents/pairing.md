# Pairing requests

The hub owns waiting codes, their expiry and per-stranger reply limits in
`hub.db`; [the pairing contract](../../hub/README.md#pairing-codes) describes
the trusted messenger callback and optional inbox rows. Use numeric ids as
strings. A platform adapter validates the pairing gesture and sends its callback
result privately; `null` is silence. A frame actor never supplies the messenger
source. Issuing a code grants no authority.

With Telegram enabled and its token resolved, open the `t.me/<bot>` link from
`cland remote status` and press Start in a private chat. The native client calls
the trusted pairing callback for `/start`; the private reply contains the sender's
numeric id, code and copyable approval command. The service owns reply limits
and expiry. After local approval, `/start` names the loaded project instead.
Explicit injected handlers keep first-match priority. Use the
[native pairing regression](tests/hub-test-telegram-pairing.test.ts.md) for the
CLI grant, stranger silence, blocked-bot reports and durable kick consumption.

Approval callers resolve `InboxBoard.pairingCodes.get(id)` at the grant boundary,
then bind the stored identity and clear that messenger's waiting codes in one
transaction. Call `pairing.approve {messenger, code}` from a human `nvim` or `cli`
connection on the local Unix socket, or Neovim on parent-owned stdio. It returns `{pairing}` with numeric ids as
strings and the display name. An attributed shell, other client, web connection
or remote cannot grant access. `cland remote approve <messenger> <code>` prints the paired name and id.
`cland remote unpair <messenger>` forgets that messenger’s binding. Remotes receive neither pairing
rows nor their needs-you count; the web cannot grant access. Existing one-argument
`Remote.start(send)` adapters and inbox replies without `pairings` remain valid.

Implement `Remote.pairingReplaced(previous, text)` in platform adapters to send
the fixed replacement line to the captured old chat. The gateway owns and drains
that callback, applies the shared redactor and isolates failures; the new grant
has already committed. See the [approval frame regression](tests/hub-test-pairing-approval.test.ts.md)
for authority, expiry, numeric persistence, replacement and shutdown receipts.

Use the [T2 frame/fake-messenger seam](tests/hub-test-pairing-codes.test.ts.md)
for routing and the [T1 service seam](tests/hub-test-pairing-service.test.ts.md)
for local lookup, clearing and fake-clock expiry. Mutations invalidate synchronous
read replay at persistence; the 250 ms inbox publication is a separate boundary.

Remote management status, test and rotation receipts use the [sealed CLI and
fake-messenger seam](tests/hub-test-remote-cli.test.ts.md). New pairings store
the loaded `remote.mute_default`; token reload keeps numeric identity and mute.

After pairing, [Telegram phone commands](../../hub/README.md#telegram-phone-commands)
use the gateway's allowed reads. The native private-chat menu is compared with
Telegram on every start and written only when its command/description list
differs. Pairing grants remain local even when `/inbox` or `/status` is read remotely.
