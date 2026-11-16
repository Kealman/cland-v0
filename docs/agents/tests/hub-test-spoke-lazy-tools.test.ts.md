# hub/test/spoke-lazy-tools.test.ts

Discovery cases run the production spoke over linked MCP transports with a fake
clock and a loopback stub hub. C1 starts with only a `.cland` directory, C3 with an
explicit absent discovery file. After an absent retry, publication and the next
backoff deadline must yield a welcome and a successful MCP tool reply. Stop joins
the socket and clears its timers. C2 pins the exact existing not-configured error
and proves no polling, even if a project marker appears later. The environment
is sealed with fixtureEnvironment and the fixture owns every file and socket.
New discovery resources register separate shared onCleanup steps so every close
is attempted before directory removal. A synchronous welcome observer is armed
before publication and removed in finally; its bounded wait starts only after
publication and clock advancement succeed, leaving no detached polling on error.

T2 uses inProcessSpoke with the production handlers and a disposable WebSocket stub hub. Concurrent first tools/list requests must both return the independently maintained DOCUMENTED_TOOLS census. Each documented tool is called with explicit valid fixture arguments, must return ok:true, and must produce its expected native frame type. Stub responses preserve the fields used by history, rename, send and who. This tests the spoke's lazy schema/handler boundary; existing hub policy and permission tests retain real admission behavior.

The fixture arms the server before connecting the spoke and joins the spoke and server before teardown. No process, browser or live project is involved. Existing preservation files remain unchanged: in-process-spoke, spoke-readiness, spoke-identity, tool-arguments-spoke, spoke-stdio, spoke-unix-edge, bridge-grace and scenarios/hub-lifecycle.

The session.stop fixture passes {session: 'fixture'} and must produce the
session.stop native frame. Both the independent tool census and the exhaustive
call-map assertion include it; listing the tool alone is insufficient.
