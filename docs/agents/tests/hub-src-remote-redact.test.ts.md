# hub/src/remote/redact.test.ts

T1 tests for the shared remote/speech diagnostic redactor. Register synthetic
values only. Keep overlapping values, regex metacharacters, empty registration
and a short value contained in a redaction marker. Match full URL, Bearer and
quoted token/key contexts before an exact value can hide their prefix; all
replacements use one pass. Check control-character flattening and the 500-character
reason bound after redaction. Gateway sink/log coverage lives in
[gateway.test.ts](hub-test-gateway.test.ts.md).

Capture regressions exercise `.text` and the bounded callable on complete JSON
and `suite timing ` records with URL, Bearer, quoted token assignments and
registered escaped synthetic credentials in nested values. Parse the result and
assert the complete expected record, including neighbouring counts and flags.
Prove the sentinel exists before filtering and is absent afterward. Mixed JSONL,
CRLF and non-JSON multiline Bearer controls retain the conservative fallback;
incomplete records are redacted as plain text, without a parseability claim.

Root JSON-string controls cover URL, Bearer, assignments and exact credentials.
Nested serialized-object controls plant a complete registered syntax span inside
an object and an array: the conservative outcome is a parsed `[redacted]` payload,
not an unparseable log or a leaked registered span. A T1 work control observes
production credential-regex scan bytes on repeated bracketed non-JSON lines,
asserts a positive observation and a linear budget, and retains exact output.
It measures work count, not elapsed time or whole-redactor asymptotics.

Original-span controls include noncanonical whitespace in a registered structured
credential, registration after construction, credentials crossing two JSON
records and credentials crossing JSON/raw output slices in both directions.
Prove the original span is planted, neither private fragment is emitted, and
all intersected JSON payloads parse as `[redacted]`. A registered value wholly
inside one JSON string keeps adjacent fields after masking that string.

Unquoted numeric-looking strings retain their exact text through `.text`, the
callable and `.value` string leaves. Keep a Discord snowflake above `2^53`, another
adjacent snowflake, exponential notation and negative zero. Quoted JSON strings
still exercise structure-preserving redaction; bare IDs must not round-trip
through `JSON.parse`/`JSON.stringify`.
