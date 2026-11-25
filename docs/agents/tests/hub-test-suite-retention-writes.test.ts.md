# hub/test/suite-retention-writes.test.ts

Runs the scheduler against a fake local executor with retentionCase's counted,
positively controlled native guard installed before setup through cleanup. Callback,
custom-promisifier, synchronous and ChildProcess prototype boundaries are covered;
the final-zero check precedes restoration. Manually owned filesystem seams persist
until original work and resources close positively, including after an earlier
cleanup rejection. Native root removal is transferred to the settlement owner.
It accounts for scheduler calls to writeFile, appendFile, open,
createWriteStream, copyFile and rename beneath the disposable suite root.
The stream positive control writes control.tmp and renames it to control.txt.
Incoming copy and rename controls use both sources outside the suites root and
sources in a second fake run. Each operation retains both endpoints; each run's
observed paths include only endpoints beneath its own directory. The second run
assertion catches cross-run path misattribution.
After the reported run and scheduler work settle, an independent recursive
directory listing checks every remaining file against observed paths. Assertions
also require provenance and publication temp files and their rename destinations.
The diagnostic separates observedWriteCalls (including source and destination),
observedFiles, and finalInventory, with separate call and final-file counts.
The final inventory includes the four incoming controls, control.txt, suite.log
and finalized.log; temporary
paths remain in the observed census after their renames remove them from disk.
Named scope.wait observations separately bound fixture setup and census action
through final listing, using shared load-scaled testDeadlineMs headroom. The
whole-case owner retains the original work through deadline failure and cleanup.
Worker execution and remote delivery are unexecuted and excluded;
the receipt is not an estimate of all executors' filesystem event counts.
Run with `node --test hub/test/suite-retention-writes.test.ts`.
