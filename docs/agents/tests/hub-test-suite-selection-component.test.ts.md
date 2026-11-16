# hub/test/suite-selection-component.test.ts

T2 uses projectHub sockets and injected local-executor receipts in a disposable
root. No package worker, native process or browser starts.

The capped-stall case appends a 32-process census and subsequent noise to the
scripted worker log. It waits for the published result and its reported receipt,
checks the 768-byte cap and log pointer, and reads the full census from the
artifact. This exercises dispatch publication as well as the priority summary;
the streaming semantic reduction is covered in suite-log-backfill.test.ts.
Its command-only variant omits the census and checks the same bounded published
pointer and durable exit/EOF record, as when native inspection fails first.
