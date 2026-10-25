# hub/test/suite-selection.test.ts

Selection replay uses the real CLI in a disposable caller. Its native-call
observer records only owned paths, command arguments and presence of synthetic
poison keys. Assert that every Git/tar call has a sealed HOME, XDG, Git config
and explicit cwd; clone/archive/coverage worktrees stay inside replay scratch.
Compare the caller's worktree list and status afterwards. Exercise positional
selector refs and retain the existing selection/time-share/miss/fallback checks.
Register detached replay-tree ownership before awaiting the child. Bound cases
with node:test's timeout option; owned teardown drains native descendants and
child pipes before root removal, including on failure or runner timeout.
The held-writer control starts the same teardown only after its persisted PID
receipt, retains the native signal, and asserts PID death before deleting scratch.

Use the sealed Git fixture for added, renamed, deleted, dirty and untracked test-file paths. Assert unmapped unchanged T3/T4 files stay absent on coverage fallback and each per-tier plan contains only its changed or mapped files. Project the repository read-path map onto the guard declared by the sealed candidate, dropping other guards and empty mappings. Prove admission selects the unchanged inbox-verifier T4 guard with the changed-source explanation, both with the current production manifest and after adding another T4 guard to its scratch copy (in a shared-source array and a separate source mapping); plan the T4 phase without running the load file. Tracker fixtures resolve an open container owner, not the measuring task. Never fetch against the live repository from a test.
