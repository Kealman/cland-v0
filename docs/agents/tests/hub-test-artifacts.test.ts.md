# hub/test/artifacts.test.ts

Inline admission/retry coverage uses a disposable projectHub: refuse 65,537
UTF-8 bytes, persist exactly 65,536, discard the first result, stop the hub and
retry the same key after restart. Assert saved bytes, the single index row and
single topic chip independently, and refuse changed arguments under the same key.
The existing no-key test retains the previous request/reply shape.

The new inline/retry callbacks create fixtureWork before root acquisition,
use root/acquire/step to adopt late roots/resources and fence continuations,
and dispose the hub/journal before removal. The held-acquisition cancellation
control checks the close receipt, no later write and absent root after disposal.
