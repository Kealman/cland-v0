# hub/test/connection-resume.test.ts


Resume coverage adds `model-ring.test.ts` (T1 fake-clock age/UTF-8 byte bounds,
including terminal close after a late disconnect publication) and
`model-output.test.ts` (T1 stalled transport at exactly/past 4 MiB).
`connection-resume.test.ts` uses real Unix clients of `projectHub` for five
missed item changes, expiry/foreign-epoch snapshots, request-frame exclusion
from replay and two hub starts. `connection-resync.test.ts` uses a stalled
in-memory dispatcher peer for exact replay continuity and a real paused Unix
reader for the outgoing queue boundary. It also races a synchronous action
against replay and retains the final replay-then-live order assertion. Explicit
resume during another subscriber's fan-out also proves that replaced callbacks
cannot resend either the current or a queued publication. All
projects, homes, Git configuration and account environments come from the sealed
fixture. These tests add no hub child process. Clients resume from their last
applied cursor; a completed request after replay/drain fences preceding writes.
