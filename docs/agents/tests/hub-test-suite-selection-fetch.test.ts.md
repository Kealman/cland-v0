# hub/test/suite-selection-fetch.test.ts

The T3 case `dev T3 deciding files exclude dirty tracker edits while task selection retains them`
uses disposable Git, fixtureEnvironment and scratchGitEnvironment. It proves a
nonempty committed dev delta, excludes unstaged tracker, staged and untracked
paths, and checks occasionSelection plus describeSelection for the dev-t3 report.
The task control retains all those working paths. No hub, provider or browser runs.

The new cases enter suiteCase before acquisition, with separate setup/action
bounds. Native setup uses fixtureCommand, which captures writer identities and
joins native close before settling. Failure and cancellation controls assert
structured close receipts, exercise a separately withheld directory-removal
receipt through ownDirectory, retain the sentinel on refusal, then observe
ENOENT after release. Whole-case cleanup joins selector continuations before
removing the adopted root.
