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
coverage, not a process-crash or exactly-once transport claim. Direct replies
have no outbox; a lost reply requires a new human command. Keep the durable native
identity before the first send, and the final single-message assertion.

The long-card case keeps General in rich format and sends an ask below the hub's
8 KiB cap but above Telegram's 4096-code-point bound. It checks numbered plain
parts, each entity/text budget, literal Markdown characters and non-BMP text
reconstructed without loss. Command formatting escapes facts before calling the
landed `markdownToEntities`/`plainParts` renderer, rather than parsing user text
as reply markup.

All completion waits are bounded independently of setup. Keep FakeClock timer
counts empty after hub stop and retain native poll-close receipts before removal.
