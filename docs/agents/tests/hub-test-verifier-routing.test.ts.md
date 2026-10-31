# hub/test/verifier-routing.test.ts

T2 request-routing seam: real send, who, session.list and topic.history frames through sealed projectHub fixtures, in-process peers and a FakeClock. Closure tests reserve two verifiers and queue two requests to prove immediate oldest-first assignment for both Reviewer and QA, then check closed-item and late-delivery visibility. The existing merge component fixture exercises Tracker.finishMerge, the landing finalization boundary, with a disconnected verifier; reopening proves the old reservation was durably cleared without needing native Git or a hub process.

Legacy restart cases seed pending-verification metadata only after the first in-process hub has stopped all writers. Observe the assigned message and wait boundedly for its durable `delivered` stage in `topic.history` before asserting the new pending: the local channel event can precede the hub's ack transaction, which records both delivery acceptance and the reservation atomically. Check both an empty queue and the oldest of two queued requests; current open-item uncertain reservations remain covered by the existing cases. Run this file alone with `node --test hub/test/verifier-routing.test.ts`.

Ready-transition regression reserves an idle fake Codex reviewer while a second reviewer is busy, queues the next request and observes its recorded assignment in the status-write tick without another clock or idle signal. Legacy restart cases also seed the unchanged `{item,kind}` metadata for ready-but-open items and prove visibility and FIFO recovery. Late delivery of a ready-item request must not recreate its reservation.

Same-item follow-up controls settle a not-clear verdict at 12:38, observe idle,
then send at 12:43 for Reviewer and QA. These controls pass on the original source;
they alone do not reproduce the incident. The overdue-request case reserves an
idle bare verifier with another item hold, advances the project FakeClock past
1000 ms, and checks one durable Agents diagnostic containing the request identity,
verifier and held item. Later ticks must not duplicate that notice.

The incident regression queues a named request while its verifier is disconnected,
records a later same-kind verdict or accepts a newer request elsewhere, then
reconnects and observes durable acceptance of the delayed request before sending
the 12:43 follow-up. Both variants fail original source with `['reviewer']` instead
of `['rev-a']`. Keep the legacy open-row restart control and its different-kind
verdict control: legacy metadata begins at load time, retaining live work until a
later same-kind settlement. The already-served queue case asserts the positive
`dropped` receipt plus refusal notice, so a delayed second assignment cannot hide
behind an absent event. Closure setup now includes a real hold plus a pending
reservation because newer accepted requests supersede duplicate reservations;
assignment still proves both oldest requests reach distinct eligible verifiers.

Source-review authority control sends an unrelated named request, then a valid
Coordinator request to the wrong verifier kind, before the valid named replacement.
Only the last may retire the original reservation. Authorization is captured on
the stored message before send, never inferred from an acknowledgement. Legacy
queued requests with no admission receipt are upgraded only at authorized queue
assignment; restart controls explicitly clear that private column.

Legacy named delivery controls queue to a disconnected reviewer, stop all writers,
NULL the private admission column, then reconnect. A valid Coordinator request
must publish the unchanged pending projection after durable delivery acceptance;
an unrelated sender's identical first line stays ordinary traffic. New sends
write explicit 0/1 so denied admission cannot become a legacy reauthorization.
Migration uses senderSessionId, current send permission and item-lead authority;
missing durable identity cannot be replaced by a display name.

Human admission controls use the trusted topic.send frame in General without any
sender session. Observe durable acceptance before checking the legacy pending
projection, then send a newer human request to another reviewer and retain the
supersession assertions. The legacy named matrix also seeds NULL admission for a
stored human request after all writers stop. The production human send boundary
covers CLI, web and remote ingress; agent first-line text remains subject to its
separate stored sender identity and explicit admission decision.

Named cross-kind compatibility is local: the wrong-kind control now checks the
recipient's pending entry while retaining the independent assertion that the
original matching-role verifier stays reserved. A later authorized matching-role
request may supersede globally. Carried launch and pool-reuse brief controls wait
for durable injected receipts before checking pending; pool reuse additionally
checks that the returned session identity is the original verifier. Both owned
brief producers must capture admission before native delivery.

Retained NULL launch controls close Core, Store and Tracker before editing the
fixture row, then reopen. Only the accepted message/recipient delivery whose
launch token matches that durable session credential may gain admission. The
matrix retains ordinary hub notice, cancelled delivery, wrong owner and explicit
0 controls; each checks its positive delivery stage and final pending result.
The helper queries one indexed delivery and credential binding, never history.
