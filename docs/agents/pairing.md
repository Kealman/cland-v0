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

`cland setup` also uses the local human CLI connection. After enabling Telegram,
it pauses with the bot link for Start and Enter, reads this messenger's waiting
inbox rows and confirms the selected row before `pairing.approve`. Multiple rows
offer a choice; an empty list offers one extra wait. No leaves the binding alone
and prints the selected row's approve command. Nonterminal setup never approves:
an enabled, unpaired remote reports `open` with the available bot link and command;
a connected, paired rerun reports `ok`. The wait/choose/confirm helper is keyed
by messenger so another platform can supply its own pairing gesture. See the
[setup pairing regression](tests/hub-test-setup-pairing-component.test.ts.md).

Approval callers resolve `InboxBoard.pairingCodes.get(id)` at the grant boundary,
then bind the stored identity and clear that messenger's waiting codes in one
transaction. Call `pairing.approve {messenger, code}` from a human `nvim` or `cli`
connection on the local Unix socket, or Neovim on parent-owned stdio. It returns `{pairing}` with numeric ids as
strings and the display name. An attributed shell, other client, web connection
or remote cannot grant access. `cland remote approve <messenger> <code>` prints the paired name and id.
`cland remote unpair <messenger>` forgets that messenger’s binding. Remotes receive neither pairing
rows nor their needs-you count; the web cannot grant access. Existing one-argument
`Remote.start(send)` adapters and inbox replies without `pairings` remain valid.

Both Inbox views place waiting rows in **Asks and approvals**, counted there.
Enter on Neovim's row opens its pairing card; `1` approves, `q` or Escape closes.
The card shows messenger, numeric user id, name, code and expiry, then the paired
name or the hub's refusal. The web says "approve in the terminal or Neovim" and
offers the command as selectable read-only text at desktop and phone widths,
with no approval key or control. The next inbox update removes codes after
approval, replacement or expiry, including from retained visits and split detail.
Use the [cross-client regression](tests/web-test-pairing.test.ts.md) for the
real Neovim key and isolated Headless Shell boundary with test messengers.

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

Native Telegram `/mute` and `/unmute` affect only eligible General traffic for
that pairing. Keep hub notices and card paths outside the gate. Persist one
missed count per General source; `/unmute` resets it and reports the old count.
New approval resets that count along with applying `mute_default`. Keep command
effects atomic with chat/message-id receipts before reply I/O so replay after
interruption cannot reapply them. An interrupted reply is uncertain and stays
fenced. The [mute guide](tests/hub-test-telegram-mute.test.ts.md) covers the
frame/fake receipt boundary; status retains its existing mute field.

After pairing, [Telegram phone commands](../../hub/README.md#telegram-phone-commands)
use the gateway's allowed reads. The native private-chat menu is compared with
Telegram on every start and written only when its command/description list
differs. Pairing grants remain local even when `/inbox` or `/status` is read remotely.

A paired Telegram human can answer an ask by tapping its option card. The hub
stores the answer with `via: "telegram"` before acknowledging the press and
confirming the update. Keys must belong to that card's ask; Other answer and
Decline currently show `Not available yet`. Outcomes remove the buttons and
name the choice, actor, source and hub-local time. Long questions keep one card
with a marked preview; full labels and the question remain in the workbench.
See [Telegram ask cards](../../hub/README.md#telegram-ask-cards) and the
[frame/fake regressions](tests/hub-test-telegram-cards.test.ts.md).

## Workbench remote state

`remote.state` is the safe, pushed replacement for connection, pairing name, mute,
outbox depth and failure facts. Snapshot clients read optional `sessions.remotes`;
older hubs can omit it. Never reuse the local `remote.status` row for a workbench
push: that row contains token fingerprints and numeric routing identities.
Neovim and web Sessions render enabled messengers beside verification, with
offline/stopped rows in the error highlight. Web facts wrap at phone width and
field meanings live in `title` tooltips. Its connection model replaces the rows
from snapshots and pushes, clearing stale facts if a snapshot omits the optional
field. Connection and pairing changes bypass the one-second depth-only
coalescing window. The web receives the safe push while `remote.status` remains
refused; remote management authority is unchanged.
