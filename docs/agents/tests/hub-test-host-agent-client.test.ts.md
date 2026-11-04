# hub/test/host-agent-client.test.ts

`hub/test/host-agent-client.test.ts` is T2. Run with
`node --test hub/test/host-agent-client.test.ts` under targeted admission.
An in-process Unix server returns the original protocol-1 hello without optional
capabilities. The new client accepts the exact old shape. The fixture joins the
client and server before removing its disposable socket directory; it launches
no child, Git, hub or harness and reads no account environment.
