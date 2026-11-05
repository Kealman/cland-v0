T-1666: document bounded pre-revoke generation settlement, leftover reporting,
post-cut authority fence and future provider removal entry point.

Review corrections pin stop authority across renames, join failed-launch cleanup
producers, drain settlement before storage closes, and use optional adapter
releaseHostGeneration to remove OpenCode resume config/password at retirement.

Retained OpenCode cleanup obligations survive stop, archive/prune and restart;
explicit retirement streams and checkpoints them without scanning all history
or granting signal authority from recovered metadata.

Positive joined normal exits also persist retirement before terminal notices.
Legacy terminal rows without closure receipts stay incomplete and grant no
metadata deletion authority. Native completion setup uses fresh counted receipts
per T-1678 rather than stale log matches.

Retirement storage keys on native generation identity and keeps prior record
compatibility. Older unknown generations fence shared private files; read-only
Host inventory reports untracked OpenCode private files without deleting them.

Read-only inventory also names untracked agent admission records. Pending or
partial file inventory cannot become a complete cut receipt; acquisition warm-up
rechecks admission before readiness cleanup after its awaited native receipt.


Coordinator-requested changed-boot closure entry covers every harness and pending
failed launch. Shared boot validation, durable retry fences and captured Host
fences preserve remaining resource ownership without native stop or deletion.


A-16646 correction keeps the exact-generation native fence independent of
resource receipt deletion, through storage reopen and row replacement. Old
resource-only markers preserve that fence lazily before cleanup; no startup
history migration is added.


The Coordinator-authorized stage-5 merge retains session-resume drain and
T-1609/T-1610 ref-watch/flush helpers. Their requests and adopted-worker restore
use the same per-request revoke admission fence, with held-boundary regression
controls. Durations use dev as the base with only T-1666 allowances re-added.


Native stage-5 evidence exposed a lexical alias mismatch in OpenCode retirement.
Capture canonical private-directory path and device/inode ownership at launch,
key it by the existing native generation, and preserve it through retirement.
Refuse retargeted aliases, directory symlinks and inode replacement. Regenerate
the merged agent closure; do not resurrect dev's removed duration samples.
