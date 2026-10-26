# hub/src/remote/redact.test.ts

T1 tests for the shared remote/speech diagnostic redactor. Register synthetic
values only. Keep overlapping values, regex metacharacters, empty registration
and a short value contained in a redaction marker. Match full URL, Bearer and
quoted token/key contexts before an exact value can hide their prefix; all
replacements use one pass. Check control-character flattening and the 500-character
reason bound after redaction. Gateway sink/log coverage lives in
[gateway.test.ts](hub-test-gateway.test.ts.md).
