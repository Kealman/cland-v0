# T-1751 — scheduler host spend cap

New host reservations obey both the hosts sub-cap and shared verification cap.
Renewals of admitted host leases bypass only the hosts sub-cap. Waiting demand
survives refusal. The event-driven warning uses each spend transaction’s already-loaded ledger, without extra reads,
and a durable per-project UTC-day checkpoint; see docs/hub/host-spend-cap.md and the
pool-spend-cap test guide for isolated evidence.
