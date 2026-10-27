import { markdownToEntities, plainParts, type Formatted } from './telegram-render.ts';
import type { TgBotCommand } from './telegram-api.ts';

/** One private-chat menu, reconciled with Telegram rather than a local cache. */
export const TELEGRAM_COMMANDS: readonly TgBotCommand[] = [
  { command: 'status', description: 'Hub, sessions and queues' },
  { command: 'inbox', description: 'Re-send open cards and notices' },
  { command: 'mute', description: 'Mute the General stream' },
  { command: 'unmute', description: 'Resume the General stream' },
  { command: 'decision', description: 'Send a decision' },
  { command: 'question', description: 'Ask a question' },
  { command: 'cancel', description: 'Cancel an answer; keep the ask open' },
  { command: 'help', description: 'Commands and trust' },
  { command: 'start', description: 'Pair or show the project' },
];

export type CommandReply = { title: string; markdown: string };
const literal = (text: string): string => text.replace(/[\\`*_{}[\]()#+\-.!|~>]/g, '\\$&');

/** Escape each fact before adding the reply's own formatting. */
class PhoneReply implements CommandReply {
  readonly title: string;
  markdown = '';
  constructor(title: string) { this.title = title; }
  group(label: string, lines: readonly string[]): this {
    this.markdown += `\n\n**${literal(label)}**\n${lines.map(literal).join('\n')}`;
    return this;
  }
  small(lines: string[]): this {
    for (const line of lines) this.markdown += `\n\n*${literal(line)}*`;
    return this;
  }
}

export function plainCommandReply(title: string, body?: string): CommandReply {
  return { title, markdown: body === undefined ? '' : `\n\n${literal(body)}` };
}

/** Force the entities renderer even when General uses Rich Messages. */
export function commandParts(reply: CommandReply): Formatted[] {
  const formatted = markdownToEntities(literal(reply.title) + reply.markdown);
  if ([...formatted.text].length <= 4096 && formatted.entities.length <= 100) return [formatted];
  return plainParts(reply.title, reply.markdown);
}

export function telegramHelp(project: string): CommandReply {
  return new PhoneReply(`${project} — Help`)
    .group('Follow', ['General messages arrive here.', 'Asks arrive as cards; tap an option to answer.', 'Other answer… and Decline… open a reply prompt. /cancel keeps the ask open.', '/inbox re-sends open cards and notices oldest first. Earlier cards keep working.'])
    .group('Send', ['Write to the Coordinator, reply to a mirrored message, or answer an ask card.', '📥 request and item-message replies keep their topic; plan and terminal-approval replies go to General with a reference.', 'Plans are approved in the workbench; terminal approvals in their terminal.', 'Late messages stay in General; reply to a card to answer its open ask.', 'Use /decision or /question before your text.'])
    .group('Commands', TELEGRAM_COMMANDS.map(({ command, description }) => `• /${command}${['decision', 'question'].includes(command) ? ' <text>' : ''}: ${description}`))
    .small(['Only the paired Telegram user in this private chat can act.', 'Pairing is approved locally. Session, release and configuration controls stay in the workbench.']);
}

export function telegramCommand(text: string | undefined): string | null {
  const match = /^\/(status|inbox|help|cancel)(?:@[A-Za-z0-9_]+)?\s*$/.exec(text ?? '');
  return match?.[1] ?? null;
}

export function telegramStatus(project: string, status: import('../protocol.ts').HubStatus,
  releases: Array<{ id: string; title: string }>, state: { connected: boolean; muted: boolean; outbox: number }): CommandReply {
  const minutes = Math.floor(status.uptimeMs / 60_000);
  const uptime = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  const sessions = status.sessions.slice(0, 6).map(session => `• ${session.label ?? session.name}: ${session.state}`);
  const queue = status.verification;
  const holder = queue?.holder;
  return new PhoneReply(`${project} — Status`)
    .group('Hub', [`Version ${status.version}`, `Up ${uptime}`])
    .group('Coordinator', [status.coordinator ?? 'None', `Needs you: ${status.needsYou ?? 0}`])
    .group(`Sessions (${status.sessions.length})`, sessions.length ? [...sessions,
      ...(status.sessions.length > 6 ? [`${status.sessions.length - 6} more session${status.sessions.length === 7 ? '' : 's'}`] : [])] : ['None'])
    .group('Queues', [`Verification: ${holder ? `running ${holder.item ?? holder.session ?? holder.kind}` : 'idle'}`,
      `Waiting: ${queue?.waiters.length ?? 0}`, `Merge queue: ${status.mergeQueue?.length ?? 0}`])
    .group('Release', releases.length ? releases.map(release => `${release.id} ${release.title}`) : ['None open'])
    .group('This chat', [state.connected ? 'Connected' : 'Disconnected', state.muted ? 'General muted' : 'General on'])
    .small([`Outbox: ${state.outbox}`]);
}
