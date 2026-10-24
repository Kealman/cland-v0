# hub/test/item-lead.test.ts

`hub/test/item-lead.test.ts` covers `@lead T-n` resolution and its routing at
the T2 hub frame seam with `FakeClock` and a disposable `projectHub`: a report
reaches the item's claimant, an unclaimed item falls back to the Coordinator,
and a human claim never becomes an agent addressee.

T-1209 closes the two closed-item refusals. A `lead T-n` address for a closed
item now resolves to the Coordinator (never its old claimant), and a question
sent from a closed release's topic to `coordinator`, by role or literal name,
is delivered: the ask path resolves the topic's next lead before recording, so
it must not throw for a closed item. The case closes the release, reads the
bound topic's status, sends, and asserts the recorded addressee and the
Coordinator's delivery. It also asserts the message reopens the closed topic as
an agent ask while the release stays closed. The attachment-I/O cases assert the
same closed-item fallback after the tracker changes behind a deferred read; they
start their own `startHub` because the artifact reader must pause between
resolution and recording. Unknown item addresses still refuse with the
Coordinator hint. These cases add no native process.
