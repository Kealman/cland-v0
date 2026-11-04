# hub/test/host-flush.test.ts

T1 checks the held publication boundary, named unknown/lease refusals with both
heads, reported-head corroboration, a concurrent ref move and old Host refusal.
The fake Host has no hub-local filesystem fallback and no native processes.

CLI status rendering retains the previous hub reply shape and distinguishes a
pending snapshot census (null) from a completed census with named leftovers.

Reusable optional Host-operation coverage exercises local absence, exact path and
branch through a held successful operation, SSH drain followed by its matching
watch receipt, and a previous agent lacking ref-flush-v1. Capability absence
permits initial read-only process receipts and sends no flush request.
