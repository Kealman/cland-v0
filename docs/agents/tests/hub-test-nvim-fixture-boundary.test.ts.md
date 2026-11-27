# hub/test/nvim-fixture-boundary.test.ts

`hub/test/nvim-fixture-boundary.test.ts` checks canonical recording keys,
packed-catalog replay and the T2 import boundary without launching Neovim.
Its catalog guard rejects duplicate normalized inputs and stale keys.

The complete-catalog codec regression reads the committed file once, checks its
byte length against the existing 16 MiB hub Git reader, and decodes and encodes
every record once. The encoded SHA-256 must equal the original file's SHA-256,
so every catalog byte, key, input and output survives the complete round trip.
It avoids extra full-catalog packing passes and deep traversal of shared trees.
Record-order determinism, previous full-hash readability, and mixed old/new
slice fallback are checked on the small fixture; node namespaces remain local
to each decoder. Intern nodes keep hash-based deduplication in memory; disk IDs
are compact opaque strings assigned in hash order. Recording keys remain SHA-256.

This exact catalog case has a 6.628-second allowance owned by E-880, added
2026-11-27 and expiring 2026-12-04. Enqueue requires an allowance for a new Linux
identity measured at 4 seconds or more; the eligible base receipt in de08d6d3
(A-23588, head 90718147c) measured 4.418251964 seconds. The cap rounds 1.5 times
that receipt upward to milliseconds. The five loaded observations are separate
evidence (maximum 4.715693604 seconds); no assertion, data coverage or tier changed.

Explorer `task.plan` result projection does not read the scenario item index.
`task.view` projects its item using the current open release and descendant
membership. Its context therefore retains open rows and their ancestors,
including closed ancestors, while dropping unrelated closed branches.
Normalization happens before transient timestamp/path binding, in the same
canonicalization boundary for recording and ordinary replay. Other frame kinds
keep their complete context, including task events' index-wide layer maps.

`node hub/test/migrate-nvim-frame-inputs.ts` performs the deterministic one-time
metadata migration of the catalog and slices. It refuses collisions with
different outputs and asserts the distinct output JSON byte strings are
unchanged, then reports before/after record counts and collapsed duplicates.
Existing timestamp/UUID token slots are reindexed after context pruning, matching
fresh canonicalization. Frame fields precede item context; their token bytes
stay unchanged. A regression covers a removed timestamp before a retained one.
It is idempotent; it does not call a hub or launch a client. Fresh capture still
uses `npm run test:nvim-fixtures` under the project's native-slot procedure.
An optional positional path reads the original fixtures directory from a
separate checkout and writes migrated metadata into this checkout. This allows
reproducing the migration independently of incidental fresh-capture churn.
