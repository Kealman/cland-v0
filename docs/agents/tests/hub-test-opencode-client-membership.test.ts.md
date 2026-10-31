# hub/test/opencode-client-membership.test.ts

T1, fake `OpenCodeClient.request` boundary; no sockets, harness, credentials or
browser. Run `node --test hub/test/opencode-client-membership.test.ts`.

T-1501 records schema-reader evidence for OpenCode 2.2.5, not native runtime
coverage. `opencode-2.2.5-readers.json` contains handwritten examples of all six
form fields, the flattened `Form.When.value` numeric/special-string alternatives,
assistant text/reasoning/tool native metadata, and all three compaction states.
The message case covers streaming/running/completed/error tool states, exact
source tool correlation, non-assistant fallback, and the previous metadata shape.
Snapshot asserts every form id; approvalDetails asserts the exact safe subject
and command. Metadata and form field payloads must never enter these results.

The unchanged readers are unaffected by the upstream changes: snapshot reads
only form ids. approvalDetails reads assistant type/content and the correlated
tool id/name/state.status/state.input.command; these fields retain their shapes.
Streaming string input cannot authorize shell execution. Compaction messages are
ignored, including completed messages with `native` and no `recent` or
`providerContext`. User/shell controls also retain the null subject fallback.

The form warnings concern five variants (all except external), repeated for
`items` and `prefixItems[0]`: numeric alternatives in `Form.When.value` were
flattened without changing values. String lengths/multiselect counts also gain
safe-integer maxima. The two message warnings concern assistant metadata
(`state`, `providerState`, `providerResultState` replaced by `native`) and
compaction (`recent`, `providerContext` removed; `providerState` becomes `native`).
Shell output safe-integer bounds are additive response constraints, not one of
the twelve warnings. No adapter code or tested runtime range changes are needed.

M1 fidelity follow-up: every form, message state and previous-shape assistant is
checked against its pinned schema before reaching the reader. The fixture-only
structural checker covers refs, unions, types, enums, required/additional object
properties, array items/prefix/minimum length, patterns and numeric bounds used
by these examples; it is not a general OpenAPI validator. Positive/negative
controls retain required running metadata and distinguish old text/reasoning
`state` from new `native` and tool-only provider metadata. The red control with
the original fixture fails at `fixture conforms to Session.Message.Assistant`.
