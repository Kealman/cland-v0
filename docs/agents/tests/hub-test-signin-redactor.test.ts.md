# hub/test/signin-redactor.test.ts

T1: memory-only stream redaction, with no files, process, socket, browser,
provider or credential. Run with supported Node:
`node --test hub/test/signin-redactor.test.ts`, with inherited `CLAND_*` removed
and subject to the project's targeted-run admission.

- `registered input is hidden across every output split and at close`:
  registers a sentinel input line, splits its echo at each offset 0 through 22,
  flushes at close, and asserts the exact `[redacted] accepted` output each time.

This proves redaction across chunk boundaries and final buffering. Native stdin
ordering and persisted-output absence are covered separately by
[the native operation cases](hub-test-host-agent-signin-op.test.ts.md).
