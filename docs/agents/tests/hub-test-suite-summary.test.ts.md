# hub/test/suite-summary.test.ts

Pass-accounting disclosure preserves aggregate counters and labels excess raw
base pass finishes and pass finishes without retained starts, separating load-gate
repetitions. Legacy logs without progress retain their aggregate-only summary.
The pure whole-case regression checks duplicate identities, file/suite envelopes,
unknown aggregates and a single scan with 10,006 visited records; it asserts no
wall-clock bound. A-22307 reproduces aggregate 9,397 versus 9,400 base passes,
with three base and fifteen loaded pass finishes lacking retained starts.
Both accounting and interruption reducers consume the shared retained-receipt
parser. Focused cases accept legacy fields and forward-compatible extra fields,
and refuse malformed common fields, torn JSON and ordinary output through both
reader interfaces. Event, cancellation and envelope policies stay in the reducers.

Interrupted-metrics disclosure is a pure provenance/semantic-retention case.
It preserves native exit 137, zero and unknown as distinct facts, emits no
invented sample and keeps normal/legacy provenance free of the loss marker.

Pure log and summary boundary checks. The native runner UTC start marker must
survive semantic retention while malformed runner-like noise stays filtered.
It supplies no test counts or result status; older logs without the marker
retain their prior summaries and yield an unknown calibration interval.
