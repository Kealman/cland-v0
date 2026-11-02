import type { DatabaseSync } from 'node:sqlite';
import type { Message, Artifact, AnswerAttribution } from '../src/protocol.ts';
type Row = Record<string, string | number | null>;
import { COORDINATOR_RETIRED } from '../src/hub/retirement.ts';
// Frozen pre-T-1628 candidate query. Intentionally independent equivalence oracle.
export const oldInboxQuery = `with latest_messages as materialized (
      select t.id as topic, (select m.seq from messages m where m.topic = t.id
        and m.from_kind = 'agent' and coalesce(m.notice, '') not in ('progress', 'event', 'request')
        and not exists (select 1 from asks a where a.id = m.id)
        order by m.seq desc limit 1) as seq from topics t where t.status = 'waiting for human'
    ), candidates as materialized (
      -- Only unread human-addressed rows after the last same-topic human reply can become messages.
      select m.id from topics t cross join messages m on m.topic = t.id
        and m.seq > max(t.read_seq, coalesce((select max(h.seq) from messages h where h.topic = t.id and h.from_kind = 'human'), 0))
      where (m.from_kind = 'agent' or (m.from_kind = 'hub' and (json_extract(m.notice_detail, '$.event') = 'verification-cleanup-incomplete' or m.notice = '${COORDINATOR_RETIRED}')))
        and coalesce(m.notice, '') not in ('progress', 'event', 'request') and json_array_length(m.to_json) = 0
      union
      select m.id from latest_messages l cross join messages m on m.topic = l.topic and m.seq = l.seq
      union
      -- Requests ignore read watermarks. Even a request replied to before publication must depart once.
      select r.id from messages r where r.notice = 'request'
        and not exists (select 1 from inbox_departures d where d.kind = 'request' and d.id = r.id)
      union
      -- Keep settled waits until list() has recorded their durable departure.
      select w.id from inbox_waits w where w.kind in ('message', 'request')
    ) select m.*, (m.seq <= t.read_seq or exists (select 1 from message_reads r where r.id = m.id)) as was_read,
      json_array_length(m.to_json) = 0 as to_human,
      m.seq = latest.seq as latest,
      (exists (select 1 from messages h where h.topic = m.topic and h.seq > m.seq and h.from_kind = 'human')
        or (m.notice = 'request' and exists (select 1 from messages h where h.reply_to = m.id and h.seq > m.seq and h.from_kind = 'human'))) as replied
      from candidates c cross join messages m on m.id = c.id join topics t on t.id = m.topic
      left join latest_messages latest on latest.topic = m.topic
      where (m.from_kind = 'agent' or (m.from_kind = 'hub' and (json_extract(m.notice_detail, '$.event') = 'verification-cleanup-incomplete' or m.notice = '${COORDINATOR_RETIRED}'))) and coalesce(m.notice, '') not in ('progress', 'event')
        and not exists (select 1 from asks a where a.id = m.id)
        and (json_array_length(m.to_json) = 0 or m.seq = latest.seq
          or exists (select 1 from inbox_waits w where w.id = m.id and w.kind in ('message', 'request')))
      order by m.seq desc`;

const toMessage = (row: Row): Message => ({
  ...(typeof row.request_kind === 'string' ? { request: row.request_kind as NonNullable<Message['request']>, subject: row.request_subject as string } : {}),
  ...(typeof row.artifact === 'string' ? { artifact: JSON.parse(row.artifact) as Artifact } : {}),
  ...(typeof row.artifacts === 'string' ? { artifacts: JSON.parse(row.artifacts) as Artifact[] } : {}),
  ...(typeof row.criteria === 'string' ? { criteria: JSON.parse(row.criteria) as NonNullable<Message['criteria']> } : {}),
  id: row.id as string,
  from: row.from_name as string,
  fromKind: row.from_kind as Message['fromKind'],
  via: row.via as Message['via'],
  to: JSON.parse(row.to_json as string) as string[],
  text: row.text as string,
  ts: row.ts as string,
  ...(row.from_role !== null && row.from_role !== undefined ? { fromRole: row.from_role as string } : {}),
  ...(row.reply_to !== null && row.reply_to !== undefined ? { replyTo: row.reply_to as string } : {}),
  ...(row.topic !== null && row.topic !== undefined ? { topic: row.topic as string } : {}),
  ...(typeof row.notice === 'string' ? { kind: row.notice } : {}),
  ...(typeof row.notice_detail === 'string' ? { detail: JSON.parse(row.notice_detail) as Record<string, unknown> } : {}),
  ...attributionOf(row),
  ...(row.answer_to !== null && row.answer_to !== undefined ? { answerTo: row.answer_to as string } : {}),
});

const attributionOf = (row: Row): Partial<AnswerAttribution> => typeof row.answer_attribution === 'string' ? JSON.parse(row.answer_attribution) as AnswerAttribution : {};

export function oldInboxMessages(db: DatabaseSync) {
  return (db.prepare(oldInboxQuery).all() as Row[]).map(r => ({
    message: { ...toMessage(r), seq: Number(r.seq), topic: r.topic as string },
    read: r.was_read === 1, replied: r.replied === 1, toHuman: r.to_human === 1, latest: r.latest === 1,
  }));
}
