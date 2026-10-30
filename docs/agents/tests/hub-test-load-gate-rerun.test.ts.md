# hub/test/load-gate-rerun.test.ts

Run `node --test hub/test/load-gate-rerun.test.ts` for the T1 platform, cover,
ordinary failure, repeated failure, timeout, missing evidence and five-cover /
seven-day window table. This seam uses fixed facts and starts no processes.

Run `node --test hub/test/durations-runner.test.ts` for the T3 sealed native
runner control. It writes one disposable fixture, fails its first repetition,
and observes the final native exit and persistent execution count. On macOS the
repetition-only count is six (five repetitions and one rerun), the ordinary phase passes, the cover remains red,
and both receipts pin the head, platform and repetition. Linux expects five repetitions with
no rerun; the T1 table proves the excluded platform policy. The fixture uses the
shared isolated environment and owns children before directory removal.

Run `node --test hub/test/suite-stage-rules.test.ts` for checkpoint/restart
coverage at the scripted scheduler seam. Explicit pass is required; skip, fail
and legacy unknown timing outcomes cannot supply a recent green.

The serializer control starts with raw nested synthetic sensitive values and command
tails as a positive control, checks shared redaction and a 65,536-character diagnostic
tail bound, and retains native facts. Native controls also cover a failed retry and
an admission-blocked retry with an explicit incomplete receipt and native exit/signal.
The scheduler control seeds thirty compact archives and bounds full hydration to
five records; `hub/test/suite-persistence.test.ts` keeps the large legacy-archive
byte guard with checkpoint payload inside the omitted selection.
