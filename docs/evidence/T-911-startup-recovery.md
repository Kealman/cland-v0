# T-911: restart deferral and startup progress

The restart #22 incident on 2026-10-19, spanning 21:33:40–21:36:06Z,
combined two failures. The task records a hub outage of 2 min 28 s,
longer than the roughly 60 s after which the Claude Code mod bridge can
be lost permanently.

The operator stopped the hub at 21:33:40Z. At 21:33:52Z the Neovim
workbench's automatic starter took the startup lock (pid 39797, starter
client `nvim`, parent pid 92893). The existing stop marker lasted only
10 s, so this retry at +12 s was already outside its window. In addition,
the client did not read the marker before spawning `cland hub start`;
only the CLI and daemon checked it. An operator's direct serve lost the
lock race and exited with “a hub already runs”.

The automatic hub was listening by 21:33:58Z and still restoring sessions.
It disappeared before 21:34:05Z without a signal or stop journal event.
As the task evidence concludes, this matches the starter's unconditional
SIGKILL at its fixed 15 s elapsed deadline. T-865's diagnostics identified
stalled storage but did not distinguish a progressing startup from a stall.

## Changes

- The Coordinator selected a 30 s stop grace period: operator restarts have
  priority, while an abandoned restart still leaves fallback startup time
  before the bridge's roughly 60 s expiry. Explicit CLI starts bypass it.
- The socket client's autostart checks the recorded expiry before spawning
  the CLI, remains in its retry loop during deferral, and starts after expiry.
  CLI and daemon checks still close races after that client-side read.
- CLI start renews its 15 s inactivity deadline when the startup log grows
  beyond its observed size. Existing log bytes cannot renew it. Startup can
  exceed 15 s overall while opening storage, listening or restoring sessions;
  15 s without new log output still reports diagnostics and kills the child.

## Regression evidence

Both changed test files remain T2. No live project hub or human Neovim was
stopped, started or signalled. The client test uses the documented headless
stub client, a fixture stop marker and simulated timestamp/scheduling APIs;
the CLI tests use fake child/socket boundaries and a fake clock.

- `hub/test/startup-deadline-component.test.ts`: 4 passing tests, about 0.27 s
  for the file. Before the fix, progress every 4 s still led to SIGKILL at
  simulated 16 s. After the fix the child survives progress beyond 20 s and
  succeeds on an authenticated welcome. Silent startup still times out;
  startup that logs then stalls gets a full inactivity deadline. At +12 s,
  CLI autostart defers without spawning, while explicit start reaches the child.
- `nvim/test/client-component.test.ts`: 3 passing tests, about 0.68 s for
  the file. Before the fix the client spawned immediately despite the marker.
  After the fix it launches no CLI at 0, 12 or 29.999 s, then launches once
  after the 30 s window expires.
- `hub/test/startup-ready-component.test.ts`: 2 passing tests, about 0.41 s
  for the file, preserving the serving-before-ready-check contract.
- Root typecheck passed. Source review precedes mode-free queued verification.
- The source review's fixture-boundary finding was corrected by recording
  marker JSON directly in the Neovim test, without importing hub runtime.
  `hub/test/nvim-fixture-boundary.test.ts` passes all 7 tests (about 0.29 s).

The hosting repository uses T0–T2 task verification and T1-only merge batches.
T3 process evidence is deferred to periodic dev and integrated occasions;
these fixture checks do not claim a T3 receipt.
