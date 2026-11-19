# hub/test/qa-lint-cli.test.ts

T2 invokes the shipped offline qa lint CLI under a disposable root without starting a hub or browser. Pass fixtureEnvironment after all launch overlays so HOME, XDG paths, Git configuration and credential filtering belong to the fixture. Preserve clean/invalid brief diagnostics, exact file:line output, help and usage/read-error exit codes; a text-only brief still needs no Git repository. Immutable Git-source and production-install checks belong to qa-lint-build.test.ts at T3.

All callbacks enter the shared `fixtureWork` owner before root acquisition.
Setup readiness and behaviour have separate bounds; the original sequence stays
owned after a caller deadline. Every CLI invocation registers its captured child,
arms a native close observer and joins both close and result during cleanup.
Cancellation fences later steps and an incomplete join retains the fixture root.
The report-only regression keeps the real executable exit-0/exit-1 assertions.

Outer setup/behaviour deadlines settle through the production withCleanupAsync
helper, preserving the selected error and adding any disposal error as secondary
diagnostic. Keep the disposal/root fence even when either path rejects; the pure
contract control is in qa-lint.test.ts.
