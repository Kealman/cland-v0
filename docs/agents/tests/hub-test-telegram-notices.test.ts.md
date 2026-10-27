# hub/test/telegram-notices.test.ts

T2 exercises public hub frames, the production messenger factory and a sealed
loopback fake Bot API. `tempProject` and `pacingOwner` register storage, startup
and writer cleanup before acquisition; fake close owners drain native I/O before
fixture removal. There is no real platform, browser, key or token. Run this file
alone with `node --test hub/test/telegram-notices.test.ts`.

Arm accepted-message/mapping observers before producing each inbox row. The
250 ms fake-clock step publishes already committed inbox changes; it is not the
receipt. Drive pacing from durable queued intents, retaining accepted native
messages and `sent` card jobs. Pin the item topic through the public visibility
frame so a direct message actually qualifies for the needs-you inbox.

The generated cases are:

- `Telegram plan, review request, item message and Claude Code approval arrive once as button-free notices`: C1's four real rows, 📥 prefixes, facts, entities and absent markup. A new ask's accepted card proves another inbox publication completed before the final four-notice count.
- `Telegram item notice reply keeps its topic and source via Telegram without following ordinary agent replies`: C2's actual native reply, durable offset and frame history retain the exact source, topic, human and via. A later accepted General marker drains the observation before shutdown and absence assertions.
- `Telegram long item notice stays one clipped entities message with its full source retained`: Unicode/code-point budget, full-message marker, one accepted notice and unchanged source text.
- `Telegram oversized plan title keeps the complete notice and entity spans in bounds` and the `title and origin` case: literal 5,000-code-point public epic titles, with and without an oversized configured origin. Complete text stays within 4,096 code points, bold spans match the actual rendered header, every entity stays in UTF-16 range, and the full title/link target and native source map survive. Ordinary origins retain the existing literal URL assertion; oversized origins use an Open workbench text link.
- `Telegram one backlog publication sends notices oldest first across sections with stable ties`: hold automatic inbox frames while real public producers create a request, message, two equal-time plans and a TUI approval. Release one complete frame to the production adapter, reversing only the two equal-time plan rows at that public seam. Retain five exact source mappings in chronological/id order, 📥 prefixes, absent keyboards and durable sent receipts. This also covers an older hub's arbitrary equal-time row order.
- `Telegram plan notice reply goes to General with its reference and no epic-topic reply`: the epic has a non-General topic, but no source message. Its reply has `re plan <item>:`, no `replyTo`, and leaves the plan pending.
- `Telegram plan notice has no link without a configured origin` and `Telegram plan notice links only the configured origin`: C3's omitted/present URL and exact UTF-16 URL entity. A synthetic credential-shaped source URL is a positive control; native output **and the producer's durable outbox payload before fake capture redaction** exclude its credential/path. The plan never calls `web.link`.
- `Telegram TUI approval notice reply goes to General with the session reference`: `re approval <session>:` leaves the native approval pending with no approval-answer call.
- `Telegram qa notice reply targets its real source in the item topic` and the `handover` case: the same source-backed routing as review requests.
- `Telegram notice reply replay after commit and lost result keeps one attributed item-topic message`: drop the actual committed frame result, observe the durable human message and missing adapter result/offset, stop and restart over the same scratch database/fake queue. Confirm the new offset and one identical source-backed human message. This is a component restart receipt, not an OS-crash claim.

Notice routing follows the Coordinator's T-1358 decision: source-backed requests
and item messages use their topic and `replyTo`; plans and TUI approvals use
General with an adapter-owned reference. The mirror stays General-only. Existing
gateway old-client cases retain the prior wire shape; no shared wire fields or
new authority are introduced. Pairing exclusion remains `gatewayInbox`'s job.

The fake's optional `publicOrigin` capture exception accepts only one exact
credential-free HTTPS `.invalid` origin. Other URLs, including a credential URL
starting with the same origin, still scrub. `telegram-api.test.ts` controls this
exception and rejects non-fictional/credential/path origins. Producer-side payload
checks prevent the fake's scrubbing from hiding production leaks.

Before source review run Telegram, outbox, gateway, asks and inbox test files
serially and `npm run typecheck`. No browser, real Telegram, Linux duration or
full-suite claim follows from these targeted local receipts. The role clause
already supplies secret/isolation requirements; this feature needs no clause line.

Source-review corrections preserve the original guard sources and assertions.
The existing frozen `cli-usage-compatibility.test.ts` and `cli-help.test.ts` fail
against the original REMOTE_USAGE fixture; only that owning commands.json row
migrates. Both original native exits/output and corrected output are retained.
The size controls first fail at 5,047 and 10,065 complete notice code points;
the single-publication control first observes plans before the older request and
message. Each correction has its original red and subsequent green native exit.
