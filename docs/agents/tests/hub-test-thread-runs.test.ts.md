# hub/test/thread-runs.test.ts

`hub/test/thread-runs.test.ts` proves the additive history/live-frame seam at T2
with a disposable `projectHub`, in-process Implementer/Reviewer/Aide peers and a
complete fake clock: four-message facts, a fifth message's same-id delta without
a history read, tracked ask/answer/verdict/human/Aide boundaries, the hub-local
midnight rule, queued verifier assignment with a later run member, and full first-three/+N metadata on mid-run numeric/message-id
pages. Observers are armed before sends; final run/count/identity assertions
remain. A late client reads a suffix without seeing the run's first message.
`thread-runs-store.test.ts` is T1: store reopen, role-at-send boundaries,
transaction rollback, retention rebuild with a surviving former-Aide boundary, lazy backfill across 405 existing
messages and byte-capped run pages. No new native process is involved. Wire conformance checks `ThreadRun`
and `TopicMessage`; run facts count toward the existing history reply cap.
