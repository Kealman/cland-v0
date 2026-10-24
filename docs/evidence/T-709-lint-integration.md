# T-709 T-684 lint integration

Coordinator c4ed00a9 authorized one dev merge after prior-head green A-5059. Merge723daf59 integrates devb27f71f4; no further dev merge taken.

<!-- cland-allow-closed-wording: historical integration evidence; until.ts is a filename -->
The coverage fixture keeps both required changes: actual shared/test-support production roots and the new until.ts harness dependency. package.json preserves T-684’s gated lint/static ordering and T-709’s test:nvim-fixtures command. Other source changes are incoming dev. All existing test assertions are retained.

Fetched origin, then npm run test:lint passed the new policy. npm run test:lint -- --shrink also passed; generated baseline committed as5e6e612e. Only change is an empty entry for the zero-debt T1 nvim-fixture-boundary test. Existing allowances total524 before and after; no per-file/category increase. No waits/process helpers or duration allowance added.

Typecheck and test:tiers pass. Gated lint and shrink receipts are retained. Seven coverage/compiler/Neovim boundary whole files ×5 serial =35 accepted runs,245 passes,0fail/cancel/skip,peak1m 7.949<15. Admission checked before each file, no override.

| File | Runs | Passes | Seconds (min–max) |
| --- | --- | --- | --- |
| hub/test/cover-quiet.test.ts | 5/5 | 70 | 7.855–10.619 |
| hub/test/nvim-fixture-boundary.test.ts | 5/5 | 15 | 0.157–0.200 |
| hub/test/suite-coverage.test.ts | 5/5 | 10 | 2.633–3.645 |
| hub/test/tier-tripwire-runner.test.ts | 5/5 | 85 | 20.364–20.919 |
| hub/test/typecheck.test.ts | 5/5 | 5 | 1.677–1.897 |
| nvim/test/client.test.ts | 5/5 | 30 | 8.648–10.130 |
| nvim/test/scenarios/workbench.test.ts | 5/5 | 30 | 1.569–1.932 |

Exact40 replay refreshed atb27f71f4:11 T2 files, hub runtime closure[],0 import-decided T2 selections.

Prior reviewed72570ce0 droplet322abcc1 is green(A-5059): full mode,2530passes/2538tests,8skips,0fail. Linux x64 6.8.0-142-generic,c-8 lon1,Node24.21.0,Neovim0.12.5,lifetime1650s,cost$0.1146. All8 skips were macOS sandbox/idle-inhibitor or missing real OpenCode controls; no T2 Neovim skip. Those macOS cases have prior Mac proof. This receipt predates the authorized integration, so a fresh delta source review and exact-head mode-free droplet are required.

The hand-maintained source-carrier closure debt was reported separately to lead T-709 (S,Tech debt); Coordinator filed an E-482 follow-up. This task retains the minimal requested fixes.
