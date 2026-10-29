# hub/test/claude-code-adapter.test.ts

`hub/test/claude-code-adapter.test.ts` uses the sealed fake Claude binary and
production hub frames for native launch, delivery, hooks and lifecycle evidence.

The crash case advances its injected clock while the discovered process is still
running, then kills it. This forces the native exit to follow the initial advance.
Its bounded `eventually` advances another 150 ms on each attempt (50 ms watcher
plus 100 ms re-exec grace) until `hub.status` reports the exited row. Keep the
unknown state, cleared attach, process-source event, once-only log and successful
replacement injection assertions. One clock advance is not an exit receipt.

Run the named case with:

```sh
node --test --test-name-pattern='^a crashed Claude Code process:' hub/test/claude-code-adapter.test.ts
```

For this timing regression, run ten fresh sequential invocations and retain their
terminal summaries. These are local targeted evidence; they do not establish
load-gate coverage. The existing T3 identity runs once in mode-free task
verification. For a Coordinator-authorized local load probe, acquire the shared
hub, Neovim and machine leases through `suite-lock.acquire`, use a sealed
disposable clone at the reviewed head and two owned busy CPU workers, run this
T3 identity alone five times, and retain original per-run exit/pass output, worker
progress/join and lease acquire/release records. This establishes local CPU-load
evidence only; it does not establish Linux, slow-disk or integrated load coverage.
