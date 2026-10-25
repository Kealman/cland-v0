# hub/test/cli-command-help.test.ts

`hub/test/cli-command-help.test.ts` is T1. It calls the same pure `commandHelp`
entry in `hub/src/cli/help.ts` that the executable calls before importing command
implementations. The top-level usage composition comes from that entry, so its
table discovers the actual advertised command set without a second inventory.
Read complete non-option tokens at exact two-space indentation, including names
with digits. Colon-terminated tokens label explanatory prose, such as T-779's
`release: optional [release.homebrew] ...`; exclude those annotation rows while
retaining the real `release` command and its complete unchanged usage block.
Every listed command, aliases and publication commands included,
must resolve both `--help` and `-h` to its own usage. The table retains the
read-only scratch project with invalid TOML, no hub and sealed HOME/XDG/Git
environment, comparing contents, modes and modification times after every call.
Restore the caller's cwd and environment before cleanup.

For the C2 mutation control, temporarily advertise `future2-command` in the
top-level usage without adding a dispatch entry. The T1 table must fail that
named row. Remove the mutation and rerun the complete table. There is no
letters-only command-name restriction.

The task subcommand inventory matches the advertised task usage. Each named
subcommand checks both immediate flags, its own usage only and shared options;
unknown commands and non-immediate flags remain for normal argument parsing.

The [T2 executable help checks](hub-test-cli-help.test.ts.md) prove the real entry-point wiring with four child launches.
