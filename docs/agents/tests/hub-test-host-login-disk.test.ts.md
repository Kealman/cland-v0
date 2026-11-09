# hub/test/host-login-disk.test.ts

T3 exercises the authenticated agent socket and SSH Host with a directory-backed
fake provider. Run `node --test hub/test/host-login-disk.test.ts` on supported
Node 24 with inherited `CLAND_*` removed, under the assigned native preservation
slot. Children use `fixtureEnvironment`; disposable roots are retained.
No browser, network, real volume, provider key or harness login is used.

`login-disk mounts only this fake machine attachment through the SSH Host`
checks detached and other-machine refusal, roundtrip file bytes, writer exit
before unlink, an unrelated live process, symlink refusal, local Host refusal,
and retention after agent restart without inherited signal authority.
Setup observes child-written readiness files with `until`; unmount checks its
native exit receipt. Independent captured cleanup stops children before closing
the agent. It measures no product latency.

`login-disk uses exactly sudo -n helper op volume path and preserves typed helper failures`
stubs sudo in a private PATH and checks complete argv and exit-to-code mapping.
`login-disk rejects malformed paths and volume names before invoking a helper`
checks typed refusal and absence of the stub's invocation receipt.

Stage QA repeats these cases on integrated dev. Mode-free Linux task verification
supplies T0–T2 and changed T3; the native slot supplies macOS evidence for this
file and cland-auth, with host-prelude regression checks. Full T3 belongs to
the merge batch and T4 to stage/epic occasions. Real ext4, sudo policy and fuser
semantics are outside these fake/stub checks.

The source-review corrections add named live-parent and retained-orphan tree cases, checking exact child births closed and outside parents alive. A held before-signal observer admits a second authenticated connection and proves spawn refuses through unlink. The incomplete-helper case injects a synthetic native-incomplete result into the fake agent’s helper-command seam, checks the durable prepared checkpoint fences disk and file/spawn mutation, then restarts the agent and proves no helper replay. No actual unfinished native helper is leaked by that injection. A rejected-connect/planted cleanup failure control proves AsyncDisposableStack attempts all joins and observes server.close. Fixtures register their stack with t.after before setup and defer each acquired resource immediately; children precede transports and servers in cleanup.

The held-completion control pauses exit publication after the native completion checkpoint, starts unmount, and observes which exact boundary wins: joining the completion owner or unmount. It retains the immediate published-exit assertion after the reply and verifies the login file remains mapped at the join boundary. The join uses the existing four-second drainage deadline and retains the mount on completion failure or timeout; live outside roots are not awaited. The held-spawn fixture prearms release/request-join above client close, captures independent native cleanup before its setup receipt, and covers a planted setup rejection after losing the public client reply. Native exit and disposal-order assertions remain final checks.

`login-disk joins its owned close callback when kernel exit precedes native publication`
holds the owned child's close callback before it changes the process row. Unmount
must join that owner while a second authenticated observer still sees owned
authority, an unpublished root exit and the mapped login file. Releasing the
callback must publish the exact process exit before the unmount reply; the final
alive check remains. This deterministically covers the kernel-exit/close-callback
race without filesystem timing. The two held-admission cases also run alone in
fresh Linux processes; tmpfs is a useful reproduction condition for the original
race, but the held-close regression requires no particular filesystem.
