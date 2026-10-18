# T-709 source carrier audit

A-5010 identified fixed-root source carriers omitted by the neutral admission extraction. This correction changes only those carriers; all existing assertions remain unchanged.

| Carrier | Boundary | Correction or disposition |
| --- | --- | --- |
| hub/test/suite-coverage.test.ts | Real production source fixture | Copy shared and test-support beside the original hub roots; all raw-coverage, malformed-receipt and descendant-attribution assertions retained. |
| hub/test/typecheck.test.ts | Root and linked-worktree compiler fixture | Copy both roots and include them in the same Git seed as the existing projects; all four compiler checks and compiler/API version assertions retained. |
| hub/test/selection-replay.ts | Archived historical selector | Query ls-tree for shared/test-support at selectorRef and include only present roots; old selector refs remain supported. |
| hub/test/prepared-project.ts | Complete private prepared fixture | Recursive copy of the entire prepared seed, including objects; no source whitelist to update. |
| hub/src/executor/droplet/prepare.ts and run.ts | Remote package source | Full-tree Git bundles and checkout of the submitted committed head; no source whitelist. |
| hub/src/territory-release.ts | Territory/release source | Whole Git trees/refs, no filtered package copy. |
| nvim/test/nvim-path.test.ts | Isolated binary downloader fixture | Copies only the standalone downloader and its pin files; downloader imports no moved shared primitive. |
| artifact/import/fixture-data copies | Payloads, discovery or fake-machine snapshots | Payload-only or complete-directory copies, not filtered production source. No change. |
| hub/src/suite-shards.ts ls-tree | Test inventory | Enumerates test paths, not source packaging. No change. |

Search covered cp/cpSync/copyFile/copyFileSync, Git archive/bundle and related source-copy paths across hub and nvim.

## Refreshed proof

Two affected test files × 5 complete serial runs = 10 accepted runs, 15 passing tests, zero failures/cancellations/skips. Current and historical archived-selector invocations each pass 5/5: 7dccacff (both roots present) and af981f17 (both roots absent). Peak one-minute load across these receipts: 4.367 < 15. Read-only admission checked before running; no override.

Typecheck, test:tiers and test:lint pass. A-5009 remains the 27-file/135-run admission/runtime proof; this follow-up changes no production or Neovim fixture implementation. No allowance, tier or quarantine changes. Exact-head droplet verification waits for a fresh clear source verdict.
