## Pinned verifier request heads

A review or QA request may include a standalone `Head: <full-commit-sha>` line
(case insensitive; 40 or 64 hexadecimal digits). Use the pushed, reviewed build.
The hub captures this explicit field with its existing admission authorization
before delivery, retains it across queueing and restart, and projects it as
optional `pending.head`. Ambiguous or non-full-SHA Head details remain legacy unpinned prose.
This is a sender-selected commit identity, not proof of a push or a clear review.
Requests without the field remain accepted, including older clients and stored
requests, and keep ordered-receipt retirement.

For a pinned reservation, a later same-kind verdict or newer accepted request
retires it only when its commit is the same or a proven descendant. Unrelated,
missing and not-yet-computed ancestry retain the reservation. The existing
asynchronous freshness cache computes ancestry off send/presence paths; later
presence/queue maintenance observes the result. Item closure/ready and taking a
hold still end pending work. Existing permissions and role clauses apply;
this introduces no gate or approval requirement.

Coverage is monotonic: later unrelated work cannot hide an earlier covering
verdict or accepted request, including before delayed assignment. Accepted
request facts are retained in an indexed compact ledger. Pinned retirement
scans at most 32 indexed verdicts, 32 accepted requests and 32 unresolved pairs per background turn,
shares one in-flight check per request, and persists both producer cursors and
the covering result. Unknown/transient ancestry is saved in a separate deduplicated retry queue;
forward cursors still advance to later exact proof. Retry cursors rotate through
unresolved pairs without starving new facts;
shutdown cancels deferred checks before storage closes. No retained history is
scanned in a startup or presence reply.

Legacy NULL-admission messages gain authorization only at authorized delivery;
they never gain a head inferred from their retained text, even if it happens to
contain a full-SHA Head line. Fresh admission alone captures that field.

Pinned ancestry proves both commit objects and a positive merge-base result.
Missing objects, failed ancestry and histories without an observed common base
remain unknown and retryable; only a returned common base distinct from the
request head proves unrelated coverage. Existing stage-cover callers retain
their earlier cache mode.

