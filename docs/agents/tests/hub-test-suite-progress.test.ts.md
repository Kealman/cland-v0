# hub/test/suite-progress.test.ts

Timing receipts retain all existing body rows and add an optional outcome. Assert the body timing and passing outcome while continuing to exclude the outer file envelope. Skipped and failed bodies remain available to existing timing consumers; only allowance recommendations filter passing samples.


T-1489 keeps the previous progress wire shape, including finish-only receipts.
The replay regression covers modern test ids and legacy location keys: one
completion replay produces no extra row, a fresh dequeue at that location still
produces its own pair, and a previously unseen finish-only completion survives.
Native concurrent-lane replay is covered by the selected runner fixture; it
must remain outside this process-free T1 file.

The same-location legacy control retains distinct test numbers and changed
outcome/duration evidence. A location alone never proves replay. Keep both the
passing and failing finish-only receipts visible to downstream readers.
