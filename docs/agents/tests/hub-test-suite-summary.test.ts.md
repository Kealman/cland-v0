# hub/test/suite-summary.test.ts

Pure log and summary boundary checks. The native runner UTC start marker must
survive semantic retention while malformed runner-like noise stays filtered.
It supplies no test counts or result status; older logs without the marker
retain their prior summaries and yield an unknown calibration interval.
