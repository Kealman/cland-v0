# hub/test/host-survival.test.ts

`hub/test/host-survival.test.ts` checks persisted mixed-harness rows with two
recording Hosts, unavailable startup, coalesced host readiness and positive birth
loss. Its twenty seconds are logical clock time; it claims no native lifecycle
or real downtime. Native harness and spoke evidence lives in
`hub/test/host-survival-native.test.ts`.

A held startup pass first fails an earlier row, then receives readiness while a
later row is held. It requires the shared flight to retry the earlier row before
settling; setup and completion each have their own bound.

Snapshot-race cases hold the first adapter resume, then rename and reuse a later
name, replace its row, move its host, stop it or establish durable pending cleanup.
They check the exact captured ids reaching the adapter and structured
`resume-skipped` reasons. Child APIs, including promisified exec/execFile, are
guarded through cleanup by `fakeNativeGuard`, including captured prototype spawn
and callback/custom denial controls. Every new case enrolls `caseDeadlines`
before acquisition, adopts its root and joins admitted work before closing storage
or checking/restoring the guard. Setup and held-result observation have separately
named bounds. No native lifecycle or network runs.

Settlement cases hold the admitted row's adapter result or final identity proof,
then rename, replace, move or stop that row. They require the committed changed
row to remain byte-for-byte equivalent through the public table view, no restarted
watch, and a structured skip instead of session-resumed publication. The ordinary
resume rename controls remain in `hub/test/lifecycle-serialization.test.ts`.

Legacy-local cases also hold the initial identity migration probe before adapter
resume. After rename, replacement, host or status mutation, the recorded row must
retain its original identity fields and emit a structured skip without a migration
write or adapter call. The local Host is injected and guarded; its PID is synthetic.
