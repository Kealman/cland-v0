# T-1644 preservation correction

Run 0e027541 at 490fc805 failed nine unchanged Claude discovery/liveness cases
with `test host t1 refuses stat`. Coordinator triaged the shared-defect notices
as branch-local and directed keeping claude-code-host.test.ts unedited.

Its recording Host explicitly delegates the shared local fileType/write/remove
operations but inherited testHost's rejecting stat. Add stat delegation only
when those exact shared function capabilities are installed. A default testHost
or arbitrary override cannot access native metadata; other operations still
refuse. Production LaunchFiles and SSH Host stay unchanged. Red/green guard
cases live in launch-files.test.ts, while the original Claude file is preserved.

The Coordinator also required a production negative control: host-ssh-contract
replays the older agent's unknown-stat reply on an actual agent connection.
Production SSH Host / LaunchFiles reject before any file mutation or undo entry;
original bytes and mode remain intact. This completes the capability/refusal proof.
