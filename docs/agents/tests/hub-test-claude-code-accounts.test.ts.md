# hub/test/claude-code-accounts.test.ts

The late-PID stop test holds a native identity probe behind filesystem receipts.
Only the held probe writes `finished`; unrelated `ps` invocations must not satisfy
that wait or keep rewriting the marker during directory removal. Its nested
`finally` releases the probe and closes the UI and fixture hub, including when an
assertion or the completion wait fails. Retain the `hub-stopped` journal receipt
and the assertion that the probe directory still exists: together they prove
shutdown precedes directory removal without another process scenario (T-1108).


The T-1471 authentication-hook consumer reads its launch generation from the
captured native --settings path, preserving the account latch, native I/O drain
and unaffected-directory assertions. Legacy fixtures and genuinely old persisted
rows remain separate from a newly generated account-selected launch.
