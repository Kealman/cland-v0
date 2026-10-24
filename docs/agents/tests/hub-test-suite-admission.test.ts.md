# hub/test/suite-admission.test.ts

Use the sealed `suite-component-fixture` with `projectHub`, injected candidate
facts, semantic local executor receipts and `FakeClock`. The CLI is called in
process with `fixtureEnvironment`; no package worker, native Git, real provider
or browser is needed for report routing.

Observe the exact `suite:<id>` completed report before checking its Coordinator
recipient, topic-owned log artifact and matching chip. A default run leaves
General history and its artifact list empty. Explicit item and General report
topics remain deliberate overrides. Keep those positive receipts alongside the
negative General assertions; a launch acknowledgement alone proves neither.

The prior-hub wire test uses a disposable Unix socket, sealed environment and a
literal pre-T-1257 validator (base `8fd6195f`). Do not import the current validator:
it would hide omission regressions. No-report CLI requests must send
`report: "agents"` and `to: ["coordinator"]`; explicit recipients/topics retain
their shape and report-free previews omit both defaults. The stub returns the
previous minimal submission/preview reply shape. Assert the received frames as
well as successful CLI completion. Close every peer and the listener before
fixture directories are removed. This is admission compatibility, not proof of
an older hub's new report-publication behavior.
