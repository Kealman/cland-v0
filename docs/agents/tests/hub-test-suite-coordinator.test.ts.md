# hub/test/suite-coordinator.test.ts

T1 uses suiteUnit with disposable storage, FakeClock and semantic executor receipts.
No native suite, browser or cloud resource runs. Tests cover config default and
validation/round trip, two Coordinator droplet keys, retry identity across restart,
remote-slot queueing and the unchanged local/other-role refusal. Coordinator
eligibility comes from the session id's stored role; caller display names confer
no authority. A local-only matching key cannot bypass a full droplet-key cap. Existing suite-stage-rules and suite-admission tests stay unedited.
