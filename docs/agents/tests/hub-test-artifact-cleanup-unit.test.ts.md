# hub/test/artifact-cleanup-unit.test.ts

T1 exercises `ArtifactLifecycle.cleanup` with an in-memory SQLite `Store` and a
fake filesystem that reports missing old hard links and retained folders. It
generates 8,000 artifacts: 200 shared folders and 7,800 moved files distributed
among them. No hub, subprocess, browser or real project paths are used.

The SQLite full-index row getters tag the JSON inputs, and a scoped `JSON.parse`
observer counts their actual decodes separately from current-record point reads.
The test requires exactly 8,000 index row decodes and fails early at 8,001 so the
historical quadratic implementation cannot consume millions of decodes. The
final assertions retain a redirect and its undeleted owner. This is a work-count
guard, not a startup timing measurement.

`hub/test/artifact-lifecycle.test.ts` retains the existing T2 filesystem and
durable deletion receipt coverage unchanged, including interrupted moved-file
deletion recovery and committed housekeeping retries. Run each file separately
with `node --test <path>` under normal cover-quiet admission.
