# hub/test/login-records.test.ts

T1, in-memory SQLite. `disk and key login rows round-trip every field without key disk properties` proves C1. The generated `refuses login transition from <current> to <target> naming current state` cases cover every invalid state edge (C2). `creating is neither free nor bound; bindings enforce exclusive writer and non-exclusive readers` covers allocation and binding release. `login syntax, uniqueness, harness and key disk constraints name their rules` proves C4. No provider, native process or real credentials are involved.

Run: `node --test hub/test/login-records.test.ts`. Full task evidence uses mode-free `cland verify` after source review.

The six generated `binding invariant: <scenario> is a typed refusal with no partial write` cases independently cover missing disk volume, mismatched writer volume, reader on original volume, key with volume, exclusive second binding and second writer. Each checks refusal name/code and unchanged row/bindings.
