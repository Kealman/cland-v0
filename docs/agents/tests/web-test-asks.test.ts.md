# web/test/asks.test.ts

`web/test/asks.test.ts` owns the shared ask-card seam through the sealed
`webFixture`, a fake Coordinator asker and authenticated Headless Shell contexts.
It covers physical option keys with a Cyrillic key value, thread and Inbox cards,
required decline reasons, free-answer failure/draft retention, pending/offline
write suppression, the Inbox link, context help and thread navigation. C2 mounts
Inbox and thread in two panes of a second independent cookie context against the
same hub; the observer is armed before answering, and the explicit one-second
criterion starts at the first browser's successful answer receipt. Final DOM
assertions retain the hub option, answerer and exact timestamp. C5 holds a real
outbound answer until a second context has won, withholds the winning ask delta,
then observes the actual refusal and the history-recovered fold. A peer hub read
proves the topic read mark reaches the ask without viewing its thread. Fresh-epoch
recovery uses the existing in-process hub restart and controlled browser clock;
it asserts disabled offline writes and zero replayed answers. No native harness
or live project participates. A second competing-client regression moves the
answer beyond the seven-day archive and more than 100 later messages, then
asserts exactly two one-row history reads, the winner's exact outcome and
unchanged newer Inbox rows/counts. The secondary-thread Inbox-link regression
keeps another copy in the primary pane and asserts destination list and focus.

The existing fold tests name the exact outer Inbox list and Fold Inbox button,
separately from its nested Asks and approvals fold. Existing held-history/live
Topics cases anchor asks by message id and assert the card's state attribute and
chosen outcome; question text disappears on folding. Their pagination, viewport
anchor, cross-pane persistence and zero-extra-read assertions remain intact.

The offline-asks case uses `reconnectUntilLive` to await the real rendered Live
receipt under the enclosing test's timeout, rather than a separate 15-second
wall deadline. The helper still advances the paused browser clock by at most
15 seconds (the 10-second retry cap plus 5-second handshake deadline), then
continues yielding to real socket I/O without advancing it further. Keep the
helper's final Live assertion and every caller's outcome assertions: asks,
connection, composer, session-actions, topics (both reconnects),
phone-disconnected (both reconnects), area-slots, events, inbox and session-launch.
Standalone runs must supply a finite `node --test --test-timeout` just as the
suite runner does. A temporary held-real-snapshot probe may demonstrate the old
wall cutoff and recovery after it, but its deliberate 16-second hold does not
belong in the ordinary Web tier.
