# hub/test/executor-lease-index.test.ts

`hub/test/executor-lease-index.test.ts` is T1. It uses a disposable root,
sealed fixture environment and 5,000 synthetic retained leases from distinct demo
epics supplied through filesystem fakes. Cold pointers, report queues and their
checkpoints are in memory. Only the live files, ledger and index use scratch
storage. No provider, network, process or live project state is needed.

The missing-run control requires the structured result
`{status: 'stopped', reason: 'run-directory-missing'}` and stat(`.cland`) ENOENT.
The publication control creates its run anchor first, injects an unrelated
ENOENT at index rename and requires that failure to propagate. Its manual seam
is independent of TestContext mock restoration and stays installed until the
original compaction joins. A held-publication control executes the registered
cleanup hook while the writer is held, then requires the native rename receipt,
writer join and restoration in that order. Cleanup always releases and joins
the original producer before fixture removal or guard restoration.

The unchanged-membership control counts temporary opens, writes, file syncs,
renames and directory syncs through filesystem seams. Initial migration and a
settled lease removal must publish durably; unchanged periodic and rebuild
passes must perform none of those operations. The interrupted-publication case
settles a previously pending spend entry so its fault targets a changed index.
An absent index with no lease directories creates no temporary file on either
startup or periodic compaction. Absent-index readers still find legacy leases;
the first append durably indexes all legacy ids plus the newly admitted lease.
All-settled legacy history must publish an empty index; its subsequent lease
and demo reads are checked with directory enumeration refused.

The 5,000-record historical root is built and repaired once per file. The scale
case then shares that root between read-only lease and released-demo status
checks. Lease seeds use one batched helper. Report acknowledgement uses a
separate 65-demo root, and spend/publication/repair mutations use a separate
four-record root, so independent fault checks never rebuild the large history.

The read-count assertion expects exactly three file reads: one bounded index
and two live lease files, with no directory enumeration and fewer than 2,048
decoded bytes. Separate small-root checks retain
missing/pending spend, preserve the prior checkpoint on interrupted publication,
retry idempotently, recover a file omitted from the index at startup, and read
the latest released demo through its cold pointer without enumerating history.
Demo reconciliation drains at most 32 queued reports per pass; interrupted
acknowledgement retains the queue and never duplicates the tracker report.
Released keys must be removed before compaction, and an injected partial key
cleanup failure keeps recovery membership until the next successful attempt.
An interrupted startup repair remains pending for the next periodic retry,
including recovery of a file omitted from the previous checkpoint.
