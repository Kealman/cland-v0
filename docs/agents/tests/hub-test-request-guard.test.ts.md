# hub/test/request-guard.test.ts

The lifecycle cases plant synchronous publication and adapter/state-observer work
after an adapter await, retaining the single `slow-request` event, `resumed` phase
and at-least-400-ms assertions. T-1220 added awaited credential provisioning between
the stopped relaunch row and the adapter resume call. For the aggregate relaunch
case, plant publication work on the running row after provisioning, then consume
the second block in the state observer in that same resumed continuation. The
credential await legitimately separates the earlier stopped row from that scope;
counting both sides as one blocking stretch would include asynchronous I/O.
