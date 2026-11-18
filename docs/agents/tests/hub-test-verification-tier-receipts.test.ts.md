# hub/test/verification-tier-receipts.test.ts

The pure producer seam records native callback outcomes and rejection before
terminal publication. The uploaded writer executes in a VM with an in-memory
filesystem: assert ordered native exits, private temporary writes and atomic
renames. The reader fake limits each chunk, positively reaches the 65537-byte
sentinel for oversized input, and observes descriptor close on valid, failed and
oversized reads. No shell, process, network or real filesystem is used.
The native status reader's additive previous-shape control is in
executor-droplet-component.test.ts, under its full positive launch guard.
