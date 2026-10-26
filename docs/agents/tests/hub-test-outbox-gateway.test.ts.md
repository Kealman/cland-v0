# hub/test/outbox-gateway.test.ts

T2 seam: sealed tempProject/projectHub, a fake Coordinator and the existing
frame-only messenger augmented with `mirror(outbox)` and a fake delivery client.
The fixture translates General message frames into jobs; full production mirror
selection/rendering belongs to the messenger epics. No platform, token, key,
real harness or browser is used.

Arm the exact General frame observer before each send. Drain completion and
persisted terminal rows prove three missed General jobs; actual topic.answer
and inbox.list receipts prove the queued card's source closed. An open card is
the recovery positive control: it leaves exactly once over repeated drains and
a database reopen, while missed and dropped work never replays. Missed counts
remain per remote and durable for a later gap-line acknowledgement policy.
Use caseDeadlines for setup/behaviour waits, stop the owning gateway/outbox
before closing the external Store, then allow fixture directory cleanup.
