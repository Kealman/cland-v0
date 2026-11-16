# hub/test/case-deadlines.test.ts

Whole-case users supply the shared beforeDirectories and guardDirectoryRemoval
adapters. Enrollment happens before acquisition; `run` refuses without it.
Each acquisition callback calls adoptRoot before returning, so even a late
result attaches the positive join guard. Normal and signal cleanup call the
same owner: fence admission, release held controls, join whole sequences and
named waits, then invoke captured teardown. Guard failure retains storage/root.
Wait-only T1 users retain raw-after behavior and import no native cleanup module.
The registration control checks the injected shared path without sending a
signal; held controls release through that same owner and preserve their final
completed-write, fenced-step, adopted-root and removed-root assertions.

`caseDeadlines.run` admits an entire asynchronous case before its first resource
acquisition. Each `step` checks the shared fixtureWork fence before admission;
late acquisitions are adopted by the same proxied teardown hooks. Cleanup closes
that owner and joins the entire continuation before invoking resource/storage
teardown, then drains the existing named waits. The fixtureWork implementation
is unchanged.

Held acquisition and writer controls arm an entry receipt before triggering
cleanup. A separately bounded setup observation precedes release. They retain
the final assertions that the admitted write completed, later admission was
fenced, late roots were adopted and root removal followed the join. Fake-clock
startup/teardown deadline controls retain their previous assertions. No cloud,
browser or worker process is required; projectHub writers stay in-process.
