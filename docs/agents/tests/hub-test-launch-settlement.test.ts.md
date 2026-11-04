# hub/test/launch-settlement.test.ts

T2 checks inline void-callback ordering, rejecting callbacks, bounded hung
settlement and deferred recovery receipts. The injected 10 ms deadline measures
the production checker, not elapsed time or a sleep. A timeout retains the same
producer; retries cannot duplicate it. Held producers are released and the owner
drained before the test finishes. Run `node --test hub/test/launch-settlement.test.ts`.
The concurrent timeout case counts native-close effects before and after the
held producer completes, keeping its exactly-once assertion separate from the
callback invocation count.
