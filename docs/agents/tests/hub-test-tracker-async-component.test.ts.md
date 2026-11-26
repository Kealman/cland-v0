# hub/test/tracker-async-component.test.ts

The storage deadline cases use `stageCase` before acquisition, a disposable tracker,
fake Git and a fake clock. A held planned read proves queue progress through a
completed view, one read admission (no retry spin), and unchanged child bytes after
late continuation drainage. The companion cases prove a caller's retryable view
refusal and a planned status write's fatal callback with recorded abandoned work.
No native daemon, network, droplet or elapsed wall-time assertion is needed.

Complete setup and action/results have separate named load-scaled `owner.wait`
observations inside the owned sequence; `step` only fences admission. Generic
`writeItem` calls labeled `view`, `planned check` and `ready check` each retain
writer ownership, a fatal callback, and abandoned caller/successor receipts.
