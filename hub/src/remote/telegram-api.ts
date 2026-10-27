import { validateAndRegisterSecrets } from './secrets.ts';
import { remoteRedactor, type RemoteRedactor } from './redact.ts';
import { realClock, type Clock } from '../hub/clock.ts';

export type TgUser = { id: number; is_bot: boolean; first_name: string; username?: string };
export type TgChat = { id: number; type: 'private' | 'group' | 'supergroup' | 'channel' };
export type TgInlineKeyboardButton = { text: string; callback_data: string; style?: 'primary' | 'success' | 'danger' };
export type TgInlineKeyboardMarkup = { inline_keyboard: TgInlineKeyboardButton[][] };
export type TgForceReply = { force_reply: true; input_field_placeholder?: string };
export type TgReplyMarkup = TgInlineKeyboardMarkup | TgForceReply;
export type TgReplyParameters = { message_id: number };
export type TgMessage = {
  message_id: number;
  date: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  entities?: TgEntity[];
  reply_markup?: TgReplyMarkup;
  reply_to_message?: TgMessage;
};
export type TgBotCommand = { command: string; description: string };
export type TgCommandScope = { type: 'all_private_chats' };
export type SetMessageReaction = { chat_id: number | string; message_id: number; reaction: Array<{ type: 'emoji'; emoji: '👌' | '👀' }> };
export type TgEntity = { type: string; offset: number; length: number; url?: string; language?: string };
type SendOptions = { disable_notification?: boolean; link_preview_options?: { is_disabled: boolean } };
export type SendMessage = SendOptions & { chat_id: number | string; text: string; entities?: TgEntity[]; reply_markup?: TgReplyMarkup; reply_parameters?: TgReplyParameters };
export type SendRichMessage = SendOptions & { chat_id: number | string; rich_message: { markdown: string; skip_entity_detection: boolean } };
export type AnswerCallbackQuery = { callback_query_id: string; text?: string; show_alert?: boolean };
export type EditMessageText = { chat_id: number | string; message_id: number; text: string; entities?: TgEntity[]; reply_markup?: TgInlineKeyboardMarkup };
export type TgChatMember = { user: TgUser; status: string; until_date?: number };
export type TgChatMemberUpdated = { chat: TgChat; from: TgUser; date: number; old_chat_member: TgChatMember; new_chat_member: TgChatMember };
export type TgCallbackQuery = { id: string; from: TgUser; message?: TgMessage; data?: string };
export type TgUpdate = { update_id: number; message?: TgMessage; edited_message?: TgMessage; callback_query?: TgCallbackQuery; my_chat_member?: TgChatMemberUpdated };
export type TgUpdateKind = 'message' | 'edited_message' | 'callback_query' | 'my_chat_member';
export type GetUpdates = { offset?: number; timeout: number; allowed_updates: readonly TgUpdateKind[] };
export type TelegramRequestOptions = { signal?: AbortSignal };

export type TelegramApiOptions = { apiRoot?: string; redactor?: RemoteRedactor; clock?: Clock };

/** Only sanitized provider facts leave the client, never a fetch error or its cause. */
export class TelegramError extends Error {
  readonly method: string;
  readonly code: number;
  readonly description: string;
  readonly retryAfter: number | undefined;
  constructor(method: string, code: number, description: string, retryAfter?: number) {
    super(`Telegram ${method} failed: ${code} ${description}`);
    this.name = 'TelegramError';
    this.method = method;
    this.code = code;
    this.description = description;
    this.retryAfter = retryAfter;
  }
}

/** Plain-fetch Bot API boundary. Credential-bearing URLs never leave this class. */
export class TelegramApi {
  readonly #token: string;
  readonly #root: string;
  readonly #redactor: RemoteRedactor;
  readonly #clock: Clock;

