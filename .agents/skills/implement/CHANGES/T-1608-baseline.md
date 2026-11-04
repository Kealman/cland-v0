# T-1608 baseline

Coordinator decision 6d12bbe1 approves a reviewed test-only baseline atop dev before the production split. The T4 footprint test observes the native spoke's consumed welcome, idles ten seconds without tool enumeration/calls, reports VmRSS on Linux (ps RSS on macOS), then closes and joins the recorded spoke before an empty fixture census. RSS is measurement only, including unavailable values; no size threshold. The hub stays in process. Child environments use the existing sealed spawnSpoke builder; ps uses fixtureEnvironment after scratchGitEnvironment.

The initial local macOS arm64 Node24.21 sample ran successfully but RSS was unavailable because scratchGitEnvironment requires an excludesFile; fixed before baseline review. This is not a size reading or Linux evidence.

Production baseline and droplet run receipts will be recorded together with the final split evidence. No source change in this baseline.

Baseline review correction: guide heading names its actual test path and the generated index includes it. A-16357 retains native durations10.513454209s and11.039158541s plus the production durationBudgetReport replay (report mode, T4 unbounded, missing baseline explicit). Coordinator a326ffb5 keeps30s and corrects C-216 nonlegacy expiry to2026-11-10. No production file changed from devd38db9df7.
