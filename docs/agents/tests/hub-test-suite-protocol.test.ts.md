# hub/test/suite-protocol.test.ts

The incomplete-collection result case seeds the existing nonzero scheduler
outcome with its original test-exit-zero cause. It arms the exact suite-message
observer before ticking the in-process hub, then checks the posted cause
verbatim and rejects a fabricated no-tests-executed claim. No worker or provider
is started for this case; the old wire shape is retained.
The whole sequence enters caseDeadlines.run before seed acquisition; step
fencing prevents later operations once cleanup begins. The message observer is
armed before the tick, bounded to five seconds, observed immediately for
rejection and joined in finally before the owned sequence settles. Captured
seed teardown hooks run only after whole-sequence and named-wait drainage.

T2 keeps the queue/status CLI, subscription, role and journal contracts on
seeded executor receipts. The root-preservation controls call the public sweep
boundary with fixture-owned paths and no process discovery: wrong paths and
symlinks refuse before ownership probes; a live holder and absent or unknown
runner group preserve the recreated canonical token path and its bytes.
Missing runner metadata never proves a dead group.

Known-dead positive recovery, detached writers after parent death and ambiguous
writer preservation use the real native lifecycle seam in
`suite-recovery.test.ts` (T3). Cancellation and next-run admission stay in
`suite-cancel.test.ts` (T3). Keep their final root/lock and descendant assertions.


Recovered synthetic suite records carry explicit scratch-owned log/result/gate
paths, including finished and queued records whose tests never open those files.
An empty path resolves against the runner cwd; isolated recovery correctly refuses
it rather than treating it as an absent capability. Keep the original report,
queue, cached-content and accounting assertions when changing fixture paths.
The cache admission and stage/release cover seed helpers follow the same rule;
the old outside-path and native-PID refusal controls remain in measure-memory.
Provenance finalization preserves legacy rows that share one `job.log` path.
The fresh/cached oversized-results case retains that shared path, every priority
summary and all missing-baseline bytes, and checks that each published artifact
has exactly one footer with its own cache identity. The batch-member attachment
case asserts the exact original bytes before the terminal footer. Finalization
serializes each shared path through artifact publication, not just atomic rename.
