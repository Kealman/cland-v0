# hub/test/qa-demo-policy.test.ts

Both existing entry points exercise the shared policy's QA-demo and capture
profiles. Generated in-memory positive controls cover every provider prefix,
query/assignment family, private-key header, private path and raw/URL/JSON
encoding. Exact wrapper diagnostics, capture's supplied-secret check and the
intentional short-prose difference are pinned. Existing parsed/serialized nested
Authorization metadata cases retain the QA-demo header-context regression.

`hub/test/qa-demo-policy.test.ts` is T1 at the pure recorder policy seam. Missing expected facts and recorded step errors each had a failing control before the gate; the secret scanner has a positive control built from obviously fake values at runtime and asserts value-free diagnostics. No process, socket or browser is required.

Publication controls separately reject synthetic header and standalone credentials in raw text, URL escapes, nested metadata and serialized JSON. Both failed with the Bearer guard removed before the fix. Five named prose/title controls failed against the old guard; they pass with the narrowed rule. Header context still rejects short values; standalone detection starts at 16 token characters. Existing escaped-whitespace and provider-key controls remain active. The T1 test imports only the pure shipped policy; `.claude/skills/qa` links to `.agents/skills/qa`, which init copies directly.

The source-review repair adds separate short structured and serialized header controls, both proved red against the first candidate. These cover mixed-case Authorization fields, space/tab/newline, URL-encoded JSON and JSON embedded in another serialized message. Header traversal retains the field name and escape normalization runs after URL decoding.

The follow-up array controls were red against the scalar repair. Parsed and complete serialized JSON now share a context-preserving traversal through arrays, nested arrays and object-valued header metadata, including a harmless first entry followed by a short credential. Encoded and nested serialized variants use the same walk; plain-text fragments retain the documented heuristic limits.

A partial non-scalar header fragment with a token-shaped Bearer value must still be refused by the context-free rule; only short-value header context falls outside the partial-JSON traversal guarantee.

Run it as one targeted file. `hub/test/skills-qa.test.ts` owns the T2 persisted-recorder boundary; unchanged `hub/test/demo.test.ts` owns real remote execution, accounting and recovery at T3.

Four entry-pair and property-key controls were red before the contextual traversal repair. They reject short synthetic values in parsed and complete serialized metadata, including mixed-case header names and space/tab/newline separators. Serialized controls also cover URL encoding and JSON embedded in another message. The existing five prose/title controls remain accepted.
