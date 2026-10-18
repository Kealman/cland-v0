# T-774 Mac validation and catalog cost

All tests ran one complete file at a time, with read-only admission before each validation invocation and no cover/load override. The cover-quiet lift was posted at 14:38Z. Validation has 40 distinct files and 182 accepted invocations: 28 required files ×5, 12 unchanged T2 consumers once, then six affected files ×5 after the lazy committed-catalog fallback. There are 1,843 test passes, zero failures, cancellations or skips, and a sampled one-minute load peak of 6.394 (<15). The initial source base is 2a3aa788; the fallback/source-integration repetitions and quiet profile use 50cb7a7d. Subsequent pre-review integration 013ac860 changes no Neovim source or producer; final static gates cover it.

The table uses the later five runs for the six repeated files. Other rows retain their original five complete runs. Final reviewed-head Linux evidence is required separately; no prior-head receipt is claimed as that proof.

| File | Runs | Passes | Seconds, min–max | Peak 1m load |
| --- | ---: | ---: | ---: | ---: |
| hub/test/nvim-fixture-boundary.test.ts | 5/5 | 35 | 0.196–0.215 | 3.687 |
| nvim/test/account-poll.test.ts | 1/1 | 1 | 0.342–0.342 | 4.960 |
| nvim/test/artifact-browser-component.test.ts | 5/5 | 5 | 0.445–0.528 | 2.911 |
| nvim/test/artifact-browser.test.ts | 5/5 | 50 | 5.262–6.010 | 2.758 |
| nvim/test/client-component.test.ts | 5/5 | 10 | 0.362–0.426 | 2.711 |
| nvim/test/client.test.ts | 5/5 | 20 | 9.154–13.447 | 5.167 |
| nvim/test/criteria-component.test.ts | 5/5 | 15 | 0.982–1.354 | 6.268 |
| nvim/test/criteria.test.ts | 5/5 | 10 | 3.899–4.710 | 6.268 |
| nvim/test/events-quiet.test.ts | 5/5 | 15 | 2.901–2.982 | 5.915 |
| nvim/test/events.test.ts | 1/1 | 4 | 2.270–2.270 | 4.960 |
| nvim/test/explorer-card-component.test.ts | 5/5 | 70 | 6.298–6.427 | 5.833 |
| nvim/test/explorer-card.test.ts | 5/5 | 5 | 1.114–1.302 | 5.833 |
| nvim/test/explorer-component.test.ts | 5/5 | 80 | 4.804–5.397 | 4.158 |
| nvim/test/explorer-compose-component.test.ts | 5/5 | 40 | 2.844–3.143 | 5.586 |
| nvim/test/explorer-compose.test.ts | 5/5 | 5 | 1.327–1.728 | 5.268 |
| nvim/test/explorer-roots-component.test.ts | 5/5 | 35 | 2.132–2.480 | 5.006 |
| nvim/test/explorer-roots.test.ts | 5/5 | 5 | 0.836–1.153 | 4.856 |
| nvim/test/explorer-summary.test.ts | 1/1 | 1 | 0.128–0.128 | 4.883 |
| nvim/test/explorer.test.ts | 5/5 | 10 | 1.093–1.423 | 4.085 |
| nvim/test/graph.test.ts | 1/1 | 17 | 5.122–5.122 | 4.883 |
| nvim/test/inbox-actions.test.ts | 1/1 | 4 | 1.672–1.672 | 4.812 |
| nvim/test/inbox-sections.test.ts | 1/1 | 4 | 6.160–6.160 | 4.827 |
| nvim/test/layers-component.test.ts | 5/5 | 50 | 2.917–3.182 | 4.708 |
| nvim/test/layers.test.ts | 5/5 | 20 | 2.936–3.561 | 4.303 |
| nvim/test/palette-component.test.ts | 5/5 | 65 | 3.574–3.849 | 4.256 |
| nvim/test/palette.test.ts | 5/5 | 25 | 2.282–2.486 | 3.958 |
| nvim/test/plan-component.test.ts | 5/5 | 20 | 1.012–1.065 | 3.801 |
| nvim/test/plan.test.ts | 5/5 | 25 | 2.304–2.872 | 4.004 |
| nvim/test/rulebook-component.test.ts | 5/5 | 5 | 0.329–0.584 | 3.764 |
| nvim/test/rulebook.test.ts | 5/5 | 15 | 3.697–4.675 | 4.138 |
| nvim/test/scenarios/workbench.test.ts | 5/5 | 30 | 1.972–2.563 | 3.687 |
| nvim/test/session-archive.test.ts | 1/1 | 2 | 0.798–0.798 | 4.601 |
| nvim/test/session-resume.test.ts | 1/1 | 1 | 0.570–0.570 | 4.601 |
| nvim/test/shell-component.test.ts | 5/5 | 300 | 17.849–19.558 | 5.641 |
| nvim/test/shell.test.ts | 5/5 | 125 | 13.746–15.778 | 4.120 |
| nvim/test/stub-control.test.ts | 1/1 | 3 | 0.083–0.083 | 4.601 |
| nvim/test/thread.test.ts | 5/5 | 115 | 15.996–21.097 | 6.394 |
| nvim/test/vboard.test.ts | 1/1 | 24 | 7.371–7.371 | 4.601 |
| nvim/test/verification-queue.test.ts | 1/1 | 1 | 0.417–0.417 | 4.428 |
| nvim/test/verification-view.test.ts | 1/1 | 1 | 6.274–6.274 | 4.428 |

