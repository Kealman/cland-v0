# hub/test/telegram-commands.test.ts

T2 uses sealed `tempProject`/`projectHub`, the production gateway frame port,
native Telegram factory and loopback fake Bot API. Every credential is fabricated;
no browser, real platform or native hub process is used. Run this file alone with
`node --test hub/test/telegram-commands.test.ts`, subject to cover-quiet.

The private-menu case starts/stops the same scratch hub three times. It retains
the first scoped command/description write, the unchanged second start's zero
additional writes, and repair after the fake's `/control/commands` changes the
platform list. A local hash cannot satisfy that last control. Each start completes
through its held native poll and each stop joins that exact poll's close.

The help case retains title, bold labels, command bullets and final italic trust
lines as explicit UTF-16 entities, including a non-BMP project name. The status
case creates seven real fixture spokes, a release and an ask through public tools;
it checks six session bullets, remaining count, Coordinator/needs-you, queues,
release and transport numbers last. No extra remote authority is granted.

The inbox case retains empty text, repeated open ask/options, local pairing grant
exclusion and the unchanged open ask after `/cancel`; paired `/start` names the
project. Card actions and Other/Decline drafts belong to the cards feature.

The replay case arms `hold-after-send` before `/cancel`. The held native receipt
and actual fake message prove the reply committed; shutdown closes that exact
HTTP request before the scratch hub restarts. The replayed input reaches its
stored offset without another reply. This is in-process restart/response-loss
coverage, not a process-crash or exactly-once transport claim. The queued
transport's unknown attempt stays fenced, and the durable command identity
prevents a new logical reply. A new human command remains the recovery for an
unknown reply. Keep identity before the first queue write and the final
single-message assertion.

The long-card case keeps General in rich format and sends an ask below the hub's
8 KiB cap but above Telegram's 4096-code-point bound. It checks numbered plain
parts, each entity/text budget, literal Markdown characters and non-BMP text
reconstructed without loss. Command formatting escapes facts before calling the
landed `markdownToEntities`/`plainParts` renderer, rather than parsing user text
as reply markup.

All completion waits are bounded independently of setup. Keep FakeClock timer
counts empty after hub stop and retain native poll-close receipts before removal.

T-1347 integration retains every menu, text/entity, native offset, ask, literal
part, lost-receipt and TCP-close assertion. Multi-reply/split/reopen cases use a
pre-owned Store observer with the shared driveTelegram helper. Each native hub,
including its restart, belongs to that owner before observer disposal. Only
persisted pacing deadlines advance fake time; pending HTTP stays on native I/O.

`Telegram command replies obey the bot hold at ordinary priority and confirm
their own durable result` posts two General messages, queues /help during an
eight-second 429, then posts later General. No message arrives at7999ms; the
accepted order must be General/General/help/General. Retain help entities, its
durable Telegram id/map and maximum one in flight. The command's next-poll
confirmation must arrive while the later General is still queued, proving its
own receipt does not wait for the whole chat drain.

Catch-up must not insert a queue-wide recovery join on every successful poll.
Restrict queue/feedback recovery joins to an active outage; the healthy command
path confirms its own settled job even while later ordinary work remains queued.
Keep this existing regression unchanged when modifying catch-up hooks.
