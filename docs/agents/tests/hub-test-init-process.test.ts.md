# hub/test/init-process.test.ts

This T3 process contract owns real init concurrency, native fake Claude launch
and generated project-hook shell execution. Use sealed disposable roots and the
shared environment builders; stop and drain owned processes/worker writes before
fixture removal. Keep bounded durable receipts and native exit assertions.

The project-hook PATH test executes SessionStart and Bash PreToolUse registrations
against a scratch recorder that delegates literal-rm to the shipped CLI. It
preserves signal success, checks the real handler's exit 2 propagation and retry
reason without a running hub, and proves both hooks stand aside when the hub injected its own or
cland is absent from PATH. The real local handler stdin/exit refusal is tested at
the lower T2 CLI seam in literal-rm-cli.test.ts; pure policy is T1.
