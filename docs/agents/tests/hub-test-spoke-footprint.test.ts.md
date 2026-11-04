# hub/test/spoke-footprint.test.ts

This T4 measurement uses an in-process project hub and one recorded native spoke in a disposable project. It waits for the spoke's consumed-welcome log, then idles ten real seconds without listing or calling tools. Linux VmRSS and macOS ps RSS are reported in bytes; unavailable readings stay null. No resident-size threshold changes the exit status. Startup failure remains a test failure.

The sample excludes the hub and test runner. Closing the MCP transport joins the recorded process; an empty fixture process census precedes directory teardown. Compare Linux samples only with their exact heads, executor size/region and native run receipts. The baseline for T-1608 is dev plus this test, with production byte-identical, as approved by the Coordinator.
