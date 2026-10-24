# hub/test/session-events.test.ts

Arm the transport's welcome capture before starting the spoke. Presence can
precede asynchronous credential provisioning: wait with a bound for the exact
held welcome frame before asserting that a pre-welcome rename stays queued.
Keep the later process-event transport hold and final rendered frame assertion.
Dispose Sessions and drain its owned I/O before closing its process table.
