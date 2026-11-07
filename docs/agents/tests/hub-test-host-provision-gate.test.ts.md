# hub/test/host-provision-gate.test.ts

T3 because creation runs native ssh-keygen. Run with supported Node, inherited
CLAND variables removed, and the stage preservation lock. No real provider API,
SSH transport, browser or network is used. Scratch environments use
fixtureEnvironment; cleanup aborts/releases and joins creation/readiness before
closing storage and removing roots.

- `never-booting creation releases at exactly 300000 ms on the hub clock` uses
  FakeHostProvider with neverBoot and the same clock. After observing a machine
  status read, advances 299999 ms (still pending), then 1 ms, and observes the
  returned failed record, durable released checkpoint and provider absence.
- `tunnel readiness expires at exactly 300000 ms on its injected clock` uses
  typed carrier and Git owners. It observes down status before advancing, keeps
  readiness pending at 299999 ms and asserts the timeout at 300000 ms.
- `settings entry publishes durable creating id before held acquisition completes`
  supplies pool settings absent from disk and holds provider acquire. The callback
  sees a persisted creating record; acquisition remains unresolved when the caller
  receives the id. Cleanup releases and joins the held producer.

Setup waits use eventually/testWaitMs; behaviour bounds remain literal 300000 ms.
The clock controls lifecycle polling and provision timestamps. Native command I/O
and transport deadlines remain real time; this is not native SSH timeout evidence.
The unchanged host-create-ready, host-destroy and host-provision-records files
retain CLI/create/destroy/record compatibility coverage.
