# hub/test/host-agent.test.ts

T3 `hub/test/host-agent.test.ts` runs isolated Unix sockets and the actual CLI with a scratch HOME, Git configuration and environment. Fake Linux and macOS hosts set `CLAND_FAKE_HOSTS` and `CLAND_HOST_BOOT_ID_FILE`; ordinary Linux agents read `/proc`. The native death test observes agent close before restarting and confirms the child's identity after restart. Cleanup captures native child ownership immediately, stops children and joins close and persistence before removing roots. No SSH, cloud or systemd is used. Tests bound event waits and readiness independently; RSS/CPU are snapshots, and memory is reported without enforcing a launch floor.

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
