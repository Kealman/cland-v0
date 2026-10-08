// The topic model (spec 4.5, decision #7): how a topic's status follows what happens in it, how a human
// message finds its addressees in the text, and the port to the tracker a binding goes through. Pure: the
// core (`./core.ts`) applies it and the store (`./store.ts`) keeps it.
import type { TopicStatus } from '../protocol.ts';
import { parseTags } from '../address.ts';
import { ROLE_NAMES } from '../names.ts';
import type { Tracker } from '../tracker/tracker.ts';

/**
 * What moves a topic's status:
 * - `human`: the human wrote (to anyone) — the topic waits for an agent;
 * - `to-human`: an agent wrote to the human — the topic is open again, unless it waits for the human (an ask, #33);
 * - `reply`: an agent the human's latest message addressed wrote in the topic to others — that wait is answered;
 * - `between-agents`: any other agent message in the topic — only a closed topic reopens;
 * - `ask`: an agent asked the human (#33);
 * - `resolve`: the wait is cleared, by the Coordinator (the `resolve` tool) or the human (`topic.resolve`);
 * - `close`: the human closed it, or its item closed.
 */
export type TopicMove = 'human' | 'to-human' | 'reply' | 'between-agents' | 'ask' | 'resolve' | 'close';

export class TopicRefusal extends Error {}

/** The status after `move`; a `resolve` of a closed topic is refused (a new message reopens it). */
export function nextStatus(current: TopicStatus, move: TopicMove): TopicStatus {
  switch (move) {
    case 'human':
      return 'waiting for agent';
    case 'to-human':
      return current === 'waiting for human' ? current : 'open';
    case 'reply':
      return current === 'waiting for agent' || current === 'closed' ? 'open' : current;
    case 'between-agents':
      return current === 'closed' ? 'open' : current;
    case 'ask':
      return 'waiting for human';
    case 'resolve':
      if (current === 'closed') throw new TopicRefusal('the topic is closed: a new message reopens it');
      return 'open';
    case 'close':
      return 'closed';
  }
}

/**
 * The addresses a human message names in its text (spec 4.5): `@<role>` (coordinator, implementer, reviewer,
 * qa) and `@<session-name>`. No `@all` and no globs for the human in v0: those stay text. `known` tells whether a
 * name is a session the hub knows; a tag that is neither is returned in `unknown` (it addresses nobody).
 */
export function mentions(text: string, known: (name: string) => boolean): { to: string[]; unknown: string[] } {
  const to: string[] = [];
  const unknown: string[] = [];
  for (const tag of parseTags(text)) {
    if (tag.toLowerCase() === 'all' || tag.includes('*')) continue;
    if (ROLE_NAMES.includes(tag) || known(tag)) to.push(tag);
    else unknown.push(tag);
  }
  return { to, unknown };
}

/** The warning a topic shows while a message in it waits for a role nobody holds: `no coordinator`. */
export function vacancyWarning(roles: string[]): string | undefined {
  const sorted = [...new Set(roles)].sort((a, b) => ROLE_NAMES.indexOf(a) - ROLE_NAMES.indexOf(b));
  return sorted.length ? sorted.map((r) => `no ${r}`).join(', ') : undefined;
}

/**
 * The tracker as a topic's binding sees it. A hub with no project has none, and refuses a binding.
 */
export type TopicItems = {
  /** The item's normalized id (`T-12`), with the topic its file names (or null); throws why it cannot be bound. */
  check: (item: string) => { id: string; topic: string | null; state: string };
  /** Record the binding in the item's file (`topic:`), through the tracker. */
  bind: (item: string, topic: string) => void;
};

/** The tracker behind a topic's binding: an item is checked by its file, and the binding written into it by the hub. */
export function trackerItems(tracker: Tracker): TopicItems {
  const hub = { id: 'hub', name: 'hub', role: null };
  return {
    check: (item) => {
      const view = tracker.view(item);
      return { id: view.id, topic: view.topic ?? null, state: view.state };
    },
    bind: (item, topic) => void tracker.link(hub, item, { topic }),
  };
}
