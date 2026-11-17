# hub/test/artifact-cli.test.ts

T2 artifact CLI subprocess subjects use a disposable projectHub.
The inline admission test owns its whole sequence with fixtureWork: --content
above 65536 bytes and a 2 MiB --content-file both get named limit/path errors.
A real CLI stdin pipe also receives the named refusal. The same large source succeeds with --path as A-1, proving refusals did not
publish. File/stdin inline reads are bounded to the limit plus one byte.
