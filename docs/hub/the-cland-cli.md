## The cland CLI

Subcommands load lazily: `bin/cland.ts` imports only the command it dispatches.
Command help text lives in `src/cli/usage/<command>.ts`; the `usage.ts` facade
re-exports existing constants and composes the legacy grouped blocks.
`src/cli/help.ts` composes top-level usage and resolves bare help. Help, version
and noninteractive no-command invocations load the facade, help, `version.ts`
and 37 pure command-help modules. Command implementations re-export their usage
constants for existing callers.

`test/cli-imports.test.ts` uses a real-process resolve hook to assert the 37 help
modules separately. Excluding those modules, the existing source-module budgets
remain: help/version/no-command at most 10, task list at most 17 and hub status
at most 21. The macOS Node 24 real-CLI fixture observed total counts of 40, 52 and 57
respectively (help/version/no-command, task list and hub status).
The guard also checks lazy implementation imports and preserves command import
failure error lines and exit codes.

Every command and group listed by `cland --help` accepts `--help` or `-h`
immediately after its name: it prints its usage and exits 0 without a running
hub or project changes. The executable calls the pure `commandHelp` entry in
`src/cli/help.ts` before importing command implementations. It uses the
command-owned entries behind the `src/cli/usage.ts` facade; release, sync and publish share
the release usage block. Every task subcommand also accepts an immediate help
flag (`cland task criterion --help`), showing that subcommand's forms and shared
task options. This includes offline migrate and import-github, and requires
neither valid configuration nor a hub. Other argument paths keep their existing parsing.
The T1 table in `test/cli-command-help.test.ts` derives its command list from
that same advertised top-level help and checks both flags in process. Adding
a listed command without help support fails the table. The table also checks
every advertised task subcommand and both flags. T2 `test/cli-help.test.ts` keeps five real
CLI launches: top-level `--help`, `task criterion --help`, `remote --help`,
`hub --help` and `session -h`, checking output and sealed project/profile immutability.

The root `package.json` owns cland's version. `src/version.ts` reads it for
`cland --version`, the spoke's MCP server info, hub discovery and every managed
mark. `hub/package.json` has no version. `CLAND_VERSION_OVERRIDE` is for tests
that simulate an update. A release bump is an ordinary commit merged before
the release's dry run; `cland release` does not write the version.

