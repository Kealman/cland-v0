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

The Aide lint/runtime matrix sends the same literal argv through the in-process
CLI and `lintQaBrief` (verify and suite alias), asserting each against independent
allowed/refused expectations. It covers explicit topics, named and repeated
recipients, default Coordinator addressing, role/glob/all/lead refusals,
report-target recipient fallback and overrides, report-free and reporting
previews, both help flags with an unknown-short-flag negative, package mode,
all mode after flags and reserved occasions. Candidate/executor facts are injected; this measures
admission only, with no real suite execution. Keep the prior-hub wire control.
