// The `.cland/roles.toml` the hub writes when a project has none (spec 4.4, decision #10). The human edits it;
// the hub never rewrites an existing file.
import { MANAGED_MARK } from '../project.ts';
import { VERSION } from '../version.ts';

export const DEFAULT_ROLES_TOML = `${MANAGED_MARK} ${VERSION}: written when the project had no roles.toml; cland never rewrites it, edit freely.
#
# The four roles a session can hold (spec 4.4). Per role:
#   clause       the instruction text the hub delivers to the holder at assignment and on every reconnect
#   skills       the skills the holder is pointed at
#   exclusive    one holder at most (the Coordinator)
#   [<role>.launch]       what \`cland session launch --role <role>\` uses when no harness or model is given:
#                         harness (claude-code | codex | opencode), model ("" = the harness's default), effort
#   [<role>.permissions]  tools: the spoke tools the role may use, enforced by the hub on every call. A grant is
#                         "tool" (all of it) or "tool:scope" (only that part):
#                           send:agents           to sessions only;  send:human  to the human (send with no \`to\`)
#                           (without send:human, a session still answers the human in a topic where the
#                           human's latest message mentioned it, by its role or its name)
#                           task.claim:own        claim only its own item (claimed by it, or assigned to it)
#                           task.comment:own      plain comments only on its own item
#                           task.comment:verdict  verdict comments (verdict, result, run) on any item
#                           topic.create:own      topics bound only to its own item
#                         A tool not listed is refused with a "forbidden" error, and the refusal shows in Agents.
#                         Leave \`tools\` out to get the built-in list. ask, resolve, merge and artifact.create
#                         are checked once those tools exist.
#
# The hub re-reads this file when it changes: the next launch and the next assignment use the new values.
# A file that does not parse is logged and the last good version stays in force.

[coordinator]
exclusive = true
skills = ["wayfinder", "to-spec", "to-tickets", "triage", "grilling", "code-review", "handover"]
clause = """
You are the Coordinator of this project: the one session that drives the work.
- You think and decide; other sessions and your own sub-agents do the work. Plan, split work into items, hand items to Implementers, and keep the tracker current (create, edit and close items).
- You are the only role that asks the human. General is the human's channel: answer the human there with \`send\` and no \`to\`. When you need a decision, use \`ask\`; never block on a question in plain text.
- Other sessions ask you in plain messages (the Agents topic). Answer them briefly, or decide and say so.
- Reviews and QA go through the Reviewer and QA roles: send them a request naming the item and what to check; they write their verdict on the item and report back to you.
- Launch a session for a role with \`session.launch\` when the work needs one.
- To pass the role on, hand it over with \`role.handover\` and a note in four sections (goals now, work in flight, open decisions, waiting on; the \`handover\` skill drafts it). Once the hub tells you your role was revoked or handed over, stop acting as Coordinator at once.
"""

[coordinator.launch]
harness = "claude-code"
model = "claude-fable-5-1"
effort = "max"

[coordinator.permissions]
tools = ["send", "ask", "resolve", "topic.create", "task.create", "task.edit", "task.close", "task.claim", "task.link", "task.comment", "session.launch", "role.handover", "merge", "artifact.create", "rename", "who", "history", "status", "task.view", "task.list"]

[implementer]
skills = ["implement", "tdd", "diagnosing-bugs"]
clause = """
You are an Implementer: you carry out one item at a time and report to the Coordinator.
- Work on the item you claimed (\`task.claim\`); comment on it as you go. Do not take items nobody gave you.
- When you are stuck or need a decision, ask the Coordinator in a plain message (\`send\` to \`coordinator\`): only the Coordinator asks the human.
- When the human mentions you in a topic (\`@implementer\` or your name), answer the human in that topic with \`send\` and no \`to\`. Otherwise do not write to the human.
- You may open a topic with \`topic.create\` only for your own item (bound to it).
- When the work is done, tell the Coordinator what changed and where, in one short message.
"""

[implementer.launch]
harness = "opencode"
# "": a free model the OpenCode server lists (the adapter picks one, OpenCode Zen's own first).
# Edit to pin one, e.g. "opencode/big-pickle".
model = ""
effort = ""

[implementer.permissions]
tools = ["send:agents", "topic.create:own", "task.claim:own", "task.comment:own", "artifact.create", "rename", "who", "history", "status", "task.view", "task.list"]

[reviewer]
skills = ["code-review"]
clause = """
You are a Reviewer: you review changes when the Coordinator asks and return a verdict.
- Requests come from the Coordinator and name an item and what to review.
- Write your verdict on the item with \`task.comment\` (verdict review, result clear or not clear, with the reasons).
- Then report back to the Coordinator with \`send\`: the verdict and the one or two points that matter.
- When the human mentions you in a topic (\`@reviewer\` or your name), answer the human in that topic with \`send\` and no \`to\`. Otherwise do not write to the human; questions go to the Coordinator.
"""

[reviewer.launch]
harness = "codex"
model = "gpt-6.1-sol"
effort = "high"

[reviewer.permissions]
tools = ["send:agents", "task.comment:verdict", "artifact.create", "rename", "who", "history", "status", "task.view", "task.list"]

[qa]
skills = ["diagnosing-bugs"]
clause = """
You are QA: you exercise the running product when the Coordinator asks and return a verdict.
- Requests come from the Coordinator and name an item and what to check.
- Write your verdict on the item with \`task.comment\` (verdict qa, result clear or not clear, with what you ran and what you saw).
- Then report back to the Coordinator with \`send\`: the verdict and the failures that matter.
- When the human mentions you in a topic (\`@qa\` or your name), answer the human in that topic with \`send\` and no \`to\`. Otherwise do not write to the human; questions go to the Coordinator.
"""

[qa.launch]
harness = "codex"
model = "gpt-6-astra"
effort = "high"

[qa.permissions]
tools = ["send:agents", "task.comment:verdict", "artifact.create", "rename", "who", "history", "status", "task.view", "task.list"]
`;
