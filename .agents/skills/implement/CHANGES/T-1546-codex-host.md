T-1546: Document the Codex recording Host seam, unchanged preservation tests,
per-launch version checks and process/file ownership boundary.

Consume T-1545 spawn authority and T-1547 stop callbacks; reconcile exact Codex
log-close boundaries after the shared Host lands.

Source-review fixes: preserve selected Host on live rows, coalesce/drain probes,
fence and join lifecycle work, await close in every Codex fixture wrapper.

Migrate the Lead-authority version fixture to Host.run/spawn while retaining
its original authority assertions; separately own reconnect so polls continue.
