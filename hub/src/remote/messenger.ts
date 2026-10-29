import type { Artifact } from '../protocol.ts';
import { DiscordApi } from './discord-api.ts';
import { DiscordRemote } from './discord.ts';
import type { MessengerFactory } from './configuration.ts';
import type { Clock } from '../hub/clock.ts';
import type { RemoteRedactor } from './redact.ts';
import { TelegramApi } from './telegram-api.ts';
import type { RemoteState } from './state.ts';
import type { LogFn } from '../log.ts';
import { TelegramRemote } from './telegram.ts';

/** Resolve platform roots from the daemon's environment, never a session's frames. */
export function messengerFactory(env: NodeJS.ProcessEnv, redactor: RemoteRedactor, clock: Clock, persistence?: {
  files?: { root: string; artifact: (id: string) => Artifact | null } | undefined;
  discordNotice?: (cause: string, fix: string, transition?: boolean) => void;
  maxUploadMb?: () => number; state: RemoteState; log?: LogFn; projectName?: () => string; webOrigin?: () => string; notice?: (cause: string, fix: string, transition?: boolean) => void;
}): MessengerFactory {
  return (via, token, settings, speech) => {
    if (via === 'discord') return new DiscordRemote(new DiscordApi(token, { redactor, clock,
      ...(env.CLAND_DISCORD_API_ROOT !== undefined ? { apiRoot: env.CLAND_DISCORD_API_ROOT } : {}),
    }), token, clock, { media: { redact: redactor, speech, speechSettings: settings.speech, maxUploadMb: persistence?.maxUploadMb, fakeRoot: env.CLAND_DISCORD_API_ROOT }, fake: env.CLAND_DISCORD_API_ROOT !== undefined,
      ...(persistence ? { store: persistence.state.forMessenger('discord'), projectName: persistence.projectName, webOrigin: persistence.webOrigin, log: entry => persistence.log?.(redactor.value(entry)), notice: persistence.discordNotice } : {}),
    });
    return new TelegramRemote(new TelegramApi(token, { redactor, clock,
      ...(env.CLAND_TELEGRAM_API_ROOT !== undefined ? { apiRoot: env.CLAND_TELEGRAM_API_ROOT } : {}),
    }), clock, persistence ? { redact: redactor, speech, speechSettings: settings.speech, store: persistence.state.forMessenger('telegram'), files: persistence.files, maxUploadMb: persistence.maxUploadMb, ...(persistence.log ? { log: persistence.log } : {}),
      ...(persistence.projectName ? { projectName: persistence.projectName } : {}),
      ...(persistence.webOrigin ? { webOrigin: persistence.webOrigin } : {}),
      ...(persistence.notice ? { notice: persistence.notice } : {}),
    } : undefined, { format: settings.remote.telegram.format });
  };
}
