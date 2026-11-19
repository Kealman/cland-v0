# hub/test/suite-reference-pins.test.ts

T2 disposable filesystem tests exercise tracker create/edit body references,
verdict and criterion publishers,
coverage pointer publication and duration refresh through their public APIs.
At each final write boundary a retirement attempt must retain the pinned run;
after retirement a fresh publication must refuse. The counted native launch
guard and root/resource ownership come from retentionCase. Git is injected.
No subprocess, provider, credential or network operation is permitted.

Crash recovery is modeled by abandoning a successful pin before any publication,
and by an empty admission record with an ancient timestamp. Both keep the raw
root through the real guarded retirement owner. No expiry is inferred.

The duration identity control changes an alias after its realpath result is
captured and before publication opens the log. It asserts the exact timing key
from the pinned run, keeps that run through guarded retirement and allows the
unconsumed replacement to retire. Static renamed/alias inputs remain covered.

Run: `node --test hub/test/suite-reference-pins.test.ts`.

The retained-history work test copies body and run-reference data from the
immutable real-world tracker snapshot at source 96238cb9a into a disposable
tracker. It positively observes cold filesystem admission, then requires zero
realpath/mkdir/lstat/open entry calls in admission ownership paths during four
history-preserving edits. One new reference has a fixed budget of 16 such calls.
This is an admission entry-call budget, not a whole-tracker I/O census or timing
speedup. The owner test separately proves shared pending work, no success cache
on failure/unknown state, and lazy durable-record revalidation after recovery.
