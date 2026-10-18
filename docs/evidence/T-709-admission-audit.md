# T-709 admission extraction audit

Compared with the authorized T-747 integration commit `2ebc5bbe`. All checks below compare unchanged function/implementation text, except the explicitly named annotation/path expression substitutions.

- Complete clock implementation: identical.
- Complete admission outcome implementation: identical.
- Admission policy and typed timeout handling: identical.
- One-request socket transport (only a type annotation removed): identical.
- Session frame identity: identical.
- projectRoot: identical.
- readDiscovery: identical.
- Wire frame parser: identical.
- Discovery path (layout(root).discovery is join(root, .cland, hub.json)): identical.

Production compatibility exports preserve the singleton clock, transport timeout and AdmissionTimeout class identities. The existing typed timeout and account-fixture tests exercise those compatibility paths.

Neovim owns a cached admission promise, exposed through an async function that returns a fresh promise to each caller. Both tempProject and createClient await it before resource allocation. Native startClient retains T-747’s first-statement await ensureAccountFixture().

The source importer follows nvim/, shared/ and test-support/ helpers; a planted neutral helper-to-hub import is detected. Shared helper diffs select both packages.
