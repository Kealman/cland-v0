# hub/test/executor-lease-index.test.ts

The copy fixture's late-root regression holds mkdtemp until its injected setup
clock passes the five-second observer deadline. It observes the new directory
inside the producer, then requires the original deadline rejection, no body
admission, and stat(root) ENOENT after guarded cleanup joins. fakeOnlyFixture
captures the path inside the acquisition producer, so a rejecting observer
cannot discard cleanup ownership. The test's fallback cleanup runs only after
the original fixture joins; it does not substitute for the final ENOENT assertion.

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
unknown/pending spend, preserve the prior checkpoint on interrupted publication,
retry idempotently, recover a file omitted from the index at startup, and read
the latest released demo through its cold pointer without enumerating history.
Demo reconciliation drains at most 32 queued reports per pass; interrupted
acknowledgement retains the queue and never duplicates the tracker report.
Released keys must be removed before compaction, and an injected partial key
cleanup failure keeps recovery membership until the next successful attempt.
An interrupted startup repair remains pending for the next periodic retry,
including recovery of a file omitted from the previous checkpoint.

Released leases with no ledger entry publish `cost: null` and a `spendReceipt`
identifying the project, lease, release and `ledger-entry-missing` reason before
leaving the index. Four compactions (including rebuilds) count exactly one
missing-spend diagnostic per lease. Ledger and executor status assertions keep
spend unknown; `todayCostUsd` is null and the summary names the unknown count.
Pending entries remain recoverable. Migration counts are asserted on the first
durable index publication only; rebuilding an existing index emits no migration.

The first-writer control seeds a legacy id, appends a new lease and requires one
read=2/indexed=2/settled=0 log across later writes, compactions and rebuilds.
Primary/legacy permutation controls observe and migrate unknown receipts beside
pending or zero duplicates in both orders. Malformed reason, shape, project,
lease and release bindings refuse status, settlement and compaction while the
prior index and key remain intact.

New callbacks enroll fixtureWork before acquisition, register the same close on
TestContext normal cleanup and abort, and use caseDeadlines for named root/seed
setup bounds. Each effect is admitted through step. A setup deadline fences
continuations and joins its original producer before fixture removal or seam
restoration. Normal, abort and fake-clock timeout controls hold setup, require
the original root while held, then require no later write and observed removal.
The existing positive native-launch guard remains installed through that join.
This owner imports no native process-cleanup module; older callers are unchanged.
The fixture's optional step argument carries admission through guard setup, root
acquisition and callback entry. A held-guard control closes admission and requires
the next root acquisition itself to be refused. Existing two-argument callers
keep their prior behavior.

The throwing-sink case uses the real first publisher and DropletRun.status with
fake provider/transport boundaries. A migration-only and a permanently throwing
sink must both preserve lease.json publication and the exact parsed completion
receipt after clearing an outage marker. It checks the secondary notice attempt
and no replay on an existing index. A real lease-record rename fault must still
reject with its original write error and leave the conservative index checkpoint.
