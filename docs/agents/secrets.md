# Project secrets

Use the [local secret commands](../../hub/README.md#project-secrets) to manage
the project's messenger tokens and speech keys. Values enter through stdin or
a hidden terminal prompt. Only names and SHA-256 fingerprint prefixes belong in
reports; never share the file, parser input or a credential-bearing command.
The file store is separate from `.cland/secret`, which authenticates local clients.

Remote and speech code share `resolveSecrets(root)` in
`hub/src/remote/secrets.ts`. It reads the four supported dotted keys, refuses
symlinks and tightens permissions; errors contain fixed diagnostics. Keep values
inside the process and pass them only to the intended provider boundary.
Hub startup checks this store before opening logs and listeners. Local secret
commands require an initialized project, but no running hub or platform call.
The daemon imports the resolver at that startup boundary, inside its held lock.
Keep the shared `project.ts` module free of the loader and fingerprint helpers:
read-only CLI commands use it without loading the credential implementation.
For a custom unmarked `.cland/.gitignore`, put `/secrets.toml` last among its
non-comment rules. Writes refuse before requesting input until that protection
exists; the command preserves the file's bytes.

Use [the sealed test seams](tests/hub-test-secrets.test.ts.md) for changes here.
The [CLI import guard](tests/hub-test-cli-imports.test.ts.md) protects that boundary.
The existing role clauses already require secret isolation; this local command
adds no frame, role permission or role-clause line.
