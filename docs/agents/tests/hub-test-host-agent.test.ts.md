# hub/test/host-agent.test.ts

T3 `hub/test/host-agent.test.ts` runs isolated Unix sockets and the actual CLI with a scratch HOME, Git configuration and environment. Fake Linux and macOS hosts set `CLAND_FAKE_HOSTS` and `CLAND_HOST_BOOT_ID_FILE`; ordinary Linux agents read `/proc`. The native death test observes agent close before restarting and confirms the child's identity after restart. Cleanup captures native child ownership immediately, stops children and joins close and persistence before removing roots. Memory admission cases use the fake SSH carrier; no real SSH host, cloud or systemd is used. Tests bound event waits and readiness independently; RSS/CPU are snapshots, and available-memory samples feed the shared 1,300,000,000-byte launch floor, with the Linux-only native policy and fake JSON override described below.

Review fault controls hold spawn/exit checkpoints, kill the real CLI before the process-table checkpoint, fail log-close and socket mode changes, add a group member after capture, and check bounded 600-row previous-shape confirmed-closed recovery (one shared pass, zero terminal PID probes, 256 rows, under 64 KiB). Independent native ownership cleanup survives a refused protocol stop. Unknown exit status stays null.

Second-review controls hold recovery observation across a native code-19 event and compare the final durable code. A naturally exiting parent leaves an independently captured writer; restart preserves its target births and later stop closes it before removing admission. A separate native CLI fixture kills the agent across root exit, checks unknown authority and retained admission, and proves stop refuses without signaling the live writer. These follow the Coordinator's 2026-11-02 06:35Z no-per-launch-supervisor decision. Only confirmed closed history is capped; unresolved authority remains current host state until reboot/recycling. Fake boot reversal does not recover authority.

Final boundary control has two deterministic phases with automatic resource sampling held beyond the setup/behavior bound: a detached child is captured by an explicit process-list checkpoint while PPID ancestry is intact, then survives parent exit and is stopped through its captured birth. An otherwise identical child whose parent exits before any capture remains unowned, the row closes, stop returns false, and the native birth remains alive until independent fixture cleanup. The test also checks identical boundary wording in local Host and agent protocol documentation. This follows Coordinator refinement 24e17b6f, superseding the intermediate group-only note; no local implementation change or per-launch supervisor is added.

Retained-resource control keeps the root alive, captures a detached grandchild, then ends its intermediate parent to force reparenting. A fixed 64 MiB resident allocation makes omitted accounting observable against an independent native ps reading; the initial intact-ancestry sample also checks duplicate-PID overcount. The same retained birth is stopped afterward, and native fixture cleanup owns the writer on red paths. Held-observation setup has its own 3 s receipt bound before triggering root exit; durable code-19 and event uniqueness assertions remain.

CLAND_FAKE_HOSTS requires CLAND_HOST_BOOT_ID_FILE on Linux and macOS. Hello and
native birth expectations read that file; Linux also asserts the fixture boot
differs from /proc/sys/kernel/random/boot_id while retaining the exact native
start-tick assertion. CLI restart retains the captured birth on both platforms;
changing the fixture boot revokes authority and restoring it cannot regain
authority. Production Linux reads the kernel boot. The T2 host-boot-source file
checks missing-file admission before recovery and real-host stray-variable safety.

T-1741 memory cases use the shared SSH fixture owner, registered before server,
client or child acquisition. The owner attempts every close, joins native writers
and retains the root on incomplete teardown. `memory fixture drains accepted
server after failed client setup before removing its root` proves failed client
setup still closes the accepted server before the root is removed.

Set `<fake-host-directory>/available-memory` to JSON
`{"availableBytes":1200000000}`. The directory is beside `CLAND_HOST_BOOT_ID_FILE`
(fallback: agent run directory). Only `CLAND_FAKE_HOSTS` enables this override.
Shared fake hosts start with `{"availableBytes":8589934592}` (8 GiB). Unitless,
malformed, negative, fractional and string byte values refuse admission.

`memory floor refuses direct and prepared spawn, reports fake bytes and admits
the exact floor` proves direct/SSH refusal at 1.2 GB, matching memory events,
commit-time refusal after a drop to 1,299,999,999 bytes, durable failure settlement,
and native completion at exactly 1,300,000,000 bytes and above. Setup, behaviour
and cleanup have separate named allowances within the outer watchdog.
`memory override is ignored without the fake-host marker and malformed fake bytes
refuse` proves marker gating, invalid inputs and non-Linux no-verdict admission.
Native Linux uses MemAvailable; non-Linux without override emits no memory sample.

Run `node --test hub/test/host-agent.test.ts` under the stage preservation lock.
`host-agent-client.test.ts` retains old hello and fieldless error compatibility.
See also `host-memory.test.ts` for injected-reader T2 policy and
`claude-code-remote.test.ts` for actual Claude launch admission.

The memory-floor case also runs `optionalCapacityHostContract` after the first
SSH refusal has connected its agent client. The fixture publishes 1,200,000,111
and 1,200,000,222 available bytes. The helper observes the first through Host,
unsubscribes it, then observes the second through a new subscriber before
asserting that the first received nothing further. Its observations and raw
agent requests receive only the remaining MEMORY_BEHAVIOUR_MS budget from one
realClock deadline started after setup. Memory writes and spawn authorization
check that same deadline; the final assertion checks the whole phase after
native completion. Any remaining subscriptions close in finally.
The fixture resets the memory floor before continuing prepared/native admission.

The environment-free admission case and key spawn composition are documented in [key spawn coverage](hub-test-login-key-spawn.test.ts.md). It observes the plan before bootstrap, then native exit zero from full-environment assertions.
