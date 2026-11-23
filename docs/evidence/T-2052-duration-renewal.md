# T-2052 duration renewal, 2026-11-23

The Coordinator folded T-2059's five expiring allowances into this item and
authorized the current-dev merge before renewal. The branch merged dev
0a75e7668 (including 022d75601); there was no durations conflict.

These are completed passing case receipts, not whole-run success claims.
All samples below are Linux x64, Node v24.21.0, droplet executors. Durations
include case setup, assertions and cleanup; worker startup is excluded.
No sample is inferred from a missing row, start event, timeout or skipped case.
The log scan streamed lines and selected exact generated names with structured
`suite timing` outcome `pass`. A-22625 and A-22628 are the same run and count once.

| Run | Artifact | Head | Tree | Occasion |
| --- | --- | --- | --- | --- |
| d6245a18-d301-4acf-b154-e66cacaf74cb | A-22629 | 022d7560131a51725bd87fbbacfbcd05a64d5aed | 2e78d9b977e8494e966223127bd0f4550046b76c | integrated Linux cover |
| fe8db4e4-f435-495b-a6fb-d7ac36a1710a | A-22625 / A-22628 | d381f0b03b4cd73328af8d978c00f00d738d3d64 | 2e78d9b977e8494e966223127bd0f4550046b76c | merge batch |
| 6a4791fb-0590-4481-bf3b-e3891bb68ecc | A-22606 | d6f0b7da6c6ab6464948e586a0c82ff1a67af313 | 9cd0886ee1ee15149c7d946167066eb37cc602ad | integrated Linux cover |
| 8ae71246-13a5-4dbb-a477-3d7470ebd5f9 | A-22556 | c226f9c48431b6489d1204bdf6e88b814ce5f7f0 | aafb8a0d4daf2ea93541f4663863849e5d1ab44f | task sampling |
| ae9e60c1-953c-4e1b-a890-1e8784da8a0c | A-22630 | 022d7560131a51725bd87fbbacfbcd05a64d5aed | 2e78d9b977e8494e966223127bd0f4550046b76c | periodic dev; whole run timed out; only completed cases used |

All seven belong to T3 (10 s tier budget). The shipped manifest remains in
report mode, whose missing-baseline fallback uses `budget.testSeconds = 5`.
The Coordinator therefore required 1.5 times the worst recent passing sample
to fit that fallback before retirement. None fits: even the smallest resulting
cap is 6.939 s. Prune has no test baseline, so removing its allowance causes a
hard report-mode failure above 5 s; the other cases lack 1.5-times fallback
margin as well. Historical baselines remain untouched; refresh belongs to the
stage-close add-only procedure. No assertion or policy was relaxed.

Values below are seconds. `unexecuted` means the selected task run did not run
that identity; it supplies no timing. Every worst sample is from A-22630.

| Exact generated identity | d6245a18 | fe8db4e4 | 6a4791fb | 8ae71246 | ae9e60c1 / worst | Renewed cap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| hub/test/startup-listener-scale.test.ts::1500 startup freshness answers keep summary hydration and dependent work linear | 10.783413544 | 10.198886678 | 11.047103336 | 11.377711638 | 15.934576423 | 23.902 |
| hub/test/startup-listener-scale.test.ts::listener binds report each await while retained verdict freshness drains | 14.522762447 | 14.580224929 | 15.262193899 | 16.648331425 | 22.123179524 | 33.185 |
| hub/test/fake-claude-cleanup.test.ts::fake Claude final census detects dropped cleanup | 3.087417488 | 3.408762494 | 3.099894640 | unexecuted | 4.625876421 | 6.939 |
| hub/test/fake-claude-cleanup.test.ts::orphan sweep joins a fake Claude session after its fixture worker is killed | 3.516085613 | 3.918056833 | 3.563172391 | unexecuted | 4.920187203 | 7.381 |
| hub/test/host-allow-list.test.ts::immediate merge revokes every host lease before landing the task | 4.038486850 | 4.336229344 | 4.302159338 | unexecuted | 6.376878765 | 9.566 |
| hub/test/prune-process-lifecycle.test.ts::hub crash after durable writer release is reconciled by restart before territory admission | 3.936248728 | 5.347221626 | 3.616479029 | unexecuted | 5.577654668 | 8.367 |
| hub/test/suite-stage-cover.test.ts::after-stage gates close on sharded Linux, retain history and advance without a Mac full cover | 20.130509069 | 17.909663075 | 20.053844871 | unexecuted | 31.189065355 | 46.784 |

Each cap is `ceil(worstSeconds * 1500) / 1000`, preserving 1.5 times headroom
rounded upward to milliseconds. All seven entries use C-216, added 2026-11-23,
expires 2026-11-30 at 00:00 UTC. The listener moves from E-880's migration span
to the ordinary seven-day owner. Work-only still publishes all 1,500 answers
with the original census assertions. A-22557 audited those exact task receipts;
A-22558 records the discarded optimization experiments and their limitations.

## Config pin search and validation scope

Rule 33 search covered hub/test and nvim/test for `durations.json`, `C-216`,
the seven exact identity names, `DURATION_MANIFEST`, raw read/copy sites and
their importers. The shipped config readers are suite-tiers.test.ts (standing
owner/config validation) and duration-duplicates.test.ts (copies shipped JSON
to its scratch lint fixture). Both full files run before commit; durations.test.ts
also runs for production checker, renewal, owner/date and identity validation.
All tests use disposable fixtures and their shared isolated environments.

Other matches plant or read their own synthetic manifests, or assert diagnostic
text/path handling, rather than pin these shipped values: suite-soak-component,
quarantine-runner, suite, epic-close, dev-t3-search-component, suite-dry-run,
verification-tree, suite-retention-component, suite-close-component, merge-gate,
tier-tripwire-runner, durations-runner, suite-admission, heartbeat, duration-legacy,
suite-duration-context, merge-batches, suite-selection, suite-hung-component,
suite-cover, suite-admission-native, suite-preflight, suite-tier-report,
durations-refresh, durations-runner-budget, suite-reference-pins and merge-queue
(all hub/test/*.test.ts). Neovim vboard and explorer-roots-component mention the
duration owner category without pinning this config. No consumer contract changed.

Final-head verification and source review are separate receipts from these
historical Linux samples; the samples do not claim execution of the final tree.

Pre-commit local validation on macOS arm64 Node24.21.0, serial starts under
1-minute load 12: suite-tiers.test.ts 19/19, duration-duplicates.test.ts 3/3,
durations.test.ts 26/26; all exited 0. These are selected files, not the whole
project suite. The production checker replayed all 30 completed passing samples
across five unique runs with the candidate manifest: no failures in report mode
or an in-memory enforce-mode replay. Removing the work-only allowance in a
separate in-memory positive control produced the expected report-mode failure.
The shipped manifest remained report-only throughout.
