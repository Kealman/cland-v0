T-1830: record setup's optional host consent boundary, metadata-only diagnostics,
existing pool/role setters and legacy-reply compatibility. No permission change.
Source-review fixes preserve existing pool guidance, check configured-pool tokens,
and use shared account-aware freeCount for opt-in role eligibility.
Coordinator decision 573f205e: untouched nonterminal hosts skip, partial pools
remain open; preserve successful unattended setup and existing consumer assertions.
