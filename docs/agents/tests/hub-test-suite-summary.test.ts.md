# hub/test/suite-summary.test.ts

Interrupted-metrics disclosure is a pure provenance/semantic-retention case.
It preserves native exit 137, zero and unknown as distinct facts, emits no
invented sample and keeps normal/legacy provenance free of the loss marker.

Pure log and summary boundary checks. The native runner UTC start marker must
survive semantic retention while malformed runner-like noise stays filtered.
It supplies no test counts or result status; older logs without the marker
retain their prior summaries and yield an unknown calibration interval.
