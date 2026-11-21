T-1901 documents Coordinator6b7eddaa's correction after configured run fad1a58f:
an absent resolved verification check yields an explicit skipped-preflight
enqueue result and continues through the existing gates. The check-only caller
does not require a test command; ordinary verification retains its prerequisite.
No role permission or ready-gate field changes.
