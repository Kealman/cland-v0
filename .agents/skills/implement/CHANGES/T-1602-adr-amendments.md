# T-1602: Host transport ADR amendments

Recorded the landed T-1591/T-1596/T-1597 socket, admission and branch-lease
boundaries in dated amendments to ADR 0003 and ADR 0004. Replaced the earlier
Unix-edge amendment's future transport wording with a reference to the landed
Host amendment. The shared implement procedure and SKILL.md are unchanged.

Sources: landing diffs d1eb35e34, f7b7a8367 and 1fcc37db5; their tracker comments,
including both T-1591 receive-lock/revoke-wait seam decisions; spec v0.4 §§3.2,
3.3, 3.12; GLOSSARY Hosts; stage-2 QA A-16202 at 722f1ce57917ac800aa365088f3050776b60490c.
QA establishes fake-transport/scratch-repository coverage, not real SSH or
remote-host execution. This item adds documentation only.
