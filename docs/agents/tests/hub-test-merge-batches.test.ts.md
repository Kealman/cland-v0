# hub/test/merge-batches.test.ts

Use the T1 `MergeBatches` + `Suites` seam with `FakeClock`, candidate-tree facts
and semantic executor receipts. No Git, compiler, worker or provider process runs.
For T0 regressions, use two members whose individual trees receive passing check
receipts and whose combined tree receives a named failing `tier T0` receipt.
Observe collected receipts before ticking the controller; assert leave-one-out
step plans, the original-tree repeat, final refusals and the named step duration.
An exit-zero test receipt alone cannot prove that T0 ran. Keep interrupted and
missing/conflicting-step receipts inconclusive through controller restart. Cover
both a unique static omission and a passing static repeat: neither lands until
the exact selected candidate passes the original full plan. Change config and
reopen before confirmation admission, then prove both green and later red tiers.
The real repository command plan is covered
in `verification-commands.test.ts`; shared procedures live in
[Queued merge batches](../tests.md#queued-merge-batches).

The T1 landing regression composes MergeBatches, Suites, the real Tracker, MergeQueue and TaskMerges with immutable Git facts and executor receipts. After a planted green completion, the squash boundary advances only dev between reading its parent and invoking the preparation callback. Every unchanged task must land FIFO using that same receipt, with no member drop. The stable control keeps every ref fixed; a real task-head move must drop only that member, naming prepared and current heads, while the remaining members land after their rebuilt batch completes.

The fixture uses a FakeClock and the scripted executor; no native Git, harness or hub process runs. The boundary routes base-movement errors like the hub dispatcher so the regression reaches the landing guard that caused T-1184.