## Quiet same-machine producer/replay comparison

Darwin arm64, Node v24.21.0, pinned Neovim 0.12.5. Each cell is a complete file, serially, with no concurrent T0 command or local suite. Peak sampled load is 3.681. Producer mode installs the existing hub-owned recordedOutput only in the stdio stub, with no recording/append overhead; it is a diagnostic T3 route, never ordinary T2 validation. The full-catalog control temporarily withholds that file’s slice; every slice is restored byte-for-byte, with its SHA-256 in quiet-profile.json. No assertion or test-name filter changes.

| File | Producer seconds | Full catalog seconds | Slice seconds |
| --- | ---: | ---: | ---: |
| nvim/test/shell.test.ts | 14.837 | 15.375 | 14.052 |
| nvim/test/shell-component.test.ts | 17.336 | 20.847 | 18.052 |
| nvim/test/explorer.test.ts | 1.365 | 1.414 | 1.103 |
| nvim/test/explorer-component.test.ts | 6.168 | 6.793 | 5.138 |

The four files total 44.429 seconds with the full catalog and 38.345 with slices: 6.084 seconds less in this single comparison. These are local comparisons, not integrated-suite T3 totals; T-775 owns the refreshed full-run duration and hub-start census. Retained native rows and later splitting candidates are in the migration audit.

## Catalog startup separately

Eleven read/parse samples per file in one Node process; the first is excluded and the table shows the arithmetic median of the ten warm samples. Raw samples are retained. The initial measurement while starting the task was 11.134 ms read / 50.214 ms parse for 4,464 records; the final quiet table uses the refreshed 4,467-record catalog. Cache and load differ, so the initial value is not substituted for this later comparison.

| Catalog | Bytes | Records | Read ms | JSON parse ms |
| --- | ---: | ---: | ---: | ---: |
| nvim/test/fixtures/protocol-frames.json | 11603403 | 4467 | 8.797 | 40.058 |
| nvim/test/fixtures/protocol-frames/shell.json | 426147 | 175 | 0.246 | 0.992 |
| nvim/test/fixtures/protocol-frames/shell-component.json | 4814364 | 2256 | 3.459 | 11.666 |
| nvim/test/fixtures/protocol-frames/explorer.json | 73682 | 23 | 0.031 | 0.168 |
| nvim/test/fixtures/protocol-frames/explorer-component.json | 949368 | 197 | 0.181 | 2.261 |

## Controls and boundaries

A packed-data integrity check confirms that all 4,464 original records and all 24,807 original interned nodes remain unchanged. The refreshed catalog adds only three records and seventeen nodes. `catalog-integrity.json` retains this result and every committed slice hash.

- The newly moved client composer case first fails on its missing recorded message; the maintenance command captures its two frame variants without changing its assertions. The explorer producer capture adds one already-permitted benchmark-root detail ordering. Existing records remain unchanged.
- The per-file selection and lazy fallback regressions run red before implementation and green afterward. Normal slice reads do not load the main catalog; a recorded interleaving loads it once; a truly unknown key retains operation/request/key diagnostics and the refresh instruction.
- A planted slice output is rejected by the complete workbench recorder file; exact byte restoration is SHA-256 checked. The --from-recordings maintenance path and the ordinary whole-file workbench checks pass afterward.
- The live workbench producer check validates all main-catalog outputs and each slice against that catalog. T2 clients still have no hub runtime/harness imports. Current selection replay covers 40 landings and all 26 T2 Neovim files, with zero import-decided T2 selections.
- Test-lint debt stays 524. Generated shrink adds empty entries only; no duration allowance, quarantine, existing input, title or assertion expectation grows or weakens.
- Coordinator decision 19dc76f5 accepts the explicit native CLI/watcher/transaction/account/harness keeps and requires their per-file accounting. No new hub-side T2 rule proof is added here; the two added pure boundary controls are T1.

## Remaining gate

Source review precedes one mode-free task droplet verification at its exact reviewed head, including Neovim. Submission is held until the Coordinator posts “hub restarted.” No source verdict or Linux success is claimed by this Mac evidence.
