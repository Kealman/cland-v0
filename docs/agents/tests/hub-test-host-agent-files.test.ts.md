# hub/test/host-agent-files.test.ts

T3 uses an authenticated in-process fake host agent on a scratch Unix socket,
with f1/f2 fake-host environment and isolated HOME/XDG/Git settings. No real SSH,
provider, hub, browser or human profile is used. Native command timeout, Git
worktree operations and loopback bind/release require OS integration.

The five feature cases cover C1/C2 file parity with local Host, exact binary
bytes and the inclusive 512 KiB cap; C3 modes/truncate, single-path removal,
symlink target preservation and released loopback port; C5 canonical occupants
and sibling exclusion; C1 exit/stdout/stderr parity and timeout native-close
completion; C4 scratch Git worktree link, shared stale warning and dirty-remove
refusal. Every RPC is bounded by AgentClient; test cleanup closes the client,
drains the agent and then removes the root. Ownership is registered immediately
after root creation; cleanup joins in-flight setup before closing acquired resources,
and failed setup performs that cleanup before rejecting. A sixth generated case
injects a wrong-secret connection after startup and proves root removal and
connection refusal, with independent fallback ownership for the red control. Commands use fixtureEnvironment.

Run individually with `node --test hub/test/host-agent-files.test.ts` after the
shared Node/load/disk preflight in docs/agents/tests.md. Existing preservation
owners are host-agent.test.ts, host-agent-boundary.test.ts,
host-local-contract.test.ts, worktree-host.test.ts, doctor-run.test.ts and
artifact-folders.test.ts; these retain their original assertions.
