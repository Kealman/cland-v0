# Structured verification tier receipts

Local and droplet verify runners publish optional `tierReceipts` alongside their
native run status. Each ordered record names `tier`, native `exit` (or null on
rejection), `completion` (`complete` or `incomplete`), `tree`, `run` and `command`.
The runner captures these from the native command outcome before publishing its
terminal status. Printed tier lines remain display/legacy diagnostic evidence;
they cannot authorize batch T1 omission.

Local workers retain records through command rejection, signal handling and
compatibility cleanup diagnostics. The hosting source generates the remote writer
and reader, so delivered older candidates need no runtime helper. The remote
writer atomically replaces a private JSON file after each completed command,
including a reused native host check. Publication failure leaves evidence unknown
without replacing the command's native exit. The status reader bounds ingestion
at 65536 bytes plus one oversize sentinel and closes its descriptor. The shared
parser accepts at most 32 records; missing, damaged, oversized or incomplete data
cannot authorize reuse. The hub retains the optional field in full job/result
records, including terminal collection and restart recovery. It stays outside
public queue/status projections and the compact retained-history index.

The cached member request must be current at its exact pinned head. Its source
receipt may belong to another head, item or branch at the same tree, under the
existing tree-hash cache's command, selection, worker, executor and freshness
checks. The source owns the tier records and their run identity. Every planned
step must have a positive complete receipt. An interrupted attempt is superseded
only by a later complete pass for the same tier/run/tree/command; other failures,
incomplete records or mismatched identities retain T1.

Older workers/status records omit the field and remain readable. Their batches
run configured T1. This safe fallback permits rollout without a receipt-format
restart prerequisite; omission begins only with complete new producer receipts.
It never removes a sole configured T1 or adds T1 to a configuration without it.
