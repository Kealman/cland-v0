# hub/test/secret-input.test.ts

T1 native stream keypress events exercise hidden input, backspace, cancellation,
raw-mode restoration and CRLF handling. The file starts no terminal process
and waits on the input promise under a bounded test timeout, with no sleeps.
Fake values enter the stream, and assertions keep diagnostics value-free.
Confirmation and cancellation release an initially non-flowing stream; the
already-flowing control retains its prior state. This establishes the input
cleanup boundary without claiming a native terminal process-exit receipt.

The [T2 startup and CLI seam](hub-test-secrets.test.ts.md) proves the executable
wiring and file effects; the stream cases prove input behaviour without a
terminal child.
