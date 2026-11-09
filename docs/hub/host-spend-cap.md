# Host spend admission and warning

New host creates reserve their lease cost before provider acquisition. Admission
checks both `[hosts] daily_spend_usd` and the shared verification spend cap.
A refusal leaves the launch waiting for a host, without a provider acquisition
or an added spend entry. Existing hosts and sessions keep running. Renewing an
admitted lease bypasses the hosts sub-cap; the shared cap still applies.

Host admission, renewal, cancellation and settlement transactions check the
80% warning using their already-loaded ledger. After the durable spend write
and lock release, the running hub posts one General line per project per UTC
day. Its detail names contributing pools. Accounting matches admission: today's
settled host costs plus all pending host reservations, including reservations
carried across midnight, across projects. Verification costs do not count.
A zero hosts cap admits no positive-cost creates and has no percentage warning.

There is no polling, startup scan, derived totals cache or additional ledger
read. A detached watchdog has no live notice subscriber; its settlement enters
the next hub-owned spend observation. No warning is sent while the hub is down.

The General notice has a stable day identity. A hub database checkpoint retains
the last warned day across restart and message retention. Publication precedes
that checkpoint; replay after an interrupted checkpoint reuses the notice id.
The dispatcher removes its synchronous observation subscription on replacement
or shutdown. No provider API is used for warning accounting.
