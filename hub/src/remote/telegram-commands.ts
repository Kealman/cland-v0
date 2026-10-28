import { statusReply, helpReply, type PhoneReply } from './replies.ts';
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

/** Telegram alone escapes and renders the neutral facts. */
function renderReply(reply: PhoneReply): CommandReply {
  let markdown = '';
  for (const group of reply.groups) markdown += `\n\n**${literal(group.label)}**\n${group.lines.map(literal).join('\n')}`;
  for (const line of reply.small) markdown += `\n\n*${literal(line)}*`;
  return { title: reply.title, markdown };
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
  return renderReply(helpReply(project, { groups: [
    { label: 'Follow', lines: ['General messages arrive here.', 'Asks arrive as cards; tap an option to answer.', 'Other answer… and Decline… open a reply prompt. /cancel keeps the ask open.', '/inbox re-sends open cards and notices oldest first. Earlier cards keep working.'] },
    { label: 'Send', lines: ['Write to the Coordinator, reply to a mirrored message, or answer an ask card.', '📥 request and item-message replies keep their topic; plan and terminal-approval replies go to General with a reference.', 'Plans are approved in the workbench; terminal approvals in their terminal.', 'Late messages stay in General; reply to a card to answer its open ask.', 'Use /decision or /question before your text.'] },
    { label: 'Commands', lines: TELEGRAM_COMMANDS.map(({ command, description }) => `• /${command}${['decision', 'question'].includes(command) ? ' <text>' : ''}: ${description}`) },
  ], small: ['Only the paired Telegram user in this private chat can act.', 'Pairing is approved locally. Session, release and configuration controls stay in the workbench.'] }));
}

export function telegramCommand(text: string | undefined): string | null {
  const match = /^\/(status|inbox|help|cancel)(?:@[A-Za-z0-9_]+)?\s*$/.exec(text ?? '');
  return match?.[1] ?? null;
}

export function telegramStatus(project: string, status: import('../protocol.ts').HubStatus,
  releases: Array<{ id: string; title: string }>, state: { connected: boolean; muted: boolean; outbox: number }): CommandReply {
  return renderReply(statusReply(project, status, releases, { ...state, label: 'This chat' }));
}
