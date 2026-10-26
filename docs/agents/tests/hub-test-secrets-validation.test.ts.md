# hub/test/secrets-validation.test.ts

T1 exercises the shared resolved-secret validation and registration boundaries
without a platform, socket, process or clock. Literal cases cover zero/leading
zero ids, overlong ids, short suffixes, forbidden characters, terminal newline,
maximum length and valid boundaries. Discord remains opaque.

Registration covers all four dotted names, rotation retaining old values,
project isolation and full multiline persistence text. Opaque credentials that
begin with the redaction marker still match in full; repeated writes preserve
markers even when another credential is a marker substring. Fixed diagnostic and
boolean credential comparisons keep failure output value-free. The T2 gateway
file proves startup ordering and native journal/artifact persistence separately.
