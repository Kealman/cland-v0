# hub/test/telegram-messenger.test.ts

T2 exercises the default Telegram messenger factory through sealed
`tempProject`/`projectHub` and the existing Unix-socket frame client. Every run
supplies a loopback fake API root and the fake's fabricated token in a private
scratch store. No real Telegram call, browser or hub process is involved.
Run this file alone with `node --test hub/test/telegram-messenger.test.ts`.

`configured Telegram uses the production factory for token checks and a paired
send` omits `gatewayMessenger`/`gatewayRemotes` injection. It seeds a numeric
pairing through the storage API, then retains the successful `remote.test`
reply, exact fake chat/message and `remote.status` traffic/bot-link facts.
This isolates factory construction and the existing callback contract; the case
does not exercise pairing or mirroring. The inbound mirror has its own
[guide](hub-test-telegram-inbound.test.ts.md). Polling
This isolates factory construction and the existing callback contract; it does
not exercise chat pairing or mirroring. Native `/start` pairing and blocked-bot
reporting are covered in [telegram-pairing.test.ts](hub-test-telegram-pairing.test.ts.md). Polling
is covered separately in the polling component and restart guides.
Keep projectHub's native resource check: the client closes each HTTP connection
instead of leaving a socket and idle timer in fetch's global keep-alive pool.
Arm the fake's `waitForConnectionClose('sendMessage')` before `remote.test` and
retain that TCP-close receipt while the remote is still active. This assertion
remains red if keep-alive returns, even though shared `onCleanup` closes the
fake on every failure before fixture checks. Separate native after hooks stop
at their first failure, so use the shared cleanup owner for the fake.
Its one-second close bound starts after the successful frame result, separately
from the five-second setup observer. Waiting through fetch's idle pool expiry
does not prove prompt request drainage.

`Telegram refusal reaches actual frame log journal and artifact sinks without
its token` arms a fake `getMe` refusal that echoes the fabricated credential.
It requires the masked error in the actual frame result, disabled-remote log,
drained process log and created artifact file, then writes that client error to
an owned native Journal and checks its closed-file receipt. The hub journal is
also scanned, but a remote-disabled log is not itself a hub journal event.
Positive receipts are checked independently of the token-absence scan. The healthy `hub.status`
reply proves failure stays within the remote. Stop the hub before reading
durable log/journal bytes; the successful artifact creation reply owns that file.

`Telegram configuration reload starts the native client only when enabled`
retains zero requests while disabled, `getMe` and the first held `getUpdates`
after the exact reload result (arm the poll observer before reload),
unchanged-client retention, then disable completion and an unavailable test.
The daemon's explicit environment selects the fake root on startup and reload.
Set the fixture's verification lock path to `join(root, 'suite.lock')` before
rendering reload candidates, so they retain projectHub's isolated lock setting.

Keep the existing `config-set`, `gateway-secrets`, `gateway`, `remote-cli` and
`project-hub-lifecycle` regressions: explicit factory/legacy remote injection,
optional callbacks and previous-hub management replies retain their contracts.
No frame field, role permission or role-clause line changes here.

`shutdown aborts held Telegram getMe during native factory reload` starts a
disabled remote, holds the real fake API's getMe response, then enables it by
reload. Arm held-entry and TCP-close observers before reload; observe entry
before stopping. Keep the exact native close id, failed-or-disconnected reload,
completed hub stop, empty held-request state and zero fake timers. The single
FakeClock never advances to the HTTP deadline. Gateway aborts the optional
third `Remote.start` lifetime signal before joining startup; its acquisition
fence and join remain, and legacy signatures simply ignore the additive signal.