  constructor(token: string, options: TelegramApiOptions = {}) {
    this.#redactor = options.redactor ?? remoteRedactor();
    this.#clock = options.clock ?? realClock;
    // Reuse the startup validator, before even parsing the API root.
    validateAndRegisterSecrets({ 'telegram.token': token }, this.#redactor);
    this.#token = token;
    let root: URL;
    try { root = new URL(options.apiRoot ?? 'https://api.telegram.org'); }
    catch { throw new Error('Telegram API root must be an absolute HTTP(S) URL'); }
    const official = root.protocol === 'https:' && root.hostname === 'api.telegram.org';
    const fake = root.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(root.hostname) && !!root.port;
    if ((!official && !fake) || root.username || root.password || root.search || root.hash)
      throw new Error('Telegram API root must be api.telegram.org over HTTPS or an explicit loopback HTTP fake');
    this.#root = root.href.replace(/\/+$/, '');
  }

  getMyCommands(params: { scope: TgCommandScope }, options?: TelegramRequestOptions): Promise<TgBotCommand[]> { return this.#call('getMyCommands', params, options); }
  setMyCommands(params: { scope: TgCommandScope; commands: readonly TgBotCommand[] }, options?: TelegramRequestOptions): Promise<boolean> { return this.#call('setMyCommands', params, options); }
  getMe(options?: TelegramRequestOptions): Promise<TgUser> { return this.#call('getMe', {}, options); }
  setMessageReaction(params: SetMessageReaction, options?: TelegramRequestOptions): Promise<true> { return this.#call('setMessageReaction', params, options); }
  sendMessage(params: SendMessage, options?: TelegramRequestOptions): Promise<TgMessage> { return this.#call('sendMessage', params, options); }
  sendRichMessage(params: SendRichMessage, options?: TelegramRequestOptions): Promise<TgMessage> { return this.#call('sendRichMessage', params, options); }
  answerCallbackQuery(params: AnswerCallbackQuery, options?: TelegramRequestOptions): Promise<true> { return this.#call('answerCallbackQuery', params, options); }
  editMessageText(params: EditMessageText, options?: TelegramRequestOptions): Promise<TgMessage> { return this.#call('editMessageText', params, options); }
  getUpdates(params: GetUpdates, options?: TelegramRequestOptions): Promise<TgUpdate[]> {
    if (!Number.isInteger(params.timeout) || params.timeout < 0 || params.timeout > 50)
      return Promise.reject(new TelegramError('getUpdates', 0, 'poll timeout must be an integer from 0 to 50 seconds'));
    return this.#call('getUpdates', params, options, Math.max(35_000, (params.timeout + 15) * 1_000));
  }

  async #call<T>(method: 'getMe' | 'sendMessage' | 'sendRichMessage' | 'getUpdates' | 'getMyCommands' | 'setMyCommands' | 'setMessageReaction' | 'answerCallbackQuery' | 'editMessageText', params: object, options?: TelegramRequestOptions, timeoutMs = 35_000): Promise<T> {
    const deadline = new AbortController();
    const timer = this.#clock.setTimeout(() => deadline.abort(), timeoutMs);
    timer.unref();
    const signal = options?.signal ? AbortSignal.any([deadline.signal, options.signal]) : deadline.signal;
    try { return await this.#request<T>(method, params, signal); }
    finally { this.#clock.clearTimeout(timer); }
  }

  async #request<T>(method: string, params: object, signal: AbortSignal): Promise<T> {
    let response: Response;
    try {
      // Fetch's global keep-alive pool outlives this remote. Close each HTTP
      // connection so stop can drain the client's resources without a shared dispatcher.
      response = await fetch(`${this.#root}/bot${this.#token}/${method}`, {
        method: 'POST', headers: { 'content-type': 'application/json', connection: 'close' }, body: JSON.stringify(params),
        redirect: 'error', signal,
      });
    } catch {
      throw new TelegramError(method, 0, 'request failed or exceeded its time bound');
    }
    let body: Record<string, unknown>;
    try {
      const value: unknown = await response.json();
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid envelope');
      body = value as Record<string, unknown>;
    }
    catch { throw new TelegramError(method, response.status, 'invalid JSON response'); }
    if (!response.ok || body.ok !== true) {
      const code = typeof body.error_code === 'number' && Number.isInteger(body.error_code) ? body.error_code : response.status;
      const description = typeof body.description === 'string' ? this.#redactor(body.description) : 'no description';
      const parameters = body.parameters as { retry_after?: unknown } | undefined;
      const retryAfter = typeof parameters?.retry_after === 'number' && Number.isFinite(parameters.retry_after) && parameters.retry_after >= 0
        ? parameters.retry_after : undefined;
      throw new TelegramError(method, code, description, retryAfter);
    }
    if (!Object.hasOwn(body, 'result')) throw new TelegramError(method, response.status, 'missing result');
    return body.result as T;
  }
}
