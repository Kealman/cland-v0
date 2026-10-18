# T-709 authorized dev integration

Coordinator fe50a48b authorized one merge after the green 7d8025ae droplet receipt. Integration commit 5cfc492a merges dev5f8d274a (T-708/T-767). No additional dev merge was taken.

The tiers conflict retains T-708 names=T2 and T-709 nvim-fixture-boundary=T1. The compiler conflict takes T-767’s minimal launcher/config/source fixture, copies and Git-seeds shared/test-support, and binds the real admission API in both tiny sources so root and linked-worktree compiler checks resolve the extracted dependencies. Every existing compiler assertion remains.

T0 typecheck, test:tiers and test:lint pass. Six requested compiler/Neovim boundary whole files ×5 serial=30 accepted runs,235 passing tests,0fail/cancel/skip. Peak1m load 3.283<15; read-only admission checked before runs, no override.

| File | Runs | Passes | Seconds (min–max) |
| --- | --- | --- | --- |
| hub/test/cover-quiet.test.ts | 5/5 | 70 | 6.054–6.241 |
| hub/test/nvim-fixture-boundary.test.ts | 5/5 | 15 | 0.135–0.142 |
| hub/test/tier-tripwire-runner.test.ts | 5/5 | 85 | 16.103–16.863 |
| hub/test/typecheck.test.ts | 5/5 | 5 | 1.410–1.440 |
| nvim/test/client.test.ts | 5/5 | 30 | 8.838–10.009 |
| nvim/test/scenarios/workbench.test.ts | 5/5 | 30 | 1.562–1.739 |

The compiler fixture retains T-767’s speed: 1.410–1.440 seconds whole-file on this Mac. No timing allowance/baseline or quarantine changed. The updated exact40 replay at5f8d274a still records11 T2 files, an empty hub runtime import closure and zero import-decided T2 selections.

Earlier exact-head droplet1e629b10 at7d8025ae is green (A-5045): full mode,2530passes/2538tests,8skips,0fail. Linux x64 6.8.0-142-generic, c-8 lon1, Node24.21.0, Neovim0.12.5, lifetime1544s,cost$0.1072. This is prior-head evidence; the Coordinator requires delta source review and a fresh mode-free droplet at the new reviewed head.

T-684 is not part of the merged dev parent and this linter has no --shrink option. Its landing is subscribed; follow the Coordinator’s shrink instruction when that capability is available.
