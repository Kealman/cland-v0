# hub/test/launch-files.test.ts

T2 uses a recording local Host and tempProject, with no hub or native harness.
Assert directory creation, exact bytes/mode restoration, log truncation and
removal through Host operations. Replay the previous serialized undo shape and
assert final filesystem bytes plus an empty recovery snapshot. Hub-side metadata
reads remain local. Refusal cases call every new test-Host operation and require
the Host name and operation in each error and log.

Keep session-launch.test.ts and session-stop-races.test.ts unedited as controls;
session-host.test.ts additionally exercises durable old pending-stop recovery.
The reusable native cases live in host-contract.ts through the T3 local wrapper.

The testHost stat guard refuses by default and for arbitrary fileType overrides.
Only a double explicitly delegating shared local fileType/writeFile/removePath
receives native stat metadata; publish/append keep their default refusals. The
Claude polling fixture explicitly delegates file metadata/publication and real
record reads, retaining only synthetic project settings reads.

The mapped remote rollback guard plants distinct hub and Host bytes/modes. Native
hub stat/read spies reject access, with positive controls before resetting the
counter. Production LaunchFiles restores the remote bytes/mode and leaves the
hub mirror unchanged and unread.


The missing-native-exit regression first timed out without a production bound.
With a 10 ms injected receipt deadline, concurrent rollback calls report
cleanup-incomplete, retain the exact child/undo/file bytes, and a later retry
cannot repeat Host.stop. Only resolution of the captured native exit permits
file undo and an empty final snapshot. Cleanup releases the held receipt and
joins rollback before fixture directory removal; no native process is started.


## T-1692 stage-5 timeout audit

All 28 item files were inspected. Line numbers below refer to the original base.
The shared setup budget is `testWaitMs()` (15 s default, configured by
`CLAND_TEST_WAIT_MS`). Test envelopes allow eight setup waits plus the original
work/cleanup envelope; these are failure guards, not latency assertions.
Implicit `eventually` setup waits already use the shared budget. Numeric
post-signal deadlines are explicitly labelled and retain their values.
No assertion or production source changes. No browser involved.

