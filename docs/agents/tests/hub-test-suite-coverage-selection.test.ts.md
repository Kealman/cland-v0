# hub/test/suite-coverage-selection.test.ts

Raw coverage sweep controls plant scratch finished, active, unclean and unknown
runs. Only finished, cleaned, reported records permit deletion. The exact nested
file byte count must appear in the sweep log. Traversal and symlink controls keep
a sentinel outside the permitted raw root intact. No live suite directory is used.

The 4,082-run synthetic index control bounds concurrent and repeated admissions
to 32 previously unchecked identities and 32 checkpoint writes per batch. Restart
uses the persisted identity receipts and must not revisit completed IDs. It is a
work-count control, not a wall-time measurement or a copy of live hub records.
