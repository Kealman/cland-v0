# hub/test/tool-arguments-spoke.test.ts

`hub/test/tool-arguments-spoke.test.ts` is T2: one loopback stub hub and an in-process MCP spoke with sealed fixture environment and virtual hub-client time. The SDK rejects a non-object `arguments` envelope before the tool handler (currently JSON-RPC -32603 naming `arguments`); preserve this existing non-`forbidden` boundary without changing size handling. A typed stub reply proves `invalid_argument` and `reason` survive forwarding. The outgoing frame receipt also proves a local typo never reaches the hub.

Run `node --test hub/test/tool-arguments-spoke.test.ts`. Close the spoke and all stub sockets before test cleanup.

A free-only MCP ask omits `options`, succeeds, and reaches the stub hub with concrete `options: []`. Keep this compatibility receipt separate from raw wire validation, which still requires a string array.
