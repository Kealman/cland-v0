# hub/test/spoke-unix-edge.test.ts

`hub/test/spoke-unix-edge.test.ts` is T2. Run it with
`node --test hub/test/spoke-unix-edge.test.ts` after the usual load and disk checks.
It uses disposable `projectHub` roots and fake harnesses, with sealed fixture
environments. No SSH, cloud, account, browser or live project is used.

Observe native socket mode/type, authenticated welcome and unauthorized HTTP or
protocol replies, and filesystem state after awaited hub stop. The tests retain
an old bound inode under another name to prove that shutdown preserves a
replacement endpoint. Both short and system temporary roots exercise real binds;
pure long/UTF-8 path checks cover stable fallback selection separately. Real
space, Unicode, colon and fragment-character roots also set an unsafe TMPDIR,
observe a welcome on the fixed `/tmp` fallback and retain human socket placement.

Preservation files are `hub/test/daemon.test.ts` (hub socket),
`hub/test/resilience.test.ts` (native spoke reconnect), and
`hub/test/edges-component.test.ts` (JSON-lines edge). Run each unchanged and
sequentially; the two native files are T3 and require load at most 10.
