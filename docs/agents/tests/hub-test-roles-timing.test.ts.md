# hub/test/roles-timing.test.ts

The malformed-refresh case keeps its four clock, snapshot and slow-request
assertions. Arm the `roles-unreadable` promise before ticking the refresh interval
and await that receipt before `RolesFile.stop()`: stopping suppresses unfinished
refreshes, and asynchronous skill inventory can take more than one event-loop
turn. The logger resolves the receipt after recording the failure; the resumed
continuation finishes its accounting before the awaiting code resumes.

The node:test timeout bounds the case, and its signal aborts the sealed child
process if that bound is reached. Do not add timer sleeps or counted
`setImmediate` turns. A negative control that removes only the receipt wait must
fail the unchanged `clock === 300` assertion. Run this file five times locally;
the changed T3 file also runs once in the item's mode-free Linux verification.
