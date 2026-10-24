# hub/test/literal-rm-cli.test.ts

The T2 CLI seam invokes the shipped Node CLI directly through clandCliLaunch;
the exception applies only to that synchronous launch, not a shell wrapper.
Use a disposable root and fixtureEnvironment after the last overlay. Assert
native exit 2, stderr retry guidance and empty stdout, then literal/malformed
input success without a hub. Child completion precedes root removal; never
execute the payload's Bash command.

Generated project hook shell execution, PATH absence, refusal propagation and
standing aside for injected hooks are covered by the existing T3 shell contract
in init-process.test.ts. T1 init-settings.test.ts retains the exact managed Bash
hook registration, and T2 claude-code-environment.test.ts covers injection.
