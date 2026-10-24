# hub/test/opencode-adapter.test.ts

Role clauses arrive in the default `cland-role` instruction entry (T-619). The
message-path contracts that assert a first-prompt clause and its turn accounting
opt out with `CLAND_OPENCODE_ROLE_INSTRUCTIONS=0` through the `messagePath` helper.
The default/opt-out/fallback test asserts the entry appears by default and is
replaced on role change and revocation, the launch brief remains a prompt, an
explicit opt-out leaves no entry, and a failed instruction route confirms
deletion before the prompt fallback. Its `old endpoint` mode models a server
that predates the experimental route for a session this hub created and never
wrote an entry to: both PUT and DELETE answer 404, and the test asserts the
prompt fallback and its log. The separate retained-entry test installs an entry,
then removes the route: both writes answer 404 while the saved entry remains,
and the test asserts `inject-unconfirmed`, the retained entry, no prompt
fallback and a later replacement once the route returns. A third case loses the
reply to a first write that still persisted, then 404s the cleanup: it asserts
`inject-unconfirmed`, the saved entry, no prompt fallback, and acknowledgement
only after the retried write. Keep all three: a route-level 404 is not proof
that a saved entry is gone, and a lost reply is not proof that no write
happened.

The sender-specific native admission paths stay covered in `opencode-adapter.test.ts`
(T3 HTTP/SSE contract) and `codex-native.test.ts` (T2 scripted RPC): a human
message sent in state `busy` waits, an agent report steers the running turn,
and the human input starts a new native turn after completion. Hold the native
turn explicitly, observe the agent's injected receipt before asserting the
human input has not reached the adapter, then release and require the human's
injected receipt. OpenCode's fake `/test/turn` endpoint holds execution without
changing the busy state. Existing human steering during `waiting for approval`
is a different state and remains covered by the Codex contract/reconciliation tests.

The shell identity contract (T-1219) runs a command through fake OpenCode's
authenticated `/test/shell` endpoint, inheriting the server's five `CLAND_*`
identity variables without using its MCP config as a shell environment. The
fixture seals HOME, XDG, Git and provider variables before starting the shell.
Two launched Implementers claim separate items/topics, then their real CLI
children submit mode-free `verify` concurrently. Hold executor capacity with
the injected compatibility observation; assert both distinct persisted queued
jobs and their named owners through hub status and queue replies. This proves
admission and attribution only; it runs no package checks or suites. Compare
the shell identity with the unchanged MCP environment and independently assert
the launch's name, id, role, discovery path and nonempty launch token.

The owned shell credential contract emits only a SHA-256 comparison digest, never the token. Claim setup uses the fixture session's private MCP configuration. After relaunch, check rotation and run a real shell task read through the new server environment.
The port-retry contract (T-1092) keeps the collision fixture's chosen port open
until the adapter's readiness request against it has been answered, recording
`collided-served` before the fake exits. The test asserts that receipt next to
two distinct chosen ports: the planted EADDRINUSE collision still drives the
retry on a second port, while no undici request is left in flight against a
socket whose process has closed it. A focused failure-path case proves the
fixture's own bound: with no probe it drains its listener and sockets, then
exits with EADDRINUSE inside `FAKE_OPENCODE_COLLIDE_SETTLE_MS`; a taken
competitor bind exits instead of hanging.
