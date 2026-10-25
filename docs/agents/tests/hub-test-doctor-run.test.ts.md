# hub/test/doctor-run.test.ts

T2 exercises the owned native-command boundary with a mocked child process and
fake timers. Legacy five-argument callers retain their exact timeout, error and
incomplete-cleanup results. An optional trailing `AbortSignal` terminates the
same owned process group and retains pending state until native close; a signal
already cancelled before launch starts no child. Signals and destroyed pipes
are never counted as close receipts. No native process starts in this file.

`hub/test/git-maintenance.test.ts` covers real group reaping and recovery after
cancelling a collector; its fixture retains the root until writers are gone.
