# web/test/composer.test.ts

`web/test/composer.test.ts` owns the authenticated composer → `topic.send` seam:
sealed `webFixture`, fake Coordinator and second in-process session, rendered
kinds plus peer frame history, default role addressing and the `@` session picker,
physical Enter/newline/command Enter, palette focus/draft retention and `~`
artifact chips. Artifacts from another topic or the archive are excluded; a
batched 101-artifact setup proves selection beyond the initial inventory page.
Per-topic reload and fresh-epoch disconnect checks retain drafts, disable offline
writes, and prove zero replay. The peer reads the exact sent message's `readSeq`.
Controlled browser time drives reconnect retries up to the existing retry cap and
handshake deadline, retaining the final Live assertion. A held real outbound send
crosses topic navigation; archiving its artifact before release produces an actual
hub refusal and restores text/chips before newer typing. A held successful receipt
retains the newer draft, and reload recovers uncertain text without a second send.
Pending state is checked
before release and the refusal receipt before restored-state assertions. No live
hub, real harness or human browser participates.
