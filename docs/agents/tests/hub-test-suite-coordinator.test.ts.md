# hub/test/suite-coordinator.test.ts

T1 uses suiteUnit with disposable storage, FakeClock and semantic executor receipts.
No native suite, browser or cloud resource runs. Tests cover config default and
validation/round trip, two Coordinator droplet keys, retry identity across restart,
remote-slot queueing and the unchanged local/other-role refusal. Coordinator
eligibility comes from the session id's stored role; caller display names confer
no authority. A local-only matching key cannot bypass a full droplet-key cap. Existing suite-stage-rules and suite-admission tests stay unedited.

The concurrent-key and local-only-cap cases advance one synthetic worktree HEAD.
Observe the first remote worker's durable start before advancing it, so the new
key does not invalidate an undelivered earlier head. Both use suiteCase to bound
and drain the whole caller. Keep the original concurrency and cap assertions.

Head-refusal controls distinguish before-acquisition and after-acquisition
failures. The former acquires no machine; the latter keeps the cap full while a
fake release refuses confirmation. Only a persisted cleaned/reported job and a
released lease (or no acquired lease) permit the next key to start. No outcome
or disappearance alone proves cleanup.
