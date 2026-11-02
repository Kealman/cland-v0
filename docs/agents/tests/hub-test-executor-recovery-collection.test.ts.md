# hub/test/executor-recovery-collection.test.ts

T2 scripted-provider regression for a shard result whose short release attempt
expires during a held confirmation GET. The GET observer receives the exact id and waits for its durable accepted
DELETE timestamp before holding confirmation. The test arms the observer before
finishing the shards, bounds setup independently, advances the shared clock
past the 500 ms release budget, and resumes native work. It then waits for the
durable parent message without manually admitting another scheduler tick.
Final assertions retain the failed child outcome, exactly one parent receipt,
and absence of both droplets and keys. The hold is released before fixture
writers drain. No real cloud resources, browser or worker process.

Executor recovery completion calls `Suites.executorRecovered()`. It joins
in-flight inspections and reinspects only active pending collections, including
parents. Dispatcher owns and drains this continuation with its recovery work.
GET404, spend and accounting-window policies remain unchanged.
