# hub/test/opencode-adapter.test.ts

The sender-specific native admission paths stay covered in `opencode-adapter.test.ts`
(T3 HTTP/SSE contract) and `codex-native.test.ts` (T2 scripted RPC): a human
message sent in state `busy` waits, an agent report steers the running turn,
and the human input starts a new native turn after completion. Hold the native
turn explicitly, observe the agent's injected receipt before asserting the
human input has not reached the adapter, then release and require the human's
injected receipt. OpenCode's fake `/test/turn` endpoint holds execution without
changing the busy state. Existing human steering during `waiting for approval`
is a different state and remains covered by the Codex contract/reconciliation tests.
