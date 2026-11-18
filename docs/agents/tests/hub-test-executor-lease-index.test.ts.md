# hub/test/executor-lease-index.test.ts

`hub/test/executor-lease-index.test.ts` is T1. It uses a disposable root,
sealed fixture environment and 5,000 synthetic retained leases from distinct demo
epics supplied through filesystem fakes. Cold pointers, report queues and their
checkpoints are in memory. Only the live files, ledger and index use scratch
storage. No provider, network, process or live project state is needed.

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
