export type ReplyGroup = { label: string; lines: readonly string[] };
export type PhoneReply = { title: string; groups: ReplyGroup[]; small: string[] };

class ReplyBuilder {
  readonly model: PhoneReply;
  constructor(title: string) { this.model = { title, groups: [], small: [] }; }
  group(label: string, lines: readonly string[]): this { this.model.groups.push({ label, lines }); return this; }
  small(lines: string[]): this { this.model.small.push(...lines); return this; }
}

export function helpReply(project: string, sections: { groups: ReplyGroup[]; small: string[] }): PhoneReply {
  return { title: `${project} — Help`, groups: sections.groups, small: sections.small };
}

export function statusReply(project: string, status: import('../protocol.ts').HubStatus,
  releases: Array<{ id: string; title: string }>, state: { connected: boolean; muted: boolean; outbox: number; label: 'This chat' | 'This channel'; extra?: string[] }): PhoneReply {
  const minutes = Math.floor(status.uptimeMs / 60_000);
  const uptime = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  const sessions = status.sessions.slice(0, 6).map(session => `• ${session.label ?? session.name}: ${session.state}`);
  const queue = status.verification;
  const holder = queue?.holder;
  return new ReplyBuilder(`${project} — Status`)
    .group('Hub', [`Version ${status.version}`, `Up ${uptime}`])
    .group('Coordinator', [status.coordinator ?? 'None', `Needs you: ${status.needsYou ?? 0}`])
    .group(`Sessions (${status.sessions.length})`, sessions.length ? [...sessions,
      ...(status.sessions.length > 6 ? [`${status.sessions.length - 6} more session${status.sessions.length === 7 ? '' : 's'}`] : [])] : ['None'])
    .group('Queues', [`Verification: ${holder ? `running ${holder.item ?? holder.session ?? holder.kind}` : 'idle'}`,
      `Waiting: ${queue?.waiters.length ?? 0}`, `Merge queue: ${status.mergeQueue?.length ?? 0}`])
    .group('Release', releases.length ? releases.map(release => `${release.id} ${release.title}`) : ['None open'])
    .group(state.label, [state.connected ? 'Connected' : 'Disconnected', state.muted ? 'General muted' : 'General on'])
    .small([`Outbox: ${state.outbox}`, ...(state.extra ?? [])]).model;
}
