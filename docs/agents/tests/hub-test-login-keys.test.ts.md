# hub/test/login-keys.test.ts

T2 key-store tests use disposable directories and sentinel keys. The integrated
case uses local Unix sockets plus CLI and Git children, joined before cleanup.
No external network, real provider or harness login is used. Run with supported Node 24:
`node --test hub/test/login-keys.test.ts`.

- `key files encrypt a sentinel, reuse the store key and authenticate project and name`: independent AES-GCM decode, C1/C3 and tamper refusal C5, mode checks C6.
- `key store refuses symlink directories and files and never overwrites a key`: C6 and create-only ownership.
- `a held key-store write fences other key creation and store-key rotation`: serialized writers.
- `key admission registers plaintext before storing metadata and refuses invalid ciphertext without a row`: metadata-only storage and redactor ordering C4.
- `store key cannot rotate while a retained key login has lost its file`: durable row protection.

`hub/test/secrets.test.ts` additionally covers `[auth]` startup, fingerprint-only
listing and unknown auth keys (C2). `stdin key CLI publishes metadata only and the hub retains no sentinel bytes`
covers the real CLI with stdin through a captured local socket into projectHub:
C1/C3 encrypted file and store-key reuse, C4 exact metadata frame fields and argv,
log/journal/database scans with a positive control, C5 argument guidance and
one-byte ciphertext corruption, C6 real Git check-ignore. It uses FakeClock and
fake lock/startup processes, closes the CLI and socket before directory removal,
and refuses Claude Code/Codex key paths with 0.4.x guidance. It also proves a
refused authorization preflight leaves no auth directory or store key, and a disk
row named opencode-1 makes unnamed key add choose opencode-2. Stage QA runs the integrated command on dev with sentinel
stdin values and sealed fixture environments, never a real key.