| File | Original line | Old | New | Class | Reason |
| --- | --- | --- | --- | --- | --- |
| hub/test/host-revoke.test.ts | 55 | 1000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-revoke.test.ts | 120 | 1000 | /* behaviour: post-signal receipt deadline */ 1000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-revoke.test.ts | 282 | 1000 | /* behaviour: post-signal receipt deadline */ 1000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-revoke.test.ts | 318 | 1000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-reboot.test.ts | 65 | 1000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-reboot-controller.test.ts | 24 | 5000 | 8 * testWaitMs() + 5000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-reboot-controller.test.ts | 33 | 5000 | 8 * testWaitMs() + 5000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-reboot-controller.test.ts | 39 | 1000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-reboot-controller.test.ts | 42 | 1000 | /* behaviour: post-signal receipt deadline */ 1000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-reboot-controller.test.ts | 49 | 5000 | 8 * testWaitMs() + 5000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-reboot-controller.test.ts | 55 | 1000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-reboot-controller.test.ts | 66 | 5000 | 8 * testWaitMs() + 5000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-reboot-controller.test.ts | 71 | 1000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-reboot-controller.test.ts | 76 | 1000 | /* behaviour: post-signal receipt deadline */ 1000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/codex-host.test.ts | 365 | 2000 | 8 * testWaitMs() + 2000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-attach.test.ts | 23 | 10000 | 8 * testWaitMs() + 10000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-attach.test.ts | 37 | 5000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-attach.test.ts | 68 | 5000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/claude-code-remote.test.ts | 75 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 83 | 5000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/claude-code-remote.test.ts | 113 | 1000 | /* behaviour: post-signal receipt deadline */ 1000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 133 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 151 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 158 | 1000 | /* behaviour: post-signal receipt deadline */ 1000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 167 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 183 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 204 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 211 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 224 | 3000 | /* behaviour: post-signal receipt deadline */ 3000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 233 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 254 | 3000 | /* behaviour: post-signal receipt deadline */ 3000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 261 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 285 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 288 | 1000 | /* behaviour: post-signal receipt deadline */ 1000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 300 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 306 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 312 | 2500 | /* behaviour: post-signal receipt deadline */ 2500 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 327 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 353 | 1000 | /* behaviour: post-signal receipt deadline */ 1000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 356 | 1000 | /* behaviour: post-signal receipt deadline */ 1000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 358 | 1000 | /* behaviour: post-signal receipt deadline */ 1000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 389 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 409 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 414 | 2500 | /* behaviour: post-signal receipt deadline */ 2500 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 427 | 1500 | /* behaviour: post-signal receipt deadline */ 1500 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 433 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 455 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 465 | 3000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/claude-code-remote.test.ts | 467 | 3000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/claude-code-remote.test.ts | 469 | 3000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/claude-code-remote.test.ts | 480 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 493 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 494 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 499 | 3000 | /* behaviour: post-signal receipt deadline */ 3000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 510 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 512 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 521 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-code-remote.test.ts | 529 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-code-remote.test.ts | 541 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/opencode-host.test.ts | 90 | 2000 | 8 * testWaitMs() + 2000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-attach-routing.test.ts | 45 | 2000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-push-on-ref-move.test.ts | 41 | 30000 | 8 * testWaitMs() + 30000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-push-on-ref-move.test.ts | 49 | 5000 | 5000 (explicit behaviour comment) | behaviour | Publication deadline after ref move stays unchanged. |
| hub/test/host-push-on-ref-move.test.ts | 93 | 30000 | 8 * testWaitMs() + 30000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-push-on-ref-move.test.ts | 116 | 5000 | /* behaviour: post-signal receipt deadline */ 5000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-push-on-ref-move.test.ts | 128 | 15000 | 8 * testWaitMs() + 15000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-push-on-ref-move.test.ts | 144 | 30000 | 8 * testWaitMs() + 30000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-push-on-ref-move.test.ts | 159 | 5000 | /* behaviour: post-signal receipt deadline */ 5000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-push-on-ref-move.test.ts | 163 | 5000 | /* behaviour: post-signal receipt deadline */ 5000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-flush-native.test.ts | 47 | 15000 | /* behaviour: post-signal receipt deadline */ 15000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-flush-native.test.ts | 187 | 15000 | /* behaviour: post-signal receipt deadline */ 15000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-survival.test.ts | 75 | 5000 | 8 * testWaitMs() + 5000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-survival.test.ts | 97 | 1000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-survival.test.ts | 106 | 1000 | /* behaviour: post-signal receipt deadline */ 1000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/launch-files.test.ts | 129 | 1000 | 8 * testWaitMs() + 1000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/claude-capture-concurrency.test.ts | 35 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/claude-capture-concurrency.test.ts | 37 | 2000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/claude-capture-concurrency.test.ts | 45 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-survival-native.test.ts | 24 | 120000 | 8 * testWaitMs() + 120000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-survival-native.test.ts | 83 | 10000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-survival-native.test.ts | 94 | 15000 | /* behaviour: post-signal receipt deadline */ 15000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-survival-native.test.ts | 108 | 15000 | /* behaviour: post-signal receipt deadline */ 15000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-survival-native.test.ts | 132 | 15000 | /* behaviour: post-signal receipt deadline */ 15000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-revoke-native.test.ts | 62 | 2000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-revoke-native.test.ts | 77 | 5000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-revoke-native.test.ts | 84 | 1000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-revoke-native.test.ts | 85 | 1000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-revoke-native.test.ts | 91 | 2000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-revoke-native.test.ts | 93 | 3000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-revoke-native.test.ts | 29 | 45000 | testWaitMs(45000) | setup | Retain native setup fallback, permit shared configured budget. |
| hub/test/host-reboot-native.test.ts | 25 | 60000 | 8 * testWaitMs() + 60000 | setup | Whole-test envelope includes repeated setup waits and original work/cleanup headroom. |
| hub/test/host-reboot-native.test.ts | 37 | 2000 | /* behaviour: post-signal receipt deadline */ 2000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-reboot-native.test.ts | 74 | 15000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-reboot-native.test.ts | 78 | 5000 | testWaitMs() | setup | Readiness/admission/producer setup uses shared native wait budget. |
| hub/test/host-reboot-native.test.ts | 85 | 20000 | testWaitMs(20000) | setup | Separate CLI harness guard uses shared budget with original 20 s fallback. |
| hub/test/host-reboot-native.test.ts | 95 | 15000 | /* behaviour: post-signal receipt deadline */ 15000 | behaviour | Preserved exact post-signal/settlement value. |
| hub/test/host-reboot-native.test.ts | 100 | 15000 | /* behaviour: post-signal receipt deadline */ 15000 | behaviour | Preserved exact post-signal/settlement value. |

