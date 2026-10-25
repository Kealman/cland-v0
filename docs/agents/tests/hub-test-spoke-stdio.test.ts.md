# hub/test/spoke-stdio.test.ts

T2 runs the production `runSpoke` with owned in-memory byte streams, a sealed
fixture environment and disposable discovery root. No hub or child process is
needed: the assertion concerns the local MCP framing boundary.

Run `node --test hub/test/spoke-stdio.test.ts`. The oversized invalid
`tools/call` envelope must receive the cap error instead of the SDK's schema
error. Keep the exact refusal and subsequent ping response assertions. The
incomplete multibyte line refuses before its newline and resumes after its
discarded tail; two exact-cap lines in one write both succeed. Under-cap
schema errors retain their prior JSON-RPC shape, and EOF exits once. Arm output
collection before writing input; wait on exact reply/exit receipts with bounds.

The byte cap includes an optional CR and excludes LF. Tests use injected streams
so they never read, close or change encoding on the test process's stdin/stdout.
