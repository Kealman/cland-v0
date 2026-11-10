---
id: T-1783
kind: task
title: The key store and `cland login add --kind key`
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1773
topic: null
branch: null
created: 2026-11-09T12:44:10.500Z
updated: 2026-11-10T05:08:03.603Z
---

## Summary

`cland login add <harness> --kind key [--name] [--account]` reads the key from stdin or a hidden prompt, as `cland secret set` does. It stores the key AES-256-GCM in `.cland/auth/<login>.key` under the store key from the `[auth]` section of `.cland/secrets.toml`, which the strict secrets reader and `cland secret` learn. The CLI encrypts the key and never sends it in a frame; the hub records a `key` login row with no volume.

## What to build

The store key and the key files:
- **The store key.** `[auth] key` holds 32 random bytes in base64. The first key login writes it when it is absent. `cland secret list` shows only its fingerprint, and replacing it is refused while key logins exist.
- **A key file.** It holds a version, nonce, ciphertext and tag, authenticated with the project tag and the login name as associated data, at mode 0600 in a 0700 `.cland/auth/` that `.cland/.gitignore` ignores.
- **The row.** The `login.add` frame with `kind: key` carries the name, harness and account, never the key. Before writing the row, the hub decrypts the file in memory and registers the value with the redactor.

The harnesses allowed a key login follow question 4.

## Acceptance criteria

- [ ] C1. A sentinel key piped into `cland login add opencode --kind key` is stored in `.cland/auth/<name>.key` as AES-256-GCM ciphertext that decrypts with the `[auth]` key, and the file holds no plaintext byte of it (test).
- [ ] C2. The hub starts with an `[auth]` section in `.cland/secrets.toml`, `cland secret list` shows only the auth key's fingerprint, and an unknown key in `[auth]` is refused (test).
- [ ] C3. The first key login writes an `[auth]` key when none exists, and a second key login reuses it (test).
- [ ] C4. The `login.add` frame, the CLI's argv, the hub log, the journal and `hub.db` hold no byte of the sentinel key (test).
- [ ] C5. A key passed as an argument is refused naming stdin, and a ciphertext altered by one byte fails to decrypt with a refusal that names the login and not the key (test).
- [ ] C6. `.cland/auth/` is ignored by Git, and a key file or `.cland/auth` that is a symlink is refused (test).

## Blocked by

- T-1773

## Notes

- Hot files: `hub/src/remote/secrets.ts`, `hub/src/cli/secret.ts`, `hub/src/host/login-keys.ts` (new), `hub/src/cli/login.ts` (`add --kind key`), `hub/src/project.ts` (the ignore rule).
- Tests: new `hub/test/login-keys.test.ts` (T1 for the cipher, T2 for the CLI and frame); `hub/test/secrets.test.ts` (T1, new cases). Sentinel values only.
- Serves epic C5.
