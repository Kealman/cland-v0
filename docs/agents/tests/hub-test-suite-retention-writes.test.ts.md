# hub/test/suite-retention-writes.test.ts

Runs the scheduler against a fake local executor with retentionCase's counted,
positively controlled native guard installed before setup through cleanup. Callback,
custom-promisifier, synchronous and ChildProcess prototype boundaries are covered;
the final-zero check precedes restoration. Manually owned filesystem seams persist
until original work and resources close positively, including after an earlier
cleanup rejection. Native root removal is transferred to the settlement owner.
It accounts for scheduler calls to writeFile, appendFile
and open beneath the disposable suite root. The diagnostic names the files and
call counts. Worker execution and remote delivery are unexecuted and excluded;
the receipt is not an estimate of all executors' filesystem event counts.
Run with `node --test hub/test/suite-retention-writes.test.ts`.
