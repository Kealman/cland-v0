# hub/test/webauthn.test.ts

T1 exercises `verifyRegistration` and `verifyAssertion` at their public byte
boundary. It generates P-256/Ed25519 keys with Node crypto and independently
encodes CBOR/COSE and signs assertions. No hub, browser, process, provider,
transport, filesystem fixture or external credential is used.

C1 covers none registration and usable public keys for ES256 and Ed25519;
RS256 is deliberately unsupported. C2 checks ceremony fields, RP hash and flags.
C3 covers mutations in both signed parts and the signature, credential identity,
counter rollback/replay and authenticators with both counters zero. Both algorithms
also cover unsigned mutations to RP hash, UP, UV and counter bytes, including
forged UV elevation and UV removal with verification optional or required. C4 covers
truncated/indefinite/oversized/deep/duplicate CBOR, unsupported algorithms,
invalid keys, extensions, trailing bytes and malformed runtime values. C5 checks
built-in-only imports; review checks unchanged manifests and lockfiles.

Run `df -h .`, then `node --test hub/test/webauthn.test.ts`. Existing
`hub/test/web-auth-unit.test.ts` is the untouched single-mode preservation check.
This is cryptographic module evidence, not browser ceremony or sign-in coverage.
