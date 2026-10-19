# Existing project

Learn the project before asking about it; the cland tracker then becomes its only tracker, and the first release comes out of what the human wants next.

1. **The study**, started before round 1, with sub-agents in parallel; they read and report, and none runs `cland` or changes a file. When your clause disables sub-agents, study after round 2 yourself.
   - structure and stack: languages, frameworks, package manager, build, entry points;
   - tests: the project's commands for `cland verify`'s `prepare` (install when needed), `check` (a fast gate when available) and `test` (required), whether they pass now (run them only when nothing needs installing), and CI;
   - docs: README, CONTRIBUTING, ADRs, a glossary, a changelog;
   - history: age, commits per month lately, contributors, the last tag or release;
   - the tracker: GitHub Issues of the `github` remote (`cland init` renamed `origin` to `github`; `origin` is the local territory now): open and closed counts, open pull requests, labels, milestones (`gh issue list --repo <owner/name> --state open --limit 1000 --json number,title,labels`); any other tracker the docs name.
2. **The report.** Ten lines at most, in the terms the rules give the human: what the project is and how healthy it looks; a developer also gets the stack and the test commands.
3. **The tracker.** Say that from now on the cland tracker is the only source of work. With open GitHub issues, say what an import brings: the open issues as items, read through the human's `gh` login (unscheduled tasks with their labels and comments, no size); closed issues stay on GitHub, untouched; pull requests stay out; another tracker is out of scope, so name it only. One question: import them now? Recommend yes. On yes, run `cland task import-github --repo <owner/name>` from your own shell. On a hub refusal, report its reason in one line and stop that step; offer no other route to the same act. When the import is done, run `cland task list --state open --json` and report the count.
4. **What next: the first release.** One round: what comes next? Recommend from the study and the issues: a first release of three to six items, imported issues or new tasks; or a larger goal charted with Wayfinder (then `EMPTY.md` steps 4 and 5). File the release as `EMPTY.md` step 3 does; an imported issue joins it with `cland task link T-<n> --parent R-<m>`, `cland task edit T-<n> --size S` and its status planned. Show it the same way.
5. Back to `SKILL.md`, the end of step 3.
