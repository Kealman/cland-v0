# hub/test/suite-import-parser.test.ts

`hub/test/suite-import-parser.test.ts` runs at T1. A counting compiler loader
proves that concurrent and repeated scans share analysis for identical source
and filename, while edited source and a different compiler loader cannot reuse
that result. Rejected compiler acquisition remains retryable. Returned facts are
independent copies, so callers cannot mutate another admission's dependencies.
