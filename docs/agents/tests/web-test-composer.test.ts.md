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

Topic selection waits up to 15 s for the exact rendered topic row, asserts its
visibility, then uses the normal 3 s click budget. A restored composer is not a
receipt that the reloaded socket has applied its topic list. The reload case
holds both topic snapshots and `shell-topics` replies at the browser edge.
After Topics navigation completes, it asserts General is still absent and starts
the shared row-selection helper with a case-local 500 ms action budget. A second
native General click must reject with Playwright's 500 ms timeout while the
readiness selection stays pending. That rejection explicitly signals release
of the held frames; there is no test-owned release timer. Removing readiness
makes the selection settle early and fails the pending assertion. With readiness,
the exact rendered row, draft, read cursor, disconnect and no-replay assertions
pass. A body-local `finally` drains held sends, joins selection even on failure,
and restores the 3 s action budget before context teardown. The bounded negative
native click is a regression control, not application latency evidence.
