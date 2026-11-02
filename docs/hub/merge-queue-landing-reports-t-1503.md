## Merge queue landing reports (T-1503)

With `[merge] queue = true`, a completed queue landing sends one `report`
to the enqueuing session and the claimant captured before closure, in the item
topic (Agents when no topic is bound). The report names the item, landed commit
and batch. Shared recipients receive one delivery. Its stable notice id prevents
duplicate reports on a landing retry. A landed result with an incomplete
follow-up still reports the landing; the separate follow-up diagnostic remains.
Direct merges retain their existing reply. No role permission changes apply.
Pending landing reports retain recipient session IDs, item/head/branch, topic and
batch in the hub store before merge begins. Startup and queue ticks reconcile
closed matching merge receipts. Notice admission and pending settlement share
a transaction; an unavailable topic or session identity retains the pending
report. Names are resolved only at synchronous durable admission, so rename
and name reuse cannot retarget the intended recipient.

Recipients settle independently: an unknown identity stays pending while known
recipients receive the single durable report. Later resolution appends only the
missing delivery, preserving the message id and earlier receipts. Human enqueue
has a topic receipt and delivers to the claimant without inventing a human session.
Definite pre-landing refusals and base rebuilds retire the attempt obligation;
recoverable or uncertain landing errors retain it. The refused/re-enqueued
same-head control and late-recipient reconnect control guard against duplicates.

### OpenCode 2.2.5 schema review (T-1501)

The informational release check retains twelve differences from 2.0.24 to 2.2.5
and appends their reviewed reasons for that exact pair. Ten form warnings reflect
flattened numeric alternatives in `Form.When.value` across five field variants,
repeated for `items` and `prefixItems`; snapshot reads only form ids. The two
message warnings concern assistant provider metadata moved to `native`, and
compaction dropping `recent`/`providerContext` and moving provider metadata to
`native`. Approval details read only assistant content and correlated tool
id/name/state/input; compaction is ignored. Safe-integer response bounds are
also harmless to these readers. Recorded schemas and reader examples cover
these changes; native runtime coverage and Doctor's informational tested range
remain at 2.0.24. Future versions require a new review. The check remains
informational, with no new gate, setting or role permission.

