# hub/test/agents-checkpoint.test.ts

The T1 retirement checkpoint regression writes a projected Agents role event and
queues a harness-exited lifecycle record. Before that projection runs, it writes
the deterministic General retirement notice twice, detaches the recorder, closes
the Store and opens a new Store on the same disposable SQLite path. The Agents
checkpoint must still name the previous Agents event; replay recovers exactly
one session-death notice and a second replay recovers zero. General keeps exactly
one retirement notice. This proves deduplication does not suppress pending
lifecycle recovery. No native harness, browser, credentials or wall-time bound
is needed. Close the core and Store and settle the detached microtask before
removing the fixture root.

Verifier stalled diagnostics use separate durable deduplication from Agents
lifecycle checkpoint IDs. The control holds a lifecycle projection, records an
overdue queue diagnostic, detaches the recorder and reopens the Store. It checks
the unchanged checkpoint, exact recovery of the pending death notice and one
stalled diagnostic after a second maintenance pass.
