# hub/test/inject-stalled.test.ts

Use projectHub, fake harnesses and FakeClock for advisory deaf supervision.
Every role uses a strict age greater than five minutes from the durable queue
receipt. Assert session.list/CLI, default hub.status, one Agents notice and one
inbox wait, plus General and named Aides for the Coordinator. Reconnects retain
the deadline; the next positive injection clears the mark and inbox wait.
The memory fixture covers held human input with no injection attempt; the
persisted Store/ProcessTable restart fixture positively observes a failed replay
of an older id after a later confirmation, then fresh successful injection.
Neither confirmed nor superseded replays produce alerts. The watermark negative
control must raise the forbidden notice. Existing backoff and uncertain controls
stay intact. No native process or wall-clock wait is needed.

Codex's native app-server seam remains in
[codex-delivery.test.ts](hub-test-codex-delivery.test.ts.md). Its fixed startup
grace remains 120 seconds; the five-minute queue age dominates ordinary cases.

Review controls retain an unresolved episode through restart with the same inbox
id/since and no repeated Agents/General/notification. A pending lifecycle journal
suffix still replays. Cross-recipient fanout acknowledgements/injections cannot
clear another recipient; its own next injection does. Legacy persisted shapes
omit the watermark and use equal-time confirmations bracketing a failed replay.
Both stage-specific displayed commands execute via fake-harness frames. Every
persisted generation registers disposal before opening storage; shared
caseDeadlines owns setup, effect observations and pending-work drainage.

The legacy equal-time control reorders retained delivery rowids after all first-
generation writers close, as a logical database restore can do. Message sequence
stays authoritative; restoring timestamp-only selection must raise a false
notice. Omitted and aborted setup receipts retain first-generation ownership;
after-cleanup checks observe its Store closed. Setup entry and acquisition
drainage use separate real-time bounds from the injected fault clock.

Emergency release/join for held setup receipts is registered on the real test
context before deadline owners, and owns the assertion promise immediately.
The early-failure control releases held acquisition before the owner joins it;
final after-cleanup still observes the Store closed.
Legacy null session_id rows bind only through a validated native confirmation's
captured session id, atomically with injection/checkpoint/episode settlement.
Retain the reused-name negative control and own-confirmation positive control;
never infer native confirmation authority from the current display-name holder.

The coalesced session timer owns candidate derivation. Delivery and view paths
perform no candidate query; the SQL observer has a positive one-pass receipt
at the next policy tick and a deadline recheck naming the oldest id. Restoring
the original eager Sessions source fails the synchronous-read assertion.
Retain the unchanged inbox-workload pending-read guard alongside this case.
Inbox health rows consume session.process projections, with one initial seed;
they do not add another full process-reader call to each inbox rebuild.

The launch-owned-brief control keeps a previous name holder in the session store,
records a new carried brief before the next native session exists, and observes
provisional null identity. Only its matching launch's native completion binds
and injects it, before replacement process/hello publication. Unrelated launch
and repeated completion controls retain isolation and no-replay assertions.
The unchanged native lifecycle file proves the resulting single fresh Codex turn.
