# hub/test/cli-help.test.ts

The [T1 command help table](hub-test-cli-command-help.test.ts.md) covers every advertised command and both flags in process.

`hub/test/cli-help.test.ts` is T2 and makes five bounded real CLI
launches: `--help`, `task criterion --help`, `remote --help`, `hub --help` and `session -h`. Each runs through `execFile`
in its own sealed scratch fixture with invalid config and no hub, awaits the
child's successful exit and asserts empty stderr. Full help and the remote, hub and session cases compare
stdout against independent frozen help fixtures; criterion help asserts all
three documented forms and excludes other task commands. The complete top-level bytes remain frozen.
Every launch also asserts that project and profile contents/modes/mtimes are
unchanged. No child writer remains when its scratch directory is removed.

This split replaces the old 67-process table, whose Linux receipt A-11192 at
d0333145 failed the 5-second aggregate gate (8.232 seconds). It keeps full
command coverage in T1 without a duration allowance. The existing T3
`cli-imports.test.ts` guards the executable's static help closure, lazy
implementation imports and dispatch failures; `help.ts`, the `usage.ts` facade and the 36 `usage/<command>.ts` modules are
static metadata. The guard counts those 36 help modules separately from the
existing implementation budgets.
