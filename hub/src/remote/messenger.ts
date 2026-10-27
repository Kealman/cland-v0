import type { MessengerFactory } from './configuration.ts';
import type { Clock } from '../hub/clock.ts';
import type { RemoteRedactor } from './redact.ts';
import { TelegramApi } from './telegram-api.ts';
import type { RemoteState } from './state.ts';
import type { LogFn } from '../log.ts';
import { TelegramRemote } from './telegram.ts';

/** Resolve platform roots from the daemon's environment, never a session's frames. */
export function messengerFactory(env: NodeJS.ProcessEnv, redactor: RemoteRedactor, clock: Clock, persistence?: {
  state: RemoteState; log?: LogFn; projectName?: () => string; webOrigin?: () => string; notice?: (cause: string, fix: string, transition?: boolean) => void;
}): MessengerFactory {
  return (via, token, settings) => {
    if (via !== 'telegram') throw new Error('Discord platform client is unavailable; an injected messenger factory is required');
    return new TelegramRemote(new TelegramApi(token, { redactor, clock,
      ...(env.CLAND_TELEGRAM_API_ROOT !== undefined ? { apiRoot: env.CLAND_TELEGRAM_API_ROOT } : {}),
    }), clock, persistence ? { store: persistence.state.forMessenger('telegram'), ...(persistence.log ? { log: persistence.log } : {}),
      ...(persistence.projectName ? { projectName: persistence.projectName } : {}),
      ...(persistence.webOrigin ? { webOrigin: persistence.webOrigin } : {}),
      ...(persistence.notice ? { notice: persistence.notice } : {}),
    } : undefined, { format: settings.remote.telegram.format });
  };
}
