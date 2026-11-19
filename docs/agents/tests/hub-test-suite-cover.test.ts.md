# hub/test/suite-cover.test.ts

T1 uses the sealed `suiteUnit` scheduler, candidate facts, semantic executor
receipts and a fake clock. Sharded outcome tests inject typed and generic acquisition refusals and
delivery failures before start, observe the durable merged report, and retain
each cause in the result JSON and reopened scheduler. Stage, epic and release
cases cover homogeneous and mixed refusal causes; no cover or culprit search may
be created. A partially executed group preserves passing or failing executed
counts and identities, lists the unexecuted shard in both ordinary and compact
priority summaries, and supplies no green stage evidence. Reservation arithmetic
and provider I/O remain in their executor tests. The public unavailable notice
is covered by the typed and generic pre-lease refusal cases in `suite-close-component.test.ts`.
Start acknowledgement failures remain executed-or-unknown failures; an attempted
start without a receipt cannot establish that execution never occurred.
Integrated shards use captured candidate facts even when live tree reads are
unavailable. Assert committed-only delivery for both children and durable green
completion, including recovery after the root candidate changes. Readiness and
delivery errors are pre-execution only while the lease is undelivered; a restored
delivered lease retains uncertainty even without a start acknowledgement.

The two changed integrated-shard callbacks use `suiteCase` with a pre-acquisition
whole-caller owner, adopted roots and fenced steps through teardown. The positive
native launch guard covers setup, body, recovery and cleanup; shard reservation,
release and acquisition retain their explicit semantic fakes.
