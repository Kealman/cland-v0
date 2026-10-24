# hub/test/merge-batches.test.ts

The T1 landing regression composes MergeBatches, Suites, the real Tracker, MergeQueue and TaskMerges with immutable Git facts and executor receipts. After a planted green completion, the squash boundary advances only dev between reading its parent and invoking the preparation callback. Every unchanged task must land FIFO using that same receipt, with no member drop. The stable control keeps every ref fixed; a real task-head move must drop only that member, naming prepared and current heads, while the remaining members land after their rebuilt batch completes.

The fixture uses a FakeClock and the scripted executor; no native Git, harness or hub process runs. The boundary routes base-movement errors like the hub dispatcher so the regression reaches the landing guard that caused T-1184.
