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
