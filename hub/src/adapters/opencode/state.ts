// One OpenCode session's state, derived from the server's event stream (research `harness-surfaces` §3.1;
// observed with opencode v2.0.24). The server reports only whether a session's agent loop runs:
//
//   session.execution.started                          → running (busy)
//   session.execution.succeeded | failed | interrupted → not running (idle); what was pending ends with it
//   permission.asked {id, sessionID}                   → a pending approval: `waiting for approval`
//   permission.replied {requestID, sessionID}          → that approval is answered
//   form.created {form: {id, sessionID}}               → a pending form (the `question` tool): `waiting for human`
//   form.replied | form.cancelled {id, sessionID}      → that form is closed
//   session.step.started {model}, session.step.ended {tokens, cost} → the model and one message's usage
//
// "Waiting" is not a status of the server: it is running plus a pending request, so both waiting states are
// heuristic. A pending approval outranks a pending form, which outranks running.
import type { SessionState } from '../../protocol.ts';
import { formatModel, type ModelRef, type PermissionRequest, type ServerEvent } from './client.ts';
import { turnError } from '../turn-error.ts';

export type Usage = { model?: string; inputTokens: number; outputTokens: number; reasoningTokens: number; cacheReadTokens: number; cacheWriteTokens: number; cost: number };

export type Change = { state?: SessionState; approvalCommand?: string; usage?: Usage; model?: string; ended?: true; turnError?: string };

type PendingPermission = { id: string; approvalCommand: string | undefined };

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export class SessionTracker {
  readonly sessionId: string;
  running = false;
  readonly permissions = new Map<string, PendingPermission>();
  readonly forms = new Set<string>();
  model: string | undefined;
  #last: SessionState | null = null;
  #lastCommand: string | undefined;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  state(): SessionState {
    if (this.permissions.size) return 'waiting for approval';
    if (this.forms.size) return 'waiting for human';
    return this.running ? 'busy' : 'idle';
  }

  /** Replace what is known with a snapshot the server gave (after the stream (re)connected). */
  reset(snapshot: { running: boolean; permissions: PermissionRequest[]; forms: string[] }): Change {
    this.running = snapshot.running;
    this.permissions.clear();
    this.forms.clear();
    for (const permission of snapshot.permissions) this.#permission(permission);
    for (const id of snapshot.forms) this.forms.add(id);
    return this.#emit(true);
  }

  /** The stream ended: nothing is known until it is back. */
  forget(): void {
    this.#last = null;
    this.permissions.clear();
  }

  /** A late message lookup cannot describe an answered request or a new waiting episode. */
  describePermission(pending: PendingPermission, command: string | undefined): Change {
    if (this.permissions.get(pending.id) !== pending) return {};
    pending.approvalCommand = command;
    return this.#emit();
  }

  #permission(permission: PermissionRequest): void {
    this.permissions.set(permission.id, { id: permission.id, approvalCommand: str(permission.action) });
  }

  /** Apply one event; the change it makes, if any (a state only when it differs from the last one emitted). */
  apply(e: ServerEvent): Change {
    const d = e.data ?? {};
    const form = typeof d.form === 'object' && d.form !== null ? (d.form as Record<string, unknown>) : undefined;
    const sid = str(d.sessionID) ?? str(form?.sessionID);
    if (sid !== this.sessionId) return {};
    switch (e.type) {
      case 'session.execution.started':
        this.running = true;
        return this.#emit();
      case 'session.execution.succeeded':
      case 'session.execution.failed':
      case 'session.execution.interrupted':
        this.running = false;
        this.permissions.clear();
        this.forms.clear();
        return { ...this.#emit(), ended: true, ...(e.type === 'session.execution.failed' ? { turnError: turnError(d.error) } : {}) };
      case 'permission.asked': {
        const id = str(d.id);
        if (id) this.#permission({ ...d, id });
        return this.#emit();
      }
      case 'permission.replied': {
        const id = str(d.requestID) ?? str(d.id);
        if (id) this.permissions.delete(id);
        // `reject` rejects every other pending request of the session too (OpenAPI)
        if (d.reply === 'reject') this.permissions.clear();
        return this.#emit();
      }
      case 'form.created': {
        const id = str(form?.id) ?? str(d.id);
        if (id) this.forms.add(id);
        return this.#emit();
      }
      case 'form.replied':
      case 'form.cancelled': {
        const id = str(d.id) ?? str(d.formID) ?? str(form?.id);
        if (id) this.forms.delete(id);
        return this.#emit();
      }
      case 'session.step.started': {
        const m = d.model as ModelRef | undefined;
        if (m && typeof m.id === 'string' && typeof m.providerID === 'string') this.model = formatModel(m);
        return this.model ? { model: this.model } : {};
      }
      case 'session.step.ended': {
        const t = (typeof d.tokens === 'object' && d.tokens !== null ? d.tokens : {}) as Record<string, unknown>;
        const cache = (typeof t.cache === 'object' && t.cache !== null ? t.cache : {}) as Record<string, unknown>;
        const usage: Usage = {
          ...(this.model ? { model: this.model } : {}),
          inputTokens: num(t.input),
          outputTokens: num(t.output),
          reasoningTokens: num(t.reasoning),
          cacheReadTokens: num(cache.read),
          cacheWriteTokens: num(cache.write),
          cost: num(d.cost),
        };
        return { usage };
      }
      default:
        return {};
    }
  }

  #emit(always = false): Change {
    const state = this.state();
    const approvalCommand = this.permissions.values().next().value?.approvalCommand;
    if (!always && state === this.#last && approvalCommand === this.#lastCommand) return {};
    this.#last = state;
    this.#lastCommand = approvalCommand;
    return { state, ...(approvalCommand !== undefined ? { approvalCommand } : {}) };
  }
}
