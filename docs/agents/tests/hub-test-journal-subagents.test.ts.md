# hub/test/journal-subagents.test.ts

Run `node --test hub/test/journal-subagents.test.ts` alone (T1). The synthetic
300 MiB test takes about one second on the development Mac; it writes only to a
fixture-owned disposable root and closes the writer before selection/removal.
It asserts the exact input bytes consumed and selected tail record, with a fixed
1 MiB upper bound on accounted input work, rather than a timing threshold.
The counter conservatively covers chunks, unfinished fragments, joined line and
UTF-16 decoding, excluding allocator overhead and selected decoded objects.
The production bound is proportional to the longest line; oversized valid lines
are preserved. Multi-chunk Unicode, CRLF, escaped keys/values, malformed records
and an unterminated tail are compared with the prior synchronous selector.
Promise identity proves concurrent readers share the open/stat/scan/close; later
append and failed-open/read controls prove the in-flight entry is released.

`node hub/test/measure-startup-journal.ts --help` describes the selection-only
probe. Pass only a disposable journal copy, never the live journal. Its heap/RSS
are immediate process readings including module imports and selected records,
not whole-hub startup or post-GC retention. It enforces no memory budget.
Live-scale comparisons use T-1467's sealed memory probe and a Coordinator slot;
record the source/tree, checkpoint, machine and excluded stages. A post-selection
checkpoint includes more work than the old whole-read checkpoint; label that
comparison explicitly. No browser or external provider is involved.

The recorded parity subset is `hub/test/fixtures/startup-journal.jsonl`, extracted
incrementally from the measurement's disposable copy, with source line ordinals
and redactions in `startup-journal-provenance.json`. It preserves ts/event and
normalizes identities; unrelated fields and all text were removed. The retained
copy contained no task-plan events, so the inline boundary/escape control supplies
those examples separately. The recorded subset proves exact selection equality
for retained checkpoint/subagent and ordinary audit/lifecycle records.
