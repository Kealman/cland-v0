# hub/test/codex-fake-envelope.test.ts

T1 controls the sealed fake Codex's pure envelope selector. Its first native text
input may answer the first hub report in Agents following the role clause or
no-role introduction: that is the sessionless launch brief. The fake passes the
first-input flag only for the first item of the first turn, excluding tool output.
Later hub reports and hub events remain ineligible. Human and agent deliveries
still select the last eligible envelope, preserving its body and routing fields.

Keep the first-turn red control and the event/digest negative controls together.
These checks use only literal inputs, with no sockets, processes or real time.
The existing T3 digest contract in `codex-adapter.test.ts` proves actual sends
through the spoke, and `account-limited.test.ts` proves a brief-triggered hard hit
is durably retained before first-turn launch publication. Do not widen that test's
15-second bound or alter hub delivery shapes to make the fake respond.
