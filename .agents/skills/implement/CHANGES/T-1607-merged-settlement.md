# T-1607 merged failed-launch settlement

Supersedes the pending-T-1606 statements in earlier T-1607 checkpoints. Coordinator ed0aa34f authorized one merge of dev a9fc026d; it merged cleanly. No later dev merge is taken without a new instruction or conflict.

Reuse the landed FailedLaunches, boundedSettlement and LaunchSettled; LaunchFiles and Codex/OpenCode stay unedited. Remote private MCP/settings use a separate generation-owned writer, outside generic undo. Re-adopt accepted receipts before rollback, including close-before-adopt and unknown returned outcomes, preserving exact session/generation/Host/account identity with no launch token in the metadata.

Coordinator3d3d176f approves optional HarnessAdapter.settleFailedLaunch(process): Sessions uses it only for file-backed pending launches when no captured observer exists. Other adapters/doubles remain unchanged. Claude reconstructs the same bounded producer, retains incomplete state/receipt failures, and persists terminal proof before role release.

Coordinator43159f98 approves post-clear acknowledgement via existing forget, limited to opted-in, unpublished/unpreserved failed launches. A durable outstanding-intent index covers interruption after clearPendingStop. A prune failure logs and retains the marker, never reopens the row. Startup prunes only intents without a pending stop, in a tracked per-adapter flight yielding every 32 entries; it performs no native work. Normal index cardinality is zero; outstanding entries belong only to settling or interrupted acknowledgements, not retained history.

The native restart controls hold stop after re-adoption and assert the original row/role/credential before release. Missing state/receipt stays incomplete. The post-clear prune interruption is recovered with no adopt/Host stop/Claude call. Captured and reconstructed T2 callbacks count one producer. The close-before-adopt control was red with pid:null refusal before wiring.

Coordinator6bf1ce23 approves a narrow Claude-only C2 SSH observer migration: hostForProcess and the typed non-admission tag after the replacement probe's joined exit. Codex's branch and all assertions are unchanged; unsafe-config precondition remains unshimmed. Only the typed code is honoured, never message text. A generic lookalike remains supervised.

Agent pending records now retain identity/config metadata and valid job/stop diagnostics; no token/content is stored, and no PID authority is granted. One exported job-id validator covers launch, receipt read and removal, rejecting a leading CLI option before stop. The invalid --all control was red (it was wrongly accepted) then green. Local parsing/C5 fixtures remain unchanged.

Review flags: dispatch.ts native-ID binding is a permission boundary; Sessions fallback and post-clear acknowledgement are recovery boundaries; host-ssh-contract edits are forced Claude-only observer migrations. Existing source review A-16407 and repetition A-16426 remain part of the final evidence.
