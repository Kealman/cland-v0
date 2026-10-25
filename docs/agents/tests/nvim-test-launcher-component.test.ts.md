# nvim/test/launcher-component.test.ts

T2 seam: owned headless Neovim with the committed protocol recordings and sealed
stub hub; no native harness. T-781 adds the six built-in role rows plus one custom
role, preserving snapshot membership. Observe the rendered custom harness/model/
effort before launch, then the exact session row and outbound launch fields.

T-323 holds the initial `role.list` answer while real keys select a role. Release
it without another key and observe the rendered defaults, Insert mode and exact
outbound launch fields. The typed-value cases select the role by its label and
preserve an explicit harness, model and effort, including a different harness.
The role reply must update the open form without requiring a role change.

Refresh only this consumer with `node hub/test/record-nvim-frames.ts
nvim/test/launcher-component.test.ts` after changing scenario inputs. Audit both
the retained main catalog and its launcher slice; new custom role-list and
session frames require recordings. Keep every existing assertion and the recorder's
nonzero-frame guard. A missing recording is a fixture refresh requirement, not
proof that custom roles were refused by the real hub.

The failed/empty model-answer case arms its native `TextChangedI` observer before
opening the launcher with real keys. `InsertEnter` queues name/role/model-field
navigation; after the failure reason is rendered, real `<C-u>custom-model` input
must produce a `launcher-model-input` RPC notification containing the exact name,
role, model text, model row and Insert mode. This is the completion receipt, not
an RPC mode poll or the `models.list` reply. The input wait has a 5 s gross bound,
separate from fixture and failure-reason setup; missing proof reports the native
exit/signal and a bounded stderr tail. Keep the rendered reason, absent popup
and exact outbound `session.launch.model` assertions for both error and empty
answers. The client fixture owns process teardown and directory removal.

T-1028's negative control prepends `<C-\><C-n>` to model typing: Normal-mode input
must fail with an incomplete input receipt. Remove that control for the passing
run. The quiet macOS case remains below the 2 s T2 budget; Linux parallel-load
measurements are separate evidence and require the suite's exclusive capacity.
The shared case lives in `nvim/test/launcher-model-fixture.ts`; its mapped
[T4 guard](nvim-test-launcher-input-load.test.ts.md) supplies the twenty-case
parallel Linux receipt without duplicating the case or changing its T2 tier.
