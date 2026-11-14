Doctor's hosts diagnostics use existing read-only hub frames and the local pool
image key comparison. See docs/hub/cland-doctor.md and the doctor-hosts test guide.
Never inspect provider credentials from doctor or turn its warnings into gates.
Review correction: use store-owned actual eligible identity counts, scoped to
placed-role harnesses, rather than admission capacity. Older hubs missing those
facts produce an unavailable warning. Ready hosts may carry an outage timestamp
during the health grace interval.
