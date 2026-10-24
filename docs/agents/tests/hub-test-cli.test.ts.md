# hub/test/cli.test.ts

T2 executable CLI coverage uses sealed `tempProject` roots and the harness's
`cland` child environment. Run `node --test hub/test/cli.test.ts` after
cover-quiet admission.

The release, sync, publish, push and merge help cases run both `--help` and
`-h` in a sealed disposable root with no project hub. CLI completion with exit
0, empty stderr and the command's usage is the receipt: help must return before
required arguments, discovery or any Git/network operation, without a real release.

The old-hub compatibility case serves a literal JSON-line reply from an
in-process Unix-socket stub, deliberately omitting `criteriaCounts`, `closed`
and `verify`. Keep the literal shape independent of current tracker projections.
Both `task view` and `task comment` must exit successfully and preserve the
heading, item facts, body and comments while omitting absent card rows. The
same stub then supplies populated card fields to check their text rendering.
CLI completion is the receipt; register stub/peer disposal with
`beforeDirectories`, which also participates in signal cleanup. Await server
closure after destroying its peers before the harness removes the disposable root.
