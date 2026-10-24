# hub/test/fake-claude-cleanup.test.ts

`fakeClaude` owns every fake CLI invocation, including adapter polls, through a
home-local process-identity registry. After resource and hub shutdown it closes
writer admission, reaps session groups (including hooks and spokes), and allows
in-flight CLIs to exit. After 5 seconds a stuck-writer error names the remaining
PID/start identities and retains the home, without killing the polls or starting
removal. Release or stop those writers before retrying cleanup. Only observed OS
exit permits removal; a delayed `execFile` callback is awaited separately.
Removal retries ENOTEMPTY/EBUSY for 1 second and reports remaining paths
if exhausted. A stale fixture environment cannot recreate a closed home.
`fake-claude-cleanup.test.ts` proves the held-poll late write, delayed callback,
home retention at the injected-clock drain deadline, orphan hook cleanup,
closed-home admission and bounded remaining-file diagnostic at the T3 process
lifecycle seam. The same writer drain applies during signal recovery.
