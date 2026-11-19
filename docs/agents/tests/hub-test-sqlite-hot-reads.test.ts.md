# hub/test/sqlite-hot-reads.test.ts

`hub/test/sqlite-hot-reads.test.ts` is T2. It counts prepare calls at the injected
database boundary, rather than measuring elapsed time. Standalone cases use
in-memory databases; the hub-stop case uses projectHub's disposable root, fake
harnesses and default fake native probes. No provider or network service is used.

Tracker list variants, referenced-kind hydration, point reads and criteria counts
retain fresh bindings and read updated rows. Label filters share a SQL shape
regardless of label count, bounding the read cache to the finite filter combinations.
Store suite summaries and inbox queries retain the existing SQL-text cache.
Closing each owner, including hub stop, must close its connections and invalidate
every captured statement. Reopening allocates a separate connection and statements.

Each callback uses a whole-case owner before guard installation or acquisition.
The counted fakeNativeGuard positively exercises public, custom-promisifier,
sync and prototype launch paths, and stays installed through joined original
setup/body work, hub shutdown, probe fallback closure and guarded root removal.
Every opened probe connection is registered before owner construction, so a
constructor rejection cannot strand an unassigned handle. Cleanup attempts all
probe closes; incomplete joins, retained roots or open handles retain the guard.