Additional helper and harness changes:

- `host-survival-native`: `welcome` now requires an explicit budget: initial call uses `testWaitMs()` (old 15000); both post-restart calls retain 15000 as behaviour deadlines.
- `claude-code-remote`: `joinInitialHookWriters` requires explicit budgets; setup calls pass `testWaitMs()` (same previous default); post-root-exit call retains 1000 as a behaviour deadline.
- `codex-host`: five setup `testWaitMs(5000)` fallbacks now use the shared 15000 default, including completion helpers that guard harness acquisition.
- `host-reboot-native`: separate reboot CLI execFile harness guard uses `testWaitMs(20000)` (old 20000).

Other fixed clocks retained:

- `host-revoke`: native 5000 watchdog guards fake-clock I/O only; fake 3000/6000 exits and 5001 tick are behaviour inputs.
- `host-settlement`: 50 ms fake settlement deadlines and derived `LAUNCH_SETTLEMENT_MS` delay are behaviour inputs.
- `claude-stop-owner-component`: mocked 10 ms callback and 1000 clock tick are behaviour inputs.
- `host-survival-native`: real 20000 ms downtime is the required behaviour interval.
- `launch-files`: 10 ms exit receipt deadline and 50 ms child stop input remain unchanged.
- `host-revoke-native`: `REVOKE_FRAME_MS` remains `HOST_SETTLEMENT_MS + 3000`; 50 ms stop grace is a behaviour input.

Inspected files with no changed bounds: host-ref-watch-recovery, host-settlement,
host-flush, process-identity, host-ref-watch-compat, host-push-facts,
host-contract-coverage, host-boot, host-boot-source, claude-stop-owner-component,
host-local-contract. Their fake clock steps, production-deadline inputs and
shared eventual defaults are retained.

Loaded receipts and allowances are recorded in the item artifact after execution.

Coordinator-authorized extreme-load follow-up: `claude-stop.test.ts` original
lines 29 and 51 each passed real-clock grace `1` to `stopClaude`. Both now use
`testWaitMs()` as setup-class budgets. Foreign UID is rejected before the deadline;
persistent unknown returns null from capture failure after exactly one re-read,
independently of deadline. Transient unknown proceeds through two empty captures.
All assertions remain unchanged. The remaining 2/3 ms inputs use injected fake
`now` and `pause` and are retained behaviour deadlines.

T-1692 completed load evidence at reviewed `7f40bc776`: 26 included files,
five repetitions on macOS arm64 and Linux arm64 via `docker run --init`,
Node24.21.0. macOS start loads meet the required12 floor; earlier overshoots
and burner counts are retained. The resumed samples target12–15. Linux uses
four yes burners on four CPUs; its lagged initial load readings can be zero.
All processes and burners are joined before owner-checked lock release.

Coordinator-approved C2 exclusions retain their native outcomes:

| Scope | Result retained | Reason | Evidence |
| --- | --- | --- | --- |
| host-push-on-ref-move whole file | macOS4/5; Linux not run | product-path cause, T-1693 | A-16903 |
| host-survival-native whole file | macOS1/2; Linux not run | product-path cause, T-1695 | A-16907 |
| remote Claude lost-native-release case only | macOS5/5; Linux4/5; fifth file25/26 exit1 | product cause, T-1697 | A-16915 |

The other25 remote-Claude cases passed all five Linux repetitions. Counts of
eligible cases and raw process passes are reported separately; the excluded
case does not turn that exit1 into a passing file. Final report-only allowances
are owned by C-216 through 2026-11-11 and use ceil(1.5 times the worst passing
loaded sample), retaining any higher previously supported cap. Outer explicit
test guards exceed those caps; tests without an explicit Node guard retain the
unlimited default. The remaining5 s fake-clock hang guard exceeds five times
the unburned base samples0.041528208/0.037345104 s in A-16904.

The final delta relocates the existing testWaitMs import and updates only
allowances/documentation. Coordinator rule7 exception retains green fe31ba24
at reviewed7f40bc776 plus delta source review and targeted proof; no second
configured verification is required.
