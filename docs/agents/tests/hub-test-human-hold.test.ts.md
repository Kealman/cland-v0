# hub/test/human-hold.test.ts

`hub/test/human-hold.test.ts` is T1: memory HubCore/ProcessTable, Sessions,
a fake harness and one FakeClock for policy and transport. It launches no native
process, touches no real project or HOME, and needs no credentials or browser.
Run this file alone with `node --test hub/test/human-hold.test.ts`.

Observe exact message ids at the socket boundary for queued input and durable
`injected` delivery records for acknowledged input. Repeated accepted idle must
flush both stages. Advance fake time in minute steps to assert recheck source
and age, strict five-minute expiry of poll-only busy, repeated-poll non-renewal,
and continued gating after pushed busy. Never-attempted agent input must recover on
the timer without another transition. A rejected/attempted input must stay
delivered across repeated idle and minute rechecks, then recover on busy-to-idle.
Close Sessions before storage and prove
closed timers emit no further logs. Uncertain outcomes and capped retry backoff
retain their separate controls in `inject-stalled.test.ts`.

This seam proves scheduling policy, excluding real harness latency, native hook
startup and transport I/O. Integrated verification supplies those boundaries.


Retained reviewer reuse begins with six-minute-old poll-idle evidence: public
Sessions.launch must reserve busy with fresh crew provenance and hold input until
idle. Recovery recreates Sessions over retained SQLite stores, with native resume
returning alive/discovery-unavailable. The minute timer must still reach the
retained agent report's injected receipt, without replaying attempted-unconfirmed,
uncertain or terminal
siblings. Capture the crash boundary after Store.markDelivered persists an ack
but before the callback starts injection; do not model that boundary with rejection.
Every Sessions state writer uses the same observation setter, including
crew reuse, stop and exit; idle evidence cannot establish a busy episode's age.


T-1473 uses public `Sessions.retry` and `answerSession` to force a human message
older than 60 seconds through pushed busy, retaining the transport ack and final
stored injected receipt. Assert the selected identity, queued-stage retry log,
no sibling delivery, and no duplicate after idle/timer. Refusal controls retain
exact queued (including the 60-second boundary), attempted delivered and injected
stages with admission ages. The previous message-id request and legacy reply
remain covered alongside optional-id selection. This seam excludes native CLI
and actual harness I/O.

T-1475 observes bridge replacement and flush outcomes through the same memory
Sessions/HubCore log callback, binding the production Claude bridge implementation.
Closing an older, generation-invalidated or unwatched bridge reports stale closure;
job identity stays pinned to connect even when the process row changes. Busy
input and transport rejection retain queued delivery and report zero sent;
idle recovery records transport acceptance without claiming ack or injection.
An explicit Journal.write/readJournal round trip covers additive fields and
legacy rows in a disposable project. The shared pre-registered pacing owner
tracks the complete root/Journal acquisition before its first await and separately
bounds acquisition, flush/read and native-close drainage. Cancellation fences
writer construction after late root acquisition; acquired file handles close
before directory removal. A pre-registered cleanup step owns late roots even
when native acquisition finishes during teardown. Failed drainage retains the
root. Omitted and aborted controls hold the actual root and native-open boundaries,
assert acquisition settlement, no post-cancel writer construction, native file
close where acquired, zero pending observers/timers and root removal. This
is reader compatibility evidence: production bridge/flush events remain outside
JOURNALLED. The seam excludes real native startup and transport latency.

This file is T2: the retained-row controls now own filesystem resources through
the shared process-cleanup owner; the delivery-policy cases still use memory.

The generation invalidation control uses public host.launchGeneration with
production unwatch, so revocation is observed at its native owner. Late-close
controls close adapter and real memory storage before disconnect, and refuse all
generation reads on a live disconnect. Keep both current/stale classifications
and the no-storage-read assertion. Native registry shutdown invalidation makes
late socket callbacks safe after the Store closes.
