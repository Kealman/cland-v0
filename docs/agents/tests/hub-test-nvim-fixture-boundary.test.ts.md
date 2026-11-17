# hub/test/nvim-fixture-boundary.test.ts

`hub/test/nvim-fixture-boundary.test.ts` checks canonical recording keys,
packed-catalog replay and the T2 import boundary without launching Neovim.
Its catalog guard rejects duplicate normalized inputs and stale keys.

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
