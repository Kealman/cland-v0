# hub/test/telegram-gap.test.ts

T1 uses a disposable SQLite store, a second durable reader, fake time and an
in-memory native-delivery callback. There is no socket, process, browser, real
platform, token or elapsed-time wait. Run this file alone.

`Telegram gap counts sources once and acknowledges only captured jobs after
its send receipt` captures three missed rows belonging to two General sources,
including a split source. Hold its native send result. The independent reader
must retain all three missed states while it is held. Insert a fourth row for
a new source, release the successful receipt and retain exactly three reported
states plus the new missed row. The next gap reports that one new source;
zero missed messages never invoke the sender.

`Telegram uncertain gap retains its captured ids and stable send key across
reopening` rejects the send as unknown, retains the missed row, closes/reopens
the store and requires the same send key. Only a successful native reconciliation
may acknowledge the row and clear the captured gap. The native queue owns proof
and the unknown-delivery fence; the service never creates a new key on retry.

The production frame and fake API seam remains
[telegram-catchup.test.ts](hub-test-telegram-catchup.test.ts.md). This cheaper
boundary proves the captured-set race independently of transport pacing.

The held-send fixture registers one disposer before allocating either nullable
Store. It owns the acceptance barrier and the captured producer promise, bounds
setup and held behavior with separate injected clocks. Start drives its own
setup clock after triggering the synchronous T1 capture/readiness producer,
so a missing receipt reaches its deadline without any caller clock advance.
It also connects the test's abort signal. Disposal joins that setup driver,
cancels/releases the
barrier and joins the producer before closing either Store. The ordinary test
retains final reported rows and zero timer receipts after that same disposer.
The missing-readiness and aborted-setup controls call it while the actual
captured writer is held, then retain a joined rejected producer, closed Stores,
missed terminal rows and zero behavior/setup timers. Directory cleanup follows
this ownership receipt; it never substitutes for joining the writer.
