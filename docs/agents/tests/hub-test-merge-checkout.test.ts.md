# hub/test/merge-checkout.test.ts

The T3 final-preparation cases call squashTask against a sealed disposable territory. The final message callback moves either dev or the task ref using native Git compare-and-swap, after the gate callback but before squashTask rereads the refs. The rejection must identify the changed ref and its prepared/current heads, with no landing receipt or merge checkout applied. Native Git is retained here to prove the final ref reread boundary; the batch retry policy is covered at T1 in merge-batches.test.ts.

All Git children and squashTask receive the complete fixtureEnvironment. Prepared projects own their HOME, XDG directories and Git configuration, and teardown follows completion of every synchronous Git command and the awaited squash call.
