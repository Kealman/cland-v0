# hub/test/telegram-rendering.test.ts

T2 exercises General through sealed `tempProject`/`projectHub`, the production
messenger factory and the loopback fake Bot API. Run this file alone with
`node --test hub/test/telegram-rendering.test.ts`. All credentials are fabricated;
there is no real messenger, browser or child hub process. Fixtures use an
injected clock and the shared native resource/cleanup owners.

`Telegram mirrors an agent report as Rich Markdown with its author and kind`
checks exact GFM with a heading, table and code, nested `rich_message`, disabled
entity detection/previews and the accepted fake message. The rejection case
arms one rich refusal before the General send, then requires successful plain
delivery with independently worked UTF-16 offsets beside an emoji. Neither uses
MarkdownV2. Arm request/TCP-close observers before sends and retain exact ids.
Fatal rich-send 401/403 responses stop the remote before fallback; those generated
production-factory controls live in the [liveness guide](hub-test-telegram-liveness.test.ts.md).

The configured entities case sends a long ASCII block and one emoji bold span.
It requires two numbered plain sends, an intact entity and a repeated header.
Arm the durable last-part observer before posting; request arrival or TCP close
alone is too early to stop the hub. Wait until the fake accepted that exact last
text and its source mapping exists in hub.db, then stop and verify both mappings
refer to the same General source. The test deliberately reads the durable
mapping because storage completion, rather than request arrival, is its boundary.
Cleanup stops the gateway's writers before closing that read connection or roots.

The native receive regression uses the existing complete message-frame shape
directly with the fake, independently of new inbound handlers. It checks silent
progress and hub notices, workbench/Discord authors, Telegram echo/answer/ask
exclusion, and Agents/item-topic exclusion. Await every receive and stop before
the final accepted-message census; no elapsed quiet period supplies evidence.
The production General ask/answer case separately retains actual hub frames and
the workbench message's accepted receipt, proving that real ask cards are filtered.

The provider-nesting component first proves that the fake rejects literal
blockquote+code and blockquote+link payloads with 400, independently of production
conversion. It then sends quoted code through General, retains the exact accepted
text and a subsequent send, and reads connected status through a local Neovim
client. Pure conversion covers quoted link metadata; General's shared redactor
intentionally masks raw URLs before conversion, so this component does not claim
an unredacted URL traverses the gateway. Use pre-armed request/close receipts and
one accepted-state read per action rather than repeatedly opening HTTP controls.
Arm and await each rejected request's exact request-id/TCP-close pair before
arming the next method-only observer. Parsing its error body does not prove the
server socket closed; a late negative close must not satisfy the positive send.

After the pairing integration, retain the unchanged blocked-bot membership/403
controls in `telegram-pairing.test.ts`: a terminal General notice must not
re-enter a stopped remote's mirror and replace its saved blocked cause with a
generic stopped error. Rendering keeps pairing/project-name/notice callbacks
and the existing format option together in the native factory.

Keep `telegram-messenger`, `telegram-api`, `telegram-polling`, `cli-imports` and
`project-hub-lifecycle` regressions for existing constructor/factory injection,
startup/reload and joined cleanup. No frame, reply, permission or clause changes
are required. Pacing is covered in [telegram-pacing](hub-test-telegram-pacing.test.ts.md); outage/catch-up is separate; these cases
make no rate, recovery or live-client rendering claim.

Pacing integration: keep a Store observer owned until hub stop. After a rich
400, await its durable dropped/replaced job before advancing the fake clock
1,000 ms to the plain send. For numbered parts, wait for the first accepted job
before advancing to the second. Sequential native receive controls advance only
after each receive completes. These advances schedule work; exact accepted parts,
entities and source maps remain the assertions. The nesting test waits for the
quoted report's committed send before advancing for its following report.
