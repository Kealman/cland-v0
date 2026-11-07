T-1727: Document the additive generation-bound Claude pre-spawn refusal receipt and conservative compatibility with older agent replies.

Coordinator correction: include native owner proof of pre-spawn abort, synchronous throw and no-PID error after close; retain observed-PID/lost-reply/incomplete-close fences.

Include Coordinator 9be88778 pre-wire proof and sent-byte ownership boundary; never infer admission from AbortError names/text.

A-17239 correction: positive owner receipt precedence over incidental error text; deterministic native-abort fixture holds admission until its captured cancellation signal is observed.
