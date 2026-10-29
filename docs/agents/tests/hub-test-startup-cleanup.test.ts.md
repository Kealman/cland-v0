# hub/test/startup-cleanup.test.ts

`hub/test/startup-cleanup.test.ts` is T2. Run it alone with
`node --test hub/test/startup-cleanup.test.ts`.

Use the sealed `tempProject` and `projectHub` fixtures. Inject a failing
`openDatabase` and capture real journal FileHandles through `journalOpen`.
Observe descriptor values at the startup rejection boundary: each must already
be `-1`. Register the fallback owner with `onCleanup` before starting the hub. Join all
pending opens with `allSettled`, then attempt every captured handle close, so a
failing regression does not rely on garbage collection or leak into later tests.
Check the lock's removal and start a successor on the same disposable root.
No child process, provider, browser or platform is needed.

The pre-fix positive control on dev 6a24facf8 failed with an open descriptor
instead of `-1`; its journal was created before the throwing Tracker constructor,
outside the normal startup catch. Startup now drains the journal, then the
process log, and releases the lock before rejecting. Cleanup failure retains the
startup error as the cause of an AggregateError and still releases the lock.

The abandoned-observation control omits both native-open receipts. Its resource
cleanup observes both descriptors closed while the root still exists; the final
cleanup check observes root removal with those same descriptors closed.
