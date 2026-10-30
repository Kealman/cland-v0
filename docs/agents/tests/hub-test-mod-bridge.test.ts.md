# hub/test/mod-bridge.test.ts

The engine seam runs the shipped mod and the real hub socket while simulating
only the native bridge child. Preserve two expiry/retry receipts and one injected
input. T-1471 then re-enters session.start with a stable session id in the process
environment and a generation only in saved settings; capture the admitted bridge
and hook argv and assert both use that saved generation. The pre-fix red reports
the stable UUID instead of the expected settings generation. This is re-exec
configuration proof, not a live vendor auto-update run.
