# Empty project

The plan is made here, with the human, and shown to them: what to build, then a first release ready to work, or a map when the way is not yet clear.

1. **What we build.** One or two rounds: what the project is for, who uses it, and what its first useful version does. Recommend a small first version the human can try soon. Under a rule that gives the stack to the human, ask for it here too.
2. **Fog or not.** Fog is a question the first version depends on that nobody can answer yet: something to research, or a choice between approaches the human must see first. Say whether there is fog, and why, as a recommendation.
3. **No fog: the first release.** One round: the release as a table to accept or edit: its title and goal, then three to six tasks in order, each one change one session can make, with its acceptance criteria. A first version that is one larger feature becomes one epic under the release, holding the tasks. On yes, file them:
   - the release: `cland task create "<title>" --kind release --body-file -`, the body its goal in two sentences, then `## Notes`; its version waits for the human;
   - the epic, when there is one: `cland task create "<title>" --kind epic --parent R-<n> --body-file -`;
   - each task: `cland task create "<title>" --size XS|S|M --parent <the release or the epic> --body-file -`, with `--blocked-by T-<m>` for the order; the body has `## Summary` (one to three sentences) and `## Acceptance criteria` (one line per criterion);
   - each task's status: `cland task edit T-<n> --status planned`: new tasks wait in backlog, and the Coordinator takes the release's planned ones.

   Then show it: "Release R-<n> '<title>' holds T-<a> to T-<b>; in the workbench, space then i shows them."
4. **Fog: the map.** Run the `wayfinder` skill's "Chart the map", its steps 1 to 4, with the human: the destination, the frontier and the fog, the map and its first questions. Say in a line what a map is. Its commands are in `docs/agents/issue-tracker.md`, "Wayfinding operations". Show the map the way step 3 shows a release, and say plainly that the Coordinator waits until the first epic exists: the map's questions are answered here, with the human, and the epic is filed when the way is clear.
5. **The research.** Say how many research sub-agents you would start and what each one answers; start them on yes. For each `wayfinder:research` question, make its worktree, one after another: `git worktree add .cland/worktrees/research-<slug> -b research/<slug> dev`. Then start one sub-agent per question with the `research` skill, the question and its worktree; it commits its findings there, pushes the branch to `origin` and reports back to you. Record each answer yourself: the resolution comment, `cland task close`, a pointer line in the map's Decisions so far. When your clause disables sub-agents, research yourself, one question at a time.
6. Back to `SKILL.md`, the end of step 3.
