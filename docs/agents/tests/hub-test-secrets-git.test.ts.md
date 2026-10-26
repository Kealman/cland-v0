# hub/test/secrets-git.test.ts

T3 because native Git is the subject. Use a disposable repository and
`fixtureEnvironment`, including scratch HOME/XDG and Git configuration.
Check the managed ignore with both `git status` and `check-ignore`; the
unignored `.gitignore` row is the positive control. This native ignore contract
cannot be established by a fake parser. The file starts no hub, harness,
messenger or browser. Each Git command has a completion callback and timeout;
fixture removal follows those receipts through `secrets-fixture.ts`, whose
before-remove barrier repeats termination and native close/output drainage.

The custom-ignore case first observes the credential path in native status,
then leaves CLI stdin open to prove an unprotected file is refused before
consuming input. It retains custom bytes, refuses a later negation and accepts
a final literal protection rule; native status/check-ignore prove protection.

The cancellation control arms a filesystem observer before launching one CLI,
waits for its exact persisted managed-ignore receipt, then aborts while stdin
is still open. It asserts native SIGTERM/close and the incomplete ABORT_ERR
output receipt, preserves the root until both drain, then removes it. No hub
starts or fake platform calls are needed.

The [T2 startup seam](hub-test-secrets.test.ts.md) proves mode tightening and
symlink refusal independently of native Git.
