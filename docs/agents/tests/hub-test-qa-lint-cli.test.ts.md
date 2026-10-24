# hub/test/qa-lint-cli.test.ts

T2 invokes the shipped offline qa lint CLI under a disposable root without starting a hub or browser. Pass fixtureEnvironment after all launch overlays so HOME, XDG paths, Git configuration and credential filtering belong to the fixture. Preserve clean/invalid brief diagnostics, exact file:line output, help and usage/read-error exit codes; a text-only brief still needs no Git repository. Immutable Git-source and production-install checks belong to qa-lint-build.test.ts at T3.
