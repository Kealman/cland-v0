# T-1752 — restart recovery

Host restart recovery streams active leases, reconciles provider absence through
confirmed destruction, restores watchdog and renewal ownership before scaling,
and retains native obligations for session rows with missing registrations.
Use docs/hub/host-restart.md and the per-file host-restart test guides. No new
CLI or role permission is introduced.
