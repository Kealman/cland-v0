# hub/test/web-readme.test.ts

`hub/test/web-readme.test.ts` checks stale feature-status wording and compares the
hub README's complete `cland web` option/alias and `[web]` key references with the
actual parser/default inventories at T1. Live pending states and human answer
attribution remain valid terminology.

The merge queue guide regression reads through `hubReference` and asserts the
entire indexed landing guide survives. In-memory document fixtures also prove
that descriptions, fragment anchors, Markdown titles (including escaped title
delimiters) and multiple links on one index line retain the complete documents.
A malformed subsystem pointer fails with its README line number and text rather
than silently omitting a document. The resolving and malformed-pointer regressions
were observed red before their corresponding reader fixes (T-1757).

The T-1757 Coordinator scope decision keeps the supported index grammar bounded:
angle-bracket destinations and whitespace before a destination are refused with
file and line. A T1 regression proves both refusals in every mode-free task
verification; these cases were already refused when added and were green first.
Full CommonMark destination grammar is outside this reader's scope.
