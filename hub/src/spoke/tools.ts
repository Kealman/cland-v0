// Shared MCP tool schemas; both the spoke and hub validate against this table.
import { sendToSchema } from '../send-input.ts';
import { VERIFY_OCCASIONS, SEND_KINDS } from '../protocol.ts';
import { TASK_TOOLS } from './task-tools.ts';
import { RULE_TOOLS } from './rule-tools.ts';

const BASE_TOOLS = [
  {
    name: 'verify',
    description: 'Preview admission with dryRun, or submit verification and return immediately; the hub posts one result. Running sessions retain their launch-time tool schema.',
    inputSchema: { type: 'object', properties: {
      cwd: { type: 'string', description: "Absolute candidate directory; defaults to the caller's claimed item worktree. Required when no item is claimed." },
      mode: { type: 'string', enum: ['auto', 'all', 'hub', 'nvim'], default: 'auto', description: 'Omit for task selection. all is reserved to the Coordinator, human shell and authorized occasions; hub/nvim select a package.' },
      executor: { type: 'string', enum: ['local', 'droplet'], description: 'Override the configured verification executor; omit to use project configuration.' },
      report: { type: 'string', description: 'Report topic id or recipient. Required except for a dryRun preview.' },
      to: { type: 'array', items: { type: 'string' }, description: 'Result recipients, including the responsible Reviewer and claimant; defaults to no extra recipients for a topic report.' },
      occasion: { type: 'string', enum: Object.values(VERIFY_OCCASIONS), description: 'Integrated run occasion: Coordinator stage/epic/release, QA epic; batch and soak are hub-owned. Omit for tasks.' },
      dryRun: { type: 'boolean', default: false, description: 'Preview admission and tier projections without enqueueing or starting an executor.' },
      diagnostics: { type: 'boolean', default: false, description: 'Include the slower report-only reachability graph; requires dryRun: true.' },
      workers: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER, description: 'Positive safe integer overriding configured test workers.' },
      size: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]*$', description: 'Droplet size slug override; letters, digits, dots, underscores and hyphens, starting with a letter or digit.' },
      fresh: { type: 'boolean', default: false, description: 'Request a new receipt instead of a completed cached result; active submissions still reuse their run.' },
    }, anyOf: [{ required: ['report'] }, { properties: { dryRun: { const: true } }, required: ['dryRun'] }],
    allOf: [{ if: { properties: { diagnostics: { const: true } }, required: ['diagnostics'] }, then: { properties: { dryRun: { const: true } }, required: ['dryRun'] } }] },
  },
  { name: 'merge.queue', description: 'List durable merge queue entries in FIFO order.', inputSchema: { type: 'object', properties: {} } },
  { name: 'merge', description: 'Queue or land an open task on its base as one squash commit after clear, current hub verdicts. Coordinator or a supervising Lead within its scheduled subtree; never delegate a merge to a sub-agent.', inputSchema: { type: 'object', properties: { item: { type: 'string' }, cancel: { type: 'boolean' }, override: { type: 'string', description: 'Human shell only: skip verdicts and criteria with an audited reason; sessions cannot override.' } }, required: ['item'] } },
  {
    name: 'artifact.create',
    description: 'Show work through a persistent artifact in a topic. Give a file or directory path (copied), content, or folder: true with optional entry and content. Returns the artifact id and absolute path; posts its chip into the topic.',
    inputSchema: { type: 'object', properties: {
      kind: { type: 'string', enum: ['prompt', 'note', 'page', 'diagram', 'file'] }, title: { type: 'string' },
      path: { type: 'string' }, content: { type: 'string' }, folder: { type: 'boolean' }, entry: { type: 'string' }, topic: { type: 'string' }, status: { type: 'string', enum: ['draft', 'shared'] },
    }, required: ['kind', 'title', 'topic'] },
  },
  { name: 'artifact.keep', description: 'Keep an artifact from retention, or release it with kept: false. Agents cannot change human or Aide artifacts.', inputSchema: { type: 'object', properties: { artifact: { type: 'string' }, kept: { type: 'boolean' } }, required: ['artifact'] } },
  { name: 'artifact.archive', description: 'Archive an artifact explicitly. Human and Aide bytes are retained.', inputSchema: { type: 'object', properties: { artifact: { type: 'string' } }, required: ['artifact'] } },
  { name: 'artifact.move', description: 'Absorb a file artifact into a folder; its old id redirects to that file. Folder moves are refused.', inputSchema: { type: 'object', properties: { artifact: { type: 'string' }, folder: { type: 'string' }, name: { type: 'string' } }, required: ['artifact', 'folder'] } },
  { name: 'artifact.list', description: 'List up to 100 artifacts newest first; use the returned before cursor for the next page. Or resolve one id and list its folder files.', inputSchema: { type: 'object', properties: { topic: { type: 'string' }, artifact: { type: 'string' }, before: { type: 'string' } } } },
  { name: 'artifact.promote', description: 'Copy an artifact into a project-relative repository path. Aides may promote here; the Coordinator promotes from its shell.', inputSchema: { type: 'object', properties: { artifact: { type: 'string' }, path: { type: 'string' } }, required: ['artifact', 'path'] } },
  {
    name: 'send',
    description:
      'Send a message into a topic. Without `to` it is for the human, in the topic (General unless `topic` names another: reply in the topic an event came from); the Coordinator and Aides write to the human anywhere, another role only in a topic where the latest message of the human mentioned it. Exception: any session may send kind request to the human, with request review, qa or handover and a known subject (item, artifact or session). request and subject are forbidden on other kinds. With `to` (`string | string[]`: one recipient string or an array of strings) it goes to other sessions — session names, `all`, globs over names (`impl-*`), or roles (`reviewer`), exactly as names appear in `from` of inbound events (Aides use names only) — and is recorded in the topic (Agents unless `topic` names another). A lead\'s `review request T-<n>` to `reviewer` or `qa request T-<n>` to `qa` in Agents or the item topic reaches one live verifier: the previous verifier, otherwise a free holder. The outcome\'s `resolvedTo` names that session. If none is eligible, `queued` waits for the next free verifier; the hub delivers automatically and sends the lead an assignment or refusal notice. Wait instead of resending. With none live, report the staffing blocker so one can be launched.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { ...sendToSchema, description: 'string | string[]: one recipient string or an array of strings. Session names, globs, roles, `all` or `lead T-<n>` (the nearest lead up the open item chain, skipping the sender’s own claims, then the Coordinator; a closed item has no lead and resolves to the Coordinator); omit or use [] to write to the human. Malformed values are validation errors.' },
        text: { type: 'string', description: 'The message' },
        kind: { type: 'string', enum: SEND_KINDS, description: 'progress waits for the next turn in a digest; report (default), question and decision start a turn' },
        request: { type: 'string', enum: ['review', 'qa', 'handover'], description: 'Required with kind request, addressed only to the human; any session may send one' },
        subject: { type: 'string', description: 'Required with kind request: a known item (T-n), artifact (A-n) or session name' },
        artifacts: { type: 'array', items: { type: 'string' }, description: 'Artifact ids in this topic to attach; deliveries carry their durable paths' },
        topic: { type: 'string', description: 'The topic id (the `topic` of the event being answered); default General for the human, Agents between sessions' },
        reply_to: { type: 'string', description: 'msg_id of the event being answered' },
      },
      required: ['text'],
    },
  },
  {
    name: 'subscribe',
    description: "Receive hub events about sessions, items, topics, roles or subtrees; turn digests are default, now steers where supported. Returns a durable caller-owned subscription; repeated identical requests return the same id.",
    inputSchema: { type: 'object', properties: {
      subject: { type: 'object', oneOf: [
        { properties: { session: { type: 'string' } }, required: ['session'], additionalProperties: false },
        ...['item', 'topic', 'role', 'subtree'].map(key => ({ properties: { [key]: { type: 'string' } }, required: [key], additionalProperties: false })),
      ] },
      events: { type: 'array', items: { type: 'string', enum: ['session.state', 'task', 'topic', 'usage', 'artifact'] }, minItems: 1 },
      digest: { type: 'string', enum: ['turn', 'now'] },
      threshold: { type: 'object', oneOf: ['cost', 'tokens'].map(key => ({ properties: { [key]: { type: 'number', exclusiveMinimum: 0 } }, required: [key], additionalProperties: false })) },
    }, required: ['subject', 'events'] },
  },
  {
    name: 'unsubscribe',
    description: 'Remove one of your subscriptions. Stops future events; already recorded deliveries remain queued for the next turn.',
    inputSchema: { type: 'object', properties: { subscription: { type: 'string' } }, required: ['subscription'] },
  },
  {
    name: 'subscriptions',
    description: 'List your durable event subscriptions.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'topic.create',
    description:
      "Open a topic: the Coordinator any topic, an Implementer only one bound to its own item (Reviewer and QA open none; questions for the human go to the Coordinator with send). A title is required; `item` binds it to a unit of work (T-12), which has one topic at most. The topic shows in the human's list with its first message: write into it with send(topic).",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What the topic is about' },
        item: { type: 'string', description: 'The item it is bound to (T-12); omit for an unbound topic' },
      },
      required: ['title'],
    },
  },
  {
    name: 'resolve',
    description: "Clear a topic's wait (waiting for agent, waiting for human) back to open, when nothing in it waits any more. The Coordinator's tool.",
    inputSchema: { type: 'object', properties: { topic: { type: 'string', description: 'The topic id' } }, required: ['topic'] },
  },
  { name: 'ask.forward', description: 'Forward an incoming open question unchanged to the next lead; the Coordinator forwards it to the human. Pass the delivered msg_id. The hub preserves its topic and question.', inputSchema: { type: 'object', properties: { ask: { type: 'string' } }, required: ['ask'] } },
  { name: 'ask.answer', description: 'Answer an incoming open question locally. Pass the delivered msg_id and answer text; the reply carries answer_to and settles the waiting state. A forwarded question waits for its upstream answer first.', inputSchema: { type: 'object', properties: { ask: { type: 'string' }, text: { type: 'string' } }, required: ['ask', 'text'] } },
  {
    name: 'ask',
    description:
      "Ask the human a question in a topic (the Coordinator only): numbered options (at most 9; the human answers with a key) and, unless `free` is false, room for a free answer. The topic waits for the human until the answer arrives as an event with `answer_to` set to this ask's id (and from_kind=\"human\"). `resolve` on the topic withdraws open asks; closing the topic cancels them. Several asks may be open at once.",
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'The topic id to ask in (General is `general`)' },
        question: { type: 'string', description: 'The question, self-contained' },
        options: { type: 'array', items: { type: 'string' }, default: [], description: 'The options, one line each, in order (1 first); defaults to [] when only a free answer fits' },
        free: { type: 'boolean', description: 'Whether a free answer is welcome beside the options (default true)' },
      },
      required: ['topic', 'question'],
    },
  },
  {
    name: 'who',
    description: 'List the sessions connected to the hub: name, role, status, connected since.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'status',
    description: 'Set the one line other sessions and the human see about you in who().',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'Your status line (≤ 200 chars)' } }, required: ['text'] },
  },
  {
    name: 'rename',
    description: 'Take another name (the Coordinator only: names never change for other roles). Lowercase letters, digits, hyphens, 1–24 chars; reserved: all, hub and the role names; a name another live session holds is refused.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'session.archive',
    description: 'Archive a stopped or exited session; a live session must be stopped first. The journal is retained.',
    inputSchema: { type: 'object', properties: { session: { type: 'string' } }, required: ['session'] },
  },
  {
    name: 'session.prune',
    description: 'Delete archived session records older than a stop-age duration (1s, 1m, 1h, 1d). dryRun lists names without deleting. Journal and traffic are retained.',
    inputSchema: { type: 'object', properties: { olderThan: { type: 'string' }, dryRun: { type: 'boolean' } }, required: ['olderThan'] },
  },
  {
    name: 'session.launch',
    description:
      'Launch a new harness session through the hub (its process runs in the background; the human attaches to it from the UI). Returns the session with its state and the command that attaches a terminal to it.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The new session\'s name (lowercase letters, digits, hyphens)' },
        role: { type: 'string', description: 'The role it runs under (coordinator, lead, implementer, reviewer, qa, aide); its launch defaults in .cland/roles.toml fill the harness, model, effort and account not given' },
        model: { type: 'string', description: "The model; the role's default, else the harness's, when absent" },
        harness: { type: 'string', description: "The harness (`claude-code`, `opencode`, `codex`); the role's default, else `claude-code`, when absent" },
        account: { type: 'string', description: 'Account name from accounts.toml; overrides the role account and selects its harness when harness is absent' },
        effort: { type: 'string', description: "The reasoning effort (Claude Code: low … max); the role's default when absent" },
        cwd: { type: 'string', description: 'The working directory: absolute or relative to the project root; the project root when absent' },
        item: { type: 'string', description: "A Lead's open container (at the project root), or an Implementer, Reviewer or QA item (T-12). Task worktrees are prepared first; Implementers take the claim, verifiers leave it intact. A calling Lead must name an item in its subtree. Not with cwd" },
        brief: { type: 'string', description: 'The first task: text, or an artifact id A-<n> whose content is read at launch. Delivered once after the role clause; never repeated on reconnect' },
      },
      required: ['name'],
    },
  },
  {
    name: 'history',
    description: 'Your recent traffic on the hub (sent by you or addressed to you), oldest first — what you missed while restarting. Up to 50. With topic: Agents accepts item and session filters over the whole record; both intersect.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many, at most 50 (default 50)' },
        with: { type: 'string', description: 'Only messages exchanged with this session' },
        item: { type: 'string', description: 'On Agents: an item id (T-12); notices naming it or its bound topic' },
        session: { type: 'string', description: 'On Agents: traffic from, to or about this session; intersects item when both are given' },
        topic: { type: 'string', description: "A topic id: that topic's latest messages instead of your own traffic (the topics `role.state` lists as waiting)" },
      },
    },
  },
  {
    name: 'role.handover',
    description:
      'Hand your Coordinator role or your claimed Lead node to another session, live or launched, with a handover note: the next holder continues from the note and the hub, never from your transcript. The note needs four non-empty sections: goals now, work in flight, open decisions, waiting on (an object with those keys, or Markdown with those headings; the `handover` skill drafts it). The role moves at once; a Lead receiver must be unclaimed, and its node claim and default subscriptions follow the note, and you get a "role revoked" event: from then on stop acting in the role.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'The session that takes the role' },
        note: {
          description: 'The handover note: { goals_now, work_in_flight, open_decisions, waiting_on }, or Markdown with the headings "Goals now", "Work in flight", "Open decisions", "Waiting on"',
          anyOf: [
            { type: 'string' },
            {
              type: 'object',
              properties: { goals_now: { type: 'string' }, work_in_flight: { type: 'string' }, open_decisions: { type: 'string' }, waiting_on: { type: 'string' } },
              required: ['goals_now', 'work_in_flight', 'open_decisions', 'waiting_on'],
            },
          ],
        },
        then: { type: 'string', enum: ['implementer'], description: 'Stay on as an Implementer instead of keeping no role' },
      },
      required: ['to', 'note'],
    },
  },
  {
    name: 'role.state',
    description:
      "Your role's state as the hub keeps it: the latest handover note, the topics waiting for the role (read one with `history` and its `topic`), the open asks, and the tracker claims you hold. Pull it when you take over a role.",
    inputSchema: { type: 'object', properties: {} },
  },
] as const;

export const TOOLS = [...BASE_TOOLS, ...TASK_TOOLS, ...RULE_TOOLS] as const;
